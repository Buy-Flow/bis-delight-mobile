import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Gift, Check, Ticket, Star, ShoppingBag, CreditCard, Award, Tag, Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import rewardTrophyAsset from "@/assets/reward-trophy.png.asset.json";
import { TierBadge, TIER_META, type LoyaltyTier } from "@/components/menu/TierBadge";

const rewardTrophy = rewardTrophyAsset.url;
const GOAL = 10;
const TIER_ORDER: LoyaltyTier[] = ["bronze", "prata", "ouro"];

export const Route = createFileRoute("/recompensas")({
  head: () => ({
    meta: [
      { title: "Bis Recompensa — Níveis Bronze, Prata e Ouro" },
      { name: "description", content: "Acumule selos, suba de nível e ganhe cupons cada vez maiores no Programa Bis Recompensa." },
      { property: "og:title", content: "Bis Recompensa — Quero Bis" },
      { property: "og:description", content: "Bronze, Prata e Ouro: recompensas crescentes para clientes fiéis." },
    ],
  }),
  component: RecompensasPage,
});

type Coupon = {
  id: string;
  code: string;
  used_at: string | null;
  created_at: string;
  discount_value: number | null;
};

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

function RecompensasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
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
      const [statusRes, cpsRes] = await Promise.all([
        supabase.rpc("get_loyalty_status"),
        supabase
          .from("loyalty_coupons")
          .select("id, code, used_at, created_at, discount_value")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      if (cancel) return;
      const row = (statusRes.data as Array<{
        tier: string;
        lifetime_stamps: number;
        current_stamps: number;
        stamps_to_next: number;
        next_tier: string | null;
        reward_value: number;
        stamps_per_order: number;
        active_coupons: number;
      }> | null)?.[0];
      if (row) {
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
      }
      setCoupons((cpsRes.data as Coupon[]) ?? []);
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

  const current = status?.current ?? 0;
  const pct = Math.min(100, (current / GOAL) * 100);
  const remaining = GOAL - current;
  const available = coupons.filter((c) => !c.used_at);
  const used = coupons.filter((c) => c.used_at);
  const rewardValue = status?.reward ?? 20;
  const currentTier = status?.tier ?? "bronze";
  const meta = TIER_META[currentTier];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1a0b2e] pb-24 text-white">
      <div className="sticky top-0 z-20 bg-gradient-to-b from-[#1a0b2e] via-[#1a0b2e]/85 to-transparent pb-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/25 to-neon-purple/25 ring-1 ring-white/15">
            <Award className="h-5 w-5 text-neon-yellow" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-yellow shadow-[0_0_8px_theme(colors.neon-yellow)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-yellow/90">Programa</span>
            </div>
            <h1 className="text-[20px] font-black leading-tight text-white">
              Bis <span className="bg-gradient-to-r from-neon-pink to-neon-yellow bg-clip-text text-transparent">Recompensa</span>
            </h1>
          </div>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-neon-pink/25 blur-[120px]" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-neon-yellow/20 blur-[100px]" />
        <div className="absolute top-32 -left-24 h-72 w-72 rounded-full bg-neon-cyan/20 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pt-5">

        {/* Hero card com nível atual */}
        <section className={cn("relative overflow-hidden rounded-[32px] border p-6 shadow-[0_30px_80px_-40px_rgba(255,52,153,0.6)]", "border-white/10 bg-gradient-to-br from-[#3a1f5c] via-[#4a2470] to-[#2a1240]")}>
          <Star aria-hidden className="absolute right-6 top-4 h-3 w-3 text-neon-yellow/70" fill="currentColor" />
          <Star aria-hidden className="absolute right-16 top-10 h-2 w-2 text-neon-pink/70" fill="currentColor" />
          <Star aria-hidden className="absolute left-8 bottom-6 h-2.5 w-2.5 text-neon-cyan/60" fill="currentColor" />
          <div aria-hidden className={cn("pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl bg-gradient-to-br opacity-30", meta.gradient)} />
          <div aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-neon-cyan/20 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                <div aria-hidden className={cn("absolute inset-0 rounded-full bg-gradient-to-br blur-xl opacity-70", meta.gradient)} />
                <img
                  src={status ? meta.image : rewardTrophy}
                  alt={status ? `Nível ${meta.label}` : "Troféu"}
                  width={128}
                  height={128}
                  loading="lazy"
                  className="relative h-16 w-16 object-contain drop-shadow-[0_6px_16px_rgba(255,52,153,0.55)]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-neon-yellow/90">
                  Seu nível atual
                </div>
                <div className={cn("text-2xl font-black leading-tight", meta.text)}>{meta.label}</div>
                <div className="mt-0.5 text-xs text-white/70">
                  {status?.stampsPerOrder ?? 1}× selos por pedido · Cupom R$ {rewardValue.toFixed(0)}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Progresso do cupom</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-5xl font-black tabular-nums text-white drop-shadow-[0_2px_10px_rgba(255,220,120,0.4)]">
                    {current}
                  </span>
                  <span className="text-2xl font-bold text-white/50">/{GOAL}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neon-yellow">Recompensa</div>
                <div className="text-lg font-black text-neon-yellow">R$ {rewardValue.toFixed(0)}</div>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/80">
              {loading
                ? "Carregando…"
                : !userId
                  ? "Entre na sua conta para começar a acumular selos."
                  : remaining === 0
                    ? `🎉 Cupom de R$ ${rewardValue.toFixed(0)} liberado!`
                    : remaining === 1
                      ? `Falta 1 selo para ganhar R$ ${rewardValue.toFixed(0)}!`
                      : `Faltam ${remaining} selos para ganhar R$ ${rewardValue.toFixed(0)}.`}
            </p>

            <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-inset ring-white/10">
              <div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              >
                <div className="absolute inset-0 rounded-full bg-white/25 mix-blend-overlay" />
                <div aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-[shine_2.4s_ease-in-out_infinite]" />
              </div>
            </div>

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
                    {filled ? <Check className="h-4 w-4" strokeWidth={3.5} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                  </div>
                );
              })}
            </div>

            {/* Próximo nível */}
            {status?.nextTier && status.stampsToNext > 0 && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                <TrendingUp className="h-5 w-5 shrink-0 text-neon-cyan" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-white/60">Próximo nível</div>
                  <div className="text-sm font-bold text-white">
                    Faltam <span className="text-neon-cyan">{status.stampsToNext} selos</span> para{" "}
                    <span className={TIER_META[status.nextTier].text}>{TIER_META[status.nextTier].label}</span>
                  </div>
                </div>
                <TierBadge tier={status.nextTier} size="sm" showLabel={false} />
              </div>
            )}
          </div>
        </section>

        {/* Trilha de níveis */}
        <section className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/70">
            <Sparkles className="h-4 w-4 text-neon-yellow" />
            Trilha de níveis
          </h3>
          <div className="space-y-3">
            {TIER_ORDER.map((t) => {
              const info = TIER_META[t];
              const reached = (status?.lifetime ?? 0) >= info.minLifetime;
              const isCurrent = status?.tier === t;
              return (
                <div
                  key={t}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-4 transition-all",
                    isCurrent
                      ? "border-neon-yellow/60 bg-gradient-to-br from-white/[0.08] to-white/[0.02] shadow-[0_0_28px_-8px_rgba(255,215,60,0.45)]"
                      : reached
                        ? "border-white/15 bg-white/[0.04]"
                        : "border-white/10 bg-black/25 opacity-70",
                  )}
                >
                  <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl", info.gradient)} />
                  <div className="relative flex items-start gap-3">
                    <div className="relative h-14 w-14 shrink-0">
                      <img
                        src={info.image}
                        alt={info.label}
                        loading="lazy"
                        width={128}
                        height={128}
                        className={cn("h-full w-full object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]", !reached && "grayscale")}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={cn("text-base font-black", info.text)}>{info.label}</h4>
                        {isCurrent && (
                          <span className="rounded-full bg-neon-yellow px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#1a0b2e]">
                            Você
                          </span>
                        )}
                        {!reached && <Lock className="h-3.5 w-3.5 text-white/40" />}
                      </div>
                      <div className="text-[11px] text-white/60">
                        {info.minLifetime === 0
                          ? "Nível inicial"
                          : `A partir de ${info.minLifetime} selos totais`}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {info.benefits.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[12px] text-white/85">
                            <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", info.text)} strokeWidth={3} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
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
                  Nenhum cupom por enquanto. Complete 10 selos para desbloquear seu desconto.
                </div>
              ) : (
                <div className="space-y-2">
                  {available.map((c) => {
                    const v = Number(c.discount_value) > 0 ? Number(c.discount_value) : 20;
                    return (
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
                          <div className="text-lg font-extrabold text-neon-yellow">R$ {v.toFixed(0)},00</div>
                          <div className="text-[11px] text-white/60">Use no checkout</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {used.length > 0 && (
              <section className="mt-6">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-white/50">Histórico</h3>
                <div className="space-y-2">
                  {used.map((c) => {
                    const v = Number(c.discount_value) > 0 ? Number(c.discount_value) : 20;
                    return (
                      <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 opacity-70">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/50">
                          <Check className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm text-white/80">{c.code}</div>
                          <div className="text-[11px] text-white/50">Utilizado</div>
                        </div>
                        <div className="text-sm text-white/60 line-through">R$ {v.toFixed(0)},00</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-pink/20 text-neon-pink">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-base font-black tracking-tight">Como funciona</h3>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: ShoppingBag, title: "Faça pedidos", desc: "Compre logado na sua conta.", color: "from-neon-pink to-neon-pink/60" },
              { icon: CreditCard, title: "Ganhe selos", desc: "1–3 selos por pedido conforme o nível.", color: "from-neon-yellow to-orange-400" },
              { icon: Award, title: "Suba de nível", desc: "Bronze → Prata (10) → Ouro (30).", color: "from-neon-cyan to-cyan-400" },
              { icon: Tag, title: "Ganhe cupons", desc: "R$ 20, R$ 25 ou R$ 30 conforme o nível.", color: "from-fuchsia-400 to-neon-pink" },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <li key={idx} className="relative flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[#1a0b2e] shadow-lg", step.color)}>
                    <Icon className="h-5 w-5" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Passo {idx + 1}</div>
                    <div className="text-sm font-bold text-white">{step.title}</div>
                    <div className="text-xs text-white/60">{step.desc}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </main>
  );
}
