// Forwards site events to the external CRM webhook (AcaiFlow).
// The CRM URL is kept server-side as a secret. Any origin can call this
// function; we only forward the JSON body as-is.

const CRM_URL = Deno.env.get("CRM_WEBHOOK_URL") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }
  if (!CRM_URL) {
    return json({ error: "CRM_WEBHOOK_URL not set" }, 500);
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    const res = await fetch(CRM_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "querobis-site",
        sent_at: new Date().toISOString(),
        ...(payload as Record<string, unknown>),
      }),
    });
    const text = await res.text();
    return json({ ok: res.ok, status: res.status, response: text.slice(0, 500) }, res.ok ? 200 : 502);
  } catch (e) {
    console.error("crm-webhook forward failed", e);
    return json({ error: String(e) }, 502);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
