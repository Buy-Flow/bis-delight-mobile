import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { getPrepPlan, type PrepPlan } from "@/lib/prep-forecast.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Brain, ChefHat, Sparkles, Timer, Package, Flame, RefreshCcw, Save, Loader2,
  TrendingUp, AlertTriangle, Settings2, Search, Pause, Play, Info,
  Snowflake, CloudRain, Sun, PartyPopper, Zap, ArrowRight, PlusCircle, MinusCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pre-preparo")({
  head: () => ({ meta: [{ title: "Pré-preparo IA — Admin" }] }),
  component: PrePreparoPage,
});

const CATEGORIES = ["acai", "shakes", "monte-voce-mesmo", "kids", "copos", "tacas", "mix", "casquinhas"];

type Settings = {
  enabled: boolean;
  horizon_hours: number;
  history_days: number;
  safety_stock_pct: number;
  min_confidence_pct: number;
  weather_boost_pct: number;
  weekend_boost_pct: number;
  round_up: boolean;
  include_paused: boolean;
  auto_notify: boolean;
  notify_channels: string[];
  auto_refresh_minutes: number;
  ai_model: string;
  ai_temperature: number;
  min_batch_hint: number;
  waste_target_pct: number;
  categories_included: string[];
  categories_excluded: string[];
  ai_context: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  prep_enabled: boolean;
  prep_yield_per_batch: number;
  prep_time_min: number;
  shelf_life_min: number;
  min_batches: number;
  max_batches: number;
  prep_priority: number;
};

