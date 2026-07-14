// Diagnóstico do Asaas — retorna se a chave/env estão OK.
// Uso: GET /api/public/asaas-check
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-check")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.ASAAS_API_KEY;
        const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
        const baseUrl = env === "production" || env === "prod" || env === "live"
          ? "https://api.asaas.com/v3"
          : "https://api-sandbox.asaas.com/v3";
        const legacyUrl = "https://sandbox.asaas.com/api/v3";

        const result: Record<string, unknown> = {
          hasApiKey: !!key,
          apiKeyPrefix: key ? key.slice(0, 6) + "…" + key.slice(-4) : null,
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
            let parsed: any = null;
            try { parsed = JSON.parse(text); } catch {}
            return {
              status: r.status,
              ok: r.ok,
              hasData: !!parsed?.data,
              error: !r.ok ? (parsed?.errors?.[0]?.description ?? text.slice(0, 200)) : null,
            };
          } catch (e: any) {
            return { status: 0, ok: false, error: `network: ${e?.message}` };
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
