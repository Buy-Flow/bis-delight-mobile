import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Loader2,
  Minus,
  Sparkles,
  Trophy,
  TrendingDown as TDown,
  TrendingUp as TUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

/**
 * Comparativo Semana / Mês / Ano — apples-to-apples com o período anterior.
 *
 * • Semana: Seg (00:00) → agora, comparado com a semana anterior alinhada (mesmo dia da semana e mesma hora).
 * • Mês: dia 1 → agora, comparado com dia 1 do mês passado → mesmo instante do mês passado.
 * • Ano: 1º Jan → agora, comparado com 1º Jan do ano passado → mesmo instante.
 *
 * Todos os cálculos usam apenas pedidos "pago" ou "entregue" (receita real).
 */

type Mode = "semana" | "mes" | "ano";

type OrderRow = {
  id: string;
  user_id: string;
  total: number;
  status: string;
  created_at: string;
};

type PeriodDef = {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: "dow" | "day-of-month" | "month";
  buckets: number;
  labels: string[];
};

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/* ---------------- Period math ---------------- */

function startOfWeekMon(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Dom..6=Sáb
  const offset = (day + 6) % 7; // 0 se seg
  x.setDate(x.getDate() - offset);
  return x;
}

function periodDef(mode: Mode): PeriodDef {
  const now = new Date();
  if (mode === "semana") {
    const from = startOfWeekMon(now);
    const to = now;
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - 7);
    const prevTo = new Date(to);
    prevTo.setDate(prevTo.getDate() - 7);
    return {
      from,
      to,
      prevFrom,
      prevTo,
      bucket: "dow",
      buckets: 7,
      labels: DOW,
    };
  }
  if (mode === "mes") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = now;
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    prevTo.setHours(now.getHours(), now.getMinutes(), 0, 0);
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return {
      from,
      to,
      prevFrom,
      prevTo,
      bucket: "day-of-month",
      buckets: dim,
      labels: Array.from({ length: dim }, (_, i) => String(i + 1)),
    };
  }
  // ano
  const from = new Date(now.getFullYear(), 0, 1);
  const to = now;
  const prevFrom = new Date(now.getFullYear() - 1, 0, 1);
  const prevTo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  prevTo.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return {
    from,
    to,
    prevFrom,
    prevTo,
    bucket: "month",
    buckets: 12,
    labels: MESES,
  };
}

function bucketIndex(d: Date, def: PeriodDef): number {
  if (def.bucket === "dow") return (d.getDay() + 6) % 7; // Seg=0..Dom=6
  if (def.bucket === "day-of-month") return d.getDate() - 1;
  return d.getMonth();
}

/** current bucket index (0-based) up to which "now" reached. Everything above
 * this in the previous period counts as "futuro" no atual — usamos pra separar
 * "comparativo até aqui" de "resto do período anterior". */
function currentUpTo(def: PeriodDef): number {
  const now = new Date();
  return bucketIndex(now, def);
}

/* ---------------- Component ---------------- */

