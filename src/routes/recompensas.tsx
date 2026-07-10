import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Gift, Check, Ticket } from "lucide-react";
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
    <main className="min-h-screen bg-[#1a0b2e] pb-24 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1a0b2e]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-extrabold">Bis Recompensa</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-5">
        <section className="relative overflow-hidden rounded-[28px] border border-neon-yellow/40 bg-gradient-to-br from-[#3a1f5c] via-[#4a2470] to-[#3a1f5c] p-5 shadow-xl">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-neon-pink/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-neon-cyan/20 blur-3xl" />

          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neon-yellow/15 text-neon-yellow">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-extrabold">Seu progresso</h2>
                <span className="text-base font-bold text-neon-yellow tabular-nums">{current}/{GOAL}</span>
              </div>
              <p className="mt-1 text-sm text-white/80">
                {loading
                  ? "Carregando…"
                  : !userId
                    ? "Entre na sua conta para começar a acumular selos."
                    : remaining === 0
                      ? "Parabéns! Um cupom de R$ 20 foi liberado."
                      : remaining === 1
                        ? "Falta 1 pedido para ganhar R$ 20 de desconto!"
                        : `Faltam ${remaining} pedidos para ganhar R$ 20 de desconto.`}
              </p>

              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-10 gap-1.5">
                {Array.from({ length: GOAL }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full border transition-colors",
                      i < current
                        ? "border-neon-yellow bg-neon-yellow/90 text-[#1a0b2e]"
                        : "border-white/15 bg-white/5 text-white/30",
                    )}
                  >
                    {i < current ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                ))}
              </div>
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
