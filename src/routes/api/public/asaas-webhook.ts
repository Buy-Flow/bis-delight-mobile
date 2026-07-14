// Asaas webhook receiver.
// URL: https://<host>/api/public/asaas-webhook
// Configure in Asaas → Configurações → Webhooks with an authentication token.
// Asaas sends the token in the "asaas-access-token" header.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "asaas-webhook" }),
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        const provided = request.headers.get("asaas-access-token") ?? request.headers.get("access_token");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = (payload.event as string | undefined) ?? null;
        const payment = (payload.payment as Record<string, unknown> | undefined) ?? undefined;
        const paymentId = (payment?.id as string | undefined) ?? null;
        const status = (payment?.status as string | undefined) ?? null;
        const externalReference = (payment?.externalReference as string | undefined) ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { mapAsaasStatusToOrder } = await import("@/lib/asaas.server");

        // Locate order by externalReference (order id) or asaas_payment_id
        let orderId: string | null = null;
        if (externalReference) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("id", externalReference)
            .maybeSingle();
          if (data) orderId = data.id;
        }
        if (!orderId && paymentId) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("asaas_payment_id", paymentId)
            .maybeSingle();
          if (data) orderId = data.id;
        }

        let processed = false;
        let error: string | null = null;
        try {
          if (orderId && status) {
            const map = mapAsaasStatusToOrder(status);
            const update: Record<string, unknown> = { asaas_status: status };
            if (map.paid) {
              update.status = "pago";
              update.paid_at = new Date().toISOString();
            } else if (map.canceled) {
              update.status = "cancelado";
              update.canceled_at = new Date().toISOString();
            }
            await supabaseAdmin.from("orders").update(update).eq("id", orderId);
            processed = true;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        await supabaseAdmin.from("asaas_webhook_events").insert({
          event,
          payment_id: paymentId,
          order_id: orderId,
          status,
          processed,
          error,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: payload as any,
        });

        return Response.json({ ok: true, processed });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
