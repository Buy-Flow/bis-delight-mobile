// Asaas webhook receiver (canonical URL).
// URL: https://<host>/api/public/asaas-webhook
// Asaas sends the token in the "asaas-access-token" header.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
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
