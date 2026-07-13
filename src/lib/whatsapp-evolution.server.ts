export async function fetchEvolutionWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function extractEvolutionMessageId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const key = rec.key && typeof rec.key === "object" ? (rec.key as Record<string, unknown>) : null;
  const data = rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : null;
  const dataKey = data?.key && typeof data.key === "object" ? (data.key as Record<string, unknown>) : null;
  const response = rec.response && typeof rec.response === "object" ? (rec.response as Record<string, unknown>) : null;
  const responseKey = response?.key && typeof response.key === "object" ? (response.key as Record<string, unknown>) : null;

  for (const candidate of [
    key?.id,
    dataKey?.id,
    responseKey?.id,
    rec.messageId,
    rec.id,
    data?.messageId,
    data?.id,
    response?.messageId,
    response?.id,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

const WEBHOOK_EVENTS = [
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_EDITED",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "SEND_MESSAGE_UPDATE",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "CHATS_UPSERT",
];

async function postEvolutionJson(base: string, key: string, path: string, body: unknown) {
  const resp = await fetchEvolutionWithTimeout(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Evolution ${resp.status}: ${text.slice(0, 240)}`);
  return text;
}

export async function setEvolutionWebhook(params: {
  base: string;
  key: string;
  instance: string;
  url: string;
}) {
  const path = `/webhook/set/${encodeURIComponent(params.instance)}`;
  const bodies = [
    {
      webhook: {
        enabled: true,
        url: params.url,
        byEvents: false,
        base64: false,
        events: WEBHOOK_EVENTS,
      },
    },
    {
      webhook: {
        enabled: true,
        url: params.url,
        webhookByEvents: false,
        webhookBase64: false,
        events: WEBHOOK_EVENTS,
      },
    },
    {
      enabled: true,
      url: params.url,
      webhook_by_events: false,
      webhook_base64: false,
      events: WEBHOOK_EVENTS,
    },
  ];

  let lastErr: unknown = null;
  for (const body of bodies) {
    try {
      await postEvolutionJson(params.base, params.key, path, body);
      return;
    } catch (error) {
      lastErr = error;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}