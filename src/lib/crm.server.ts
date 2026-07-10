// Server-only CRM webhook dispatcher.
// Sends events to the CRM's public webhook receiver with a shared secret header.
// Never import from client-reachable code — use crm.functions.ts as the boundary.

// Event types supported by the CRM receiver.
export type CrmEventType =
  | "contact_created"
  | "cart_abandoned"
  | "order_placed"
  | "order_status"
  | "birthday_today"
  | "test";

export type CrmEventPayload = Record<string, unknown>;

export async function sendCrmWebhook(
  event_type: CrmEventType,
  payload: CrmEventPayload,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.error("[crm] Missing CRM_WEBHOOK_URL or CRM_WEBHOOK_SECRET");
    return { ok: false, status: 0, body: "missing_config" };
  }

  const body = JSON.stringify({
    event_type,
    payload,
    sent_at: new Date().toISOString(),
    source: "querobis-site",
  });

  // Retry once on transient failure (5xx or network error).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": secret,
        },
        body,
      });
      const text = await res.text().catch(() => "");
      if (res.ok) return { ok: true, status: res.status, body: text };
      if (res.status < 500 || attempt === 1) {
        console.error("[crm] webhook rejected", { event_type, status: res.status, body: text });
        return { ok: false, status: res.status, body: text };
      }
    } catch (err) {
      if (attempt === 1) {
        console.error("[crm] webhook network error", { event_type, err: String(err) });
        return { ok: false, status: 0, body: String(err) };
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { ok: false, status: 0, body: "unreachable" };
}
