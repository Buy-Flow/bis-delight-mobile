// Shared Asaas webhook processing logic — used by /api/public/asaas-webhook
// and by compatibility aliases. The Asaas 500 guide is explicit: unhandled
// exceptions in this endpoint pause/retry webhook queues, so every branch here
// returns a controlled JSON response instead of leaking runtime errors.

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapAsaasStatusToOrder(status: string): { paid: boolean; canceled: boolean } {
  const s = status.toUpperCase();
  return {
    paid: ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID"].includes(s),
    canceled: ["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED", "EXPIRED", "CANCELED"].includes(s),
  };
}

function getWebhookToken(request: Request): string | null {
  return (
    request.headers.get("asaas-access-token") ??
    request.headers.get("access_token") ??
    request.headers.get("x-asaas-access-token")
  );
}

export async function handleAsaasWebhookRequest(request: Request): Promise<Response> {
  try {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    const provided = getWebhookToken(request);
    if (!expected || provided !== expected) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const eventId = (payload.id as string | undefined) ?? null;
    const event = (payload.event as string | undefined) ?? null;
    const payment = (payload.payment as Record<string, unknown> | undefined) ?? undefined;
    const checkout = (payload.checkout as Record<string, unknown> | undefined) ?? undefined;
    const paymentId = (payment?.id as string | undefined) ?? null;
    const status =
      (payment?.status as string | undefined) ??
      (checkout?.status as string | undefined) ??
      null;
    const externalReference =
      (payment?.externalReference as string | undefined) ??
      (checkout?.externalReference as string | undefined) ??
      null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (eventId) {
      const { data: prior, error: priorError } = await supabaseAdmin
        .from("asaas_webhook_events")
        .select("id, processed")
        .eq("asaas_event_id", eventId)
        .maybeSingle();

      if (priorError) console.error("[asaas-webhook] idempotency lookup failed", priorError.message);
      if (prior?.processed) return json({ ok: true, deduped: true });
    }

    let orderId: string | null = null;
    let processingError: string | null = null;

    if (externalReference) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("id", externalReference)
        .maybeSingle();
      if (error) processingError = error.message;
      if (data) orderId = data.id;
    }

    if (!orderId && paymentId) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();
      if (error) processingError = processingError ?? error.message;
      if (data) orderId = data.id;
    }

    let processed = false;
    if (orderId && status) {
      const map = mapAsaasStatusToOrder(status);
      const update: {
        asaas_status: string;
        status?: string;
        paid_at?: string;
        canceled_at?: string;
      } = { asaas_status: status };

      if (map.paid) {
        update.status = "pago";
        update.paid_at = new Date().toISOString();
      } else if (map.canceled) {
        update.status = "cancelado";
        update.canceled_at = new Date().toISOString();
      }

      const { error } = await supabaseAdmin.from("orders").update(update).eq("id", orderId);
      if (error) processingError = processingError ?? error.message;
      processed = !error;
    } else {
      // Eventos informativos ou sem pedido local não devem quebrar a fila.
      processed = true;
    }

    const eventRow = {
      asaas_event_id: eventId,
      event,
      payment_id: paymentId,
      order_id: orderId,
      status,
      processed,
      error: processingError,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
    };

    const insert = eventId
      ? await supabaseAdmin.from("asaas_webhook_events").upsert(eventRow, { onConflict: "asaas_event_id" })
      : await supabaseAdmin.from("asaas_webhook_events").insert(eventRow);

    if (insert.error) {
      console.error("[asaas-webhook] event log write failed", insert.error.message);
      processingError = processingError ?? insert.error.message;
    }

    return json({ ok: true, processed, orderId, error: processingError });
  } catch (error) {
    console.error("[asaas-webhook] unexpected failure", errorMessage(error));
    return json({ ok: false, error: "webhook_processing_failed" }, 200);
  }
}
