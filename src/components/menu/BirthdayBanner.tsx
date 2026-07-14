import { useEffect, useState } from "react";
import { Cake, Copy, Check, Gift, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Status = {
  isBirthdayMonth: boolean;
  isBirthdayToday: boolean;
  birthday: string | null;
  giftCode: string | null;
  giftUsed: boolean | null;
  giftExpiresAt: string | null;
  discountValue: number | null;
  discountType: string | null;
  minOrder: number | null;
  bannerTitle: string;
  bannerMessage: string;
  bannerCta: string;
  bannerEmoji: string;
  programEnabled: boolean;
};

function formatDiscount(value: number, type: string | null) {
  return type === "percent" ? `${Math.round(value)}%` : `R$ ${Number(value).toFixed(0)}`;
}

export function BirthdayBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase.rpc("get_birthday_gift_status");
      if (cancel || error || !data || data.length === 0) return;
      const row = data[0] as Record<string, unknown>;
      setStatus({
        isBirthdayMonth: Boolean(row.is_birthday_month),
        isBirthdayToday: Boolean(row.is_birthday_today),
        birthday: (row.birthday as string) ?? null,
        giftCode: (row.gift_code as string) ?? null,
        giftUsed: (row.gift_used as boolean) ?? null,
        giftExpiresAt: (row.gift_expires_at as string) ?? null,
        discountValue: (row.discount_value as number) ?? null,
        discountType: (row.discount_type as string) ?? null,
        minOrder: (row.min_order as number) ?? null,
        bannerTitle: (row.banner_title as string) ?? "Você ganhou um brinde!",
        bannerMessage: (row.banner_message as string) ?? "",
        bannerCta: (row.banner_cta as string) ?? "Resgatar meu brinde",
        bannerEmoji: (row.banner_emoji as string) ?? "🎂",
        programEnabled: Boolean(row.program_enabled),
      });
    })();
    return () => { cancel = true; };
  }, []);

  if (!status || !status.programEnabled || !status.isBirthdayMonth || dismissed) return null;
  if (status.giftUsed) return null;

  const handleClaim = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("claim_birthday_gift");
      if (error) throw error;
      const row = (data as Array<{ code: string; discount_value: number; expires_at: string }>)?.[0];
      if (!row) throw new Error("no_row");
      setStatus((s) => s ? { ...s, giftCode: row.code, giftUsed: false, giftExpiresAt: row.expires_at, discountValue: row.discount_value } : s);
      toast.success(`${status.bannerEmoji} Brinde resgatado! Use no carrinho.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("birthday_not_set") ? "Configure seu aniversário no perfil"
        : msg.includes("program_disabled") ? "Programa temporariamente indisponível"
        : "Não foi possível resgatar"
      );
    } finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!status.giftCode) return;
    await navigator.clipboard.writeText(status.giftCode);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const hasGift = Boolean(status.giftCode);
  const discountLabel = formatDiscount(status.discountValue ?? 15, status.discountType);
  const minOrderLabel = `R$ ${Number(status.minOrder ?? 25).toFixed(0)}`;

  return (
    <section className="px-4 pt-4">
      <div
        className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-neon-pink/40"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, oklch(0.35 0.20 350 / 0.85), transparent 60%), radial-gradient(120% 80% at 100% 100%, oklch(0.30 0.18 305 / 0.85), transparent 60%), linear-gradient(135deg, oklch(0.22 0.15 320) 0%, oklch(0.16 0.11 305) 100%)",
        }}
      >
        <button
          onClick={() => setDismissed(true)}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white/70 hover:text-white"
        >✕</button>

        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute left-4 top-4 h-1.5 w-1.5 rotate-12 bg-neon-yellow" />
          <div className="absolute right-8 top-6 h-2 w-2 rotate-45 bg-neon-cyan" />
          <div className="absolute left-10 bottom-6 h-1.5 w-1.5 rotate-45 bg-neon-pink" />
          <div className="absolute right-16 bottom-4 h-2 w-2 rotate-12 bg-neon-yellow" />
        </div>

        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neon-yellow shadow-[0_8px_24px_-8px_rgba(255,215,60,0.7)]">
            <Cake className="h-6 w-6 text-[oklch(0.18_0.11_305)]" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-neon-yellow">
              <PartyPopper className="h-3 w-3" />
              {status.isBirthdayToday ? "É hoje! Parabéns 🎉" : "Mês do seu aniversário"}
            </div>
            <h3 className="mt-0.5 font-display text-xl font-black leading-tight text-white">
              {hasGift ? `Seu brinde está pronto! ${status.bannerEmoji}` : status.bannerTitle}
            </h3>
            <p className="mt-1 text-[12px] text-white/80">
              {hasGift
                ? `${discountLabel} de desconto em pedidos acima de ${minOrderLabel}.`
                : (status.bannerMessage || `Toque em resgatar e receba ${discountLabel} de desconto.`)}
            </p>

            {hasGift ? (
              <div className="mt-3 space-y-2">
                <button
                  onClick={handleCopy}
                  className="group flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-neon-yellow/60 bg-black/40 px-3 py-2.5 text-left"
                >
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">Seu cupom</div>
                    <div className="font-mono text-base font-black tracking-wider text-neon-yellow">{status.giftCode}</div>
                  </div>
                  {copied ? <Check className="h-5 w-5 text-neon-cyan" /> : <Copy className="h-5 w-5 text-white/60 group-hover:text-white" />}
                </button>
                {status.giftExpiresAt && (
                  <div className="text-[10px] text-white/50">
                    Válido até {new Date(status.giftExpiresAt).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-neon-yellow px-4 py-2 text-[13px] font-extrabold text-[oklch(0.18_0.11_305)] shadow-[0_8px_24px_-8px_rgba(255,215,60,0.7)] active:scale-95 disabled:opacity-60"
              >
                <Gift className="h-4 w-4" />
                {loading ? "Resgatando..." : status.bannerCta}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
