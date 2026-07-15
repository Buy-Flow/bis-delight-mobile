// Sends a push notification to every admin when a new order is placed.
// Called from a DB trigger via pg_net with a shared bearer token.
//
// POST { orderId: string }

import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@querobis.com.br";
const NOTIFY_TOKEN = Deno.env.get("ORDER_NOTIFY_TOKEN")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${NOTIFY_TOKEN}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const { orderId, test, userId } = await req.json();
    if (!orderId && !test) return json({ error: "orderId required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let order: { id: string; total: number | null; customer_name: string | null; status: string | null; payment_method: string | null } | null = null;
    if (!test) {
      const { data } = await admin
        .from("orders")
        .select("id, total, customer_name, status, payment_method")
        .eq("id", orderId)
        .single();
      order = data;
      if (!order) return json({ error: "order not found" }, 404);
      const onlinePayment = ["pix", "cartao", "credit_card", "asaas_checkout"].includes(
        String(order.payment_method ?? "").toLowerCase(),
      );
      if (onlinePayment && order.status !== "pago") {
        return json({ sent: 0, failed: 0, total: 0, skipped: "payment_pending" });
      }
    }

    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((a: any) => a.user_id);
    if (!adminIds.length) return json({ sent: 0, total: 0 });

    const targetAdminIds = test && userId && adminIds.includes(userId) ? [userId] : adminIds;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .in("user_id", targetAdminIds);

    const total = Number(order?.total || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const payload = JSON.stringify(
      test
        ? {
            title: "✅ Teste do app Quero Bis",
            body: "Se esta mensagem apareceu no telefone, o push do aplicativo está funcionando.",
            url: "/pedidos",
            kind: "test",
            tag: `qb-test-${Date.now()}`,
          }
        : {
            title: "🛎️ Novo pedido · Quero Bis",
            body: `${order?.customer_name ?? "Cliente"} acabou de pedir • ${total}`,
            url: "/pedidos",
            kind: "order",
            tag: `qb-order-${order?.id}`,
          },
    );

    let sent = 0;
    let failed = 0;
    const stale: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 },
          );
          sent++;
        } catch (err: any) {
          failed++;
          console.error("webpush send failed", { statusCode: err?.statusCode, body: err?.body });
          const code = err?.statusCode;
          if (code === 404 || code === 410) stale.push(s.id);
        }
      }),
    );
    if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);

    console.log("notify-admin-order result", { test: !!test, sent, failed, total: subs?.length ?? 0 });
    return json({ sent, failed, total: subs?.length ?? 0 });
  } catch (e) {
    console.error("notify-admin-order error", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
