import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Gift, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TierBadge, TIER_META, type LoyaltyTier } from "./TierBadge";

const GOAL = 10;

type Status = {
  tier: LoyaltyTier;
  lifetime: number;
  current: number;
  stampsToNext: number;
  nextTier: LoyaltyTier | null;
  reward: number;
  stampsPerOrder: number;
  activeCoupons: number;
};

export function LoyaltyProgress() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }
    let cancel = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_loyalty_status");
      if (cancel || error || !data || (data as unknown[]).length === 0) return;
      const row = (data as Array<{
        tier: string;
        lifetime_stamps: number;
        current_stamps: number;
        stamps_to_next: number;
        next_tier: string | null;
        reward_value: number;
        stamps_per_order: number;
        active_coupons: number;
      }>)[0];
      setStatus({
        tier: row.tier as LoyaltyTier,
        lifetime: row.lifetime_stamps,
        current: row.current_stamps,
        stampsToNext: row.stamps_to_next,
        nextTier: (row.next_tier ?? null) as LoyaltyTier | null,
        reward: Number(row.reward_value),
        stampsPerOrder: row.stamps_per_order,
        activeCoupons: row.active_coupons,
      });
    };
    load();

    const channel = supabase
      .channel(`loyalty-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_coupons", filter: `user_id=eq.${userId}` }, load)
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!userId || !status) return null;

  const pct = Math.min(100, (status.current / GOAL) * 100);
  const remaining = GOAL - status.current;
  const complete = status.activeCoupons > 0;
  const meta = TIER_META[status.tier];

  return (
    <section className="relative z-30 mt-3 px-4">
      <Link
        to="/recompensas"
        aria-label="Abrir Programa Bis Recompensa"
        className={cn(
          "relative block overflow-hidden rounded-2xl border px-3 py-2.5 shadow-lg transition-transform active:scale-[0.98] hover:brightness-110",
          "border-white/10",
        )}
        style={{ backgroundColor: "#3a1f5c" }}
      >
        <div
          aria-hidden
          className={cn("pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-40 blur-2xl", meta.gradient)}
        />

        {/* Header: badge + title + counter */}
        <div className="relative flex items-center gap-2">
          <TierBadge tier={status.tier} size="sm" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-extrabold leading-tight text-white">Bis Recompensa</h3>
            <p className="truncate text-[10.5px] leading-tight text-white/60">
              {complete
                ? `${status.activeCoupons} cupom${status.activeCoupons > 1 ? "ns" : ""} disponível${status.activeCoupons > 1 ? "is" : ""}`
                : remaining === 1
                  ? `Falta 1 selo pra R$ ${status.reward.toFixed(0)}`
                  : `Faltam ${remaining} selos pra R$ ${status.reward.toFixed(0)}`}
            </p>
          </div>
          <span className="shrink-0 text-[12px] font-bold text-neon-yellow tabular-nums">
            {status.current}/{GOAL}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Footer hint */}
        {complete ? (
          <div className="relative mt-1.5 flex items-center gap-1 text-[10px] font-bold text-neon-yellow">
            <Sparkles className="h-3 w-3" /> Toque pra resgatar
          </div>
        ) : status.nextTier && status.stampsToNext > 0 ? (
          <div className="relative mt-1.5 flex items-center gap-1 text-[10px] text-white/60">
            <TrendingUp className="h-3 w-3 shrink-0 text-neon-cyan" />
            <span className="truncate">
              <b className="text-white">{status.stampsToNext}</b> selos para{" "}
              <b className={TIER_META[status.nextTier].text}>{TIER_META[status.nextTier].label}</b>
            </span>
          </div>
        ) : !status.nextTier ? (
          <div className="relative mt-1.5 flex items-center gap-1 text-[10px] font-bold text-neon-yellow">
            <Gift className="h-3 w-3" /> Nível máximo — Ouro
          </div>
        ) : null}
      </Link>
    </section>
  );
}
