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
          "relative block overflow-hidden rounded-[28px] border p-4 shadow-lg transition-transform active:scale-[0.98] hover:brightness-110",
          "border-white/10",
        )}
        style={{ backgroundColor: "#3a1f5c" }}
      >
        <div
          aria-hidden
          className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-40 blur-2xl", meta.gradient)}
        />

        {/* Top row: tier badge + reward chip */}
        <div className="relative flex items-center justify-between gap-3">
          <TierBadge tier={status.tier} size="md" />
          <div className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", meta.text, `border-current/30`)}>
            Cupom R$ {status.reward.toFixed(0)}
          </div>
        </div>

        {/* Title + counter */}
        <div className="relative mt-2.5 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-extrabold leading-tight text-white">Programa Bis Recompensa</h3>
            <p className="mt-0.5 text-[11.5px] leading-snug text-white/70">
              {complete
                ? `Você tem ${status.activeCoupons} cupom${status.activeCoupons > 1 ? "s" : ""} pra usar!`
                : remaining === 1
                  ? `Falta 1 pedido pra ganhar R$ ${status.reward.toFixed(0)}!`
                  : `${status.stampsPerOrder}× por pedido — faltam ${remaining} selos pra R$ ${status.reward.toFixed(0)}.`}
            </p>
          </div>
          <span className="shrink-0 text-[13px] font-bold text-neon-yellow tabular-nums">
            {status.current}/{GOAL}
          </span>
        </div>

        {/* Progress bar to coupon */}
        <div className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Stamps row */}
        <div className="relative mt-2 flex items-center justify-between gap-1.5">
          {Array.from({ length: GOAL }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < status.current ? "bg-neon-yellow" : "bg-white/15",
              )}
            />
          ))}
        </div>

        {/* Next tier progress */}
        {status.nextTier && status.stampsToNext > 0 && (
          <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-neon-cyan" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-white/80">
              Faltam <b className="text-white">{status.stampsToNext}</b> selos totais para subir para{" "}
              <b className={TIER_META[status.nextTier].text}>{TIER_META[status.nextTier].label}</b>
            </span>
          </div>
        )}
        {!status.nextTier && (
          <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-neon-yellow/10 px-2.5 py-1.5 ring-1 ring-neon-yellow/30">
            <Gift className="h-3.5 w-3.5 shrink-0 text-neon-yellow" />
            <span className="text-[11px] font-bold text-neon-yellow">Você atingiu o nível máximo — Ouro!</span>
          </div>
        )}

        {complete && (
          <div className="relative mt-2 inline-flex items-center gap-1.5 rounded-full bg-neon-yellow px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[oklch(0.18_0.11_305)]">
            <Sparkles className="h-3 w-3" />
            {status.activeCoupons} cupom{status.activeCoupons > 1 ? "s" : ""} disponível
            {status.activeCoupons > 1 ? "is" : ""}
          </div>
        )}
      </Link>
    </section>
  );
}
