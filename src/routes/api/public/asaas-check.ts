// Diagnóstico do Asaas — retorna se a chave/env estão OK.
// Uso: GET /api/public/asaas-check (requer admin autenticado)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Require an authenticated admin. /api/public/* bypasses edge auth,
        // so we verify the bearer token ourselves and enforce role in-app.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const supaUrl = process.env.SUPABASE_URL!;
          const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(supaUrl, anon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userData } = await userClient.auth.getUser();
          if (!userData.user) return new Response("Unauthorized", { status: 401 });
          const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: userData.user.id,
            _role: "admin",
          });
          if (!isAdmin) return new Response("Forbidden", { status: 403 });
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = process.env.ASAAS_API_KEY;
        const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
        const baseUrl = env === "production" || env === "prod" || env === "live"
          ? "https://api.asaas.com/v3"
          : "https://api-sandbox.asaas.com/v3";
        const legacyUrl = "https://sandbox.asaas.com/api/v3";

        // NOTE: we intentionally do NOT return any part of the API key —
        // only a boolean and the resolved base URL / env label.
        const result: Record<string, unknown> = {
          hasApiKey: !!key,
          env,
          baseUrl,
        };

        if (!key) {
          return Response.json({ ok: false, error: "ASAAS_API_KEY não configurado", ...result }, { status: 500 });
        }

        async function probe(url: string) {
          try {
            const r = await fetch(`${url}/customers?limit=1`, {
              headers: {
                access_token: key!,
                Accept: "application/json",
                "User-Agent": "querobis-lovable",
              },
            });
            const text = await r.text();
            let parsed: unknown = null;
            try { parsed = JSON.parse(text); } catch { /* keep raw */ }
            const p = parsed as { data?: unknown; errors?: Array<{ description?: string }> } | null;
            return {
              status: r.status,
              ok: r.ok,
              hasData: !!p?.data,
              error: !r.ok ? (p?.errors?.[0]?.description ?? "request failed") : null,
            };
          } catch (e) {
            return { status: 0, ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
          }
        }

        const primary = await probe(baseUrl);
        const legacy = env === "sandbox" ? await probe(legacyUrl) : null;

        return Response.json({
          ...result,
          primary: { url: baseUrl, ...primary },
          legacy: legacy ? { url: legacyUrl, ...legacy } : undefined,
          ok: primary.ok || legacy?.ok || false,
        }, {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
