import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Target,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Save,
  Loader2,
  Settings2,
  Wand2,
  ArrowUpDown,
  PiggyBank,
  Package,
  Scale,
  Zap,
  X,
  Check,
  Flame,
  ChevronDown,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/cart-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/precificacao")({
  head: () => ({
    meta: [
      { title: "Precificação — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrecificacaoPage,
});

/* ---------------- Types ---------------- */

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  base_price: number;
  active: boolean;
  cost_price: number | null;
  packaging_cost: number | null;
  target_margin_pct: number | null;
};

type PricingConfig = {
  card_fee: number;
  tax: number;
  platform_fee: number;
  fixed_cost: number;
  expected_sales: number;
};

type SortKey =
  | "margin_asc"
  | "margin_desc"
  | "price_desc"
  | "price_asc"
  | "name_asc"
  | "gap_desc";

/* ---------------- Helpers ---------------- */

function n(v: unknown, def = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
}

type Metrics = {
  totalCost: number;
  variableFeePct: number;
  variableFeeValue: number;
  netRevenue: number;
  contribution: number;
  realMarginPct: number;
  markup: number;
  suggestedPrice: number;
  priceGap: number;
  cmvPct: number;
};

function calc(p: ProductRow, cfg: PricingConfig): Metrics {
  const price = n(p.base_price);
  const cost = n(p.cost_price);
  const pack = n(p.packaging_cost);
  const totalCost = cost + pack;
  const varPct = n(cfg.card_fee) + n(cfg.tax) + n(cfg.platform_fee);
  const varVal = price * (varPct / 100);
  const netRevenue = price - varVal;
  const contribution = netRevenue - totalCost;
  const realMarginPct = price > 0 ? (contribution / price) * 100 : 0;
  const markup = totalCost > 0 ? price / totalCost : 0;
  const target = n(p.target_margin_pct, 60);
  const denom = 1 - target / 100 - varPct / 100;
  const suggestedPrice = denom > 0 && totalCost > 0 ? totalCost / denom : 0;
  const priceGap = suggestedPrice - price;
  const cmvPct = price > 0 ? (totalCost / price) * 100 : 0;
  return {
    totalCost,
    variableFeePct: varPct,
    variableFeeValue: varVal,
    netRevenue,
    contribution,
    realMarginPct,
    markup,
    suggestedPrice,
    priceGap,
    cmvPct,
  };
}

/* ---------------- Page ---------------- */

function PrecificacaoPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cfg, setCfg] = useState<PricingConfig>({
    card_fee: 3.5,
    tax: 0,
    platform_fee: 0,
    fixed_cost: 0,
    expected_sales: 300,
  });
  const [cfgDirty, setCfgDirty] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] =
    useState<"todas" | "abaixo" | "saudavel" | "prejuizo" | "sem_custo">("todas");
  const [sort, setSort] = useState<SortKey>("margin_asc");
  const [detail, setDetail] = useState<ProductRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [prodRes, cfgRes] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,category,image_url,base_price,active,cost_price,packaging_cost,target_margin_pct",
        )
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("site_settings").select("id,pricing_card_fee_pct,pricing_tax_pct,pricing_platform_fee_pct,pricing_fixed_cost_monthly,pricing_expected_sales_monthly").eq("id", 1).maybeSingle(),
    ]);
    if (prodRes.error) toast.error("Erro ao carregar produtos: " + prodRes.error.message);
    else setProducts((prodRes.data ?? []) as ProductRow[]);

    if (cfgRes.data) {
      const s = cfgRes.data as Record<string, unknown>;
      setCfg({
        card_fee: n(s.pricing_card_fee_pct, 3.5),
        tax: n(s.pricing_tax_pct, 0),
        platform_fee: n(s.pricing_platform_fee_pct, 0),
        fixed_cost: n(s.pricing_fixed_cost_monthly, 0),
        expected_sales: n(s.pricing_expected_sales_monthly, 300),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== "todas") {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (statusFilter !== "todas") {
      list = list.filter((p) => {
        const m = calc(p, cfg);
        const hasCost = n(p.cost_price) + n(p.packaging_cost) > 0;
        if (statusFilter === "sem_custo") return !hasCost;
        if (!hasCost) return false;
        if (statusFilter === "prejuizo") return m.contribution < 0;
        if (statusFilter === "abaixo")
          return m.realMarginPct < n(p.target_margin_pct, 60) && m.contribution >= 0;
        if (statusFilter === "saudavel")
          return m.realMarginPct >= n(p.target_margin_pct, 60);
        return true;
      });
    }
    list.sort((a, b) => {
      const ma = calc(a, cfg);
      const mb = calc(b, cfg);
      switch (sort) {
        case "margin_asc":
          return ma.realMarginPct - mb.realMarginPct;
        case "margin_desc":
          return mb.realMarginPct - ma.realMarginPct;
        case "price_asc":
          return n(a.base_price) - n(b.base_price);
        case "price_desc":
          return n(b.base_price) - n(a.base_price);
        case "gap_desc":
          return Math.abs(mb.priceGap) - Math.abs(ma.priceGap);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [products, query, categoryFilter, statusFilter, sort, cfg]);

  const kpis = useMemo(() => {
    const priced = products.filter((p) => n(p.cost_price) + n(p.packaging_cost) > 0);
    const marginAvg =
      priced.length > 0
        ? priced.reduce((s, p) => s + calc(p, cfg).realMarginPct, 0) / priced.length
        : 0;
    const contribAvg =
      priced.length > 0
        ? priced.reduce((s, p) => s + calc(p, cfg).contribution, 0) / priced.length
        : 0;
    const belowTarget = priced.filter((p) => {
      const m = calc(p, cfg);
      return m.realMarginPct < n(p.target_margin_pct, 60) && m.contribution >= 0;
    }).length;
    const negatives = priced.filter((p) => calc(p, cfg).contribution < 0).length;
    const missingCost = products.filter((p) => n(p.cost_price) + n(p.packaging_cost) <= 0).length;
    const cmvAvg =
      priced.length > 0
        ? priced.reduce((s, p) => s + calc(p, cfg).cmvPct, 0) / priced.length
        : 0;
    const breakEvenUnits =
      contribAvg > 0 ? Math.ceil(cfg.fixed_cost / contribAvg) : 0;
    const projectedProfit = contribAvg * cfg.expected_sales - cfg.fixed_cost;
    const projectedRevenue = priced.length
      ? (priced.reduce((s, p) => s + n(p.base_price), 0) / priced.length) *
        cfg.expected_sales
      : 0;
    return {
      total: products.length,
      priced: priced.length,
      marginAvg,
      contribAvg,
      belowTarget,
      negatives,
      missingCost,
      cmvAvg,
      breakEvenUnits,
      projectedProfit,
      projectedRevenue,
    };
  }, [products, cfg]);

  /* ---------------- Save handlers ---------------- */

  const saveConfig = async () => {
    setSavingCfg(true);
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, number>) => { eq: (c: string, v: number) => Promise<{ error: { message: string } | null }> };
      };
    })
      .from("site_settings")
      .update({
        pricing_card_fee_pct: cfg.card_fee,
        pricing_tax_pct: cfg.tax,
        pricing_platform_fee_pct: cfg.platform_fee,
        pricing_fixed_cost_monthly: cfg.fixed_cost,
        pricing_expected_sales_monthly: Math.round(cfg.expected_sales),
      })
      .eq("id", 1);
    setSavingCfg(false);
    if (error) toast.error("Erro ao salvar configuração: " + error.message);
    else {
      toast.success("Configuração salva");
      setCfgDirty(false);
    }
  };

  const updateProduct = async (id: string, patch: Partial<ProductRow>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("products")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      load();
    }
  };

  const applySuggested = async (p: ProductRow) => {
    const m = calc(p, cfg);
    if (m.suggestedPrice <= 0) {
      toast.error("Informe custo para calcular preço sugerido");
      return;
    }
    const rounded = Math.round(m.suggestedPrice * 100) / 100;
    await updateProduct(p.id, { base_price: rounded });
    toast.success(`${p.name}: preço ajustado para ${brl(rounded)}`);
  };

  const applyAllBelow = async () => {
    const list = products.filter((p) => {
      const m = calc(p, cfg);
      const hasCost = n(p.cost_price) + n(p.packaging_cost) > 0;
      return hasCost && m.realMarginPct < n(p.target_margin_pct, 60) && m.suggestedPrice > 0;
    });
    if (!list.length) {
      toast("Nenhum produto abaixo da meta");
      return;
    }
    if (
      !(await confirmDialog({ message: `Ajustar preço de ${list.length} produto(s) para o valor sugerido (mantendo a margem alvo)?`, }))
    )
      return;
    for (const p of list) {
      const m = calc(p, cfg);
      const rounded = Math.round(m.suggestedPrice * 100) / 100;
      await supabase.from("products").update({ base_price: rounded }).eq("id", p.id);
    }
    toast.success(`${list.length} produtos ajustados`);
    load();
  };

  const exportCSV = () => {
    const header = [
      "Produto",
      "Categoria",
      "Preço",
      "Custo",
      "Embalagem",
      "Custo total",
      "Margem alvo (%)",
      "Margem real (%)",
      "Contribuição",
      "CMV (%)",
      "Preço sugerido",
      "Gap",
    ];
    const rows = filtered.map((p) => {
      const m = calc(p, cfg);
      return [
        p.name,
        p.category ?? "",
        n(p.base_price).toFixed(2),
        n(p.cost_price).toFixed(2),
        n(p.packaging_cost).toFixed(2),
        m.totalCost.toFixed(2),
        n(p.target_margin_pct, 60).toFixed(1),
        m.realMarginPct.toFixed(1),
        m.contribution.toFixed(2),
        m.cmvPct.toFixed(1),
        m.suggestedPrice.toFixed(2),
        m.priceGap.toFixed(2),
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `precificacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="min-h-full bg-[#0e0a1a] pb-24 text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Header */}
        <header className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-neon-pink/80">
              <Sparkles className="h-3 w-3" /> Inteligência de preço
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
              Precificação{" "}
              <span className="bg-gradient-to-r from-neon-pink to-fuchsia-400 bg-clip-text text-transparent">
                estratégica
              </span>
            </h1>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">
              Analise custo, margem e simule reajustes com um clique.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={applyAllBelow}
              className="inline-flex items-center gap-2 rounded-full border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-xs font-black text-neon-pink transition hover:bg-neon-pink/20"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Ajustar todos abaixo da meta
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margem média"
            value={`${kpis.marginAvg.toFixed(1)}%`}
            hint={`${kpis.priced} de ${kpis.total} com custo`}
            accent="from-emerald-400/30 to-emerald-500/10"
            iconColor="text-emerald-300"
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Contribuição média"
            value={brl(kpis.contribAvg)}
            hint="por unidade vendida"
            accent="from-neon-pink/30 to-fuchsia-500/10"
            iconColor="text-neon-pink"
          />
          <KpiCard
            icon={<Scale className="h-4 w-4" />}
            label="CMV médio"
            value={`${kpis.cmvAvg.toFixed(1)}%`}
            hint="custo sobre venda"
            accent="from-amber-400/30 to-amber-500/10"
            iconColor="text-amber-300"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Abaixo da meta"
            value={String(kpis.belowTarget)}
            hint={
              kpis.negatives > 0
                ? `${kpis.negatives} em prejuízo`
                : `${kpis.missingCost} sem custo`
            }
            accent={
              kpis.negatives > 0
                ? "from-red-400/30 to-red-500/10"
                : "from-cyan-400/30 to-cyan-500/10"
            }
            iconColor={kpis.negatives > 0 ? "text-red-300" : "text-cyan-300"}
          />
        </section>

        {/* Break-even & projection */}
        <section className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-3">
          <BreakEvenCard
            icon={<Target className="h-4 w-4" />}
            label="Ponto de equilíbrio"
            value={
              kpis.breakEvenUnits > 0
                ? `${kpis.breakEvenUnits.toLocaleString("pt-BR")} vendas/mês`
                : "—"
            }
            hint={
              cfg.fixed_cost > 0
                ? `Cobre ${brl(cfg.fixed_cost)} de custo fixo`
                : "Defina o custo fixo mensal ao lado"
            }
          />
          <BreakEvenCard
            icon={<PiggyBank className="h-4 w-4" />}
            label="Lucro projetado"
            value={brl(kpis.projectedProfit)}
            hint={`Com ${cfg.expected_sales} vendas/mês`}
            highlight={kpis.projectedProfit >= 0 ? "positive" : "negative"}
          />
          <BreakEvenCard
            icon={<Zap className="h-4 w-4" />}
            label="Receita projetada"
            value={brl(kpis.projectedRevenue)}
            hint="Ticket médio × volume"
          />
        </section>

        {/* Config card */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-neon-pink" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white/80 sm:text-sm">
                Parâmetros da loja
              </h2>
            </div>
            {cfgDirty && (
              <button
                onClick={saveConfig}
                disabled={savingCfg}
                className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-[11px] font-black text-white hover:brightness-110 disabled:opacity-50"
              >
                {savingCfg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <NumInput
              label="Taxa cartão (%)"
              value={cfg.card_fee}
              step={0.1}
              onChange={(v) => {
                setCfg((c) => ({ ...c, card_fee: v }));
                setCfgDirty(true);
              }}
            />
            <NumInput
              label="Imposto (%)"
              value={cfg.tax}
              step={0.1}
              onChange={(v) => {
                setCfg((c) => ({ ...c, tax: v }));
                setCfgDirty(true);
              }}
            />
            <NumInput
              label="Taxa plataforma (%)"
              value={cfg.platform_fee}
              step={0.1}
              onChange={(v) => {
                setCfg((c) => ({ ...c, platform_fee: v }));
                setCfgDirty(true);
              }}
            />
            <NumInput
              label="Custo fixo mensal"
              prefix="R$"
              value={cfg.fixed_cost}
              step={50}
              onChange={(v) => {
                setCfg((c) => ({ ...c, fixed_cost: v }));
                setCfgDirty(true);
              }}
            />
            <NumInput
              label="Vendas/mês esperadas"
              value={cfg.expected_sales}
              step={10}
              onChange={(v) => {
                setCfg((c) => ({ ...c, expected_sales: Math.max(0, v) }));
                setCfgDirty(true);
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
            <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
              Taxas totais:{" "}
              <span className="font-black text-white/80">
                {(cfg.card_fee + cfg.tax + cfg.platform_fee).toFixed(2)}%
              </span>
            </div>
            <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
              Preço sugerido = <span className="font-mono">custo / (1 − margem − taxas)</span>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mt-4 flex flex-wrap items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto…"
              className="w-full rounded-full border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-white/80 focus:border-neon-pink focus:outline-none"
          >
            <option value="todas">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <FilterChip active={statusFilter === "todas"} onClick={() => setStatusFilter("todas")}>
            <Filter className="h-3 w-3" /> Todos
          </FilterChip>
          <FilterChip
            active={statusFilter === "prejuizo"}
            onClick={() => setStatusFilter("prejuizo")}
          >
            <Flame className="h-3 w-3 text-red-400" /> Em prejuízo
          </FilterChip>
          <FilterChip active={statusFilter === "abaixo"} onClick={() => setStatusFilter("abaixo")}>
            <TrendingDown className="h-3 w-3 text-amber-300" /> Abaixo da meta
          </FilterChip>
          <FilterChip
            active={statusFilter === "saudavel"}
            onClick={() => setStatusFilter("saudavel")}
          >
            <TrendingUp className="h-3 w-3 text-emerald-300" /> Saudáveis
          </FilterChip>
          <FilterChip
            active={statusFilter === "sem_custo"}
            onClick={() => setStatusFilter("sem_custo")}
          >
            <Package className="h-3 w-3 text-cyan-300" /> Sem custo
          </FilterChip>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-white/80 focus:border-neon-pink focus:outline-none"
          >
            <option value="margin_asc">Margem: menor</option>
            <option value="margin_desc">Margem: maior</option>
            <option value="price_desc">Preço: maior</option>
            <option value="price_asc">Preço: menor</option>
            <option value="gap_desc">Maior gap</option>
            <option value="name_asc">Nome A→Z</option>
          </select>
        </section>

        {/* Products list */}
        <section className="mt-4">
          {loading ? (
            <div className="grid place-items-center py-16 text-white/50">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-neon-pink/15 text-neon-pink">
                <Calculator className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black">Sem produtos com esses filtros</h3>
              <p className="mt-1 text-sm text-white/50">Ajuste os filtros acima.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] md:block">
                <div className="grid grid-cols-[minmax(0,2fr)_120px_120px_120px_140px_140px_120px] items-center gap-2 border-b border-white/10 bg-black/30 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/50">
                  <div>Produto</div>
                  <div className="text-right">Custo</div>
                  <div className="text-right">Preço</div>
                  <div className="text-right">Meta</div>
                  <div className="text-right">Margem real</div>
                  <div className="text-right">Sugestão</div>
                  <div className="text-right">Ações</div>
                </div>
                <div className="divide-y divide-white/5">
                  {filtered.map((p) => (
                    <RowDesktop
                      key={p.id}
                      p={p}
                      cfg={cfg}
                      onEdit={(patch) => updateProduct(p.id, patch)}
                      onApply={() => applySuggested(p)}
                      onDetail={() => setDetail(p)}
                    />
                  ))}
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2.5 md:hidden">
                {filtered.map((p) => (
                  <RowMobile
                    key={p.id}
                    p={p}
                    cfg={cfg}
                    onEdit={(patch) => updateProduct(p.id, patch)}
                    onApply={() => applySuggested(p)}
                    onDetail={() => setDetail(p)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {detail && (
        <DetailDialog
          product={detail}
          cfg={cfg}
          onClose={() => setDetail(null)}
          onEdit={(patch) => {
            updateProduct(detail.id, patch);
            setDetail((d) => (d ? { ...d, ...patch } : d));
          }}
          onApply={() => applySuggested(detail)}
        />
      )}
    </div>
  );
}

/* ---------------- UI Bits ---------------- */

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: string;
  iconColor: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-3 sm:p-4",
        accent,
      )}
    >
      <div className={cn("mb-1.5 flex items-center gap-1.5", iconColor)}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
          {label}
        </span>
      </div>
      <div className="text-lg font-black tabular-nums sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[10px] text-white/50 sm:text-xs">{hint}</div>
    </div>
  );
}

function BreakEvenCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-1 flex items-center gap-1.5 text-white/60">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div
        className={cn(
          "text-xl font-black tabular-nums sm:text-2xl",
          highlight === "positive" && "text-emerald-300",
          highlight === "negative" && "text-red-300",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-white/50">{hint}</div>
    </div>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step = 0.1,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
        {label}
      </span>
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 focus-within:border-neon-pink">
        {prefix && <span className="text-xs text-white/50">{prefix}</span>}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-sm font-bold text-white outline-none tabular-nums"
        />
      </div>
    </label>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
        active
          ? "border-neon-pink/60 bg-neon-pink/15 text-white"
          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function MarginPill({ pct, target }: { pct: number; target: number }) {
  const state =
    pct < 0 ? "prejuizo" : pct < target ? "abaixo" : "saudavel";
  const styles = {
    prejuizo: "bg-red-500/20 text-red-300 border-red-500/40",
    abaixo: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    saudavel: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black tabular-nums",
        styles[state],
      )}
    >
      {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pct.toFixed(1)}%
    </span>
  );
}

function InlineNum({
  value,
  onCommit,
  prefix,
  suffix,
  className,
}: {
  value: number;
  onCommit: (v: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-0.5 rounded-lg border border-transparent bg-white/[0.02] px-2 py-1 focus-within:border-neon-pink/60 hover:bg-white/[0.05]",
        className,
      )}
    >
      {prefix && <span className="text-[10px] text-white/40">{prefix}</span>}
      <input
        type="number"
        step={0.01}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const num = Number(v);
          if (Number.isFinite(num) && num !== value) onCommit(num);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-16 bg-transparent text-right text-xs font-black tabular-nums text-white outline-none"
      />
      {suffix && <span className="text-[10px] text-white/40">{suffix}</span>}
    </div>
  );
}

/* ---------------- Row: Desktop ---------------- */

function RowDesktop({
  p,
  cfg,
  onEdit,
  onApply,
  onDetail,
}: {
  p: ProductRow;
  cfg: PricingConfig;
  onEdit: (patch: Partial<ProductRow>) => void;
  onApply: () => void;
  onDetail: () => void;
}) {
  const m = calc(p, cfg);
  const hasCost = m.totalCost > 0;
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_120px_120px_120px_140px_140px_120px] items-center gap-2 px-4 py-3 transition hover:bg-white/[0.02]">
      <button onClick={onDetail} className="flex min-w-0 items-center gap-3 text-left">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/5">
          {p.image_url ? (
            <img src={p.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/30">
              <Package className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{p.name}</div>
          <div className="truncate text-[11px] text-white/50">
            {p.category ?? "sem categoria"} · CMV {m.cmvPct.toFixed(0)}%
          </div>
        </div>
      </button>
      <div className="flex flex-col items-end gap-0.5">
        <InlineNum
          value={n(p.cost_price)}
          onCommit={(v) => onEdit({ cost_price: v })}
          prefix="R$"
        />
        <InlineNum
          value={n(p.packaging_cost)}
          onCommit={(v) => onEdit({ packaging_cost: v })}
          prefix="emb"
          className="opacity-70"
        />
      </div>
      <InlineNum
        value={n(p.base_price)}
        onCommit={(v) => onEdit({ base_price: v })}
        prefix="R$"
      />
      <InlineNum
        value={n(p.target_margin_pct, 60)}
        onCommit={(v) => onEdit({ target_margin_pct: v })}
        suffix="%"
      />
      <div className="flex justify-end">
        {hasCost ? (
          <MarginPill pct={m.realMarginPct} target={n(p.target_margin_pct, 60)} />
        ) : (
          <span className="text-[11px] italic text-white/40">defina custo</span>
        )}
      </div>
      <div className="text-right">
        {hasCost && m.suggestedPrice > 0 ? (
          <div>
            <div className="text-sm font-black tabular-nums text-white">
              {brl(m.suggestedPrice)}
            </div>
            <div
              className={cn(
                "text-[10px] font-bold tabular-nums",
                m.priceGap > 0.01
                  ? "text-emerald-300"
                  : m.priceGap < -0.01
                    ? "text-red-300"
                    : "text-white/40",
              )}
            >
              {m.priceGap > 0 ? "+" : ""}
              {brl(m.priceGap)}
            </div>
          </div>
        ) : (
          <span className="text-[11px] italic text-white/40">—</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={onApply}
          disabled={!hasCost || m.suggestedPrice <= 0}
          title="Aplicar sugestão"
          className="grid h-8 w-8 place-items-center rounded-full border border-neon-pink/40 bg-neon-pink/10 text-neon-pink transition hover:bg-neon-pink/20 disabled:opacity-30"
        >
          <Wand2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDetail}
          title="Detalhes"
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
        >
          <Calculator className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Row: Mobile ---------------- */

function RowMobile({
  p,
  cfg,
  onEdit,
  onApply,
  onDetail,
}: {
  p: ProductRow;
  cfg: PricingConfig;
  onEdit: (patch: Partial<ProductRow>) => void;
  onApply: () => void;
  onDetail: () => void;
}) {
  const m = calc(p, cfg);
  const hasCost = m.totalCost > 0;
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <button onClick={onDetail} className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
          {p.image_url ? (
            <img src={p.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/30">
              <Package className="h-5 w-5" />
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onDetail} className="block w-full text-left">
            <div className="truncate text-sm font-black text-white">{p.name}</div>
            <div className="truncate text-[11px] text-white/50">
              {p.category ?? "—"} · CMV {m.cmvPct.toFixed(0)}%
            </div>
          </button>
        </div>
        {hasCost ? (
          <MarginPill pct={m.realMarginPct} target={n(p.target_margin_pct, 60)} />
        ) : (
          <span className="text-[10px] italic text-white/40">sem custo</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <label className="flex flex-col gap-0.5 rounded-xl bg-black/20 p-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
            Custo
          </span>
          <InlineNum
            value={n(p.cost_price)}
            onCommit={(v) => onEdit({ cost_price: v })}
            prefix="R$"
            className="justify-start px-0"
          />
        </label>
        <label className="flex flex-col gap-0.5 rounded-xl bg-black/20 p-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
            Embalagem
          </span>
          <InlineNum
            value={n(p.packaging_cost)}
            onCommit={(v) => onEdit({ packaging_cost: v })}
            prefix="R$"
            className="justify-start px-0"
          />
        </label>
        <label className="flex flex-col gap-0.5 rounded-xl bg-black/20 p-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
            Preço
          </span>
          <InlineNum
            value={n(p.base_price)}
            onCommit={(v) => onEdit({ base_price: v })}
            prefix="R$"
            className="justify-start px-0"
          />
        </label>
        <label className="flex flex-col gap-0.5 rounded-xl bg-black/20 p-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
            Meta
          </span>
          <InlineNum
            value={n(p.target_margin_pct, 60)}
            onCommit={(v) => onEdit({ target_margin_pct: v })}
            suffix="%"
            className="justify-start px-0"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Sugestão
          </div>
          {hasCost && m.suggestedPrice > 0 ? (
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black tabular-nums text-white">
                {brl(m.suggestedPrice)}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums",
                  m.priceGap > 0.01
                    ? "text-emerald-300"
                    : m.priceGap < -0.01
                      ? "text-red-300"
                      : "text-white/40",
                )}
              >
                {m.priceGap > 0 ? "+" : ""}
                {brl(m.priceGap)}
              </span>
            </div>
          ) : (
            <span className="text-[11px] italic text-white/40">defina custo</span>
          )}
        </div>
        <button
          onClick={onApply}
          disabled={!hasCost || m.suggestedPrice <= 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-[11px] font-black text-white hover:brightness-110 disabled:opacity-30"
        >
          <Wand2 className="h-3 w-3" /> Aplicar
        </button>
      </div>
    </article>
  );
}

/* ---------------- Detail Dialog ---------------- */

function DetailDialog({
  product,
  cfg,
  onClose,
  onEdit,
  onApply,
}: {
  product: ProductRow;
  cfg: PricingConfig;
  onClose: () => void;
  onEdit: (patch: Partial<ProductRow>) => void;
  onApply: () => void;
}) {
  const [simPrice, setSimPrice] = useState<number>(n(product.base_price));
  useEffect(() => setSimPrice(n(product.base_price)), [product.id, product.base_price]);
  const current = calc(product, cfg);
  const simulated = calc({ ...product, base_price: simPrice }, cfg);
  const target = n(product.target_margin_pct, 60);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border-white/10 bg-[#120a24] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-neon-pink" />
            {product.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Cost breakdown */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-neon-pink">
              Composição do preço atual
            </div>
            <BreakRow label="Preço de venda" value={brl(n(product.base_price))} bold />
            <BreakRow
              label={`Taxas (${current.variableFeePct.toFixed(2)}%)`}
              value={"−" + brl(current.variableFeeValue)}
              neg
            />
            <BreakRow label="Custo produto" value={"−" + brl(n(product.cost_price))} neg />
            <BreakRow label="Embalagem" value={"−" + brl(n(product.packaging_cost))} neg />
            <div className="my-1.5 h-px bg-white/10" />
            <BreakRow
              label="Contribuição"
              value={brl(current.contribution)}
              bold
              positive={current.contribution >= 0}
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-white/50">Margem real</span>
              <MarginPill pct={current.realMarginPct} target={target} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-white/50">Markup</span>
              <span className="font-black tabular-nums">
                {current.markup > 0 ? `${current.markup.toFixed(2)}×` : "—"}
              </span>
            </div>
          </div>

          {/* Suggestion */}
          {current.suggestedPrice > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-neon-pink/40 bg-neon-pink/10 p-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-neon-pink">
                  Preço sugerido (meta {target.toFixed(0)}%)
                </div>
                <div className="mt-0.5 text-2xl font-black tabular-nums">
                  {brl(current.suggestedPrice)}
                </div>
                <div
                  className={cn(
                    "text-[11px] font-bold tabular-nums",
                    current.priceGap > 0.01
                      ? "text-emerald-300"
                      : current.priceGap < -0.01
                        ? "text-red-300"
                        : "text-white/40",
                  )}
                >
                  {current.priceGap > 0 ? "+" : ""}
                  {brl(current.priceGap)} vs. atual
                </div>
              </div>
              <button
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-4 py-2 text-xs font-black text-white hover:brightness-110"
              >
                <Wand2 className="h-3.5 w-3.5" /> Aplicar
              </button>
            </div>
          )}

          {/* Simulator */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60">
              <ArrowUpDown className="h-3 w-3" /> Simulador de preço
            </div>
            <input
              type="range"
              min={Math.max(0, n(product.cost_price) + n(product.packaging_cost))}
              max={Math.max(
                n(product.base_price) * 2,
                current.suggestedPrice * 1.5,
                20,
              )}
              step={0.5}
              value={simPrice}
              onChange={(e) => setSimPrice(Number(e.target.value))}
              className="w-full accent-neon-pink"
            />
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/30 p-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  Preço
                </div>
                <div className="text-sm font-black tabular-nums text-white">
                  {brl(simPrice)}
                </div>
              </div>
              <div className="rounded-xl bg-black/30 p-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  Margem
                </div>
                <div
                  className={cn(
                    "text-sm font-black tabular-nums",
                    simulated.realMarginPct >= target
                      ? "text-emerald-300"
                      : simulated.realMarginPct >= 0
                        ? "text-amber-300"
                        : "text-red-300",
                  )}
                >
                  {simulated.realMarginPct.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl bg-black/30 p-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  Contrib.
                </div>
                <div className="text-sm font-black tabular-nums text-white">
                  {brl(simulated.contribution)}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onEdit({ base_price: Math.round(simPrice * 100) / 100 });
                toast.success("Preço atualizado");
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/80 hover:bg-white/10"
            >
              <Check className="h-3.5 w-3.5" /> Salvar {brl(simPrice)}
            </button>
          </div>

          <button
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BreakRow({
  label,
  value,
  bold,
  neg,
  positive,
}: {
  label: string;
  value: string;
  bold?: boolean;
  neg?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-white/60">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          bold && "font-black",
          neg && "text-red-300",
          positive && "text-emerald-300",
          !bold && !neg && !positive && "text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
