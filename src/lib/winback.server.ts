// Win-back (customer reactivation) core server logic.
// Selects inactive customers, generates a unique coupon per user, sends via
// WhatsApp through Evolution API, and records every send in winback_sends.

import { sendWhatsappText } from "./cash-close.server";

interface WinbackSettings {
  enabled: boolean;
  days_inactive: number;
  min_orders: number;
  min_lifetime_spent: number;
  require_phone: boolean;
  cooldown_days: number;
  max_per_run: number;
  coupon_prefix: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order: number;
  validity_days: number;
  message_template: string;
  send_whatsapp: boolean;
  send_push: boolean;
  order_link_path: string;
}

interface Candidate {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  orders_count: number;
  lifetime_spent: number;
  last_order_at: string | null;
  days_since_last_order: number;
  avg_ticket: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbAdmin = any;

function formatDiscount(type: string, value: number): string {
  return type === "percent" ? `${Math.round(value)}% OFF` : `R$ ${value.toFixed(2).replace(".", ",")} OFF`;
}

function firstName(full: string | null | undefined): string {
  const name = (full ?? "").trim().split(/\s+/)[0];
  return name || "amigo(a)";
}

function randomSuffix(n = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function ensureUniqueCoupon(
  supabaseAdmin: SbAdmin,
  prefix: string,
  settings: WinbackSettings,
  userId: string,
): Promise<{ id: string; code: string; expires_at: string } | null> {
  const cleanPrefix = (prefix || "VOLTA").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "VOLTA";
  const expiresAt = new Date(Date.now() + settings.validity_days * 86_400_000).toISOString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = `${cleanPrefix}${randomSuffix(5)}`;
    const { data, error } = await supabaseAdmin
      .from("promo_coupons")
      .insert({
        code,
        discount_type: settings.discount_type,
        discount_value: settings.discount_value,
        min_order: settings.min_order,
        max_uses: 1,
        per_user_limit: 1,
        expires_at: expiresAt,
        active: true,
        note: `Win-back automático · user:${userId}`,
      })
      .select("id,code,expires_at")
      .single();
    if (!error && data) return data as { id: string; code: string; expires_at: string };
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`Erro ao criar cupom: ${error.message}`);
    }
  }
  return null;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function publicBaseUrl(): Promise<string> {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  return "https://querobis.lovable.app";
}

export interface RunWinbackParams {
  supabaseAdmin: SbAdmin;
  triggeredBy: "cron" | "manual";
  triggeredUser: string | null;
  onlyUserIds?: string[] | null;
  dryRun?: boolean;
  overrideLimit?: number;
}

export interface RunOutcome {
  ok: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  errors: string[];
  sample: Array<{ user_id: string; status: string; error?: string; code?: string }>;
}

