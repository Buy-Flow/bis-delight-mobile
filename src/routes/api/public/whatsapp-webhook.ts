import { createFileRoute } from "@tanstack/react-router";

// Evolution API webhook receiver.
// URL: https://<host>/api/public/whatsapp-webhook?token=<EVOLUTION_WEBHOOK_TOKEN>
// Handles messages.upsert (both inbound and outbound/fromMe), connection.update, contacts.update.

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
        const ok = !!expected && token === expected;
        return Response.json({ ok, service: "whatsapp-webhook" });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ingestEvolutionPayload } = await import("@/lib/whatsapp-ingest.server");

        try {
          const result = await ingestEvolutionPayload(payload, supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[wa-webhook] processing error", e);
          return new Response("Server error", { status: 500 });
        }
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
