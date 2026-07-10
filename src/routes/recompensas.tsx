import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Gift, Check, Ticket, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";


const GOAL = 10;

export const Route = createFileRoute("/recompensas")({
  head: () => ({
    meta: [
      { title: "Bis Recompensa — Quero Bis" },
      { name: "description", content: "Acompanhe seus selos e resgate cupons de R$ 20 no Programa Bis Recompensa." },
      { property: "og:title", content: "Bis Recompensa — Quero Bis" },
      { property: "og:description", content: "A cada 10 pedidos, você ganha R$ 20 de desconto." },
    ],
  }),
  component: RecompensasPage,
});

const COUPON_VALUE = 20;

type Coupon = {
  id: string;
  code: string;
  used_at: string | null;
  created_at: string;
};

function RecompensasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stamps, setStamps] = useState<number>(0);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancel = false;
    const load = async () => {
      const [{ data: loy }, { data: cps }] = await Promise.all([
        supabase.from("loyalty").select("stamps").eq("user_id", userId).maybeSingle(),
        supabase
          .from("loyalty_coupons")
          .select("id, code, used_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      if (cancel) return;
      setStamps(loy?.stamps ?? 0);
      setCoupons((cps as Coupon[]) ?? []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`recompensas-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_coupons", filter: `user_id=eq.${userId}` }, load)
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const current = stamps % GOAL;
  const pct = Math.min(100, (current / GOAL) * 100);
  const remaining = GOAL - current;
  const available = coupons.filter((c) => !c.used_at);
  const used = coupons.filter((c) => c.used_at);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1a0b2e] pb-24 text-white">
      {/* ambient background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-neon-pink/25 blur-[120px]" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-neon-yellow/20 blur-[100px]" />
        <div className="absolute top-32 -left-24 h-72 w-72 rounded-full bg-neon-cyan/20 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pt-8">
        {/* Hero card */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#3a1f5c] via-[#4a2470] to-[#2a1240] p-6 shadow-[0_30px_80px_-40px_rgba(255,52,153,0.6)]">
          {/* decorative stars */}
          <Star aria-hidden className="absolute right-6 top-4 h-3 w-3 text-neon-yellow/70" fill="currentColor" />
          <Star aria-hidden className="absolute right-16 top-10 h-2 w-2 text-neon-pink/70" fill="currentColor" />
          <Star aria-hidden className="absolute left-8 bottom-6 h-2.5 w-2.5 text-neon-cyan/60" fill="currentColor" />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-pink/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-neon-cyan/20 blur-3xl" />

          <div className="relative">
            {/* Title row */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-yellow to-neon-pink text-[#1a0b2e] shadow-lg shadow-neon-pink/40">
                <Trophy className="h-7 w-7" strokeWidth={2.5} />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a0b2e] text-[10px] font-black text-neon-yellow ring-2 ring-neon-yellow/50">
                  <Sparkles className="h-3 w-3" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-neon-yellow/90">
                  Programa de fidelidade
                </div>
                <h1 className="text-2xl font-black leading-tight tracking-tight">
                  Bis <span className="bg-gradient-to-r from-neon-yellow via-neon-pink to-neon-cyan bg-clip-text text-transparent">Recompensa</span>
                </h1>
              </div>
            </div>

            {/* Big counter */}
            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Selos acumulados</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-5xl font-black tabular-nums text-white drop-shadow-[0_2px_10px_rgba(255,220,120,0.4)]">
                    {current}
                  </span>
                  <span className="text-2xl font-bold text-white/50">/{GOAL}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neon-yellow">Recompensa</div>
                <div className="text-lg font-black text-neon-yellow">R$ 20</div>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/80">
              {loading
                ? "Carregando…"
                : !userId
                  ? "Entre na sua conta para começar a acumular selos."
                  : remaining === 0
                    ? "🎉 Parabéns! Um cupom de R$ 20 foi liberado."
                    : remaining === 1
                      ? "Falta apenas 1 pedido para ganhar R$ 20 de desconto!"
                      : `Faltam ${remaining} pedidos para ganhar R$ 20 de desconto.`}
            </p>

            {/* Progress bar */}
            <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-inset ring-white/10">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              >
                <div className="absolute inset-0 rounded-full bg-white/25 mix-blend-overlay" />
              </div>
            </div>

            {/* Stamps grid */}
            <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: GOAL }).map((_, i) => {
                const filled = i < current;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-full border transition-all duration-500",
                      filled
                        ? "border-neon-yellow bg-gradient-to-br from-neon-yellow to-neon-pink text-[#1a0b2e] shadow-[0_0_16px_rgba(255,220,120,0.55)]"
                        : "border-white/15 bg-white/[0.04] text-white/30",
                    )}
                  >
                    {filled ? (
                      <Check className="h-4 w-4" strokeWidth={3.5} />
                    ) : (
                      <span className="text-[11px] font-bold">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>


        {userId && (
          <>
            <section className="mt-6">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/70">
                <Gift className="h-4 w-4 text-neon-yellow" />
                Cupons disponíveis
                {available.length > 0 && (
                  <span className="rounded-full bg-neon-yellow/20 px-2 py-0.5 text-xs text-neon-yellow">{available.length}</span>
                )}
              </h3>
              {available.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/60">
                  Nenhum cupom por enquanto. Complete 10 pedidos para desbloquear R$ 20 de desconto.
                </div>
              ) : (
                <div className="space-y-2">
                  {available.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl border border-neon-yellow/40 bg-gradient-to-r from-neon-yellow/10 to-neon-pink/10 p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-yellow/20 text-neon-yellow">
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white/70">Cupom de desconto</div>
                        <div className="truncate font-mono text-base font-bold text-white">{c.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-neon-yellow">
                          R$ {COUPON_VALUE},00
                        </div>
                        <div className="text-[11px] text-white/60">Use no checkout</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {used.length > 0 && (
              <section className="mt-6">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-white/50">Histórico</h3>
                <div className="space-y-2">
                  {used.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 opacity-70">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/50">
                        <Check className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-sm text-white/80">{c.code}</div>
                        <div className="text-[11px] text-white/50">Utilizado</div>
                      </div>
                      <div className="text-sm text-white/60 line-through">
                        R$ {COUPON_VALUE},00
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 font-bold">Como funciona</h3>
          <ol className="space-y-1.5 text-sm text-white/75">
            <li>1. Faça pedidos no Quero Bis com sua conta logada.</li>
            <li>2. A cada pedido pago, você ganha 1 selo.</li>
            <li>3. Ao completar 10 selos, um cupom de R$ 20 é liberado automaticamente.</li>
            <li>4. Use o código do cupom no checkout do próximo pedido.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
