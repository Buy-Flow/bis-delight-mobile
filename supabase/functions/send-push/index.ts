// Sends push notifications to registered devices for a campaign.
// Admin-only. Uses Web Push protocol with VAPID keys.
// Personalizes title/body per recipient using {{primeiro_nome}}, {{nome}} tokens.
//
// POST { campaignId: string, userIds?: string[] }
// Returns { sent, failed, total }

import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@querobis.com.br";
const NOTIFY_TOKEN = Deno.env.get("ORDER_NOTIFY_TOKEN") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function firstName(full?: string | null) {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Accept either an admin user bearer OR the shared ORDER_NOTIFY_TOKEN (used by run-notifications cron)
    let isSystem = NOTIFY_TOKEN && token === NOTIFY_TOKEN;
    if (!isSystem) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userRes } = await userClient.auth.getUser();
      if (!userRes.user) return json({ error: "unauthorized" }, 401);
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userRes.user.id,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }

    const { campaignId, userIds } = await req.json();
    if (!campaignId) return json({ error: "campaignId required" }, 400);

    const { data: campaign, error: cErr } = await admin
      .from("push_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    if (cErr || !campaign) return json({ error: "campaign not found" }, 404);

    // Build audience
    let subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string; user_id: string | null }> = [];
    const audience: string = campaign.audience || "all";

    if (Array.isArray(userIds) && userIds.length > 0) {
      const { data } = await admin
        .from("push_subscriptions")
        .select("id,endpoint,p256dh,auth,user_id")
        .in("user_id", userIds);
      subs = data ?? [];
    } else if (audience === "all") {
      const { data } = await admin
        .from("push_subscriptions")
        .select("id,endpoint,p256dh,auth,user_id");
      subs = data ?? [];
    } else if (audience === "recent_30d") {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: orders } = await admin
        .from("orders")
        .select("user_id")
        .gte("created_at", since)
        .not("user_id", "is", null);
      const ids = Array.from(new Set((orders ?? []).map((o: any) => o.user_id)));
      if (ids.length) {
        const { data } = await admin
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth,user_id")
          .in("user_id", ids);
        subs = data ?? [];
      }
    } else if (audience === "birthday_month") {
      const month = new Date().getMonth() + 1;
      const { data: profs } = await admin
        .from("profiles")
        .select("id, birthday")
        .not("birthday", "is", null);
      const ids = (profs ?? [])
        .filter((p: any) => p.birthday && new Date(p.birthday + "T00:00:00Z").getUTCMonth() + 1 === month)
        .map((p: any) => p.id);
      if (ids.length) {
        const { data } = await admin
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth,user_id")
          .in("user_id", ids);
        subs = data ?? [];
      }
    } else if (audience === "dormant_60d") {
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { data: recentOrders } = await admin
        .from("orders")
        .select("user_id")
        .gte("created_at", since)
        .not("user_id", "is", null);
      const activeIds = new Set((recentOrders ?? []).map((o: any) => o.user_id));
      const { data } = await admin
        .from("push_subscriptions")
        .select("id,endpoint,p256dh,auth,user_id")
        .not("user_id", "is", null);
      subs = (data ?? []).filter((s: any) => !activeIds.has(s.user_id));
    } else if (audience === "category" && campaign.audience_category) {
      // Fans of a category: users who bought at least one product in the category
      // (any paid order historical). We join order_items -> products -> orders.
      const { data: prods } = await admin
        .from("products")
        .select("id")
        .eq("category", campaign.audience_category);
      const productIds = (prods ?? []).map((p: any) => p.id);
      if (productIds.length) {
        const { data: items } = await admin
          .from("order_items")
          .select("order_id, orders!inner(user_id, status)")
          .in("product_id", productIds);
        const userIdsSet = new Set<string>();
        for (const it of items ?? []) {
          const ord = (it as any).orders;
          if (ord?.user_id && (ord.status === "pago" || ord.status === "entregue" || ord.status === "preparando" || ord.status === "saiu_para_entrega")) {
            userIdsSet.add(ord.user_id);
          }
        }
        const ids = Array.from(userIdsSet);
        if (ids.length) {
          const { data } = await admin
            .from("push_subscriptions")
            .select("id,endpoint,p256dh,auth,user_id")
            .in("user_id", ids);
          subs = data ?? [];
        }
      }
    }

    // Preload names + stamps for personalization if templates contain tokens
    const usesTokens = /\{\{\s*\w+\s*\}\}/.test(`${campaign.title}\n${campaign.body}`);
    const nameById = new Map<string, string>();
    const stampsById = new Map<string, number>();
    if (usesTokens) {
      const userIdsPresent = Array.from(new Set(subs.map((s) => s.user_id).filter(Boolean))) as string[];
      if (userIdsPresent.length) {
        const [{ data: profs }, { data: loys }] = await Promise.all([
          admin.from("profiles").select("id, full_name").in("id", userIdsPresent),
          admin.from("loyalty").select("user_id, stamps").in("user_id", userIdsPresent),
        ]);
        for (const p of profs ?? []) nameById.set((p as any).id, (p as any).full_name ?? "");
        for (const l of loys ?? []) stampsById.set((l as any).user_id, Number((l as any).stamps ?? 0) % 10);
      }
    }

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        const full = s.user_id ? nameById.get(s.user_id) ?? "" : "";
        const stamps = s.user_id ? stampsById.get(s.user_id) ?? 0 : 0;
        const vars = {
          nome: full || "amigo(a)",
          primeiro_nome: firstName(full) || "amigo(a)",
          selos: String(stamps),
        };
        const title = usesTokens ? render(campaign.title, vars) : campaign.title;
        const body = usesTokens ? render(campaign.body, vars) : campaign.body;

        const { data: delivery } = await admin
          .from("push_deliveries")
          .insert({ campaign_id: campaign.id, subscription_id: s.id, status: "pending" })
          .select("id")
          .single();
        const deliveryId = delivery?.id;

        const payload = JSON.stringify({
          title,
          body,
          url: campaign.url || "/",
          image: campaign.image || undefined,
          deliveryId,
        });

        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24, urgency: "high" },
          );
          sent++;
          if (deliveryId) await admin.from("push_deliveries").update({ status: "sent" }).eq("id", deliveryId);
        } catch (err: any) {
          failed++;
          if (deliveryId) await admin.from("push_deliveries").update({ status: "failed" }).eq("id", deliveryId);
          const code = err?.statusCode;
          if (code === 404 || code === 410) staleIds.push(s.id);
        }
      }),
    );

    if (staleIds.length) {
      await admin.from("push_subscriptions").delete().in("id", staleIds);
    }

    await admin
      .from("push_campaigns")
      .update({ sent_count: sent, failed_count: failed, status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaign.id);

    return json({ sent, failed, total: subs.length });
  } catch (e) {
    console.error("send-push error", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