export function FinanceComparative() {
  const [mode, setMode] = useState<Mode>("semana");
  const [loading, setLoading] = useState(true);
  const [cur, setCur] = useState<OrderRow[]>([]);
  const [prev, setPrev] = useState<OrderRow[]>([]);

  const def = useMemo(() => periodDef(mode), [mode]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [a, b] = await Promise.all([
          supabase
            .from("orders")
            .select("id,user_id,total,status,created_at")
            .gte("created_at", def.from.toISOString())
            .lte("created_at", def.to.toISOString()),
          supabase
            .from("orders")
            .select("id,user_id,total,status,created_at")
            .gte("created_at", def.prevFrom.toISOString())
            .lte("created_at", def.prevTo.toISOString()),
        ]);
        if (cancel) return;
        setCur((a.data ?? []) as OrderRow[]);
        setPrev((b.data ?? []) as OrderRow[]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [def.from, def.to, def.prevFrom, def.prevTo]);

  /* ---- derived: paid only ---- */
  const paidCur = useMemo(
    () => cur.filter((o) => o.status === "pago" || o.status === "entregue"),
    [cur],
  );
  const paidPrev = useMemo(
    () => prev.filter((o) => o.status === "pago" || o.status === "entregue"),
    [prev],
  );

  /* ---- KPI totals ---- */
  const totals = useMemo(() => {
    const sum = (rows: OrderRow[]) => ({
      revenue: rows.reduce((s, o) => s + Number(o.total || 0), 0),
      orders: rows.length,
      customers: new Set(rows.map((o) => o.user_id)).size,
    });
    const c = sum(paidCur);
    const p = sum(paidPrev);
    const cticket = c.orders > 0 ? c.revenue / c.orders : 0;
    const pticket = p.orders > 0 ? p.revenue / p.orders : 0;
    return { c: { ...c, ticket: cticket }, p: { ...p, ticket: pticket } };
  }, [paidCur, paidPrev]);

  /* ---- buckets: current vs previous side-by-side ---- */
  const series = useMemo(() => {
    const cSum = Array(def.buckets).fill(0);
    const pSum = Array(def.buckets).fill(0);
    const cCnt = Array(def.buckets).fill(0);
    const pCnt = Array(def.buckets).fill(0);
    for (const o of paidCur) {
      const i = bucketIndex(new Date(o.created_at), def);
      cSum[i] += Number(o.total || 0);
      cCnt[i] += 1;
    }
    for (const o of paidPrev) {
      const i = bucketIndex(new Date(o.created_at), def);
      pSum[i] += Number(o.total || 0);
      pCnt[i] += 1;
    }
    const upto = currentUpTo(def);
    return def.labels.map((label, i) => ({
      label,
      atual: Math.round(cSum[i]),
      anterior: Math.round(pSum[i]),
      atualOrders: cCnt[i],
      anteriorOrders: pCnt[i],
      future: i > upto,
    }));
  }, [def, paidCur, paidPrev]);

  /* ---- projection to end of period ---- */
  const projection = useMemo(() => {
    if (mode === "ano") return null;
    const upto = currentUpTo(def);
    const now = new Date();

    // fração de "tempo" completada no bucket atual
    let progress = upto + 1;
    if (mode === "semana") {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const frac = (now.getTime() - startOfDay.getTime()) / (24 * 3600_000);
      progress = upto + frac;
    } else if (mode === "mes") {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const frac = (now.getTime() - startOfDay.getTime()) / (24 * 3600_000);
      progress = upto + frac;
    }
    if (progress <= 0) return null;
    const paceRev = totals.c.revenue / progress;
    const paceOrd = totals.c.orders / progress;
    const projRev = paceRev * def.buckets;
    const projOrd = paceOrd * def.buckets;
    return {
      revenue: projRev,
      orders: Math.round(projOrd),
      // versus total anterior completo
      vsPrev: pctDelta(projRev, totals.p.revenue + prevFutureSum(def, paidPrev, upto)),
    };
  }, [mode, def, totals, paidPrev]);

  /* ---- best/worst comparative day (only within elapsed range) ---- */
  const highlights = useMemo(() => {
    const upto = currentUpTo(def);
    const rows = series
      .slice(0, upto + 1)
      .map((r) => ({ ...r, delta: pctDelta(r.atual, r.anterior) }));
    const withPrev = rows.filter((r) => r.anterior > 0);
    if (withPrev.length === 0) return null;
    const best = withPrev.reduce((a, b) => (b.delta > a.delta ? b : a));
    const worst = withPrev.reduce((a, b) => (b.delta < a.delta ? b : a));
    return { best, worst };
  }, [def, series]);

  /* ---- insights ---- */
  const insights = useMemo(() => {
    const out: string[] = [];
    const deltaRev = pctDelta(totals.c.revenue, totals.p.revenue);
    const deltaOrd = pctDelta(totals.c.orders, totals.p.orders);
    const deltaTk = pctDelta(totals.c.ticket, totals.p.ticket);
    const label = mode === "semana" ? "semana" : mode === "mes" ? "mês" : "ano";

    if (Math.abs(deltaRev) < 3) {
      out.push(`Faturamento estável em relação ao ${label} anterior.`);
    } else {
      out.push(
        `Faturamento ${deltaRev > 0 ? "cresceu" : "caiu"} ${Math.abs(deltaRev).toFixed(1)}% vs ${label} anterior (${brl(totals.c.revenue)} vs ${brl(totals.p.revenue)}).`,
      );
    }
    if (Math.abs(deltaOrd - deltaRev) > 8) {
      out.push(
        deltaOrd > deltaRev
          ? `Mais pedidos, mas ticket médio recuou ${Math.abs(deltaTk).toFixed(1)}%.`
          : `Menos pedidos, porém ticket médio subiu ${Math.abs(deltaTk).toFixed(1)}%.`,
      );
    } else if (Math.abs(deltaTk) > 10) {
      out.push(
        `Ticket médio ${deltaTk > 0 ? "subiu" : "recuou"} ${Math.abs(deltaTk).toFixed(1)}% para ${brl(totals.c.ticket)}.`,
      );
    }
    if (highlights) {
      out.push(
        `Melhor dia relativo: ${highlights.best.label} (+${highlights.best.delta.toFixed(0)}%).`,
      );
      if (highlights.worst.delta < -5) {
        out.push(
          `Atenção: ${highlights.worst.label} caiu ${Math.abs(highlights.worst.delta).toFixed(0)}%.`,
        );
      }
    }
    if (projection && mode !== "ano") {
      out.push(
        `Projeção: fechar ${label} em ${brl(projection.revenue)} (${projection.vsPrev >= 0 ? "+" : ""}${projection.vsPrev.toFixed(1)}% vs ${label} anterior completo).`,
      );
    }
    return out;
  }, [totals, highlights, projection, mode]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-neon-cyan" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
            Comparativo período
          </h2>
        </div>
        <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest">
          {(
            [
              { id: "semana" as const, label: "Semana" },
              { id: "mes" as const, label: "Mês" },
              { id: "ano" as const, label: "Ano" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={cn(
                "px-4 py-1.5 transition",
                mode === t.id
                  ? "bg-neon-pink text-white shadow-[0_0_16px_-6px_var(--neon-pink)]"
                  : "text-white/60 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Range description */}
      <p className="mb-4 text-[11px] text-white/50">
        <span className="text-neon-pink">Atual:</span> {fmt(def.from)} →{" "}
        {fmt(def.to)} <span className="mx-1">·</span>
        <span className="text-white/70">Anterior:</span> {fmt(def.prevFrom)} →{" "}
        {fmt(def.prevTo)}
      </p>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CompareKpi
              label="Faturamento"
              current={brl(totals.c.revenue)}
              previous={brl(totals.p.revenue)}
              delta={pctDelta(totals.c.revenue, totals.p.revenue)}
            />
            <CompareKpi
              label="Pedidos"
              current={String(totals.c.orders)}
              previous={String(totals.p.orders)}
              delta={pctDelta(totals.c.orders, totals.p.orders)}
            />
            <CompareKpi
              label="Ticket médio"
              current={brl(totals.c.ticket)}
              previous={brl(totals.p.ticket)}
              delta={pctDelta(totals.c.ticket, totals.p.ticket)}
            />
            <CompareKpi
              label="Clientes"
              current={String(totals.c.customers)}
              previous={String(totals.p.customers)}
              delta={pctDelta(totals.c.customers, totals.p.customers)}
            />
          </div>

          {/* Projection card (semana/mes) */}
          {projection && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-yellow/30 bg-neon-yellow/5 p-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-neon-yellow" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
                    Projeção fim de {mode === "semana" ? "semana" : "mês"}
                  </div>
                  <div className="text-sm text-white">
                    <span className="font-bold">{brl(projection.revenue)}</span>{" "}
                    ·{" "}
                    <span className="text-white/70">
                      ~{projection.orders} pedidos
                    </span>
                  </div>
                </div>
              </div>
              <DeltaPill delta={projection.vsPrev} />
            </div>
          )}

          {/* Chart */}
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 8, right: 10, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cmpCur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--neon-pink)" stopOpacity="1" />
                    <stop offset="1" stopColor="var(--neon-pink)" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                  interval={mode === "mes" ? 2 : 0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                  contentStyle={{
                    background: "oklch(0.13 0.09 300)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#fff", fontWeight: 600 }}
                  formatter={(v: number, k) => [
                    brl(v),
                    k === "atual" ? "Atual" : "Anterior",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}
                  iconType="plainline"
                />
                <Line
                  name="Anterior"
                  type="monotone"
                  dataKey="anterior"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive
                />
                <Line
                  name="Atual"
                  type="monotone"
                  dataKey="atual"
                  stroke="url(#cmpCur)"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props as {
                      cx: number;
                      cy: number;
                      payload: { future?: boolean };
                      index: number;
                    };
                    if (payload?.future) return <g key={index} />;
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="var(--neon-pink)"
                      />
                    );
                  }}
                  activeDot={{ r: 5, fill: "var(--neon-pink)" }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Best / worst */}
          {highlights && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <HighlightCard tone="good" hi={highlights.best} label="Melhor dia" />
              <HighlightCard tone="bad" hi={highlights.worst} label="Pior dia" />
            </div>
          )}

          {/* Detailed grid */}
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                  <th className="py-2 pr-2 text-left font-medium">
                    {mode === "semana" ? "Dia" : mode === "mes" ? "Dia" : "Mês"}
                  </th>
                  <th className="py-2 pr-2 text-right font-medium">Atual</th>
                  <th className="py-2 pr-2 text-right font-medium">Anterior</th>
                  <th className="py-2 pr-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {series.map((r) => (
                  <tr
                    key={r.label}
                    className={cn(
                      "border-b border-white/5",
                      r.future && "opacity-40",
                    )}
                  >
                    <td className="py-1.5 pr-2 text-white/70">{r.label}</td>
                    <td className="py-1.5 pr-2 text-right text-white">
                      {brl(r.atual)}
                      {r.atualOrders > 0 && (
                        <span className="ml-1 text-[10px] text-white/40">
                          ({r.atualOrders})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-white/60">
                      {brl(r.anterior)}
                      {r.anteriorOrders > 0 && (
                        <span className="ml-1 text-[10px] text-white/30">
                          ({r.anteriorOrders})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {r.future ? (
                        <span className="text-white/30">—</span>
                      ) : (
                        <DeltaText
                          delta={pctDelta(r.atual, r.anterior)}
                          hasPrev={r.anterior > 0}
                          hasCur={r.atual > 0}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
                <Sparkles className="h-3.5 w-3.5 text-neon-yellow" />
                Insights automáticos
              </div>
              <ul className="space-y-1.5">
                {insights.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-white/85"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neon-pink" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ---------------- Helpers ---------------- */

function pctDelta(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function prevFutureSum(def: PeriodDef, prevOrders: OrderRow[], uptoIdx: number) {
  let s = 0;
  for (const o of prevOrders) {
    const i = bucketIndex(new Date(o.created_at), def);
    if (i > uptoIdx) s += Number(o.total || 0);
  }
  return s;
}

/* ---------------- Sub-components ---------------- */

function CompareKpi({
  label,
  current,
  previous,
  delta,
}: {
  label: string;
  current: string;
  previous: string;
  delta: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-white">{current}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/40">antes {previous}</span>
        <DeltaPill delta={delta} compact />
      </div>
    </div>
  );
}

function DeltaPill({
  delta,
  compact,
}: {
  delta: number;
  compact?: boolean;
}) {
  const zero = Math.abs(delta) < 0.5;
  const up = delta > 0;
  const Icon = zero ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold",
        compact ? "text-[10px]" : "text-xs",
        zero
          ? "bg-white/5 text-white/60"
          : up
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-rose-500/15 text-rose-300",
      )}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {zero ? "0%" : `${up ? "+" : ""}${delta.toFixed(1)}%`}
    </span>
  );
}

function DeltaText({
  delta,
  hasPrev,
  hasCur,
}: {
  delta: number;
  hasPrev: boolean;
  hasCur: boolean;
}) {
  if (!hasPrev && !hasCur) return <span className="text-white/30">—</span>;
  if (!hasPrev) return <span className="text-emerald-300">novo</span>;
  if (!hasCur) return <span className="text-rose-300">−100%</span>;
  const zero = Math.abs(delta) < 0.5;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "font-bold",
        zero ? "text-white/60" : up ? "text-emerald-300" : "text-rose-300",
      )}
    >
      {zero ? "0%" : `${up ? "+" : ""}${delta.toFixed(1)}%`}
    </span>
  );
}

function HighlightCard({
  hi,
  label,
  tone,
}: {
  hi: { label: string; atual: number; anterior: number; delta: number };
  label: string;
  tone: "good" | "bad";
}) {
  const Icon = tone === "good" ? TUp : TDown;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        tone === "good"
          ? "border-emerald-400/25 bg-emerald-500/5"
          : "border-rose-400/25 bg-rose-500/5",
      )}
    >
      <div
        className={cn(
          "grid h-10 w-10 place-items-center rounded-xl",
          tone === "good"
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-rose-500/15 text-rose-300",
        )}
      >
        {tone === "good" ? <Trophy className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          {label}
        </div>
        <div className="text-sm font-bold text-white">{hi.label}</div>
        <div className="text-[11px] text-white/60">
          {brl(hi.atual)} <span className="text-white/30">vs</span>{" "}
          {brl(hi.anterior)}
        </div>
      </div>
      <DeltaPill delta={hi.delta} />
    </div>
  );
}
