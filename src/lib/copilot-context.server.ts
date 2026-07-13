// Rich context snapshot loaded on every Copilot turn.
// The AI receives all of this in its system prompt so it never asks for
// data that is already sitting in the database.

import type { CopilotMenuSnapshot } from "./copilot-prompt.server";

export type CopilotOpsSnapshot = {
  // Orders (last 24h)
  orders_24h: number;
  revenue_24h: number;
  orders_pending: number;
  orders_delivering: number;
  top_products_7d: Array<{ name: string; qty: number }>;
  // Marketing state
  active_coupons: Array<{ code: string; discount_type: string; discount_value: number; uses: number; max_uses: number | null }>;
  active_popups: Array<{ id: string; name: string; title: string; ends_at: string | null }>;
  urgency_active: boolean;
  urgency_text: string | null;
  urgency_ends_at: string | null;
  // Audience
  push_subscribers: number;
  abandoned_carts_24h: number;
  vip_customers: number;
  // Reviews
  avg_rating_30d: number | null;
  reviews_30d: number;
  // Store status
  is_open_override: string | null;
};

export type CopilotMemoryItem = {
  summary: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function loadMenuSnapshot(sb: SB): Promise<CopilotMenuSnapshot> {
  const [settingsRes, catsRes, prodsRes] = await Promise.all([
    sb.from("site_settings").select("name,is_open").limit(1),
    sb.from("categories").select("id,name,active").order("position", { ascending: true }).limit(200),
    sb.from("products").select("id,name,price,active,category_id,badge,is_hero,paused_until").limit(500),
  ]);
  const cats = (catsRes.data ?? []) as CopilotMenuSnapshot["categories"];
  const catById = new Map(cats.map((c) => [c.id, c.name]));
  const products = ((prodsRes.data ?? []) as CopilotMenuSnapshot["products"]).map((p) => ({
    ...p,
    category_name: p.category_id ? catById.get(p.category_id) ?? null : null,
  }));
  return {
    settings: (settingsRes.data?.[0] as CopilotMenuSnapshot["settings"]) ?? null,
    categories: cats,
    products,
  };
}

export async function loadOpsSnapshot(sb: SB): Promise<CopilotOpsSnapshot> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

  const [ordersRes, couponsRes, popupsRes, settingsRes, subsRes, cartsRes, itemsRes, reviewsRes, loyaltyRes] = await Promise.all([
    sb.from("orders").select("id,status,total,created_at").gte("created_at", dayAgo).limit(500),
    sb.from("promo_coupons").select("code,discount_type,discount_value,uses,max_uses,active,expires_at").eq("active", true).limit(50),
    sb.from("site_popups").select("id,name,title,ends_at,active").eq("active", true).limit(20),
    sb.from("site_settings").select("open_override,urgency_active,urgency_text,urgency_ends_at").limit(1),
    sb.from("push_subscriptions").select("id", { count: "exact", head: true }),
    sb.from("abandoned_carts").select("user_id").gte("updated_at", dayAgo).is("recovered_at", null).limit(500),
    sb.from("order_items").select("name,quantity,order_id,created_at").gte("created_at", weekAgo).limit(2000),
    sb.from("reviews").select("rating,created_at").gte("created_at", monthAgo).limit(500),
    sb.from("loyalty").select("user_id,tier").in("tier", ["prata", "ouro"]).limit(500),
  ]);

  const orders = (ordersRes.data ?? []) as Array<{ status: string; total: number }>;
  const revenue_24h = orders
    .filter((o) => !["canceled", "cancelado"].includes(String(o.status).toLowerCase()))
    .reduce((s, o) => s + Number(o.total || 0), 0);

  // Top products from last 7d
  const qtyMap = new Map<string, number>();
  for (const it of (itemsRes.data ?? []) as Array<{ name: string; quantity: number }>) {
    qtyMap.set(it.name, (qtyMap.get(it.name) ?? 0) + Number(it.quantity || 1));
  }
  const top_products_7d = [...qtyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const settings = (settingsRes.data?.[0] ?? {}) as Record<string, unknown>;
  const reviews = (reviewsRes.data ?? []) as Array<{ rating: number }>;
  const avg_rating_30d = reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : null;

  return {
    orders_24h: orders.length,
    revenue_24h,
    orders_pending: orders.filter((o) => ["pending", "novo", "pago"].includes(String(o.status).toLowerCase())).length,
    orders_delivering: orders.filter((o) => ["saiu_para_entrega", "dispatched", "delivering"].includes(String(o.status).toLowerCase())).length,
    top_products_7d,
    active_coupons: ((couponsRes.data ?? []) as CopilotOpsSnapshot["active_coupons"]).slice(0, 20),
    active_popups: ((popupsRes.data ?? []) as CopilotOpsSnapshot["active_popups"]).slice(0, 10),
    urgency_active: Boolean(settings.urgency_active),
    urgency_text: (settings.urgency_text as string | null) ?? null,
    urgency_ends_at: (settings.urgency_ends_at as string | null) ?? null,
    push_subscribers: (subsRes as { count?: number }).count ?? 0,
    abandoned_carts_24h: (cartsRes.data ?? []).length,
    vip_customers: (loyaltyRes.data ?? []).length,
    avg_rating_30d,
    reviews_30d: reviews.length,
    is_open_override: (settings.open_override as string | null) ?? null,
  };
}

export async function loadMemory(sb: SB, userId: string): Promise<CopilotMemoryItem[]> {
  const { data } = await sb
    .from("ai_conversation_memory")
    .select("summary,updated_at")
    .eq("conversation_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);
  return (data ?? []) as CopilotMemoryItem[];
}

export async function loadRecentActions(sb: SB, userId: string): Promise<Array<{ action_type: string; created_at: string; reverted: boolean }>> {
  const { data } = await sb
    .from("copilot_actions")
    .select("action_type,created_at,reverted_at,status")
    .eq("user_id", userId)
    .eq("status", "executed")
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data ?? []) as Array<{ action_type: string; created_at: string; reverted_at: string | null }>).map((a) => ({
    action_type: a.action_type,
    created_at: a.created_at,
    reverted: Boolean(a.reverted_at),
  }));
}
