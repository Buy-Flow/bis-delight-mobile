import { supabase } from "@/integrations/supabase/client";

export type CRMEvent =
  | "contact_created"
  | "cart_updated"
  | "cart_cleared"
  | "order_placed"
  | "order_completed";

/**
 * Send an event to the external CRM (AcaiFlow) via the crm-webhook edge function.
 * Fire-and-forget: never blocks the UI, never throws.
 */
export function notifyCRM(event: CRMEvent, payload: Record<string, unknown>) {
  try {
    void supabase.functions
      .invoke("crm-webhook", { body: { event, payload } })
      .catch((err) => {
        console.warn("[CRM] webhook failed", event, err);
      });
  } catch (err) {
    console.warn("[CRM] webhook threw", event, err);
  }
}
