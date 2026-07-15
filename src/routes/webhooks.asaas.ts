// Compatibility alias — /webhooks/asaas (plural path variant).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/webhooks/asaas")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "asaas-webhook" }),
      POST: async ({ request }) => {
        const { handleAsaasWebhookRequest } = await import("@/lib/asaas-webhook.server");
        return handleAsaasWebhookRequest(request);
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
