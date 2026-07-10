import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const GOAL = 10;

export function LoyaltyProgress() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stamps, setStamps] = useState<number | null>(null);
  const [coupons, setCoupons] = useState<number>(0);

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
      setStamps(null);
      setCoupons(0);
      return;
    }
    let cancel = false;
    const load = async () => {
      const [{ data: loy }, { count }] = await Promise.all([
        supabase.from("loyalty").select("stamps").eq("user_id", userId).maybeSingle(),
        supabase
          .from("loyalty_coupons")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("used_at", null),
      ]);
      if (cancel) return;
      setStamps(loy?.stamps ?? 0);
      setCoupons(count ?? 0);
    };
    load();

    const channel = supabase
      .channel(`loyalty-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty", filter: `user_id=eq.${userId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty_coupons", filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!userId || stamps === null) return null;

  const current = stamps % GOAL;
  const pct = Math.min(100, (current / GOAL) * 100);
  const remaining = GOAL - current;
  const complete = coupons > 0;

  return (
    <section className="relative z-30 mt-3 px-4">
      <Link
        to="/recompensas"
        aria-label="Abrir Programa Bis Recompensa"
        className={cn(
          "relative block overflow-hidden rounded-[28px] border p-4 shadow-lg transition-transform active:scale-[0.98] hover:brightness-110",
          complete
            ? "border-neon-yellow/50 bg-gradient-to-br from-[#3a1f5c] via-[#4a2470] to-[#3a1f5c]"
            : "border-white/10",
        )}
        style={!complete ? { backgroundColor: "#3a1f5c" } : undefined}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-neon-pink/30 blur-2xl"
        />
        <div className="relative flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neon-yellow/15 text-neon-yellow">
            {complete ? <Gift className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-extrabold leading-tight text-white">
                Programa Bis Recompensa
              </h3>
              <span className="shrink-0 text-[13px] font-bold text-neon-yellow tabular-nums">
                {current}/{GOAL}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] leading-snug text-white/75">
              {complete
                ? `Você tem ${coupons} cupom${coupons > 1 ? "s" : ""} de R$ 20 pra usar!`
                : remaining === 1
                  ? "Falta 1 pedido pra ganhar R$ 20 de desconto!"
                  : `Faltam ${remaining} pedidos pra ganhar R$ 20 de desconto.`}
            </p>

            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-1.5">
              {Array.from({ length: GOAL }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i < current ? "bg-neon-yellow" : "bg-white/15",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