function PrePreparoPage() {
  const [tab, setTab] = useState<"plan" | "products" | "settings">("plan");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [context, setContext] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [horizonOverride, setHorizonOverride] = useState<number | null>(null);
  const run = useServerFn(getPrepPlan);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("prep_forecast_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) setSettings(data as any);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,category,image_url,prep_enabled,prep_yield_per_batch,prep_time_min,shelf_life_min,min_batches,max_batches,prep_priority")
      .eq("active", true)
      .order("prep_enabled", { ascending: false })
      .order("name", { ascending: true });
    if (data) setProducts(data as any);
  }, []);

  const runPlan = useCallback(async () => {
    setLoadingPlan(true);
    try {
      const p = await run({
        data: {
          horizonHoursOverride: horizonOverride ?? undefined,
          contextNote: context.trim() || undefined,
        },
      });
      setPlan(p);
      if (p.aiError) toast.warning(p.aiError);
      else toast.success("Plano atualizado ✨");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar plano");
    } finally {
      setLoadingPlan(false);
    }
  }, [run, horizonOverride, context]);

  useEffect(() => { loadSettings(); loadProducts(); }, [loadSettings, loadProducts]);

  useEffect(() => {
    if (tab === "plan" && !plan && !loadingPlan) runPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-refresh
  useEffect(() => {
    if (!settings?.auto_refresh_minutes || tab !== "plan") return;
    const ms = settings.auto_refresh_minutes * 60_000;
    const t = setInterval(runPlan, ms);
    return () => clearInterval(t);
  }, [settings?.auto_refresh_minutes, tab, runPlan]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("prep_forecast_settings")
      .update(settings as any)
      .eq("id", 1);
    setSavingSettings(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  };

  const updateProduct = async (id: string, patch: Partial<ProductRow>) => {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("products").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); loadProducts(); }
  };

  const bulkEnable = async (enabled: boolean) => {
    if (!(await confirmDialog({ message: enabled ? "Ativar pré-preparo em todos os produtos filtrados?" : "Desativar todos filtrados?" }))) return;
    const ids = filteredProducts.map((p) => p.id);
    setProducts((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, prep_enabled: enabled } : p)));
    await supabase.from("products").update({ prep_enabled: enabled } as any).in("id", ids);
    toast.success(`${ids.length} produtos ${enabled ? "ativados" : "desativados"}`);
  };

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
  }, [products, productQuery]);

  return (
    <AdminShell>
      <div className="min-h-screen bg-[#0c031f] p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-fuchsia-300">
                <Brain className="h-3.5 w-3.5" /> Pré-preparo inteligente
              </div>
              <h1 className="text-2xl font-black text-white mt-1">
                Quantos açaís montar nas próximas {plan?.horizonHours ?? settings?.horizon_hours ?? 3}h?
              </h1>
              <p className="text-sm text-white/60 max-w-2xl mt-1">
                A IA cruza histórico por hora × dia da semana, contexto (clima/feriado/evento) e a sua meta de desperdício para sugerir lotes prontos antes do rush.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(["plan", "products", "settings"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider",
                    tab === t ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30" : "bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  {t === "plan" ? "Plano" : t === "products" ? "Produtos" : "Configurações"}
                </button>
              ))}
            </div>
          </div>

          {tab === "plan" && (
            <PlanTab
              plan={plan}
              loading={loadingPlan}
              context={context}
              setContext={setContext}
              horizonOverride={horizonOverride}
              setHorizonOverride={setHorizonOverride}
              defaultHorizon={settings?.horizon_hours ?? 3}
              onRun={runPlan}
            />
          )}

          {tab === "products" && (
            <ProductsTab
              products={filteredProducts}
              query={productQuery}
              setQuery={setProductQuery}
              onUpdate={updateProduct}
              onBulk={bulkEnable}
              total={products.length}
            />
          )}

          {tab === "settings" && settings && (
            <SettingsTab
              settings={settings}
              setSettings={setSettings}
              save={saveSettings}
              saving={savingSettings}
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}

/* ================================================================
 * PLAN TAB
 * ================================================================ */

function PlanTab({
  plan, loading, context, setContext, horizonOverride, setHorizonOverride, defaultHorizon, onRun,
}: {
  plan: PrepPlan | null;
  loading: boolean;
  context: string;
  setContext: (v: string) => void;
  horizonOverride: number | null;
  setHorizonOverride: (v: number | null) => void;
  defaultHorizon: number;
  onRun: () => void;
}) {
  const contextChips = [
    { icon: Sun, label: "Calor forte", value: "Hoje o dia está quente e ensolarado, aumente a expectativa de açaí." },
    { icon: CloudRain, label: "Chuva", value: "Está chovendo — provável queda em retirada, delivery pode subir." },
    { icon: PartyPopper, label: "Feriado", value: "Hoje é feriado local, movimento diferente de um dia comum." },
    { icon: Zap, label: "Promoção ativa", value: "Estamos rodando uma promoção relâmpago no site agora." },
    { icon: Snowflake, label: "Dia frio", value: "Está frio — reduza expectativa de sobremesas geladas." },
  ];

  return (
    <>
      {/* Controls */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/[0.08] to-transparent p-4 lg:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase text-fuchsia-300">
              <Sparkles className="h-3.5 w-3.5" /> Contexto para a IA
            </div>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ex: hoje está 34°C, temos promo de 20% no shake, e é véspera de feriado…"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-400 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {contextChips.map((c) => (
                <button
                  key={c.label}
                  onClick={() => setContext(c.value)}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/80 hover:bg-white/10"
                >
                  <c.icon className="h-3 w-3" /> {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold uppercase text-fuchsia-300 mb-1.5">Horizonte</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3, 4, 6].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizonOverride(h === defaultHorizon ? null : h)}
                    className={cn(
                      "rounded-lg py-2 text-xs font-black",
                      (horizonOverride ?? defaultHorizon) === h
                        ? "bg-fuchsia-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10",
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={onRun}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3 text-sm font-black text-white shadow-lg shadow-fuchsia-500/30 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Brain className="h-4 w-4" /> Gerar plano</>}
            </button>
            {plan && (
              <button
                onClick={onRun}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] font-bold text-white/60 hover:bg-white/10"
              >
                <RefreshCcw className="h-3 w-3" /> Atualizar
              </button>
            )}
          </div>
        </div>
        {plan?.aiError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{plan.aiError}</div>
          </div>
        )}
      </section>

      {loading && !plan && (
        <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-fuchsia-400" /></div>
      )}

      {plan && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Pedidos esperados" value={plan.totalExpectedOrders} icon={TrendingUp} tone="cyan" />
            <Kpi label="Unidades a montar" value={plan.totalPrepUnits} icon={Package} tone="fuchsia" />
            <Kpi label="Lotes" value={plan.totalPrepBatches} icon={ChefHat} tone="emerald" />
            <Kpi label="Tempo estimado" value={`${plan.totalPrepMinutes}min`} icon={Timer} tone="amber" />
            <Kpi label="Confiança IA" value={`${Math.round(plan.overallConfidence * 100)}%`} icon={Brain} tone={plan.overallConfidence > 0.6 ? "emerald" : plan.overallConfidence > 0.4 ? "amber" : "red"} />
          </div>

          {/* AI reasoning */}
          <section className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/[0.08] via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-fuchsia-300 mb-2">
              <Brain className="h-4 w-4" /> Raciocínio da IA
              <span className="ml-auto rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] text-fuchsia-200">
                × {plan.aiMultiplier.toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-white/90 mb-3">{plan.aiReasoning}</p>
            {plan.aiInsights.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-bold uppercase text-fuchsia-300/70 mb-1.5">Insights</div>
                  <ul className="space-y-1.5">
                    {plan.aiInsights.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                        <Info className="h-3.5 w-3.5 mt-1 text-cyan-300 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase text-fuchsia-300/70 mb-1.5">Recomendações</div>
                  <ul className="space-y-1.5">
                    {plan.aiRecommendations.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                        <ArrowRight className="h-3.5 w-3.5 mt-1 text-emerald-300 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          {/* Per-hour timeline */}
          {plan.perHour.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-black uppercase text-fuchsia-300 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Linha do tempo esperada
              </h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${plan.perHour.length}, minmax(0,1fr))` }}>
                {plan.perHour.map((h) => (
                  <div key={h.label} className={cn(
                    "rounded-xl border p-3 text-center",
                    h.rush === "pico" ? "border-red-400/40 bg-red-500/15" :
                    h.rush === "movimentado" ? "border-amber-400/40 bg-amber-500/15" :
                    h.rush === "normal" ? "border-cyan-400/30 bg-cyan-500/10" :
                    "border-white/10 bg-white/5",
                  )}>
                    <div className="text-[10px] font-bold uppercase text-white/60">{h.label}</div>
                    <div className="text-2xl font-black text-white mt-1">{h.expectedOrders}</div>
                    <div className="text-[10px] text-white/50 mt-1">pedidos • {h.rush}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Rows */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-sm font-black uppercase text-fuchsia-300 flex items-center gap-2">
                <ChefHat className="h-4 w-4" /> Plano por produto
              </h3>
              <div className="text-[11px] text-white/50">
                {plan.rows.length} produtos • gerado {new Date(plan.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {plan.rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-white/50">
                Nenhum produto marcado para pré-preparo. Ative na aba "Produtos".
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {plan.rows.map((r) => (
                  <PlanRow key={r.productId} r={r} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function PlanRow({ r }: { r: PrepPlan["rows"][number] }) {
  const rushColor = r.rush === "pico" ? "text-red-300 bg-red-500/15 border-red-400/30" :
    r.rush === "movimentado" ? "text-amber-300 bg-amber-500/15 border-amber-400/30" :
    r.rush === "normal" ? "text-cyan-300 bg-cyan-500/10 border-cyan-400/30" :
    "text-white/60 bg-white/5 border-white/10";
  const startAt = new Date(r.startAt);
  const peakAt = new Date(r.peakAt);
  return (
    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[64px,1fr,auto,auto,auto] md:items-center">
      <div className="h-14 w-14 rounded-xl overflow-hidden bg-black/30">
        {r.imageUrl ? (
          <img src={r.imageUrl} alt={r.productName} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-white/30"><Package className="h-5 w-5" /></div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-white">{r.productName}</span>
          {r.paused && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">pausado</span>}
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", rushColor)}>{r.rush}</span>
          <span className="text-[10px] text-white/40">P{r.priority}</span>
        </div>
        <div className="text-[11px] text-white/60 mt-0.5">{r.reason}</div>
        <div className="text-[10px] text-white/40 mt-0.5">
          Histórico: {r.historicalUnits} • Após IA: {r.expectedUnits} • Confiança {Math.round(r.confidence * 100)}%
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase text-white/50">Começar</div>
        <div className="text-sm font-black text-white">{startAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
        <div className="text-[10px] text-white/40">pico {peakAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase text-white/50">Lotes</div>
        <div className="text-lg font-black text-fuchsia-300">{r.suggestedBatches}</div>
        <div className="text-[10px] text-white/40">{r.yieldPerBatch} un/lote</div>
      </div>
      <div className="rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 px-4 py-2 text-center shadow-lg shadow-fuchsia-500/30">
        <div className="text-[10px] font-bold uppercase text-white/80">Pré-montar</div>
        <div className="text-2xl font-black text-white">{r.suggestedUnits}</div>
      </div>
    </div>
  );
}

/* ================================================================
 * PRODUCTS TAB
 * ================================================================ */

function ProductsTab({
  products, query, setQuery, onUpdate, onBulk, total,
}: {
  products: ProductRow[];
  query: string;
  setQuery: (v: string) => void;
  onUpdate: (id: string, patch: Partial<ProductRow>) => void;
  onBulk: (enabled: boolean) => void;
  total: number;
}) {
  const enabledCount = products.filter((p) => p.prep_enabled).length;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-black uppercase text-fuchsia-300">Produtos elegíveis</h3>
          <p className="text-xs text-white/50 mt-0.5">
            {enabledCount} ativos de {total} produtos • ajuste rendimento, tempo e prioridade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 w-56"
            />
          </div>
          <button onClick={() => onBulk(true)} className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-xs font-bold text-emerald-200">
            <Play className="mr-1 inline h-3 w-3" /> Ativar filtrados
          </button>
          <button onClick={() => onBulk(false)} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-bold text-white/70">
            <Pause className="mr-1 inline h-3 w-3" /> Pausar filtrados
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-[10px] uppercase text-white/40">
            <tr>
              <th className="text-left py-2 px-2">Produto</th>
              <th className="text-center px-2">Pré-preparo</th>
              <th className="text-center px-2">Rendimento (un/lote)</th>
              <th className="text-center px-2">Tempo (min)</th>
              <th className="text-center px-2">Vida útil (min)</th>
              <th className="text-center px-2">Lotes mín/máx</th>
              <th className="text-center px-2">Prioridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((p) => (
              <tr key={p.id} className={cn("hover:bg-white/[0.02]", !p.prep_enabled && "opacity-60")}>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/5 grid place-items-center text-white/30"><Package className="h-4 w-4" /></div>
                    )}
                    <div>
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-[11px] text-white/40">{p.category}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center px-2">
                  <button
                    onClick={() => onUpdate(p.id, { prep_enabled: !p.prep_enabled })}
                    className={cn("h-6 w-11 rounded-full transition-all", p.prep_enabled ? "bg-gradient-to-r from-fuchsia-500 to-pink-500" : "bg-white/10")}
                  >
                    <span className={cn("block h-5 w-5 rounded-full bg-white transition-all", p.prep_enabled ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                </td>
                <td className="text-center px-2">
                  <StepNum value={p.prep_yield_per_batch} min={1} max={100} onChange={(v) => onUpdate(p.id, { prep_yield_per_batch: v })} />
                </td>
                <td className="text-center px-2">
                  <StepNum value={p.prep_time_min} min={1} max={60} onChange={(v) => onUpdate(p.id, { prep_time_min: v })} />
                </td>
                <td className="text-center px-2">
                  <StepNum value={p.shelf_life_min} min={15} max={720} step={15} onChange={(v) => onUpdate(p.id, { shelf_life_min: v })} />
                </td>
                <td className="text-center px-2">
                  <div className="flex items-center justify-center gap-1">
                    <StepNum value={p.min_batches} min={0} max={p.max_batches} onChange={(v) => onUpdate(p.id, { min_batches: v })} compact />
                    <span className="text-white/30">/</span>
                    <StepNum value={p.max_batches} min={p.min_batches} max={20} onChange={(v) => onUpdate(p.id, { max_batches: v })} compact />
                  </div>
                </td>
                <td className="text-center px-2">
                  <div className="flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => onUpdate(p.id, { prep_priority: n })}
                        className={cn("h-2.5 w-2.5 rounded-full", n <= p.prep_priority ? "bg-fuchsia-500" : "bg-white/10")}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-white/40">Nenhum produto encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StepNum({
  value, min, max, step = 1, onChange, compact,
}: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; compact?: boolean }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 p-0.5", compact ? "text-xs" : "text-sm")}>
      <button onClick={() => onChange(clamp(value - step))} className="text-white/60 hover:text-white p-1"><MinusCircle className="h-3.5 w-3.5" /></button>
      <span className={cn("font-black text-white", compact ? "w-6" : "w-8", "text-center")}>{value}</span>
      <button onClick={() => onChange(clamp(value + step))} className="text-white/60 hover:text-white p-1"><PlusCircle className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/* ================================================================
 * SETTINGS TAB
 * ================================================================ */

function SettingsTab({
  settings, setSettings, save, saving,
}: {
  settings: Settings;
  setSettings: (v: Settings) => void;
  save: () => void;
  saving: boolean;
}) {
  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingCard title="Sistema" icon={Settings2}>
        <Toggle label="Sistema ativo" hint="Desligado, ninguém consegue rodar planos." checked={settings.enabled} onChange={(v) => upd("enabled", v)} />
        <Toggle label="Incluir produtos pausados" hint="Se desligado, ignora produtos com pause_until vigente." checked={settings.include_paused} onChange={(v) => upd("include_paused", v)} />
        <Toggle label="Arredondar para cima" hint="Sempre arredonda lotes fracionados para o próximo inteiro." checked={settings.round_up} onChange={(v) => upd("round_up", v)} />
        <Toggle label="Notificar cozinha automaticamente" hint="Ao gerar plano, envia push para o grupo de cozinha." checked={settings.auto_notify} onChange={(v) => upd("auto_notify", v)} />
        <Slider label="Auto-atualizar plano" hint="0 desliga. Roda em segundo plano na aba Plano." suffix="min" min={0} max={120} value={settings.auto_refresh_minutes} onChange={(v) => upd("auto_refresh_minutes", v)} />
      </SettingCard>

      <SettingCard title="Janela e Segurança" icon={Timer}>
        <Slider label="Horizonte padrão" suffix="h" min={1} max={6} value={settings.horizon_hours} onChange={(v) => upd("horizon_hours", v)} />
        <Slider label="Janela histórica" hint="Quantos dias para trás olhar." suffix="dias" min={14} max={180} value={settings.history_days} onChange={(v) => upd("history_days", v)} />
        <Slider label="Estoque de segurança" hint="Sobe a previsão para reduzir stockout." suffix="%" min={0} max={100} value={settings.safety_stock_pct} onChange={(v) => upd("safety_stock_pct", v)} />
        <Slider label="Meta de desperdício" hint="Guia o gestor. Não altera a fórmula ainda." suffix="%" min={0} max={30} value={settings.waste_target_pct} onChange={(v) => upd("waste_target_pct", v)} />
        <Slider label="Confiança mínima" hint="Abaixo disso, itens são marcados como incertos." suffix="%" min={0} max={100} value={settings.min_confidence_pct} onChange={(v) => upd("min_confidence_pct", v)} />
        <Slider label="Mínimo de lotes" hint="Sempre pelo menos X lotes por produto ativo." min={0} max={5} value={settings.min_batch_hint} onChange={(v) => upd("min_batch_hint", v)} />
      </SettingCard>

      <SettingCard title="Boosts contextuais" icon={Flame}>
        <Slider label="Boost fim de semana" hint="Aumenta previsão em sábado/domingo." suffix="%" min={0} max={80} value={settings.weekend_boost_pct} onChange={(v) => upd("weekend_boost_pct", v)} />
        <Slider label="Boost clima quente" hint="Sugerido no contexto. IA respeita esta faixa." suffix="%" min={0} max={80} value={settings.weather_boost_pct} onChange={(v) => upd("weather_boost_pct", v)} />
        <div>
          <div className="text-xs font-bold uppercase text-fuchsia-300 mb-2">Categorias incluídas</div>
          <ChipList value={settings.categories_included} options={CATEGORIES} onChange={(v) => upd("categories_included", v)} />
          <div className="text-[10px] text-white/40 mt-1">Vazio = todas.</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-fuchsia-300 mb-2">Categorias excluídas</div>
          <ChipList value={settings.categories_excluded} options={CATEGORIES} onChange={(v) => upd("categories_excluded", v)} />
        </div>
      </SettingCard>

      <SettingCard title="Modelo IA" icon={Brain}>
        <div>
          <div className="text-xs font-bold uppercase text-fuchsia-300 mb-2">Modelo</div>
          <select
            value={settings.ai_model}
            onChange={(e) => upd("ai_model", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (rápido)</option>
            <option value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (barato)</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (preciso)</option>
            <option value="google/gemini-3.5-flash">Gemini 3.5 Flash</option>
          </select>
        </div>
        <Slider label="Temperature" hint="0 = conservador. 1 = criativo." min={0} max={100} value={Math.round(settings.ai_temperature * 100)} onChange={(v) => upd("ai_temperature", v / 100)} suffix="/100" />
        <div>
          <div className="text-xs font-bold uppercase text-fuchsia-300 mb-2">Contexto permanente</div>
          <textarea
            value={settings.ai_context ?? ""}
            onChange={(e) => upd("ai_context", e.target.value)}
            rows={4}
            placeholder="Ex: nossa loja fica em Alagoas, verão longo, público jovem, delivery forte à noite..."
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30"
          />
          <div className="text-[10px] text-white/40 mt-1">Sempre enviado à IA junto com o contexto do dia.</div>
        </div>
      </SettingCard>

      <div className="lg:col-span-2 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-fuchsia-500/30 disabled:opacity-50"
        >
          {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <><Save className="mr-1 inline h-4 w-4" /> Salvar configurações</>}
        </button>
      </div>
    </div>
  );
}

function SettingCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-fuchsia-300">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-white">{label}</div>
        {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn("mt-1 h-6 w-11 shrink-0 rounded-full transition-all", checked ? "bg-gradient-to-r from-fuchsia-500 to-pink-500" : "bg-white/10")}
      >
        <span className={cn("block h-5 w-5 rounded-full bg-white transition-all", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

function Slider({
  label, hint, value, min, max, onChange, suffix,
}: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">{label}</div>
          {hint && <div className="text-[11px] text-white/50">{hint}</div>}
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-1 text-sm font-black text-white">{value}{suffix ? ` ${suffix}` : ""}</div>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-fuchsia-500" />
    </div>
  );
}

function ChipList({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
            className={cn("rounded-full px-3 py-1 text-xs font-bold", active ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: "cyan" | "fuchsia" | "emerald" | "amber" | "red" }) {
  const cls = {
    cyan: "text-cyan-300 bg-cyan-500/10",
    fuchsia: "text-fuchsia-300 bg-fuchsia-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    amber: "text-amber-300 bg-amber-500/10",
    red: "text-red-300 bg-red-500/10",
  }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase text-white/50">{label}</div>
      <div className="text-lg font-black text-white">{value}</div>
    </div>
  );
}
