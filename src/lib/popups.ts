import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PopupFrequency = "session" | "daily" | "always";
export type PopupKind = "today" | "weekly" | "template";
export type PopupAudience =
  | "all"
  | "new_customer"
  | "returning"
  | "birthday"
  | "dormant"
  | "guest"
  | "near_reward";

export type SitePopup = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  kind: PopupKind;
  title: string;
  body: string;
  image_url: string;
  image_pos_x: number;
  image_pos_y: number;
  image_scale: number;
  cta: string;
  link: string;
  frequency: PopupFrequency;
  days_of_week: number[]; // 0=Sun..6=Sat
  start_hour: number | null;
  end_hour: number | null;
  starts_at: string | null;
  ends_at: string | null;
  audience: PopupAudience;
  audience_days: number | null;
  created_at?: string;
  updated_at?: string;
};

export const AUDIENCE_LABELS: Record<PopupAudience, { label: string; hint: string }> = {
  all: { label: "Todos", hint: "Qualquer visitante" },
  new_customer: { label: "Cliente novo", hint: "Ainda não fez pedido" },
  returning: { label: "Já comprou", hint: "Fez ao menos 1 pedido pago" },
  birthday: { label: "Aniversariante do mês", hint: "Só no mês do aniversário" },
  dormant: { label: "Inativo", hint: "Sem compra há X dias" },
  guest: { label: "Não logado", hint: "Sem conta ativa" },
  near_reward: { label: "Perto da recompensa", hint: "7+ selos acumulados" },
};

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function makeDefaultPopup(): Omit<SitePopup, "id" | "created_at" | "updated_at"> {
  return {
    name: "Novo pop-up",
    active: true,
    priority: 0,
    title: "",
    body: "",
    image_url: "",
    image_pos_x: 0,
    image_pos_y: 0,
    image_scale: 1,
    cta: "Ver agora",
    link: "",
    frequency: "session",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_hour: null,
    end_hour: null,
    starts_at: null,
    ends_at: null,
    audience: "all",
    audience_days: null,
  };
}

const KEY_PREFIX = "querobis:popup-dismissed:";
const SESSION_SHOWN_PREFIX = "querobis:popup-shown-this-session:";
const ANY_POPUP_SHOWN_THIS_SESSION_KEY = "querobis:any-popup-shown-this-session";

function hasPopupShownThisSession(p: SitePopup): boolean {
  try {
    return (
      sessionStorage.getItem(ANY_POPUP_SHOWN_THIS_SESSION_KEY) === "1" ||
      sessionStorage.getItem(SESSION_SHOWN_PREFIX + p.id) === "1"
    );
  } catch {
    return false;
  }
}

export function markPopupShownThisSession(p: SitePopup) {
  try {
    sessionStorage.setItem(ANY_POPUP_SHOWN_THIS_SESSION_KEY, "1");
    sessionStorage.setItem(SESSION_SHOWN_PREFIX + p.id, "1");
  } catch {
    // ignore
  }
}

export function shouldShowPopup(p: SitePopup): boolean {
  if (hasPopupShownThisSession(p)) return false;
  if (p.frequency === "always") return true;
  try {
    const key = KEY_PREFIX + p.id;
    if (p.frequency === "session") {
      return sessionStorage.getItem(key) !== "1";
    }
    if (p.frequency === "daily") {
      const raw = localStorage.getItem(key);
      if (!raw) return true;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return true;
      return Date.now() - ts > 24 * 60 * 60 * 1000;
    }
  } catch {
    return true;
  }
  return true;
}

export function markPopupDismissed(p: SitePopup) {
  try {
    const key = KEY_PREFIX + p.id;
    if (p.frequency === "session") sessionStorage.setItem(key, "1");
    else if (p.frequency === "daily") localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Timing rules: weekday, hour window, vigência. */
export function matchesTiming(p: SitePopup, now = new Date()): boolean {
  const dow = now.getDay();
  if (Array.isArray(p.days_of_week) && p.days_of_week.length > 0 && !p.days_of_week.includes(dow)) {
    return false;
  }
  if (p.start_hour != null || p.end_hour != null) {
    const h = now.getHours();
    const s = p.start_hour ?? 0;
    const e = p.end_hour ?? 23;
    if (s <= e) {
      if (h < s || h > e) return false;
    } else {
      // overnight window (e.g. 22 -> 4)
      if (h > e && h < s) return false;
    }
  }
  if (p.starts_at && new Date(p.starts_at).getTime() > now.getTime()) return false;
  if (p.ends_at && new Date(p.ends_at).getTime() < now.getTime()) return false;
  return true;
}

export type AudienceContext = {
  user: User | null;
  hasOrders: boolean;
  lastOrderAt: string | null;
  accountCreatedAt: string | null;
  birthdayMonth: number | null; // 1..12
  loyaltyStamps: number;
};

export async function loadAudienceContext(user: User | null): Promise<AudienceContext> {
  const ctx: AudienceContext = {
    user,
    hasOrders: false,
    lastOrderAt: null,
    accountCreatedAt: user?.created_at ?? null,
    birthdayMonth: null,
    loyaltyStamps: 0,
  };
  if (!user) return ctx;
  const [{ data: prof }, { data: order }, { data: loy }] = await Promise.all([
    supabase.from("profiles").select("birthday").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("created_at,status")
      .eq("user_id", user.id)
      .eq("status", "pago")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("loyalty").select("stamps").eq("user_id", user.id).maybeSingle(),
  ]);
  if (prof?.birthday) {
    try {
      ctx.birthdayMonth = new Date(prof.birthday as unknown as string).getMonth() + 1;
    } catch {
      ctx.birthdayMonth = null;
    }
  }
  if (order?.created_at) {
    ctx.hasOrders = true;
    ctx.lastOrderAt = order.created_at as unknown as string;
  }
  ctx.loyaltyStamps = (loy?.stamps as number | undefined) ?? 0;
  return ctx;
}

export function matchesAudience(p: SitePopup, ctx: AudienceContext, now = new Date()): boolean {
  switch (p.audience) {
    case "all":
      return true;
    case "guest":
      return !ctx.user;
    case "new_customer": {
      if (!ctx.user) return true; // considera visitantes como candidatos a novos
      if (ctx.hasOrders) return false;
      const days = p.audience_days ?? 0;
      if (!days) return true;
      if (!ctx.accountCreatedAt) return true;
      const ageDays = (now.getTime() - new Date(ctx.accountCreatedAt).getTime()) / 86_400_000;
      return ageDays <= days;
    }
    case "returning":
      return ctx.hasOrders;
    case "birthday":
      return ctx.birthdayMonth === now.getMonth() + 1;
    case "dormant": {
      if (!ctx.user) return false;
      const days = p.audience_days ?? 30;
      if (!ctx.lastOrderAt) return false;
      const gap = (now.getTime() - new Date(ctx.lastOrderAt).getTime()) / 86_400_000;
      return gap >= days;
    }
    case "near_reward":
      return ctx.loyaltyStamps >= 7;
    default:
      return true;
  }
}

export function pickPopupToShow(
  popups: SitePopup[],
  ctx: AudienceContext,
  now = new Date(),
): SitePopup | null {
  const eligible = popups
    .filter((p) => p.active)
    .filter((p) => p.title || p.body || p.image_url)
    .filter((p) => matchesTiming(p, now))
    .filter((p) => matchesAudience(p, ctx, now))
    .filter((p) => shouldShowPopup(p))
    .sort((a, b) => b.priority - a.priority || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  return eligible[0] ?? null;
}
