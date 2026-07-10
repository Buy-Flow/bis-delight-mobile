import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server fn: fire a CRM event for the current authenticated user.
// Used by client code after checkout, signup, cart activity, etc.
export const sendCrmEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { event_type: string; order_id?: string; extra?: Record<string, unknown> }) => data)
  .handler(async ({ data, context }) => {
    const { sendCrmWebhook } = await import("./crm.server");
    const { supabase, userId } = context;

    // Load profile (name/phone/birthday) — safe fields only.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, birthday, address, reference")
      .eq("id", userId)
      .maybeSingle();

    const contact = {
      user_id: userId,
      name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      birthday: profile?.birthday ?? null,
    };

    // Enrich with order details if an order_id is given.
    let orderPayload: Record<string, unknown> | null = null;
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

        orderPayload = {
          ...order,
          items: itemRows ?? [],
        };
      }
    }

    const payload: Record<string, unknown> = {
      contact,
      ...(orderPayload ? { order: orderPayload } : {}),
      ...(data.extra ?? {}),
    };

    const result = await sendCrmWebhook(data.event_type as never, payload);
    return result;
  });

// Server fn: admin-only test dispatch, mirrors the example curl.
export const testCrmWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { sendCrmWebhook } = await import("./crm.server");
    return sendCrmWebhook("test", {
      customer: { name: "Teste Quero Bis", phone: "11999998888" },
      order_id: "test-order-id",
      items: [{ name: "Açaí 500ml", qty: 1 }],
      total: 24.9,
      note: "Disparo de teste enviado pelo painel administrativo.",
    });
  });
