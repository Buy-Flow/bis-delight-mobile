import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  Home,
  LogOut,
  Loader2,
  LineChart,
  Users,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Download,
  Wallet,
  Receipt,
  Package,
  ShoppingBag,
  Bike,
  Store,
  Award,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/menu-data";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinanceiroPage,
});

/* ---------------- Types ---------------- */

type OrderRow = {
  id: string;
  user_id: string;
  mode: "entrega" | "retirada";
  customer_name: string;
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

type ProductRow = { id: string; name: string; image_url: string | null };

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

function periodRange(p: PeriodKey): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);
  if (p === "hoje") {
    from.setHours(0, 0, 0, 0);
  } else if (p === "7d") {
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else if (p === "30d") {
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  } else if (p === "mes") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (p === "ano") {
    from = new Date(now.getFullYear(), 0, 1);
  } else {
    from = new Date(2000, 0, 1);
  }
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - spanMs - 1);
  return { from, to, prevFrom, prevTo };
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}h`;
}
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pctDelta(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

/* ---------------- Component ---------------- */

function FinanceiroPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [prevOrders, setPrevOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const range = useMemo(() => periodRange(period), [period]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [curRes, prevRes, prodRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id,user_id,mode,customer_name,subtotal,delivery_fee,total,status,coupon_code,created_at")
            .gte("created_at", range.from.toISOString())
            .lte("created_at", range.to.toISOString())
            .order("created_at", { ascending: true }),
          supabase
            .from("orders")
            .select("id,total,status,created_at")
            .gte("created_at", range.prevFrom.toISOString())
            .lte("created_at", range.prevTo.toISOString()),
          supabase.from("products").select("id,name,image_url"),
        ]);
        if (cancel) return;
        if (curRes.error) throw curRes.error;
        if (prodRes.error) throw prodRes.error;
        const ords = (curRes.data ?? []) as OrderRow[];
        setOrders(ords);
        setPrevOrders((prevRes.data ?? []) as OrderRow[]);
        setProducts((prodRes.data ?? []) as ProductRow[]);
        // Items — fetch for current-range orders only
        if (ords.length > 0) {
          const ids = ords.map((o) => o.id);
          const itRes = await supabase
            .from("order_items")
            .select("id,order_id,product_id,name,quantity,unit_price,extras")
            .in("order_id", ids);
          if (!cancel && !itRes.error) {
            setItems((itRes.data ?? []) as OrderItemRow[]);
          }
        } else {
          setItems([]);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro";
        toast.error(msg);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [period, range.from, range.to, range.prevFrom, range.prevTo]);

  /* ------------- Derived metrics ------------- */

  const paid = useMemo(() => orders.filter((o) => o.status === "pago" || o.status === "entregue"), [orders]);
  const prevPaid = useMemo(
    () => prevOrders.filter((o) => o.status === "pago" || o.status === "entregue"),
    [prevOrders],
  );

  const kpis = useMemo(() => {
    const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    const grossSubtotal = paid.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const delivery = paid.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
    const ordersCount = paid.length;
    const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;
    const uniqueCustomers = new Set(paid.map((o) => o.user_id)).size;
    const cancelled = orders.filter((o) => o.status === "cancelado").length;
    const pending = orders.filter((o) => o.status === "pendente" || o.status === "novo").length;
    const cancelRate = orders.length > 0 ? (cancelled / orders.length) * 100 : 0;
    const prevRevenue = prevPaid.reduce((s, o) => s + Number(o.total || 0), 0);
    const prevCount = prevPaid.length;
    const prevAvg = prevCount > 0 ? prevRevenue / prevCount : 0;
    return {
      revenue,
      grossSubtotal,
      delivery,
      ordersCount,
      avgTicket,
      uniqueCustomers,
      cancelled,
      pending,
      cancelRate,
      deltaRevenue: pctDelta(revenue, prevRevenue),
      deltaOrders: pctDelta(ordersCount, prevCount),
      deltaTicket: pctDelta(avgTicket, prevAvg),
    };
  }, [orders, paid, prevPaid]);

  /* Revenue per day */
  const byDay = useMemo(() => {
    const map = new Map<string, { d: Date; revenue: number; count: number }>();
    // seed days
    const cur = new Date(range.from);
    while (cur <= range.to) {
      const k = cur.toISOString().slice(0, 10);
      map.set(k, { d: new Date(cur), revenue: 0, count: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    for (const o of paid) {
      const k = o.created_at.slice(0, 10);
      const cur = map.get(k);
      if (cur) {
        cur.revenue += Number(o.total || 0);
        cur.count += 1;
      }
    }
    return Array.from(map.values());
  }, [paid, range.from, range.to]);

  /* Products stats */
  const productStats = useMemo(() => {
    const paidIds = new Set(paid.map((o) => o.id));
    const map = new Map<string, { name: string; qty: number; revenue: number; image: string | null }>();
    for (const it of items) {
      if (!paidIds.has(it.order_id)) continue;
      const key = it.product_id ?? it.name;
      const extrasSum = (it.extras ?? []).reduce((s, e) => s + Number(e?.price ?? 0), 0);
      const revenue = (Number(it.unit_price || 0) + extrasSum) * Number(it.quantity || 0);
      const prod = products.find((p) => p.id === it.product_id);
      const cur = map.get(key) ?? {
        name: prod?.name ?? it.name,
        qty: 0,
        revenue: 0,
        image: prod?.image_url ?? null,
      };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += revenue;
      map.set(key, cur);
    }
    const arr = Array.from(map.values());
    const top = [...arr].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const bottom = [...arr].sort((a, b) => a.qty - b.qty).slice(0, 8);
    // Products with zero sales in the period
    const soldKeys = new Set(map.keys());
    const zero = products.filter((p) => !soldKeys.has(p.id)).slice(0, 12);
    return { top, bottom, zero, totalItems: arr.reduce((s, x) => s + x.qty, 0) };
  }, [items, paid, products]);

  /* Modality */
  const modality = useMemo(() => {
    const entrega = paid.filter((o) => o.mode === "entrega");
    const retirada = paid.filter((o) => o.mode === "retirada");
    return {
      entrega: {
        count: entrega.length,
        revenue: entrega.reduce((s, o) => s + Number(o.total || 0), 0),
      },
      retirada: {
        count: retirada.length,
        revenue: retirada.reduce((s, o) => s + Number(o.total || 0), 0),
      },
    };
  }, [paid]);

  /* Hours of day */
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, i) => ({ h: i, count: 0, revenue: 0 }));
    for (const o of paid) {
      const h = new Date(o.created_at).getHours();
      arr[h].count += 1;
      arr[h].revenue += Number(o.total || 0);
    }
    return arr;
  }, [paid]);

  /* Weekdays */
  const byDow = useMemo(() => {
    const arr = Array.from({ length: 7 }, (_, i) => ({ dow: i, count: 0, revenue: 0 }));
    for (const o of paid) {
      const d = new Date(o.created_at).getDay();
      arr[d].count += 1;
      arr[d].revenue += Number(o.total || 0);
    }
    return arr;
  }, [paid]);

  /* Heatmap DoW × Hour */
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const revGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let minH = 23;
    let maxH = 0;
    let peak = { dow: 0, h: 0, count: 0, revenue: 0 };
    for (const o of paid) {
      const d = new Date(o.created_at);
      const dow = d.getDay();
      const h = d.getHours();
      grid[dow][h] += 1;
      revGrid[dow][h] += Number(o.total || 0);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      if (grid[dow][h] > peak.count) peak = { dow, h, count: grid[dow][h], revenue: revGrid[dow][h] };
    }
    if (minH > maxH) {
      minH = 10;
      maxH = 22;
    }
    // pad edges a bit
    minH = Math.max(0, minH - 1);
    maxH = Math.min(23, maxH + 1);
    const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
    const max = Math.max(1, ...grid.flat());
    return { grid, revGrid, hours, max, peak };
  }, [paid]);

  /* Status split */
  const statusSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return Array.from(map.entries());
  }, [orders]);

  /* Coupons */
  const coupons = useMemo(() => {
    const used = paid.filter((o) => o.coupon_code);
    return { count: used.length, revenue: used.reduce((s, o) => s + Number(o.total || 0), 0) };
  }, [paid]);

  /* Export CSV */
  const exportCSV = () => {
    const rows = [
      ["Data", "Cliente", "Modalidade", "Status", "Subtotal", "Entrega", "Total", "Cupom"],
      ...orders.map((o) => [
        new Date(o.created_at).toLocaleString("pt-BR"),
        o.customer_name,
        o.mode,
        o.status,
        String(o.subtotal),
        String(o.delivery_fee),
        String(o.total),
        o.coupon_code ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  /* ---------------- Render ---------------- */

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] px-4 text-white">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-black">Acesso negado</h1>
          <p className="mt-2 text-sm text-white/60">Sua conta não tem permissão de administrador.</p>
          <button onClick={signOut} className="mt-6 rounded-2xl bg-neon-pink px-4 py-2 text-sm font-bold text-white">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.08_300)] text-white">
      <Toaster position="bottom-center" theme="dark" closeButton />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-purple-900/50 bg-[oklch(0.10_0.08_300)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <LineChart className="h-5 w-5 text-neon-yellow" />
            <span
              className="text-xl font-black uppercase text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Financeiro
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              Painel
            </Link>
            <Link
              to="/pedidos"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              <ClipboardList className="h-3.5 w-3.5" /> Pedidos
            </Link>
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              <Users className="h-3.5 w-3.5" /> Clientes
            </Link>
            <Link
              to="/"
              className="hidden items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white sm:inline-flex"
            >
              <Home className="h-3.5 w-3.5" /> Site
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Title + Period */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1
                className="text-4xl font-black uppercase leading-none text-white"
                style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
              >
                Central <span className="text-neon-pink">financeira</span>
              </h1>
              <p className="mt-2 text-sm text-white/60">
                <Calendar className="inline h-4 w-4 -mt-0.5 text-neon-cyan" />{" "}
                {range.from.toLocaleDateString("pt-BR")} — {range.to.toLocaleDateString("pt-BR")}
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/20"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>

          {/* Period pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all",
                  period === p.id
                    ? "border-neon-pink bg-neon-pink text-white shadow-[0_0_16px_var(--neon-pink)]"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <BigKpi
                label="Faturamento"
                value={brl(kpis.revenue)}
                delta={period === "tudo" ? undefined : kpis.deltaRevenue}
                icon={Wallet}
                accent="text-neon-cyan"
                glow="shadow-[0_0_30px_-8px_var(--neon-cyan)]"
              />
              <BigKpi
                label="Pedidos pagos"
                value={String(kpis.ordersCount)}
                delta={period === "tudo" ? undefined : kpis.deltaOrders}
                icon={ShoppingBag}
                accent="text-neon-yellow"
              />
              <BigKpi
                label="Ticket médio"
                value={brl(kpis.avgTicket)}
                delta={period === "tudo" ? undefined : kpis.deltaTicket}
                icon={Receipt}
                accent="text-neon-pink"
              />
              <BigKpi
                label="Clientes únicos"
                value={String(kpis.uniqueCustomers)}
                icon={Users}
                accent="text-white"
              />
            </section>

            {/* Secondary KPIs */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MiniKpi label="Subtotal produtos" value={brl(kpis.grossSubtotal)} />
              <MiniKpi label="Taxas de entrega" value={brl(kpis.delivery)} />
              <MiniKpi label="Itens vendidos" value={String(productStats.totalItems)} />
              <MiniKpi label="Cupons usados" value={String(coupons.count)} />
              <MiniKpi
                label="Taxa de cancelamento"
                value={`${kpis.cancelRate.toFixed(1)}%`}
                tone={kpis.cancelRate > 15 ? "warn" : "ok"}
              />
            </section>

            {/* Revenue chart */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                  Faturamento por dia
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-white/40">
                  {byDay.length} dias
                </span>
              </div>
              <RevenueChart data={byDay} />
            </section>

            {/* Two column: top products + modality */}
            <section className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Award className="h-4 w-4 text-neon-yellow" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                    Produtos que mais vendem
                  </h2>
                </div>
                <ProductRank items={productStats.top} tone="top" />
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Bike className="h-4 w-4 text-neon-cyan" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                      Modalidade
                    </h2>
                  </div>
                  <ModeSplit modality={modality} />
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-neon-pink" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                      Status
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {statusSplit.map(([s, c]) => (
                      <div key={s} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-white/70">{s}</span>
                        <span className="font-bold text-white">{c}</span>
                      </div>
                    ))}
                    {statusSplit.length === 0 && (
                      <div className="text-xs text-white/40">Sem pedidos no período.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Peak hours + weekdays */}
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/80">
                  Horário de pico
                </h2>
                <BarSeries
                  data={byHour.map((h) => ({ label: fmtHour(h.h), value: h.count }))}
                  accent="var(--neon-cyan)"
                  compact
                />
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/80">
                  Dias da semana
                </h2>
                <BarSeries
                  data={byDow.map((d) => ({ label: DOW[d.dow], value: d.revenue }))}
                  accent="var(--neon-pink)"
                  format={brl}
                />
              </div>
            </section>

            {/* Heatmap Dia × Hora */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                    Horários de pico · Dia × Hora
                  </h2>
                  <p className="mt-1 text-[11px] text-white/50">
                    Use pra dimensionar equipe: quanto mais rosa, mais pedidos naquele horário.
                  </p>
                </div>
                {heatmap.peak.count > 0 && (
                  <div className="rounded-2xl border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-[11px]">
                    <div className="font-bold uppercase tracking-widest text-neon-pink">Pico</div>
                    <div className="mt-0.5 text-white">
                      {DOW[heatmap.peak.dow]} · {fmtHour(heatmap.peak.h)} — {heatmap.peak.count} pedidos ·{" "}
                      {brl(heatmap.peak.revenue)}
                    </div>
                  </div>
                )}
              </div>
              <Heatmap grid={heatmap.grid} revGrid={heatmap.revGrid} hours={heatmap.hours} max={heatmap.max} />
              <div className="mt-4 flex items-center justify-end gap-2 text-[10px] uppercase tracking-widest text-white/50">
                <span>menos</span>
                <div className="flex h-2 w-40 overflow-hidden rounded-full">
                  {[0.05, 0.15, 0.3, 0.5, 0.7, 0.9].map((a, i) => (
                    <div key={i} className="flex-1" style={{ background: `rgba(236,72,153,${a})` }} />
                  ))}
                </div>
                <span>mais</span>
              </div>
            </section>

            {/* Bottom: menos vendidos + zerados */}
            <section className="grid gap-6 lg:grid-cols-2">

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-neon-yellow" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                    Menos vendidos (com venda)
                  </h2>
                </div>
                <ProductRank items={productStats.bottom} tone="bottom" />
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-neon-pink" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                    Sem nenhuma venda no período
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {productStats.zero.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/70"
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <Store className="h-3.5 w-3.5 text-white/40" />
                      )}
                      {p.name}
                    </div>
                  ))}
                  {productStats.zero.length === 0 && (
                    <div className="text-xs text-white/40">Todos os produtos venderam. 🎉</div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function BigKpi({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  glow,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  glow?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5",
        glow,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{label}</div>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div
        className={cn("mt-3 text-3xl font-black leading-none", accent)}
        style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
      >
        {value}
      </div>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
            up ? "text-emerald-400" : "text-red-400",
          )}
          title="vs período anterior"
        >
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {up ? "+" : "−"}{Math.abs(delta).toFixed(1)}%
        </div>
      )}

    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-black",
          tone === "warn" ? "text-neon-pink" : tone === "ok" ? "text-emerald-300" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: Array<{ d: Date; revenue: number; count: number }> }) {
  const max = Math.max(1, ...data.map((x) => x.revenue));
  const H = 160;
  const W = 100; // percent-based via viewBox width scaling
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const pts = data.map((x, i) => {
    const y = H - (x.revenue / max) * (H - 12) - 4;
    return { x: i * step, y, ...x };
  });
  const path =
    pts.length > 1
      ? "M " + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ")
      : "";
  const area =
    pts.length > 1
      ? `M ${pts[0].x},${H} L ` +
        pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ") +
        ` L ${pts[pts.length - 1].x},${H} Z`
      : "";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full">
        <defs>
          <linearGradient id="revFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill="url(#revFill)" />}
        {path && <path d={path} stroke="var(--neon-cyan)" strokeWidth="0.6" fill="none" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="var(--neon-cyan)" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[9px] uppercase tracking-widest text-white/40">
        <span>{fmtDay(data[0]?.d ?? new Date())}</span>
        <span>Máx: {brl(max)}</span>
        <span>{fmtDay(data[data.length - 1]?.d ?? new Date())}</span>
      </div>
    </div>
  );
}

function BarSeries({
  data,
  accent,
  compact,
  format,
}: {
  data: Array<{ label: string; value: number }>;
  accent: string;
  compact?: boolean;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((x) => x.value));
  return (
    <div className={cn("flex items-end gap-1", compact ? "h-32" : "h-36")}>
      {data.map((x, i) => {
        const h = (x.value / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative flex h-full w-full items-end">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(2, h)}%`,
                  background: `linear-gradient(180deg, ${accent}, ${accent}55)`,
                  boxShadow: `0 0 12px -2px ${accent}`,
                }}
                title={format ? format(x.value) : String(x.value)}
              />
            </div>
            <div className="text-[8px] uppercase text-white/40">{x.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProductRank({
  items,
  tone,
}: {
  items: Array<{ name: string; qty: number; revenue: number; image: string | null }>;
  tone: "top" | "bottom";
}) {
  if (items.length === 0) {
    return <div className="text-xs text-white/40">Sem dados no período.</div>;
  }
  const maxRev = Math.max(1, ...items.map((x) => x.revenue));
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const pct = (it.revenue / maxRev) * 100;
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-2.5"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white">
              {i + 1}
            </div>
            {it.image ? (
              <img
                src={it.image}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-white/40">
                <Store className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{it.name}</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    "h-full rounded-full",
                    tone === "top" ? "bg-neon-cyan" : "bg-neon-pink",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-black text-neon-yellow">{brl(it.revenue)}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">{it.qty} un.</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModeSplit({
  modality,
}: {
  modality: { entrega: { count: number; revenue: number }; retirada: { count: number; revenue: number } };
}) {
  const total = modality.entrega.revenue + modality.retirada.revenue;
  const pctE = total > 0 ? (modality.entrega.revenue / total) * 100 : 0;
  const pctR = total > 0 ? (modality.retirada.revenue / total) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
        <div className="bg-neon-cyan" style={{ width: `${pctE}%` }} />
        <div className="bg-neon-pink" style={{ width: `${pctR}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-neon-cyan" />
          <span className="text-white/70">Entrega</span>
        </div>
        <div className="text-right">
          <div className="font-bold text-white">{brl(modality.entrega.revenue)}</div>
          <div className="text-[10px] text-white/40">{modality.entrega.count} pedidos</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-neon-pink" />
          <span className="text-white/70">Retirada</span>
        </div>
        <div className="text-right">
          <div className="font-bold text-white">{brl(modality.retirada.revenue)}</div>
          <div className="text-[10px] text-white/40">{modality.retirada.count} pedidos</div>
        </div>
      </div>
    </div>
  );
}

function Heatmap({
  grid,
  revGrid,
  hours,
  max,
}: {
  grid: number[][];
  revGrid: number[][];
  hours: number[];
  max: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Header */}
        <div
          className="grid gap-1 text-[9px] uppercase tracking-widest text-white/40"
          style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(0,1fr))` }}
        >
          <div />
          {hours.map((h) => (
            <div key={h} className="text-center">
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>
        {/* Rows */}
        <div className="mt-1 space-y-1">
          {DOW.map((label, dow) => (
            <div
              key={dow}
              className="grid gap-1"
              style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(0,1fr))` }}
            >
              <div className="flex items-center text-[10px] font-bold uppercase text-white/60">{label}</div>
              {hours.map((h) => {
                const c = grid[dow][h];
                const rev = revGrid[dow][h];
                const a = c === 0 ? 0 : 0.08 + (c / max) * 0.85;
                return (
                  <div
                    key={h}
                    title={
                      c === 0
                        ? `${label} ${String(h).padStart(2, "0")}h · sem pedidos`
                        : `${label} ${String(h).padStart(2, "0")}h · ${c} pedidos · ${brl(rev)}`
                    }
                    className="grid aspect-square place-items-center rounded-md border border-white/5 text-[9px] font-bold text-white/90 transition-transform hover:scale-110"
                    style={{
                      background: c === 0 ? "rgba(255,255,255,0.02)" : `rgba(236,72,153,${a})`,
                      boxShadow: c > 0 ? `0 0 8px -4px rgba(236,72,153,${a})` : undefined,
                    }}
                  >
                    {c > 0 ? c : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

