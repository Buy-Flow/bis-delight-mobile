import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

/**
 * If a referral code is pending in localStorage AND the user is logged in,
 * try to apply it (idempotent). Shows a success toast for the referee.
 * Silently ignores expected errors like "already_referred" or "not_new_customer".
 */
export async function tryConsumeStoredReferralCode(): Promise<void> {
  const code = getStoredReferralCode();
  if (!code) return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;

  // @ts-expect-error rpc name may not be in generated types yet
  const { data, error } = await supabase.rpc("apply_referral_code", { _code: code });
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
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.coupon_code) {
    const val =
      row.discount_type === "percent"
        ? `${row.discount_value}%`
        : `R$ ${Number(row.discount_value).toFixed(2)}`;
    toast.success(`🎁 Cupom ${val} liberado!`, {
      description: `Use ${row.coupon_code} no seu primeiro pedido.`,
      duration: 8000,
    });
  }
}

export async function getMyReferralCode(): Promise<string | null> {
  // @ts-expect-error rpc name may not be in generated types yet
  const { data, error } = await supabase.rpc("get_or_create_my_referral_code");
  if (error) return null;
  return typeof data === "string" ? data : null;
}
