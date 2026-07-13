import { createFileRoute } from "@tanstack/react-router";

function normalizePhone(raw: string): string {
  let n = String(raw ?? "").replace(/@.*$/, "").replace(/\D+/g, "");
  if (!n) return "";
  n = n.replace(/^0+/, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  while (n.length > 13 && n.startsWith("5555")) n = n.slice(2);
  return n;
}

export const Route = createFileRoute("/api/public/probe-wa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const doSend = url.searchParams.get("send");


        const phone = url.searchParams.get("phone") ?? "";
        const base = (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
        const key = process.env.EVOLUTION_API_KEY ?? "";
        const instance = process.env.EVOLUTION_INSTANCE ?? "";
        const n = normalizePhone(phone);
        const variants = new Set<string>([n]);
        if (/^55\d{2}\d{8}$/.test(n)) variants.add(n.slice(0, 4) + "9" + n.slice(4));
        if (/^55\d{2}9\d{8}$/.test(n)) variants.add(n.slice(0, 4) + n.slice(5));
        const checkUrl = `${base}/chat/whatsappNumbers/${encodeURIComponent(instance)}`;
        const out: Record<string, unknown> = { normalized: n, variants: [...variants], checkUrl };
        try {
          const r = await fetch(checkUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: key },
            body: JSON.stringify({ numbers: [...variants] }),
          });
          out.batch = { status: r.status, body: (await r.text()).slice(0, 2000) };
        } catch (e) {
          out.batch = { error: String(e) };
        }
        for (const v of variants) {
          try {
            const r = await fetch(checkUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: key },
              body: JSON.stringify({ numbers: [v] }),
            });
            out[`single_${v}`] = { status: r.status, body: (await r.text()).slice(0, 2000) };
          } catch (e) {
            out[`single_${v}`] = { error: String(e) };
          }
        }
        if (doSend) {
          const sendUrl = `${base}/message/sendText/${encodeURIComponent(instance)}`;
          for (const v of variants) {
            try {
              const r = await fetch(sendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: key },
                body: JSON.stringify({ number: v, text: `probe ${Date.now()}`, delay: 0, linkPreview: false }),
              });
              out[`send_${v}`] = { status: r.status, body: (await r.text()).slice(0, 2000) };
            } catch (e) {
              out[`send_${v}`] = { error: String(e) };
            }
          }
        }

        return new Response(JSON.stringify(out, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
