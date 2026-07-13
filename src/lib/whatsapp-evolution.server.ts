export async function fetchEvolutionWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertAdminRole(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export function evolutionConfig() {
  const base = (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY ?? "";
  const instance = process.env.EVOLUTION_INSTANCE ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";
  return { base, key, instance };
}

export async function evolutionFetch(path: string, init?: RequestInit) {
  const { base, key } = evolutionConfig();
  if (!base || !key) throw new Error("Evolution API não configurada (URL/KEY ausentes).");
  const resp = await fetchEvolutionWithTimeout(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      ...(init?.headers || {}),
    },
  });
  const txt = await resp.text();
  let json: unknown = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    /* raw */
  }
  if (!resp.ok) {
    const msg =
      (json && typeof json === "object" && "message" in json
        ? String((json as Record<string, unknown>).message)
        : "") || txt.slice(0, 240);
    throw new Error(`Evolution ${resp.status}: ${msg}`);
  }
  return json as Record<string, unknown> | null;
}

export async function publicWhatsappHostFromRequest(): Promise<string> {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const publishedUrl = "https://querobis.lovable.app";
  try {
    const mod = await import("@tanstack/react-start/server");
    const getRequest = (mod as unknown as { getRequest?: () => Request }).getRequest;
    if (!getRequest) return publishedUrl;
    const req = getRequest();
    const url = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    if (host.includes("localhost") || host.includes("id-preview--")) return publishedUrl;
    return `${proto}://${host}`;
  } catch {
    return publishedUrl;
  }
}

/** Normaliza número para o formato aceito pelo Evolution/WhatsApp (dígitos, com DDI). */
export function normalizeWhatsappPhone(raw: string): string {
  const original = String(raw ?? "").trim();
  const hasExplicitCountryCode = /^\s*\+/.test(original);
  let n = original.replace(/@.*$/, "").replace(/\D+/g, "");
  if (!n) return "";
  n = n.replace(/^0+/, "");

  // Se veio com +DDI ou já começa com DDI internacional conhecido, não força Brasil.
  // Ex.: +1 850 774 4710 / 18507744710 precisa continuar 18507744710, não 551850...
  if (hasExplicitCountryCode || (n.length === 11 && n.startsWith("1"))) return n;

  // BR sem DDI → adiciona 55 apenas quando o padrão parece brasileiro.
  // Fixo BR: DDD + 8 dígitos. Celular BR: DDD + 9 + 8 dígitos.
  if (n.length === 10 || (n.length === 11 && /^\d{2}9/.test(n))) n = "55" + n;
  // 55 duplicado (55 55 + numero)
  while (n.length > 13 && n.startsWith("5555")) n = n.slice(2);
  return n;
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