export async function runWinback(params: RunWinbackParams): Promise<RunOutcome> {
  const { supabaseAdmin, triggeredBy, triggeredUser, onlyUserIds, dryRun } = params;

  const { data: settingsRaw, error: sErr } = await supabaseAdmin
    .from("winback_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (sErr || !settingsRaw) throw new Error(sErr?.message ?? "Configurações não encontradas.");
  const settings = settingsRaw as WinbackSettings;

  const limit = Math.min(params.overrideLimit ?? settings.max_per_run, 500);

  // Fetch candidates
  let candidates: Candidate[] = [];
  if (onlyUserIds && onlyUserIds.length) {
    // Manual pick: still enforce cooldown + phone requirements.
    const { data } = await supabaseAdmin.rpc("get_winback_candidates", {
      _days: 0,
      _min_orders: 1,
      _min_spent: 0,
      _require_phone: settings.require_phone,
      _cooldown_days: settings.cooldown_days,
      _limit: 500,
    });
    const all = (data ?? []) as Candidate[];
    const wanted = new Set(onlyUserIds);
    candidates = all.filter((c) => wanted.has(c.user_id)).slice(0, limit);
  } else {
    const { data, error } = await supabaseAdmin.rpc("get_winback_candidates", {
      _days: settings.days_inactive,
      _min_orders: settings.min_orders,
      _min_spent: settings.min_lifetime_spent,
      _require_phone: settings.require_phone,
      _cooldown_days: settings.cooldown_days,
      _limit: limit,
    });
    if (error) throw new Error(error.message);
    candidates = (data ?? []) as Candidate[];
  }

  const outcome: RunOutcome = {
    ok: true,
    processed: candidates.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    dryRun: !!dryRun,
    errors: [],
    sample: [],
  };

  const startedAt = new Date();
  const base = await publicBaseUrl();
  const link = `${base}${settings.order_link_path || "/"}`;

  for (const c of candidates) {
    if (!c.phone || c.phone.trim().length < 8) {
      outcome.skipped++;
      outcome.sample.push({ user_id: c.user_id, status: "skipped", error: "sem telefone" });
      continue;
    }

    if (dryRun) {
      outcome.sample.push({ user_id: c.user_id, status: "preview" });
      continue;
    }

    try {
      const coupon = await ensureUniqueCoupon(supabaseAdmin, settings.coupon_prefix, settings, c.user_id);
      if (!coupon) throw new Error("Falha ao gerar cupom único.");

      const msg = renderTemplate(settings.message_template, {
        nome: firstName(c.full_name),
        cupom: coupon.code,
        desconto: formatDiscount(settings.discount_type, settings.discount_value),
        validade: `${settings.validity_days} dias`,
        link,
      });

      let whatsappOk: boolean | null = null;
      let errorMsg: string | null = null;

      if (settings.send_whatsapp) {
        const r = await sendWhatsappText(c.phone, msg);
        whatsappOk = r.ok;
        if (!r.ok) errorMsg = r.error ?? "erro whatsapp";
      }

      const anyChannel = settings.send_whatsapp;
      const anyOk = whatsappOk === true;
      const status: "sent" | "failed" | "partial" | "skipped" = !anyChannel
        ? "skipped"
        : anyOk
          ? whatsappOk === true
            ? "sent"
            : "partial"
          : "failed";

      await supabaseAdmin.from("winback_sends").insert({
        user_id: c.user_id,
        phone: c.phone,
        coupon_id: coupon.id,
        coupon_code: coupon.code,
        channel: settings.send_whatsapp ? "whatsapp" : "none",
        status,
        whatsapp_ok: whatsappOk,
        push_ok: null,
        error: errorMsg,
        message: msg,
        triggered_by: triggeredBy,
        triggered_user: triggeredUser,
        days_since_last_order: c.days_since_last_order,
        last_order_at: c.last_order_at,
        discount_type: settings.discount_type,
        discount_value: settings.discount_value,
      });

      if (status === "sent" || status === "partial") outcome.sent++;
      else if (status === "failed") outcome.failed++;
      else outcome.skipped++;

      outcome.sample.push({
        user_id: c.user_id,
        status,
        code: coupon.code,
        error: errorMsg ?? undefined,
      });
      if (errorMsg) outcome.errors.push(errorMsg);
    } catch (e) {
      outcome.failed++;
      const msg = e instanceof Error ? e.message : String(e);
      outcome.errors.push(msg);
      outcome.sample.push({ user_id: c.user_id, status: "failed", error: msg });
      await supabaseAdmin.from("winback_sends").insert({
        user_id: c.user_id,
        phone: c.phone,
        channel: "none",
        status: "failed",
        error: msg,
        triggered_by: triggeredBy,
        triggered_user: triggeredUser,
        days_since_last_order: c.days_since_last_order,
        last_order_at: c.last_order_at,
      });
    }
  }

  if (!dryRun) {
    await supabaseAdmin
      .from("winback_settings")
      .update({
        last_run_at: startedAt.toISOString(),
        last_run_status: outcome.failed > 0 && outcome.sent === 0 ? "failed" : "ok",
        last_run_error: outcome.errors.slice(0, 3).join(" | ") || null,
        last_run_count: outcome.sent,
      })
      .eq("id", 1);
  }

  return outcome;
}
