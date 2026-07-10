import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Incoming event names from the site code (broader than CRM's vocabulary).
type SiteEventType =
  | "contact_created"
  | "cart_abandoned"
  | "order_placed"
  | "order_status_changed"
  | "order_completed"
  | "birthday_today"
  | "test";

// Normalize site → CRM event names.
function normalizeEventType(t: string): "contact_created" | "cart_abandoned" | "order_placed" | "order_status" | "birthday_today" | "test" {
  if (t === "order_completed" || t === "order_status_changed") return "order_status";
  if (
    t === "contact_created" ||
    t === "cart_abandoned" ||
    t === "order_placed" ||
    t === "order_status" ||
    t === "birthday_today" ||
    t === "test"
  ) {
    return t;
  }
  return "test";
}

// Server fn: fire a CRM event for the current authenticated user.
export const sendCrmEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { event_type: SiteEventType | string; order_id?: string; extra?: Record<string, unknown> }) => data)
  .handler(async ({ data, context }) => {
    const { sendCrmWebhook } = await import("./crm.server");
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, birthday, address, reference")
      .eq("id", userId)
      .maybeSingle();

    const customer = {
      user_id: userId,
      name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      birthday: profile?.birthday ?? null,
    };

    // Base payload conforming to the CRM contract.
    const payload: Record<string, unknown> = {
      customer,
      ...(data.extra ?? {}),
    };

    // Enrich with order details when we have an order_id.
    if (data.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, mode, subtotal, delivery_fee, total, coupon_code, address, reference, note, created_at, customer_name, phone")
        .eq("id", data.order_id)
        .maybeSingle();

      if (order) {
        const { data: itemRows } = await supabase
          .from("order_items")
          .select("product_id, name, size, flavor, quantity, unit_price, note")
          .eq("order_id", order.id);

        payload.order_id = order.id;
        payload.total = order.total;
        payload.items = (itemRows ?? []).map((it) => ({
          name: it.name,
          qty: it.quantity,
          price: it.unit_price,
          size: it.size,
          flavor: it.flavor,
          note: it.note,
        }));
        payload.order = order;
      }
    }

    const eventType = normalizeEventType(data.event_type);
    return sendCrmWebhook(eventType, payload);
  });

// Server fn: admin-only test dispatch — allows firing any event type manually.
export const testCrmWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { event_type?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { sendCrmWebhook } = await import("./crm.server");
    const eventType = normalizeEventType(data?.event_type ?? "test");

    const customer = { name: "Teste Quero Bis", phone: "11999998888", user_id: userId };
    const now = new Date().toISOString();

    switch (eventType) {
      case "contact_created":
        return sendCrmWebhook("contact_created", {
          customer,
          created_at: now,
          note: "Disparo manual de teste — contact_created.",
        });
      case "cart_abandoned":
        return sendCrmWebhook("cart_abandoned", {
          customer,
          cart_id: "test-cart-id",
          items: [
            { name: "Açaí 500ml", qty: 1, price: 24.9 },
            { name: "Sundae Ninho", qty: 1, price: 18.0 },
          ],
          total: 42.9,
          abandoned_at: now,
          note: "Disparo manual de teste — cart_abandoned.",
        });
      case "order_placed":
        return sendCrmWebhook("order_placed", {
          customer,
          order_id: "TEST-ORDER-001",
          items: [{ name: "Açaí 500ml", qty: 1, price: 24.9 }],
          total: 24.9,
          status: "pendente",
          created_at: now,
          note: "Disparo manual de teste — order_placed.",
        });
      case "order_status":
        return sendCrmWebhook("order_status", {
          customer,
          order_id: "TEST-ORDER-001",
          items: [{ name: "Açaí 500ml", qty: 1, price: 24.9 }],
          total: 24.9,
          status: "entregue",
          updated_at: now,
          note: "Disparo manual de teste — order_status.",
        });
      case "birthday_today":
        return sendCrmWebhook("birthday_today", {
          customer: { ...customer, birthday: now.slice(0, 10) },
          note: "Disparo manual de teste — birthday_today.",
        });
      default:
        return sendCrmWebhook("test", {
          customer,
          order_id: "test-order-id",
          items: [{ name: "Açaí 500ml", qty: 1, price: 24.9 }],
          total: 24.9,
          note: "Disparo manual de teste — evento genérico.",
        });
    }
  });

