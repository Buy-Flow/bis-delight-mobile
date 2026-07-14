import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronLeft,
  Flame,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { useIsAdmin } from "@/lib/menu-data";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { getDemandForecast, type DemandForecast } from "@/lib/forecast.functions";

export const Route = createFileRoute("/_authenticated/previsao")({
  head: () => ({
    meta: [
      { title: "Previsão de Demanda — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrevisaoPage,
});

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const RUSH_COLORS: Record<string, string> = {
  calmo: "#4c1d95",
  normal: "#7c3aed",
  movimentado: "#ec4899",
  pico: "#facc15",
};
const RUSH_LABEL: Record<string, string> = {
  calmo: "Calmo",
  normal: "Normal",
  movimentado: "Movimentado",
  pico: "Pico",
};

function PrevisaoPage() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const runForecast = useServerFn(getDemandForecast);

  const [days, setDays] = useState<30 | 60 | 90>(60);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemandForecast | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const res = await runForecast({ data: { days: d } });
      setData(res);
      if (res.aiError) toast.warning(res.aiError);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, days]);

  if (adminLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[oklch(0.11_0.08_300)] text-white/70">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isAdmin === false) {
    return (
      <div className="grid min-h-screen place-items-center bg-[oklch(0.11_0.08_300)] p-6 text-center text-white/80">
        <div>
          <p className="mb-4">Acesso restrito.</p>
          <Link to="/" className="text-neon-yellow underline">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const target = data?.target;
  const chartData =
    target?.hours.map((h) => ({
      label: `${String(h.hour).padStart(2, "0")}h`,
      full: h.label,
      orders: h.expectedOrders,
      revenue: h.expectedRevenue,
      rush: h.rushLevel,
      confidence: h.confidence,
      note: h.note,
    })) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.11_0.08_300)] via-[oklch(0.13_0.09_300)] to-[oklch(0.09_0.06_300)] pb-20 text-white">


      <main className="mx-auto max-w-5xl px-3 pt-4">
        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5 text-xs">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1.5 transition",
                  days === d
                    ? "bg-neon-pink/80 text-white"
                    : "text-white/70 hover:bg-white/10",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-1.5 text-xs font-semibold text-neon-yellow hover:bg-neon-yellow/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Recalcular com IA
          </button>
        </div>

        {loading && !data ? (
          <ForecastSkeleton />
        ) : !data ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            Nenhum dado ainda.
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi
                icon={<Activity className="h-4 w-4 text-neon-pink" />}
                label="Pedidos previstos 24h"
                value={target ? target.totalExpectedOrders.toString() : "—"}
              />
              <Kpi
                icon={<Wallet className="h-4 w-4 text-neon-yellow" />}
                label="Faturamento previsto"
                value={target ? brl(target.totalExpectedRevenue) : "—"}
              />
              <Kpi
                icon={<Flame className="h-4 w-4 text-orange-400" />}
                label="Hora de pico"
                value={target?.peakHour ?? "—"}
              />
              <Kpi
                icon={<Brain className="h-4 w-4 text-emerald-300" />}
                label="Confiança IA"
                value={
                  target
                    ? `${Math.round(target.overallConfidence * 100)}%`
                    : "—"
                }
              />
            </div>

            {data.aiError && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-3 text-xs text-orange-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
                <div>
                  <div className="font-semibold">Fallback ativado</div>
                  <div className="opacity-90">{data.aiError}</div>
                  <div className="mt-1 opacity-75">
                    A curva abaixo usa a média histórica como estimativa.
                  </div>
                </div>
              </div>
            )}

            {/* Chart card */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">Próximas 24 horas</h2>
                <div className="flex items-center gap-2 text-[10px] text-white/60">
                  {(["calmo", "normal", "movimentado", "pico"] as const).map(
                    (r) => (
                      <span key={r} className="inline-flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: RUSH_COLORS[r] }}
                        />
                        {RUSH_LABEL[r]}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#ffffff" stopOpacity="0.06" />
                        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                      interval={1}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{
                        background: "oklch(0.13 0.09 300)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#fff" }}
                      formatter={(v: number, k) =>
                        k === "orders"
                          ? [`${v} pedidos`, "Previsão"]
                          : [brl(v), "Faturamento"]
                      }
                      labelFormatter={(_, p) =>
                        (p?.[0]?.payload as { full?: string })?.full ?? ""
                      }
                    />
                    <Bar
                      dataKey="orders"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                    >
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={RUSH_COLORS[d.rush]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Revenue mini area */}
            <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-1 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-white/80">
                  Faturamento previsto (24h)
                </h3>
                <span className="text-[10px] text-white/50">
                  Total {target ? brl(target.totalExpectedRevenue) : "—"}
                </span>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#facc15" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.13 0.09 300)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [brl(v), "Faturamento"]}
                      labelFormatter={(_, p) =>
                        (p?.[0]?.payload as { full?: string })?.full ?? ""
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#facc15"
                      strokeWidth={2}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Insights + Recommendations */}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Panel
                title="Padrões detectados"
                icon={<TrendingUp className="h-4 w-4 text-neon-pink" />}
                items={data.insights}
                empty="A IA não retornou padrões. Aumente o histórico."
              />
              <Panel
                title="Recomendações para agora"
                icon={<Lightbulb className="h-4 w-4 text-neon-yellow" />}
                items={data.recommendations}
                empty="Sem recomendações no momento."
              />
            </div>

            {/* Hour-by-hour list */}
            <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <h3 className="mb-2 px-1 text-xs font-semibold text-white/80">
                Detalhe hora a hora
              </h3>
              <ul className="divide-y divide-white/5">
                {target?.hours.map((h) => (
                  <li
                    key={h.hourStart}
                    className="flex items-center gap-3 px-1 py-2"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: RUSH_COLORS[h.rushLevel] }}
                    />
                    <div className="w-16 shrink-0 text-xs text-white/70">
                      {h.label}
                    </div>
                    <div className="flex-1 text-sm">
                      <div className="font-semibold">
                        {h.expectedOrders} pedidos
                        <span className="ml-2 text-xs font-normal text-white/50">
                          {brl(h.expectedRevenue)}
                        </span>
                      </div>
                      {h.note && (
                        <div className="text-[11px] text-white/50">{h.note}</div>
                      )}
                    </div>
                    <div className="text-right text-[10px] text-white/40">
                      {Math.round(h.confidence * 100)}%
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Heatmap */}
            <Heatmap heatmap={data.heatmap} />

            <p className="mt-4 text-center text-[10px] text-white/40">
              Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")} ·{" "}
              {data.totalOrders} pedidos analisados nos últimos {data.historyDays}{" "}
              dias
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/50">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Panel({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-1 text-xs text-white/50">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs text-white/85"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neon-yellow" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Heatmap({
  heatmap,
}: {
  heatmap: DemandForecast["heatmap"];
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const r of heatmap) for (const c of r) if (c.orders > m) m = c.orders;
    return m || 1;
  }, [heatmap]);

  return (
    <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <TrendingDown className="h-4 w-4 rotate-180 text-neon-pink" />
        <h3 className="text-sm font-semibold">Mapa de calor histórico</h3>
      </div>
      {/* Dias em cima, horas na lateral — cabe inteiro na tela, sem rolar */}
      <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] gap-[2px] text-[10px] text-white/50">
        <div />
        {DOW.map((d, i) => (
          <div key={i} className="text-center font-semibold text-white/60">
            {d}
          </div>
        ))}
      </div>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="mt-[2px] grid grid-cols-[28px_repeat(7,minmax(0,1fr))] items-center gap-[2px]"
        >
          <div className="pr-1 text-right text-[9px] tabular-nums text-white/40">
            {h % 3 === 0 ? `${h.toString().padStart(2, "0")}h` : ""}
          </div>
          {heatmap.map((row, dow) => {
            const cell = row[h];
            const intensity = cell.orders / max;
            const alpha = Math.max(0.05, Math.min(1, intensity));
            return (
              <div
                key={dow}
                title={`${DOW[dow]} ${h}h · ${cell.orders.toFixed(1)} ped/ocor.`}
                className="h-3 rounded-[3px]"
                style={{
                  background: `rgba(236, 72, 153, ${alpha.toFixed(2)})`,
                  boxShadow:
                    intensity > 0.7
                      ? "0 0 0 1px rgba(250, 204, 21, 0.5)"
                      : "inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              />
            );
          })}
        </div>
      ))}
      <p className="mt-2 px-1 text-[10px] text-white/40">
        Pedidos médios por hora do dia (linhas) × dia da semana (colunas). Tons
        mais fortes = mais movimento. Contorno amarelo destaca picos.
      </p>
    </section>
  );
}


function ForecastSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-20 rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="skeleton-shimmer h-64 rounded-2xl border border-white/10 bg-white/[0.04]" />
      <div className="skeleton-shimmer h-32 rounded-2xl border border-white/10 bg-white/[0.04]" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="skeleton-shimmer h-40 rounded-2xl border border-white/10 bg-white/[0.04]" />
        <div className="skeleton-shimmer h-40 rounded-2xl border border-white/10 bg-white/[0.04]" />
      </div>
      <div className="skeleton-shimmer h-56 rounded-2xl border border-white/10 bg-white/[0.04]" />
    </div>
  );
}
