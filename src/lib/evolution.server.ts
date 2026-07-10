// Evolution API client — server-only helpers.
// Never import from client code.

const INSTANCE_NAME = "querobis";

function getEnv() {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) throw new Error("Evolution API credentials not configured");
  return { url: url.replace(/\/+$/, ""), key };
}

async function evoFetch(path: string, init: RequestInit = {}) {
  const { url, key } = getEnv();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Evolution indisponível no momento: ${detail}`);
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `Evolution ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }
  return body as any;
}

export function getInstanceName() {
  return INSTANCE_NAME;
}

// Normalize a Brazilian phone into the JID Evolution accepts (E.164 digits + @s.whatsapp.net).
export function toJid(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

export function fromJid(jid: string): string {
  return jid.replace(/@.*/, "");
}

export async function fetchInstances() {
  return evoFetch("/instance/fetchInstances");
}

export async function connectionState() {
  return evoFetch(`/instance/connectionState/${INSTANCE_NAME}`);
}

export async function createInstance() {
  return evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: INSTANCE_NAME,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
}

export async function connectInstance() {
  return evoFetch(`/instance/connect/${INSTANCE_NAME}`);
}

export async function logoutInstance() {
  return evoFetch(`/instance/logout/${INSTANCE_NAME}`, {
    method: "DELETE",
  });
}

export async function deleteInstance() {
  return evoFetch(`/instance/delete/${INSTANCE_NAME}`, {
    method: "DELETE",
  });
}

export async function setWebhook(webhookUrl: string) {
  return evoFetch(`/webhook/set/${INSTANCE_NAME}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        webhookBase64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE"],
      },
    }),
  });
}

export async function sendText(phone: string, text: string) {
  return evoFetch(`/message/sendText/${INSTANCE_NAME}`, {
    method: "POST",
    body: JSON.stringify({
      number: toJid(phone),
      text,
    }),
  });
}

export async function sendImage(phone: string, imageUrl: string, caption?: string) {
  return evoFetch(`/message/sendMedia/${INSTANCE_NAME}`, {
    method: "POST",
    body: JSON.stringify({
      number: toJid(phone),
      mediatype: "image",
      media: imageUrl,
      caption: caption ?? "",
    }),
  });
}

// Download media by messageId from Evolution (returns base64 or url depending on version).
export async function downloadMedia(messageId: string) {
  return evoFetch(`/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`, {
    method: "POST",
    body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
  });
}
