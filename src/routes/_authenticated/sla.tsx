import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SLA,
  computeSla,
  type SlaSettings,
  type SlaHistoryRow,
} from "@/lib/sla";
import { SlaBadge, SlaBar } from "@/components/admin/SlaBadge";
import {
  Save,
  Loader2,
  Gauge,
  Activity,
  Bike,
  Package,
  UtensilsCrossed,
  Bell,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sla")({
  head: () => ({
    meta: [
      { title: "SLA de Pedidos — Painel" },
      {
        name: "description",
        content:
          "Semáforo visual por pedido: configure limites verde/amarelo/vermelho, use média histórica e receba alertas de atraso.",
      },
    ],
  }),
  component: SlaAdminPage,
});

const MODES: { key: "entrega" | "retirada" | "mesa"; label: string; icon: any }[] = [
  { key: "entrega", label: "Entrega", icon: Bike },
  { key: "retirada", label: "Retirada", icon: Package },
  { key: "mesa", label: "Mesa", icon: UtensilsCrossed },
];

function SlaAdminPage() {
  const [settings, setSettings] = useState<SlaSettings>(DEFAULT_SLA);
  const [history, setHistory] = useState<SlaHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simMode, setSimMode] = useState<"entrega" | "retirada" | "mesa">("entrega");
  const [simMinutes, setSimMinutes] = useState(18);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("sla_settings").select("*").eq("id", 1).maybeSingle();
      if (alive && data) setSettings({ ...DEFAULT_SLA, ...(data as any) });
      const { data: h } = await supabase.rpc("get_sla_history", {
        lookback_days: (data as any)?.historical_lookback_days ?? 30,
      });
      if (alive && Array.isArray(h)) setHistory(h as SlaHistoryRow[]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const historyMap = useMemo(() => {
    const map: Record<string, SlaHistoryRow> = {};
    for (const r of history) map[r.mode] = r;
    return map;
  }, [history]);

  const patch = (p: Partial<SlaSettings>) => setSettings((s) => ({ ...s, ...p }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("sla_settings")
      .update({
        enabled: settings.enabled,
        mode: settings.mode,
        green_max_entrega: settings.green_max_entrega,
        yellow_max_entrega: settings.yellow_max_entrega,
        green_max_retirada: settings.green_max_retirada,
        yellow_max_retirada: settings.yellow_max_retirada,
        green_max_mesa: settings.green_max_mesa,
        yellow_max_mesa: settings.yellow_max_mesa,
        historical_green_factor: settings.historical_green_factor,
        historical_yellow_factor: settings.historical_yellow_factor,
        historical_lookback_days: settings.historical_lookback_days,
        warn_before_red_pct: settings.warn_before_red_pct,
        auto_notify_admin: settings.auto_notify_admin,
        auto_notify_on: settings.auto_notify_on,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("SLA salvo. Aplicando ao vivo em todas as telas.");
  };

  const simSla = computeSla(
    {
      created_at: new Date(Date.now() - simMinutes * 60_000).toISOString(),
      mode: simMode,
      status: "preparando",
    },
    Date.now(),
    settings,
    historyMap,
  );

  if (loading) {
    return (
      <AdminShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 text-white">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black">Semáforo SLA</h1>
            <p className="mt-1 max-w-xl text-sm text-white/60">
              Visualize instantaneamente se cada pedido está no prazo. Verde =
              tudo certo, amarelo = atenção, vermelho = atrasado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
                className="h-4 w-4 accent-emerald-400"
              />
              <span className="font-bold">
                {settings.enabled ? "Ativado" : "Desativado"}
              </span>
            </label>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        </header>

        {/* Mode */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
            <Gauge className="h-4 w-4" />
            <span className="font-bold uppercase tracking-wider">Modo de cálculo</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              onClick={() => patch({ mode: "fixed" })}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                settings.mode === "fixed"
                  ? "border-emerald-400/60 bg-emerald-400/10"
                  : "border-white/10 bg-black/20 hover:border-white/20",
              )}
            >
              <div className="font-display text-lg font-black">Limites fixos</div>
              <p className="mt-1 text-xs text-white/60">
                Você define quantos minutos são verde, amarelo e vermelho para cada modo.
              </p>
            </button>
            <button
              onClick={() => patch({ mode: "historical" })}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                settings.mode === "historical"
                  ? "border-emerald-400/60 bg-emerald-400/10"
                  : "border-white/10 bg-black/20 hover:border-white/20",
              )}
            >
              <div className="flex items-center gap-2 font-display text-lg font-black">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                Média histórica
              </div>
              <p className="mt-1 text-xs text-white/60">
                Calcula automaticamente pelo tempo real dos últimos pedidos ×
                multiplicadores.
              </p>
            </button>
          </div>
        </section>

        {/* Historical stats */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
            <BarChart3 className="h-4 w-4" />
            <span className="font-bold uppercase tracking-wider">
              Histórico ({settings.historical_lookback_days} dias)
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {MODES.map(({ key, label, icon: Icon }) => {
              const row = historyMap[key];
              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white/80">
                    <Icon className="h-4 w-4" /> {label}
                  </div>
                  {row ? (
                    <>
                      <div className="mt-2 font-display text-3xl font-black text-emerald-300">
                        {row.avg_minutes}m
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-white/50">
                        <div>P50 {row.p50_minutes}m</div>
                        <div>P90 {row.p90_minutes}m</div>
                        <div>{row.sample_size} ped.</div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-xs text-white/40">Sem dados suficientes.</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Thresholds per mode (fixed) */}
        {settings.mode === "fixed" ? (
          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">Limites por modo (min)</span>
            </div>
            {MODES.map(({ key, label, icon: Icon }) => {
              const gk = `green_max_${key}` as keyof SlaSettings;
              const yk = `yellow_max_${key}` as keyof SlaSettings;
              const g = settings[gk] as number;
              const y = settings[yk] as number;
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-white/80">
                    <Icon className="h-4 w-4" /> {label}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Verde até
                        </span>
                        <span className="font-mono">{g}m</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={90}
                        value={g}
                        onChange={(e) => patch({ [gk]: Number(e.target.value) } as any)}
                        className="w-full accent-emerald-400"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-400" /> Amarelo até
                        </span>
                        <span className="font-mono">{y}m</span>
                      </div>
                      <input
                        type="range"
                        min={g + 1}
                        max={180}
                        value={y}
                        onChange={(e) => patch({ [yk]: Number(e.target.value) } as any)}
                        className="w-full accent-amber-400"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-white/50">
                    <div className="h-1.5 flex-1 rounded-l-full bg-emerald-500" style={{ flex: g }} />
                    <div className="h-1.5 flex-1 bg-amber-400" style={{ flex: y - g }} />
                    <div className="h-1.5 flex-1 rounded-r-full bg-red-500" style={{ flex: 20 }} />
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
              <TrendingUp className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">Multiplicadores históricos</span>
            </div>
            <p className="text-xs text-white/50">
              Verde = média × {settings.historical_green_factor}. Amarelo = média ×{" "}
              {settings.historical_yellow_factor}. Acima disso vira vermelho.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                  <span>Fator verde</span>
                  <span className="font-mono">×{settings.historical_green_factor}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={settings.historical_green_factor}
                  onChange={(e) => patch({ historical_green_factor: Number(e.target.value) })}
                  className="w-full accent-emerald-400"
                />
              </label>
              <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                  <span>Fator amarelo</span>
                  <span className="font-mono">×{settings.historical_yellow_factor}</span>
                </div>
                <input
                  type="range"
                  min={Number(settings.historical_green_factor) + 0.1}
                  max={3.0}
                  step={0.05}
                  value={settings.historical_yellow_factor}
                  onChange={(e) => patch({ historical_yellow_factor: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
              </label>
              <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                  <span>Janela histórica</span>
                  <span className="font-mono">{settings.historical_lookback_days}d</span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={90}
                  value={settings.historical_lookback_days}
                  onChange={(e) => patch({ historical_lookback_days: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </label>
            </div>
          </section>
        )}

        {/* Warn + notify */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">Aviso antes do vermelho</span>
            </div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
              <span>Piscar alerta quando atingir</span>
              <span className="font-mono">{settings.warn_before_red_pct}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={settings.warn_before_red_pct}
              onChange={(e) => patch({ warn_before_red_pct: Number(e.target.value) })}
              className="w-full accent-orange-400"
            />
            <p className="mt-2 text-xs text-white/50">
              Ao ultrapassar essa fração da zona amarela, o cartão passa a
              piscar em laranja para chamar atenção.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm text-white/70">
              <Bell className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">Notificação automática</span>
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.auto_notify_admin}
                onChange={(e) => patch({ auto_notify_admin: e.target.checked })}
                className="h-4 w-4 accent-emerald-400"
              />
              Avisar admin quando cruzar o limite
            </label>
            <div className="mt-3 flex gap-2">
              {(["yellow", "red"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => patch({ auto_notify_on: k })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold ring-1",
                    settings.auto_notify_on === k
                      ? k === "red"
                        ? "bg-red-500 text-white ring-red-400"
                        : "bg-amber-400 text-amber-950 ring-amber-300"
                      : "bg-white/5 text-white/70 ring-white/10",
                  )}
                >
                  {k === "red" ? "Ao ficar vermelho" : "Já no amarelo"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Simulator */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
            <Gauge className="h-4 w-4" />
            <span className="font-bold uppercase tracking-wider">Simulador em tempo real</span>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {MODES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSimMode(key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1",
                      simMode === key
                        ? "bg-emerald-500 text-emerald-950 ring-emerald-400"
                        : "bg-white/5 text-white/70 ring-white/10",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <label className="block">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                  <span>Tempo decorrido do pedido</span>
                  <span className="font-mono">{simMinutes} min</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={simMinutes}
                  onChange={(e) => setSimMinutes(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </label>
              <div className="text-[11px] text-white/50">
                Verde até <b className="text-emerald-300">{simSla.greenMax}m</b>{" "}
                • amarelo até <b className="text-amber-300">{simSla.yellowMax}m</b>.
              </div>
            </div>
            <div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-white/50">
                  Prévia
                </span>
                <SlaBadge sla={simSla} />
              </div>
              <div className="mt-3 font-display text-4xl font-black">
                {Math.round(simSla.elapsedMin)}
                <span className="text-lg text-white/40">m</span>
              </div>
              <div className="mt-2">
                <SlaBar sla={simSla} />
              </div>
              <p className="mt-2 text-xs text-white/60">{simSla.label}</p>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
