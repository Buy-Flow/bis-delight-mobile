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

  const { data, error } = await sb.rpc("apply_referral_code", { _code: code });
  if (error) {
    const known = new Set([
      "already_referred",
      "not_new_customer",
      "self_referral",
      "invalid_code",
      "program_disabled",
      "referrer_limit_reached",
    ]);
    if (known.has(error.message)) {
      clearStoredReferralCode();
    }
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
}

export async function getMyReferralCode(): Promise<string | null> {
  const { data, error } = await sb.rpc("get_or_create_my_referral_code");
  if (error) return null;
  return typeof data === "string" ? data : null;
}
