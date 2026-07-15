// Compatibility alias — some Asaas panels have this URL configured.
// Delegates to the shared handler.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas")({
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
