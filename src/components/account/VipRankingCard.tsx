import { useEffect, useState } from "react";
import { Trophy, Crown, TrendingUp, Sparkles, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

type Tier = {
  key: string;
  name: string;
  emoji?: string;
  color?: string;
  min_ltv?: number;
  min_orders?: number;
  perks?: string;
};

type Ranking = {
  enabled: boolean;
  settings?: {
    show_percentile: boolean;
    show_rank: boolean;
    show_leaderboard: boolean;
    top_badge_percent: number;
    hero_title: string;
    hero_subtitle: string;
  };
  user_ltv?: number;
  user_orders?: number;
  total_ranked?: number;
  rank?: number;
  percentile?: number;
  is_top?: boolean;
  current_tier?: Tier | null;
  next_tier?: Tier | null;
};

type LbRow = { rank_pos: number; display_name: string; ltv: number; orders_ct: number; is_me: boolean };

export function VipRankingCard() {
  const [data, setData] = useState<Ranking | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [r, l] = await Promise.all([
        supabase.rpc("get_customer_ranking"),
        supabase.rpc("get_vip_leaderboard", { _limit: 10 }),
      ]);
      if (!mounted) return;
      setData((r.data as Ranking | null) ?? { enabled: false });
      setLb((l.data as LbRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    );
  }
  if (!data?.enabled) return null;

  const s = data.settings!;
  const tier = data.current_tier;
  const next = data.next_tier;
  const tierColor = tier?.color ?? "#facc15";

  // progress to next tier
  const curLtv = Number(data.user_ltv ?? 0);
  const curOrders = Number(data.user_orders ?? 0);
  const nextLtv = Number(next?.min_ltv ?? 0);
  const nextOrders = Number(next?.min_orders ?? 0);
  const baseLtv = Number(tier?.min_ltv ?? 0);
  const baseOrders = Number(tier?.min_orders ?? 0);
  const progressLtv = next && nextLtv > baseLtv
    ? Math.min(100, Math.max(0, ((curLtv - baseLtv) / (nextLtv - baseLtv)) * 100))
    : 100;
  const progressOrd = next && nextOrders > baseOrders
    ? Math.min(100, Math.max(0, ((curOrders - baseOrders) / (nextOrders - baseOrders)) * 100))
    : 100;
  const progress = next ? Math.min(progressLtv, progressOrd) : 100;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl border p-5"
        style={{
          borderColor: `${tierColor}55`,
          background: `linear-gradient(135deg, ${tierColor}22, oklch(0.15 0.08 305 / 0.9), ${tierColor}11)`,
        }}
      >
        {data.is_top && (
          <div
            className="absolute -right-8 top-4 rotate-12 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
            style={{ borderColor: tierColor, color: tierColor, background: `${tierColor}15` }}
          >
            <Crown className="mr-1 inline h-3 w-3" /> Top {s.top_badge_percent}%
          </div>
        )}
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" style={{ color: tierColor }} />
          <div className="font-display text-lg font-black uppercase tracking-wide text-white">
            {s.hero_title}
          </div>
        </div>
        <div className="mt-1 text-[11px] text-white/70">{s.hero_subtitle}</div>

        <div className="mt-4 flex items-end gap-4">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl text-3xl shadow-lg"
            style={{ background: `${tierColor}22`, border: `1px solid ${tierColor}66` }}
          >
            <span>{tier?.emoji ?? "🌱"}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Seu nível</div>
            <div className="font-display text-2xl font-black text-white truncate">
              {tier?.name ?? "Novato"}
            </div>
            {tier?.perks && (
              <div className="mt-0.5 line-clamp-2 text-[11px] text-white/70">🎁 {tier.perks}</div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Gasto total" value={brl(curLtv)} />
          <Stat label="Pedidos" value={String(curOrders)} />
          {s.show_percentile && data.percentile != null && data.percentile > 0 ? (
            <Stat
              label="Percentil"
              value={`Top ${Math.max(1, Math.round(data.percentile))}%`}
              highlight={data.is_top}
            />
          ) : s.show_rank && data.rank ? (
            <Stat label="Posição" value={`#${data.rank}`} />
          ) : (
            <Stat label="Clientes" value={String(data.total_ranked ?? 0)} />
          )}
        </div>

        {next && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-white/60">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Próximo nível
              </span>
              <span style={{ color: next.color ?? "#fff" }} className="font-bold">
                {next.emoji} {next.name}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${tierColor}, ${next.color ?? "#22d3ee"})`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/60">
              <span>
                Falta{" "}
                <strong className="text-white">
                  {brl(Math.max(0, nextLtv - curLtv))}
                </strong>{" "}
                em compras
              </span>
              <span>
                {Math.max(0, nextOrders - curOrders)} pedido
                {Math.max(0, nextOrders - curOrders) === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {s.show_leaderboard && lb.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon-yellow" />
            <div className="font-display text-sm font-black uppercase tracking-widest text-white">
              Ranking Geral
            </div>
          </div>
          <div className="space-y-1.5">
            {lb.map((row) => (
              <div
                key={row.rank_pos}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  row.is_me
                    ? "border border-neon-yellow/50 bg-neon-yellow/10 text-white"
                    : "text-white/80",
                )}
              >
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black",
                    row.rank_pos === 1 && "bg-yellow-400/20 text-yellow-300",
                    row.rank_pos === 2 && "bg-gray-300/20 text-gray-200",
                    row.rank_pos === 3 && "bg-orange-500/20 text-orange-300",
                    row.rank_pos > 3 && "bg-white/10 text-white/60",
                  )}
                >
                  {row.rank_pos <= 3 ? <Medal className="h-3.5 w-3.5" /> : row.rank_pos}
                </div>
                <div className="min-w-0 flex-1 truncate font-medium">
                  {row.display_name}
                  {row.is_me && <span className="ml-1 text-neon-yellow">(você)</span>}
                </div>
                <div className="shrink-0 font-mono text-xs text-white/70">
                  {brl(Number(row.ltv))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-2.5",
        highlight
          ? "border-neon-yellow/50 bg-neon-yellow/10"
          : "border-white/10 bg-black/30",
      )}
    >
      <div className="text-[9px] uppercase tracking-widest text-white/50">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-display text-base font-black",
          highlight ? "text-neon-yellow" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}
