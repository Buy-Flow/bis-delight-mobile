// Server-only Evolution API adapter. Keep all direct HTTP calls here so the
// UI/server functions use one predictable contract.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

export type EvolutionJson = Record<string, unknown> | Array<unknown> | null;

export type EvolutionCall = {
  ok: boolean;
  status: number;
  json: EvolutionJson;
  text: string;
};

export type EvolutionConnection = {
  state: string;
  exists: boolean;
  ownerJid: string | null;
  profileName: string | null;
  disconnectionAt: string | null;
  disconnectionCode: number | null;
  raw: EvolutionJson;
};

export type ResolvedNumber = {
  number: string;
  candidates: string[];
  verifiedJid: string | null;
  reports: Array<{
    candidate: string;
    status: number | string;
    exists: boolean | null;
    jid: string | null;
    response: unknown;
  }>;
};

const WEBHOOK_EVENTS = [
  "APPLICATION_STARTUP",
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_EDITED",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "SEND_MESSAGE_UPDATE",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
];

export async function fetchEvolutionWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 20_000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertAdminRole(supabase: DbClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export function evolutionConfig() {
  const base = (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY ?? "";
  const instance = process.env.EVOLUTION_INSTANCE ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";
  return { base, key, instance };
}

export async function evolutionRequest(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<EvolutionCall> {
  const { base, key } = evolutionConfig();
  if (!base || !key) throw new Error("Evolution API não configurada (URL/KEY ausentes).");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  headers.set("apikey", key);
  const resp = await fetchEvolutionWithTimeout(`${base}${path}`, { ...init, headers }, timeoutMs);
  const text = await resp.text();
  let json: EvolutionJson = null;
  try {
    json = text ? (JSON.parse(text) as EvolutionJson) : null;
  } catch {
    json = null;
  }
  return { ok: resp.ok, status: resp.status, json, text };
}

export async function evolutionFetch(path: string, init?: RequestInit) {
  const result = await evolutionRequest(path, init);
  if (!result.ok) {
    const msg = evolutionErrorMessage(result);
    throw new Error(`Evolution ${result.status}: ${msg}`);
  }
  return result.json as Record<string, unknown> | null;
}

export function evolutionErrorMessage(result: Pick<EvolutionCall, "json" | "text" | "status">) {
  const json = result.json;
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    const message = rec.message ?? rec.error ?? rec.response;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) return JSON.stringify(message).slice(0, 500);
    if (message && typeof message === "object") return JSON.stringify(message).slice(0, 500);
  }
  return result.text?.slice(0, 500) || `HTTP ${result.status}`;
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

/** Normaliza para dígitos com DDI; não inventa dígito 9 quando o número já foi digitado. */
export function normalizeWhatsappPhone(raw: string): string {
  const original = String(raw ?? "").trim();
  const explicitCountry = /^\s*\+/.test(original);
  let n = original.replace(/@.*$/, "").replace(/\D+/g, "").replace(/^0+/, "");
  if (!n) return "";
  while (n.length > 13 && n.startsWith("5555")) n = n.slice(2);
  if (explicitCountry) return n;
  if ((n.length === 12 || n.length === 13) && n.startsWith("55")) return n;
  if (n.length === 10 || n.length === 11) return `55${n}`;
  return n;
}

export function whatsappNumberCandidates(raw: string): string[] {
  const phone = normalizeWhatsappPhone(raw);
  if (!phone) return [];
  const out = [phone];
  const withNine = phone.match(/^55(\d{2})9(\d{8})$/);
  if (withNine) out.push(`55${withNine[1]}${withNine[2]}`);
  const withoutNine = phone.match(/^55(\d{2})(\d{8})$/);
  if (withoutNine) out.push(`55${withoutNine[1]}9${withoutNine[2]}`);
  return Array.from(new Set(out.filter((n) => n.length >= 10 && n.length <= 15)));
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function unwrapArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((x) => !!objectRecord(x)) as Array<Record<string, unknown>>;
  const rec = objectRecord(value);
  if (!rec) return [];
  for (const bucket of [rec.response, rec.data, rec.result, rec.message, rec.numbers]) {
    if (Array.isArray(bucket)) return bucket.filter((x) => !!objectRecord(x)) as Array<Record<string, unknown>>;
    const nested = objectRecord(bucket);
    if (nested) {
      for (const inner of [nested.records, nested.message, nested.numbers, nested.data]) {
        if (Array.isArray(inner)) return inner.filter((x) => !!objectRecord(x)) as Array<Record<string, unknown>>;
      }
    }
  }
  return [];
}

function digitsFromJid(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.includes("@g.us") || value.includes("status@broadcast") || value.includes("@lid")) return null;
  const digits = value.split("@")[0].replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export async function resolveEvolutionSendNumber(phone: string): Promise<ResolvedNumber> {
  const { instance } = evolutionConfig();
  const candidates = whatsappNumberCandidates(phone);
  if (candidates.length === 0) throw new Error(`Telefone inválido: ${phone}`);

  const reports: ResolvedNumber["reports"] = [];
  for (const candidate of candidates) {
    try {
      const result = await evolutionRequest(
        `/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
        { method: "POST", body: JSON.stringify({ numbers: [candidate] }) },
        10_000,
      );
      const rows = unwrapArray(result.json);
      const found = rows.find((row) => row.exists === true || row.exists === "true") ?? null;
      const jid = found ? String(found.jid ?? found.remoteJid ?? found.id ?? "") : null;
      const resolved = digitsFromJid(jid) ?? digitsFromJid(found?.number) ?? (found ? candidate : null);
      reports.push({ candidate, status: result.status, exists: !!found, jid, response: result.json ?? result.text.slice(0, 800) });
      if (resolved) return { number: resolved, candidates, verifiedJid: jid, reports };
    } catch (error) {
      reports.push({ candidate, status: "exception", exists: null, jid: null, response: error instanceof Error ? error.message : String(error) });
    }
  }

  return { number: candidates[0], candidates, verifiedJid: null, reports };
}

export function extractEvolutionMessageId(value: unknown): string | null {
  const rec = objectRecord(value);
  if (!rec) return null;
  const data = objectRecord(rec.data);
  const response = objectRecord(rec.response);
  const key = objectRecord(rec.key) ?? objectRecord(data?.key) ?? objectRecord(response?.key);
  for (const candidate of [
    key?.id,
    rec.messageId,
    rec.keyId,
    rec.id,
    data?.messageId,
    data?.keyId,
    data?.id,
    response?.messageId,
    response?.keyId,
    response?.id,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function getEvolutionConnectionSnapshot(): Promise<EvolutionConnection> {
  const { instance } = evolutionConfig();
  if (!instance) {
    return { state: "unconfigured", exists: false, ownerJid: null, profileName: null, disconnectionAt: null, disconnectionCode: null, raw: null };
  }

  const stateCall = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instance)}`, {}, 12_000);
  if (!stateCall.ok) {
    if (stateCall.status === 404) {
      return { state: "not_found", exists: false, ownerJid: null, profileName: null, disconnectionAt: null, disconnectionCode: null, raw: stateCall.json ?? { body: stateCall.text } };
    }
    throw new Error(`Evolution ${stateCall.status}: ${evolutionErrorMessage(stateCall)}`);
  }

  const stateRec = objectRecord(stateCall.json);
  const instanceRec = objectRecord(stateRec?.instance);
  let state = String(instanceRec?.state ?? stateRec?.state ?? "unknown");
  let ownerJid: string | null = null;
  let profileName: string | null = null;
  let disconnectionAt: string | null = null;
  let disconnectionCode: number | null = null;

  try {
    const list = await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`, {}, 12_000);
    if (list.ok) {
      const first = unwrapArray(list.json)[0] ?? null;
      if (first) {
        ownerJid = typeof first.ownerJid === "string" ? first.ownerJid : null;
        profileName = typeof first.profileName === "string" ? first.profileName : null;
        disconnectionAt = typeof first.disconnectionAt === "string" ? first.disconnectionAt : null;
        disconnectionCode = typeof first.disconnectionReasonCode === "number" ? first.disconnectionReasonCode : null;
        const connStatus = typeof first.connectionStatus === "string" ? first.connectionStatus : null;
        if (connStatus === "open" || connStatus === "close" || connStatus === "connecting") state = connStatus;
      }
    }
  } catch {
    // connectionState is enough for the UI; fetchInstances enriches only.
  }

  if (state === "open") {
    disconnectionAt = null;
    disconnectionCode = null;
  }

  return { state, exists: true, ownerJid, profileName, disconnectionAt, disconnectionCode, raw: stateCall.json };
}

export async function connectEvolutionInstance() {
  const { instance } = evolutionConfig();
  if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
  const snapshot = await getEvolutionConnectionSnapshot().catch((error) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (/404/.test(msg)) return null;
    throw error;
  });

  if (!snapshot || snapshot.state === "not_found") {
    const created = await evolutionRequest("/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    });
    if (!created.ok && created.status !== 409) {
      throw new Error(`Evolution ${created.status}: ${evolutionErrorMessage(created)}`);
    }
  }

  const connected = await evolutionRequest(`/instance/connect/${encodeURIComponent(instance)}`, {}, 15_000);
  if (!connected.ok) throw new Error(`Evolution ${connected.status}: ${evolutionErrorMessage(connected)}`);
  const rec = objectRecord(connected.json) ?? {};
  const qrObj = objectRecord(rec.qrcode) ?? rec;
  let base64 = typeof qrObj.base64 === "string" ? qrObj.base64 : typeof rec.base64 === "string" ? rec.base64 : null;
  if (base64 && !base64.startsWith("data:")) base64 = `data:image/png;base64,${base64}`;
  return {
    base64,
    code: typeof qrObj.code === "string" ? qrObj.code : typeof rec.code === "string" ? rec.code : null,
    pairingCode: typeof rec.pairingCode === "string" ? rec.pairingCode : typeof qrObj.pairingCode === "string" ? qrObj.pairingCode : null,
    raw: connected.json,
  };
}

export async function setEvolutionWebhook(params: { base?: string; key?: string; instance?: string; url: string }) {
  const { instance } = evolutionConfig();
  const targetInstance = params.instance || instance;
  if (!targetInstance) throw new Error("EVOLUTION_INSTANCE não configurado.");
  const body = {
    webhook: {
      enabled: true,
      url: params.url,
      byEvents: false,
      base64: false,
      events: WEBHOOK_EVENTS,
    },
  };
  const result = await evolutionRequest(`/webhook/set/${encodeURIComponent(targetInstance)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) throw new Error(`Evolution ${result.status}: ${evolutionErrorMessage(result)}`);
  return result.json;
}

export async function getEvolutionWebhook() {
  const { instance } = evolutionConfig();
  if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
  const result = await evolutionRequest(`/webhook/find/${encodeURIComponent(instance)}`, {}, 12_000);
  if (!result.ok) throw new Error(`Evolution ${result.status}: ${evolutionErrorMessage(result)}`);
  const rec = objectRecord(result.json) ?? {};
  const webhook = objectRecord(rec.webhook) ?? rec;
  return {
    url: typeof webhook.url === "string" ? webhook.url : null,
    enabled: webhook.enabled === true || webhook.enabled === "true",
    raw: result.json,
  };
}

export async function sendEvolutionText(phone: string, text: string) {
  const { instance } = evolutionConfig();
  if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
  const resolved = await resolveEvolutionSendNumber(phone);
  const attempts: Array<{ number: string; status: number; ok: boolean; response: unknown }> = [];
  let last: EvolutionCall | null = null;
  for (const number of Array.from(new Set([resolved.number, ...resolved.candidates]))) {
    const result = await evolutionRequest(`/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      body: JSON.stringify({ number, text, delay: 0, linkPreview: false }),
    });
    attempts.push({ number, status: result.status, ok: result.ok, response: result.json ?? result.text.slice(0, 1200) });
    last = result;
    if (result.ok) {
      const root = objectRecord(result.json);
      const statusRaw = root?.status ?? objectRecord(root?.data)?.status;
      const evoStatus = String(statusRaw ?? "sent").toLowerCase();
      const failed = evoStatus === "error" || evoStatus === "failed";
      return {
        ok: !failed,
        status: result.status,
        appStatus: failed ? "failed" : "sent",
        evolutionId: extractEvolutionMessageId(result.json),
        selectedNumber: number,
        error: failed ? `Evolution retornou status ${evoStatus}` : null,
        raw: { verification: resolved, attempts },
      };
    }
    if (![400, 404, 422].includes(result.status)) break;
  }
  return {
    ok: false,
    status: last?.status ?? 0,
    appStatus: "failed",
    evolutionId: null,
    selectedNumber: resolved.number,
    error: last ? `Evolution ${last.status}: ${evolutionErrorMessage(last)}` : "Evolution não respondeu.",
    raw: { verification: resolved, attempts },
  };
}