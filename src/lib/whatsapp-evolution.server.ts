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

  // 1) Se veio com +DDI explícito, respeita como está.
  if (hasExplicitCountryCode) return n;

  // 2) Já vem com DDI Brasil (55 + 10 ou 11 dígitos) → mantém.
  //    Ex.: 5511987654321 (13) ou 551133334444 (12).
  if ((n.length === 13 || n.length === 12) && n.startsWith("55")) {
    // Corrige 55 duplicado por engano ("5555...").
    while (n.length > 13 && n.startsWith("5555")) n = n.slice(2);
    return n;
  }

  // 3) BR sem DDI:
  //    - Celular: DDD (2) + 9 + 8 dígitos = 11 dígitos, padrão \d{2}9\d{8}.
  //    - Fixo:    DDD (2) + 8 dígitos     = 10 dígitos.
  //    Isso PRECISA vir antes da checagem de EUA, senão DDDs 11–19 (SP,
  //    Campinas, Vale, Ribeirão etc.) são confundidos com "+1" americano.
  if (n.length === 11 && /^[1-9]{2}9\d{8}$/.test(n)) return "55" + n;
  if (n.length === 10 && /^[1-9]{2}\d{8}$/.test(n)) return "55" + n;

  // 4) EUA/Canadá: 11 dígitos começando com 1 e que NÃO casem com o padrão BR acima.
  if (n.length === 11 && n.startsWith("1")) return n;

  // 5) Fallback: devolve como veio (já pode ser um DDI internacional válido).
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