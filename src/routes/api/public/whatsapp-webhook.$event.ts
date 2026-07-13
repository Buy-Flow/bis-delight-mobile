import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp-webhook/$event")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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
        const result = await ingestEvolutionPayload(payload, supabaseAdmin, {
          eventHint: params.event,
        });

        return Response.json({ ok: true, ...result });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
