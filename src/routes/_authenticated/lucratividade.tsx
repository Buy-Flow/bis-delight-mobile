import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Package,
  Download,
  Loader2,
  AlertTriangle,
  Flame,
  Receipt,
  Wallet,
  Bike,
  Store,
  ArrowUpDown,
  Search,
  Target,
  Sparkles,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/cart-context";

export const Route = createFileRoute("/_authenticated/lucratividade")({
  head: () => ({
    meta: [
      { title: "Lucratividade — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LucratividadePage,
});

/* ---------------- Types ---------------- */

type OrderRow = {
  id: string;
  mode: "entrega" | "retirada" | string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  coupon_code: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  extras: Array<{ label?: string; price?: number }> | null;
};

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  base_price: number;
  cost_price: number | null;
  packaging_cost: number | null;
};

type PricingCfg = {
  card_fee: number;
  tax: number;
  platform_fee: number;
  fixed_cost: number;
};

type PeriodKey = "hoje" | "7d" | "30d" | "mes" | "ano" | "tudo";

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Mês atual" },
  { id: "ano", label: "Ano" },
  { id: "tudo", label: "Tudo" },
];

/* ---------------- Helpers ---------------- */

function n(v: unknown, def = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
}

function periodRange(p: PeriodKey, firstDate?: Date | null) {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);
  if (p === "hoje") from.setHours(0, 0, 0, 0);
  else if (p === "7d") {
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else if (p === "30d") {
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  } else if (p === "mes") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (p === "ano") from = new Date(now.getFullYear(), 0, 1);
  else {
    from = firstDate ? new Date(firstDate) : new Date(now.getFullYear(), 0, 1);
    from.setHours(0, 0, 0, 0);
  }
  const spanMs = Math.max(1, to.getTime() - from.getTime());
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - spanMs);
  const days = Math.max(1, Math.ceil(spanMs / 86400000));
  return { from, to, prevFrom, prevTo, days };
}

function pctDelta(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

function itemRevenue(it: OrderItemRow) {
  const base = n(it.unit_price) * n(it.quantity);
  const extras = (it.extras ?? []).reduce((s, e) => s + n(e?.price), 0) * n(it.quantity);
  return base + extras;
}

/* ---------------- Page ---------------- */

function LucratividadePage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [loading, setLoading] = useState(true);
  const [firstDate, setFirstDate] = useState<Date | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [prevOrders, setPrevOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [prevItems, setPrevItems] = useState<OrderItemRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cfg, setCfg] = useState<PricingCfg>({
    card_fee: 3.5,
    tax: 0,
    platform_fee: 0,
    fixed_cost: 0,
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"profit_desc" | "profit_asc" | "margin_asc" | "revenue_desc" | "qty_desc">(
    "profit_desc",
  );
  const [statusFilter, setStatusFilter] = useState<"todos" | "lucro" | "prejuizo" | "sem_custo">("todos");

  const range = useMemo(() => periodRange(period, firstDate), [period, firstDate]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data?.created_at) setFirstDate(new Date(data.created_at));
    })();
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [curOrd, prevOrd, prodRes, cfgRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id,mode,subtotal,delivery_fee,total,status,coupon_code,created_at")
            .gte("created_at", range.from.toISOString())
            .lte("created_at", range.to.toISOString()),
          supabase
            .from("orders")
            .select("id,mode,subtotal,delivery_fee,total,status,coupon_code,created_at")
            .gte("created_at", range.prevFrom.toISOString())
            .lte("created_at", range.prevTo.toISOString()),
          supabase
            .from("products")
            .select("id,name,category,image_url,base_price,cost_price,packaging_cost"),
          supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (cancel) return;
        if (curOrd.error) throw curOrd.error;
        if (prodRes.error) throw prodRes.error;
        const ords = (curOrd.data ?? []) as OrderRow[];
        const pords = (prevOrd.data ?? []) as OrderRow[];
        setOrders(ords);
        setPrevOrders(pords);
        setProducts((prodRes.data ?? []) as ProductRow[]);
        if (cfgRes.data) {
          const d = cfgRes.data as Record<string, unknown>;
          setCfg({
            card_fee: n(d.card_fee, 3.5),
            tax: n(d.tax, 0),
            platform_fee: n(d.platform_fee, 0),
            fixed_cost: n(d.fixed_cost, 0),
          });
        }
        // Items
        const paidIds = ords
          .filter((o) => o.status === "pago" || o.status === "entregue" || o.status === "saiu_para_entrega")
          .map((o) => o.id);
        const prevPaidIds = pords
          .filter((o) => o.status === "pago" || o.status === "entregue" || o.status === "saiu_para_entrega")
          .map((o) => o.id);
        const [itRes, prevItRes] = await Promise.all([
          paidIds.length
            ? supabase
                .from("order_items")
                .select("id,order_id,product_id,name,quantity,unit_price,extras")
                .in("order_id", paidIds)
            : Promise.resolve({ data: [], error: null } as { data: OrderItemRow[]; error: null }),
          prevPaidIds.length
            ? supabase
                .from("order_items")
                .select("id,order_id,product_id,name,quantity,unit_price,extras")
                .in("order_id", prevPaidIds)
            : Promise.resolve({ data: [], error: null } as { data: OrderItemRow[]; error: null }),
        ]);
        if (!cancel) {
          setItems(((itRes.data ?? []) as OrderItemRow[]) ?? []);
          setPrevItems(((prevItRes.data ?? []) as OrderItemRow[]) ?? []);
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar lucratividade");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [range.from, range.to, range.prevFrom, range.prevTo]);

  /* -------- Derived -------- */

  const varPct = (n(cfg.card_fee) + n(cfg.tax) + n(cfg.platform_fee)) / 100;

  const productMap = useMemo(() => {
    const m = new Map<string, ProductRow>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const paid = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "pago" || o.status === "entregue" || o.status === "saiu_para_entrega",
      ),
    [orders],
  );
  const prevPaid = useMemo(
    () =>
      prevOrders.filter(
        (o) => o.status === "pago" || o.status === "entregue" || o.status === "saiu_para_entrega",
      ),
    [prevOrders],
  );

  const pl = useMemo(() => {
    const merchRevenue = items.reduce((s, it) => s + itemRevenue(it), 0);
    const deliveryRevenue = paid.reduce((s, o) => s + n(o.delivery_fee), 0);
    const grossRevenue = merchRevenue + deliveryRevenue;
    const cogs = items.reduce((s, it) => {
      const p = it.product_id ? productMap.get(it.product_id) : undefined;
      const unit = n(p?.cost_price) + n(p?.packaging_cost);
      return s + unit * n(it.quantity);
    }, 0);
    const variableFees = grossRevenue * varPct;
    const contribution = merchRevenue - cogs - merchRevenue * varPct; // margem de contribuição (mercadoria)
    const fixedAlloc = (n(cfg.fixed_cost) / 30) * range.days;
    const netProfit = contribution - fixedAlloc;
    const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const orderCount = paid.length;
    const aov = orderCount > 0 ? grossRevenue / orderCount : 0;
    const profitPerOrder = orderCount > 0 ? netProfit / orderCount : 0;
    const cmvPct = merchRevenue > 0 ? (cogs / merchRevenue) * 100 : 0;
    const roi = cogs + fixedAlloc > 0 ? (netProfit / (cogs + fixedAlloc)) * 100 : 0;
    const itemsWithCost = items.filter((it) => {
      const p = it.product_id ? productMap.get(it.product_id) : undefined;
      return n(p?.cost_price) + n(p?.packaging_cost) > 0;
    });
    const coverage =
      items.length > 0 ? (itemsWithCost.length / items.length) * 100 : 0;
    return {
      merchRevenue,
      deliveryRevenue,
      grossRevenue,
      cogs,
      variableFees,
      contribution,
      fixedAlloc,
      netProfit,
      netMargin,
      orderCount,
      aov,
      profitPerOrder,
      cmvPct,
      roi,
      coverage,
    };
  }, [items, paid, productMap, varPct, cfg.fixed_cost, range.days]);

  const prevPl = useMemo(() => {
    const merchRevenue = prevItems.reduce((s, it) => s + itemRevenue(it), 0);
    const deliveryRevenue = prevPaid.reduce((s, o) => s + n(o.delivery_fee), 0);
    const grossRevenue = merchRevenue + deliveryRevenue;
    const cogs = prevItems.reduce((s, it) => {
      const p = it.product_id ? productMap.get(it.product_id) : undefined;
      const unit = n(p?.cost_price) + n(p?.packaging_cost);
      return s + unit * n(it.quantity);
    }, 0);
    const contribution = merchRevenue - cogs - merchRevenue * varPct;
    const fixedAlloc = (n(cfg.fixed_cost) / 30) * range.days;
    const netProfit = contribution - fixedAlloc;
    return { grossRevenue, netProfit, cogs };
  }, [prevItems, prevPaid, productMap, varPct, cfg.fixed_cost, range.days]);

  /* -------- Per product aggregation -------- */

  type ProductAgg = {
    id: string;
    name: string;
    category: string | null;
    image_url: string | null;
    qty: number;
    revenue: number;
    cost: number;
    fees: number;
    profit: number;
    margin: number;
    hasCost: boolean;
  };

  const productAgg = useMemo<ProductAgg[]>(() => {
    const map = new Map<string, ProductAgg>();
    items.forEach((it) => {
      const key = it.product_id ?? `_${it.name}`;
      const p = it.product_id ? productMap.get(it.product_id) : undefined;
      const unitCost = n(p?.cost_price) + n(p?.packaging_cost);
      const rev = itemRevenue(it);
      const qty = n(it.quantity);
      const cost = unitCost * qty;
      const fees = rev * varPct;
      const profit = rev - cost - fees;
      const cur = map.get(key);
      if (cur) {
        cur.qty += qty;
        cur.revenue += rev;
        cur.cost += cost;
        cur.fees += fees;
        cur.profit += profit;
      } else {
        map.set(key, {
          id: key,
          name: p?.name ?? it.name,
          category: p?.category ?? null,
          image_url: p?.image_url ?? null,
          qty,
          revenue: rev,
          cost,
          fees,
          profit,
          margin: 0,
          hasCost: unitCost > 0,
        });
      }
    });
    const arr = Array.from(map.values());
    arr.forEach((a) => {
      a.margin = a.revenue > 0 ? (a.profit / a.revenue) * 100 : 0;
    });
    return arr;
  }, [items, productMap, varPct]);

  const filteredAgg = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = productAgg.filter((a) => (q ? a.name.toLowerCase().includes(q) : true));
    if (statusFilter === "lucro") arr = arr.filter((a) => a.profit > 0);
    else if (statusFilter === "prejuizo") arr = arr.filter((a) => a.hasCost && a.profit < 0);
    else if (statusFilter === "sem_custo") arr = arr.filter((a) => !a.hasCost);
    arr.sort((a, b) => {
      switch (sort) {
        case "profit_desc":
          return b.profit - a.profit;
        case "profit_asc":
          return a.profit - b.profit;
        case "margin_asc":
          return a.margin - b.margin;
        case "revenue_desc":
          return b.revenue - a.revenue;
        case "qty_desc":
          return b.qty - a.qty;
      }
    });
    return arr;
  }, [productAgg, query, sort, statusFilter]);

  /* -------- Category aggregation -------- */

  const categoryAgg = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cost: number; profit: number; qty: number }>();
    productAgg.forEach((p) => {
      const key = p.category ?? "Sem categoria";
      const cur = map.get(key) ?? { name: key, revenue: 0, cost: 0, profit: 0, qty: 0 };
      cur.revenue += p.revenue;
      cur.cost += p.cost;
      cur.profit += p.profit;
      cur.qty += p.qty;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  }, [productAgg]);

  /* -------- Daily series -------- */

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; revenue: number; profit: number; orders: number }>();
    const orderById = new Map(paid.map((o) => [o.id, o]));
    // seed days
    const start = new Date(range.from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      map.set(k, { day: k, revenue: 0, profit: 0, orders: 0 });
    }
    paid.forEach((o) => {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      const rec = map.get(k) ?? { day: k, revenue: 0, profit: 0, orders: 0 };
      rec.orders += 1;
      rec.revenue += n(o.total);
      map.set(k, rec);
    });
    items.forEach((it) => {
      const ord = orderById.get(it.order_id);
      if (!ord) return;
      const p = it.product_id ? productMap.get(it.product_id) : undefined;
      const unitCost = n(p?.cost_price) + n(p?.packaging_cost);
      const rev = itemRevenue(it);
      const qty = n(it.quantity);
      const profit = rev - unitCost * qty - rev * varPct;
      const k = new Date(ord.created_at).toISOString().slice(0, 10);
      const rec = map.get(k)!;
      rec.profit += profit;
    });
    // subtract per-day fixed alloc
    const daysCount = map.size || 1;
    const perDayFixed = pl.fixedAlloc / daysCount;
    map.forEach((rec) => {
      rec.profit -= perDayFixed;
    });
    return Array.from(map.values());
  }, [paid, items, productMap, varPct, range.from, range.to, pl.fixedAlloc]);

  /* -------- Channel breakdown -------- */

  const channel = useMemo(() => {
    const acc = {
      entrega: { revenue: 0, cost: 0, profit: 0, count: 0 },
      retirada: { revenue: 0, cost: 0, profit: 0, count: 0 },
    };
    const orderById = new Map(paid.map((o) => [o.id, o]));
    paid.forEach((o) => {
      const key = o.mode === "retirada" ? "retirada" : "entrega";
      acc[key].revenue += n(o.total);
      acc[key].count += 1;
    });
    items.forEach((it) => {
      const ord = orderById.get(it.order_id);
      if (!ord) return;
      const key = ord.mode === "retirada" ? "retirada" : "entrega";
      const p = it.product_id ? productMap.get(it.product_id) : undefined;
      const unitCost = n(p?.cost_price) + n(p?.packaging_cost);
      const rev = itemRevenue(it);
      acc[key].cost += unitCost * n(it.quantity);
      acc[key].profit += rev - unitCost * n(it.quantity) - rev * varPct;
    });
    return acc;
  }, [paid, items, productMap, varPct]);

  /* -------- Insights -------- */

  const insights = useMemo(() => {
    const list: { level: "danger" | "warn" | "info" | "ok"; text: string }[] = [];
    if (pl.coverage < 60 && items.length > 0)
      list.push({
        level: "warn",
        text: `Apenas ${pl.coverage.toFixed(0)}% dos itens vendidos têm custo cadastrado. Cadastre custos em Precificação para métricas precisas.`,
      });
    const losers = productAgg.filter((p) => p.hasCost && p.profit < 0);
    if (losers.length > 0)
      list.push({
        level: "danger",
        text: `${losers.length} produto(s) estão dando prejuízo. Revise preço ou custo.`,
      });
    if (pl.netMargin < 5 && pl.grossRevenue > 0)
      list.push({
        level: "warn",
        text: `Margem líquida em ${pl.netMargin.toFixed(1)}%. Ideal: acima de 15%.`,
      });
    if (pl.netMargin >= 20)
      list.push({ level: "ok", text: `Margem saudável de ${pl.netMargin.toFixed(1)}%. Continue!` });
    if (pl.fixedAlloc === 0)
      list.push({
        level: "info",
        text: "Cadastre seus custos fixos mensais em Precificação para calcular o lucro líquido real.",
      });
    return list;
  }, [pl, productAgg, items.length]);

  /* -------- CSV export -------- */

  const exportCsv = () => {
    const header = ["Produto", "Categoria", "Qtd", "Receita", "Custo", "Taxas", "Lucro", "Margem %"];
    const rows = filteredAgg.map((p) => [
      p.name,
      p.category ?? "",
      p.qty.toFixed(0),
      p.revenue.toFixed(2),
      p.cost.toFixed(2),
      p.fees.toFixed(2),
      p.profit.toFixed(2),
      p.margin.toFixed(1),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lucratividade_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  /* -------- Render -------- */

  const revenueDelta = pctDelta(pl.grossRevenue, prevPl.grossRevenue);
  const profitDelta = pctDelta(pl.netProfit, prevPl.netProfit);

  const maxDailyRev = Math.max(1, ...daily.map((d) => d.revenue));
  const maxDailyAbsProfit = Math.max(1, ...daily.map((d) => Math.abs(d.profit)));

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.35)]">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Lucratividade</h1>
                <p className="text-xs md:text-sm text-white/50">
                  P&amp;L em tempo real com margem por produto, categoria e canal
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                    period === p.id
                      ? "bg-pink-500 text-white shadow-[0_0_16px_rgba(236,72,153,0.5)]"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-white/50">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Calculando lucratividade...
          </div>
        ) : (
          <>
            {/* Insights */}
            {insights.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {insights.map((it, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl px-4 py-3 border text-sm",
                      it.level === "danger" &&
                        "bg-rose-500/10 border-rose-500/30 text-rose-200",
                      it.level === "warn" &&
                        "bg-amber-500/10 border-amber-500/30 text-amber-200",
                      it.level === "info" &&
                        "bg-sky-500/10 border-sky-500/30 text-sky-200",
                      it.level === "ok" &&
                        "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
                    )}
                  >
                    {it.level === "danger" ? (
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : it.level === "warn" ? (
                      <Flame className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : it.level === "ok" ? (
                      <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span className="leading-snug">{it.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                icon={<Wallet className="h-4 w-4" />}
                label="Receita bruta"
                value={brl(pl.grossRevenue)}
                delta={revenueDelta}
                accent="pink"
              />
              <Kpi
                icon={<PiggyBank className="h-4 w-4" />}
                label="Lucro líquido"
                value={brl(pl.netProfit)}
                delta={profitDelta}
                accent={pl.netProfit >= 0 ? "emerald" : "rose"}
              />
              <Kpi
                icon={<Percent className="h-4 w-4" />}
                label="Margem líquida"
                value={`${pl.netMargin.toFixed(1)}%`}
                sub={`ROI ${pl.roi.toFixed(0)}%`}
                accent={pl.netMargin >= 15 ? "emerald" : pl.netMargin >= 5 ? "amber" : "rose"}
              />
              <Kpi
                icon={<Target className="h-4 w-4" />}
                label="Lucro/pedido"
                value={brl(pl.profitPerOrder)}
                sub={`${pl.orderCount} pedidos`}
                accent="fuchsia"
              />
            </div>

            {/* P&L waterfall */}
            <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-pink-400" /> Demonstrativo (P&amp;L)
                </h2>
                <span className="text-[11px] text-white/40">Período com {range.days} dia(s)</span>
              </div>
              <div className="space-y-2">
                <PLRow
                  label="Receita mercadoria"
                  value={pl.merchRevenue}
                  base={pl.grossRevenue}
                  tone="revenue"
                />
                <PLRow
                  label="+ Taxa de entrega"
                  value={pl.deliveryRevenue}
                  base={pl.grossRevenue}
                  tone="revenue"
                />
                <PLRow label="= Receita bruta" value={pl.grossRevenue} base={pl.grossRevenue} tone="total" />
                <PLRow
                  label={`− CMV (${pl.cmvPct.toFixed(1)}% da mercadoria)`}
                  value={-pl.cogs}
                  base={pl.grossRevenue}
                  tone="cost"
                />
                <PLRow
                  label={`− Taxas variáveis (${(varPct * 100).toFixed(2)}%)`}
                  value={-pl.grossRevenue * varPct}
                  base={pl.grossRevenue}
                  tone="cost"
                />
                <PLRow
                  label="= Margem de contribuição"
                  value={pl.contribution}
                  base={pl.grossRevenue}
                  tone="mid"
                />
                <PLRow
                  label={`− Custos fixos alocados (${range.days}d)`}
                  value={-pl.fixedAlloc}
                  base={pl.grossRevenue}
                  tone="cost"
                />
                <PLRow
                  label="= Lucro líquido"
                  value={pl.netProfit}
                  base={pl.grossRevenue}
                  tone="final"
                />
              </div>
            </section>

            {/* Chart + Channel */}
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> Evolução diária
                  </h2>
                  <div className="flex items-center gap-3 text-[11px] text-white/50">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-pink-500" /> Receita
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Lucro
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-40">
                  {daily.map((d) => {
                    const revH = (d.revenue / maxDailyRev) * 100;
                    const profH = (Math.abs(d.profit) / maxDailyAbsProfit) * 100;
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className="w-full flex items-end gap-0.5 h-full">
                          <div
                            className="flex-1 rounded-t bg-gradient-to-t from-pink-500/70 to-pink-400"
                            style={{ height: `${revH}%` }}
                          />
                          <div
                            className={cn(
                              "flex-1 rounded-t",
                              d.profit >= 0
                                ? "bg-gradient-to-t from-emerald-500/70 to-emerald-400"
                                : "bg-gradient-to-t from-rose-500/70 to-rose-400",
                            )}
                            style={{ height: `${profH}%` }}
                          />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition absolute -top-16 left-1/2 -translate-x-1/2 bg-black/95 border border-white/10 rounded-lg px-2 py-1 text-[10px] whitespace-nowrap z-10">
                          <div className="font-semibold">
                            {new Date(d.day).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </div>
                          <div className="text-pink-300">Receita: {brl(d.revenue)}</div>
                          <div className={d.profit >= 0 ? "text-emerald-300" : "text-rose-300"}>
                            Lucro: {brl(d.profit)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-white/40">
                  <span>{new Date(range.from).toLocaleDateString("pt-BR")}</span>
                  <span>{new Date(range.to).toLocaleDateString("pt-BR")}</span>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Package className="h-4 w-4 text-fuchsia-400" /> Por canal
                </h2>
                <div className="space-y-3">
                  <ChannelCard
                    icon={<Bike className="h-4 w-4" />}
                    label="Entrega"
                    data={channel.entrega}
                    total={pl.netProfit}
                  />
                  <ChannelCard
                    icon={<Store className="h-4 w-4" />}
                    label="Retirada"
                    data={channel.retirada}
                    total={pl.netProfit}
                  />
                </div>
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs">
                  <MiniRow label="Ticket médio" value={brl(pl.aov)} />
                  <MiniRow label="CMV médio" value={`${pl.cmvPct.toFixed(1)}%`} />
                  <MiniRow label="Cobertura de custos" value={`${pl.coverage.toFixed(0)}%`} />
                </div>
              </section>
            </div>

            {/* Category performance */}
            {categoryAgg.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-amber-400" /> Lucro por categoria
                </h2>
                <div className="space-y-2">
                  {categoryAgg.map((c) => {
                    const marginPct = c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0;
                    const maxProfit = Math.max(1, ...categoryAgg.map((x) => Math.abs(x.profit)));
                    const w = (Math.abs(c.profit) / maxProfit) * 100;
                    return (
                      <div
                        key={c.name}
                        className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                c.profit >= 0 ? "text-emerald-300" : "text-rose-300",
                              )}
                            >
                              {brl(c.profit)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.profit >= 0
                                  ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                                  : "bg-gradient-to-r from-rose-500 to-rose-300",
                              )}
                              style={{ width: `${w}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-white/45">
                            <span>{c.qty.toFixed(0)} un · Receita {brl(c.revenue)}</span>
                            <span>Margem {marginPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Product table */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" /> Lucro por produto
                  <span className="text-xs font-normal text-white/40">
                    ({filteredAgg.length} itens)
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar produto..."
                      className="pl-8 pr-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs w-48 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="rounded-full bg-white/5 border border-white/10 text-xs py-2 px-3 focus:outline-none"
                  >
                    <option value="todos">Todos</option>
                    <option value="lucro">Lucro</option>
                    <option value="prejuizo">Prejuízo</option>
                    <option value="sem_custo">Sem custo</option>
                  </select>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className="rounded-full bg-white/5 border border-white/10 text-xs py-2 px-3 focus:outline-none"
                  >
                    <option value="profit_desc">Mais lucrativos</option>
                    <option value="profit_asc">Menos lucrativos</option>
                    <option value="margin_asc">Pior margem</option>
                    <option value="revenue_desc">Maior receita</option>
                    <option value="qty_desc">Mais vendidos</option>
                  </select>
                </div>
              </div>

              {filteredAgg.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-sm">
                  Sem dados para o período selecionado.
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-hidden rounded-2xl border border-white/5">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/50">
                        <tr>
                          <th className="text-left px-4 py-3">Produto</th>
                          <th className="text-right px-4 py-3">Qtd</th>
                          <th className="text-right px-4 py-3">Receita</th>
                          <th className="text-right px-4 py-3">Custo</th>
                          <th className="text-right px-4 py-3">Taxas</th>
                          <th className="text-right px-4 py-3">Lucro</th>
                          <th className="text-right px-4 py-3">Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAgg.map((p) => (
                          <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-3">
                                {p.image_url ? (
                                  <img
                                    src={p.image_url}
                                    alt=""
                                    className="h-9 w-9 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-white/30 text-[10px]">
                                    ?
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium truncate max-w-[220px]">{p.name}</div>
                                  <div className="text-[10px] text-white/40">
                                    {p.category ?? "Sem categoria"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right tabular-nums px-4 py-2.5">{p.qty.toFixed(0)}</td>
                            <td className="text-right tabular-nums px-4 py-2.5">{brl(p.revenue)}</td>
                            <td className="text-right tabular-nums px-4 py-2.5 text-white/60">
                              {p.hasCost ? brl(p.cost) : <span className="text-amber-300 text-xs">Sem custo</span>}
                            </td>
                            <td className="text-right tabular-nums px-4 py-2.5 text-white/60">
                              {brl(p.fees)}
                            </td>
                            <td
                              className={cn(
                                "text-right tabular-nums px-4 py-2.5 font-semibold",
                                p.hasCost
                                  ? p.profit >= 0
                                    ? "text-emerald-300"
                                    : "text-rose-300"
                                  : "text-white/40",
                              )}
                            >
                              {p.hasCost ? brl(p.profit) : "—"}
                            </td>
                            <td className="text-right tabular-nums px-4 py-2.5">
                              {p.hasCost ? (
                                <MarginPill pct={p.margin} />
                              ) : (
                                <span className="text-white/30 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden space-y-2">
                    {filteredAgg.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-white/5 bg-white/[0.02] p-3"
                      >
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                          ) : (
                            <div className="h-11 w-11 rounded-xl bg-white/5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-[10px] text-white/40">
                              {p.qty.toFixed(0)} un · {p.category ?? "s/ cat."}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={cn(
                                "font-bold text-sm",
                                p.hasCost
                                  ? p.profit >= 0
                                    ? "text-emerald-300"
                                    : "text-rose-300"
                                  : "text-white/40",
                              )}
                            >
                              {p.hasCost ? brl(p.profit) : "—"}
                            </div>
                            {p.hasCost && <MarginPill pct={p.margin} />}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-white/50">
                          <div>
                            <div className="text-white/30">Receita</div>
                            <div className="text-white/80">{brl(p.revenue)}</div>
                          </div>
                          <div>
                            <div className="text-white/30">Custo</div>
                            <div className="text-white/80">{p.hasCost ? brl(p.cost) : "—"}</div>
                          </div>
                          <div>
                            <div className="text-white/30">Taxas</div>
                            <div className="text-white/80">{brl(p.fees)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <footer className="text-[11px] text-white/30 flex flex-wrap items-center gap-2 pb-8">
              <ArrowUpDown className="h-3 w-3" />
              Cálculos consideram taxas variáveis de {(varPct * 100).toFixed(2)}%. Cadastre custos em{" "}
              <span className="text-pink-300">Precificação</span> para maior precisão.
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function Kpi({
  icon,
  label,
  value,
  sub,
  delta,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  accent: "pink" | "emerald" | "rose" | "amber" | "fuchsia";
}) {
  const accentMap = {
    pink: "from-pink-500/25 to-fuchsia-500/10 border-pink-500/30 text-pink-300",
    emerald: "from-emerald-500/25 to-teal-500/10 border-emerald-500/30 text-emerald-300",
    rose: "from-rose-500/25 to-red-500/10 border-rose-500/30 text-rose-300",
    amber: "from-amber-500/25 to-orange-500/10 border-amber-500/30 text-amber-300",
    fuchsia: "from-fuchsia-500/25 to-purple-500/10 border-fuchsia-500/30 text-fuchsia-300",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 relative overflow-hidden",
        accentMap[accent],
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">{label}</span>
        <div className="opacity-70">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {typeof delta === "number" && (
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums flex items-center gap-0.5",
              delta >= 0 ? "text-emerald-300" : "text-rose-300",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-[11px] text-white/50">{sub}</span>}
      </div>
    </div>
  );
}

function PLRow({
  label,
  value,
  base,
  tone,
}: {
  label: string;
  value: number;
  base: number;
  tone: "revenue" | "cost" | "mid" | "final" | "total";
}) {
  const pct = base !== 0 ? (Math.abs(value) / base) * 100 : 0;
  const isNeg = value < 0;
  const toneClass = {
    revenue: "text-white/80",
    cost: "text-rose-300",
    mid: "text-fuchsia-300 font-semibold",
    total: "text-white font-semibold",
    final:
      value >= 0
        ? "text-emerald-300 font-bold text-base"
        : "text-rose-300 font-bold text-base",
  }[tone];
  const barTone = {
    revenue: "bg-white/20",
    cost: "bg-rose-500/50",
    mid: "bg-fuchsia-500/60",
    total: "bg-white/40",
    final: value >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70",
  }[tone];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2",
        tone === "final" && "bg-white/[0.04] border border-white/10",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("text-sm truncate", toneClass)}>{label}</span>
          <span className={cn("text-sm tabular-nums", toneClass)}>
            {isNeg ? "-" : ""}
            {brl(Math.abs(value))}
          </span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full", barTone)} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
    </div>
  );
}

function ChannelCard({
  icon,
  label,
  data,
  total,
}: {
  icon: React.ReactNode;
  label: string;
  data: { revenue: number; cost: number; profit: number; count: number };
  total: number;
}) {
  const share = total !== 0 ? (data.profit / total) * 100 : 0;
  const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">{icon}</span>
          {label}
        </div>
        <span className="text-[10px] text-white/40">{data.count} pedidos</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            "text-lg font-bold tabular-nums",
            data.profit >= 0 ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {brl(data.profit)}
        </span>
        <span className="text-[11px] text-white/50">
          {margin.toFixed(1)}% margem
        </span>
      </div>
      <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            data.profit >= 0
              ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
              : "bg-gradient-to-r from-rose-500 to-rose-300",
          )}
          style={{ width: `${Math.min(100, Math.abs(share))}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-white/40">
        Receita {brl(data.revenue)} · Custo {brl(data.cost)}
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-white/70">
      <span className="text-white/50">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

function MarginPill({ pct }: { pct: number }) {
  const tone =
    pct >= 20
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : pct >= 5
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone,
      )}
    >
      {pct.toFixed(1)}%
    </span>
  );
}
