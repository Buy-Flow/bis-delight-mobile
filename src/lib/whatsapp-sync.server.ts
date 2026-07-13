import { ingestEvolutionPayload } from "./whatsapp-ingest.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

export async function syncWhatsappRecentMessagesFromEvolution({
  supabase,
  base,
  key,
  instance,
  limit,
}: {
  supabase: DbClient;
  base: string;
  key: string;
  instance: string;
  limit: number;
}) {
  if (!base || !key || !instance) {
    throw new Error("Evolution API não configurada (URL/KEY/INSTÂNCIA ausentes).");
  }

  const resp = await fetch(`${base}/chat/findMessages/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({ page: 1, offset: limit, where: {} }),
  });

  const text = await resp.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  if (!resp.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "") || text.slice(0, 240);
    throw new Error(`Evolution ${resp.status}: ${message}`);
  }

  return ingestEvolutionPayload({ event: "MESSAGES_UPSERT", data: payload }, supabase, { source: "sync" });
}
