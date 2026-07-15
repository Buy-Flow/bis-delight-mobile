import { createFileRoute } from "@tanstack/react-router";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, asaas-access-token, access_token, x-asaas-access-token",
  "Content-Type": "application/json",
} as const;

function ok(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export const Route = createFileRoute("/api/public/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers }),
      GET: async ({ params }) => ok({ ok: true, route: params._splat ?? "api/public" }),
      POST: async ({ request, params }) => {
        const path = params._splat ?? "";

        if (path.toLowerCase().includes("asaas")) {
          const { handleAsaasWebhookRequest } = await import("@/lib/asaas-webhook.server");
          return handleAsaasWebhookRequest(request);
        }

        return ok({ ok: true, ignored: true, route: path });
      },
    },
  },
});