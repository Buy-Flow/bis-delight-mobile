import { Cake, Copy, Gift, PartyPopper } from "lucide-react";

type Props = {
  emoji: string;
  title: string;
  message: string;
  cta: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  minOrder: number;
  state?: "unclaimed" | "claimed";
};

function formatDiscount(v: number, t: "fixed" | "percent") {
  return t === "percent" ? `${Math.round(v)}%` : `R$ ${Number(v).toFixed(0)}`;
}

export function BirthdayBannerPreview({
  emoji, title, message, cta,
  discountType, discountValue, minOrder,
  state = "unclaimed",
}: Props) {
  const discountLabel = formatDiscount(discountValue || 15, discountType);
  const minOrderLabel = `R$ ${Number(minOrder || 25).toFixed(0)}`;
  const hasGift = state === "claimed";

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/60 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
        <span>Preview no app</span>
        <span>iPhone · 375px</span>
      </div>
      <div className="rounded-3xl bg-background p-3">
        <div
          className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-neon-pink/40"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, oklch(0.35 0.20 350 / 0.85), transparent 60%), radial-gradient(120% 80% at 100% 100%, oklch(0.30 0.18 305 / 0.85), transparent 60%), linear-gradient(135deg, oklch(0.22 0.15 320) 0%, oklch(0.16 0.11 305) 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
            <div className="absolute left-4 top-4 h-1.5 w-1.5 rotate-12 bg-neon-yellow" />
            <div className="absolute right-8 top-6 h-2 w-2 rotate-45 bg-neon-cyan" />
            <div className="absolute left-10 bottom-6 h-1.5 w-1.5 rotate-45 bg-neon-pink" />
            <div className="absolute right-16 bottom-4 h-2 w-2 rotate-12 bg-neon-yellow" />
          </div>
          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neon-yellow shadow-[0_8px_24px_-8px_rgba(255,215,60,0.7)] text-2xl">
              {emoji || <Cake className="h-6 w-6 text-[oklch(0.18_0.11_305)]" strokeWidth={2.5} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-neon-yellow">
                <PartyPopper className="h-3 w-3" />
                Mês do seu aniversário
              </div>
              <h3 className="mt-0.5 font-display text-xl font-black leading-tight text-white">
                {hasGift ? `Seu brinde está pronto! ${emoji}` : (title || "Você ganhou um brinde!")}
              </h3>
              <p className="mt-1 text-[12px] text-white/80">
                {hasGift
                  ? `${discountLabel} de desconto em pedidos acima de ${minOrderLabel}.`
                  : (message || `Toque em resgatar e receba ${discountLabel} de desconto.`)}
              </p>
              {hasGift ? (
                <div className="mt-3">
                  <div className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-neon-yellow/60 bg-black/40 px-3 py-2.5">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Seu cupom</div>
                      <div className="font-mono text-base font-black tracking-wider text-neon-yellow">ANIV-XXXX</div>
                    </div>
                    <Copy className="h-5 w-5 text-white/60" />
                  </div>
                </div>
              ) : (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-neon-yellow px-4 py-2 text-[13px] font-extrabold text-[oklch(0.18_0.11_305)] shadow-[0_8px_24px_-8px_rgba(255,215,60,0.7)]">
                  <Gift className="h-4 w-4" />
                  {cta || "Resgatar meu brinde"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type PushProps = {
  emoji: string;
  title: string;
  body: string;
};

export function PushNotificationPreview({ emoji, title, body }: PushProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/60 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
        <span>Preview do push</span>
        <span>Notificação · lock screen</span>
      </div>
      <div className="rounded-3xl bg-gradient-to-br from-card via-background to-background p-4">
        <div className="rounded-2xl bg-white/[0.08] backdrop-blur-md p-3 ring-1 ring-white/10">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-pink text-lg">
              {emoji || "🎂"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">Seu app</div>
                <div className="text-[10px] text-white/40">agora</div>
              </div>
              <div className="mt-0.5 text-sm font-bold text-white truncate">
                {title || "Feliz aniversário! 🎉"}
              </div>
              <div className="mt-0.5 text-xs text-white/70 line-clamp-2">
                {body || "Toque em resgatar e receba seu desconto de aniversário!"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
