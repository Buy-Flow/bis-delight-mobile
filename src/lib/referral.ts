import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";

const KEY = "quero-bis:referral-code";

export function storeReferralCode(code: string) {
  try {
    if (!code) return;
    localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    /* noop */
  }
}
export function getStoredReferralCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

const sb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: typeof supabase.auth;
};

/**
 * If a referral code is pending in localStorage AND the user is logged in,
 * try to apply it (idempotent).
 */
export async function tryConsumeStoredReferralCode(): Promise<void> {
  const code = getStoredReferralCode();
  if (!code) return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;

  const KNOWN_MESSAGES: Record<string, { title: string; description?: string; kind: "info" | "error" }> = {
    already_referred: { title: "Cupom de indicação já utilizado", description: "Você já resgatou uma indicação anteriormente.", kind: "info" },
    not_new_customer: { title: "Indicação disponível só para novos clientes", description: "Este benefício é exclusivo do primeiro pedido.", kind: "info" },
    self_referral: { title: "Não é possível se autoindicar", description: "Compartilhe seu código com amigos para ganhar recompensas.", kind: "info" },
    invalid_code: { title: "Código de indicação inválido", description: "Confira o código com quem te indicou.", kind: "error" },
    program_disabled: { title: "Programa de indicação indisponível", description: "Tente novamente mais tarde.", kind: "info" },
    referrer_limit_reached: { title: "Limite de indicações atingido", description: "Este código não aceita mais novas indicações.", kind: "info" },
  };

  const tryApply = async (attempt: number): Promise<void> => {
    const { data, error } = await sb.rpc("apply_referral_code", { _code: code });
    if (error) {
      const known = KNOWN_MESSAGES[error.message];
      if (known) {
        clearStoredReferralCode();
        if (known.kind === "error") {
          toast.error(known.title, { description: known.description });
        } else {
          toast(known.title, { description: known.description });
        }
        return;
      }
      // Unknown error — likely network/transient. Retry once, then surface a friendly toast.
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        return tryApply(1);
      }
      toast.error("Não foi possível aplicar seu cupom de indicação", {
        description: friendlyError(error) + " Tocamos automaticamente na próxima vez que você abrir o app.",
        action: {
          label: "Tentar de novo",
          onClick: () => {
            void tryConsumeStoredReferralCode();
          },
        },
        duration: 10000,
      });
      return;
    }
    clearStoredReferralCode();
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown>);
    const couponCode = row?.coupon_code as string | undefined;
    const discountType = row?.discount_type as string | undefined;
    const discountValue = Number(row?.discount_value ?? 0);
    if (couponCode) {
      const val = discountType === "percent" ? `${discountValue}%` : `R$ ${discountValue.toFixed(2)}`;
      toast.success(`🎁 Cupom ${val} liberado!`, {
        description: `Use ${couponCode} no seu primeiro pedido.`,
        duration: 8000,
      });
    }
  };

  try {
    await tryApply(0);
  } catch (e) {
    toast.error("Não foi possível aplicar seu cupom de indicação", {
      description: friendlyError(e) + " Vamos tentar de novo automaticamente.",
      action: {
        label: "Tentar agora",
        onClick: () => {
          void tryConsumeStoredReferralCode();
        },
      },
      duration: 10000,
    });
  }
}


export async function getMyReferralCode(): Promise<string | null> {
  const { data, error } = await sb.rpc("get_or_create_my_referral_code");
  if (error) return null;
  return typeof data === "string" ? data : null;
}
