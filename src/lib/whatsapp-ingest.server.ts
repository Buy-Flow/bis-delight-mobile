type EvoKey = {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
  senderPn?: string;
  previousRemoteJid?: string;
};

type EvoMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; url?: string };
  videoMessage?: { caption?: string; url?: string };
  audioMessage?: { url?: string };
  documentMessage?: { fileName?: string; url?: string };
  stickerMessage?: { url?: string };
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string };
  contactMessage?: { displayName?: string };
};

type EvoData = {
  id?: string;
  key?: EvoKey;
  pushName?: string;
  message?: EvoMessage;
  messageType?: string;
  messageTimestamp?: number | string;
  status?: string;
};

type IngestResult = {
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

function normalizeEvent(raw?: string | null) {
  return (raw || "")
    .toLowerCase()
    .replace(/_/g, ".")
    .replace(/-/g, ".");
}

function phoneFromJid(...jids: Array<string | undefined | null>): string | null {
  for (const jid of jids) {
    if (!jid) continue;
    if (jid.includes("@g.us") || jid.includes("status@broadcast")) continue;
    const first = jid.split("@")[0] ?? "";
    if (first.endsWith(":0")) continue;
    const digits = first.replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  return null;
}

function extractText(m?: EvoMessage): { text: string | null; type: string; media: string | null } {
  if (!m) return { text: null, type: "unknown", media: null };
  if (m.conversation) return { text: m.conversation, type: "text", media: null };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, type: "text", media: null };
  if (m.imageMessage) return { text: m.imageMessage.caption ?? "[imagem]", type: "image", media: m.imageMessage.url ?? null };
  if (m.videoMessage) return { text: m.videoMessage.caption ?? "[vídeo]", type: "video", media: m.videoMessage.url ?? null };
  if (m.audioMessage) return { text: "[áudio]", type: "audio", media: m.audioMessage.url ?? null };
  if (m.documentMessage) return { text: `[documento] ${m.documentMessage.fileName ?? ""}`.trim(), type: "document", media: m.documentMessage.url ?? null };
  if (m.stickerMessage) return { text: "[figurinha]", type: "sticker", media: m.stickerMessage.url ?? null };
  if (m.locationMessage) {
    const label = m.locationMessage.name ? `[localização] ${m.locationMessage.name}` : "[localização]";
    return { text: label, type: "location", media: null };
  }
  if (m.contactMessage) return { text: `[contato] ${m.contactMessage.displayName ?? ""}`.trim(), type: "contact", media: null };
  return { text: null, type: "unknown", media: null };
}

function timestampIso(item: EvoData, payloadDate?: unknown) {
  const raw = item.messageTimestamp;
  if (typeof raw === "number" || (typeof raw === "string" && raw.trim())) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      const ms = n > 10_000_000_000 ? n : n * 1000;
      return new Date(ms).toISOString();
    }
  }
  if (typeof payloadDate === "string" && payloadDate.trim()) {
    const d = new Date(payloadDate);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function extractItems(payload: Record<string, unknown>): EvoData[] {
  const data = payload.data;
  if (Array.isArray(data)) return data as EvoData[];

  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const messages = rec.messages as Record<string, unknown> | EvoData[] | undefined;
    if (Array.isArray(messages)) return messages as EvoData[];
    if (messages && typeof messages === "object") {
      const records = (messages as Record<string, unknown>).records;
      if (Array.isArray(records)) return records as EvoData[];
    }
    if (Array.isArray(rec.records)) return rec.records as EvoData[];
    if (rec.key || rec.message || rec.messageTimestamp) return [rec as EvoData];
  }

  if (payload.key || payload.message || payload.messageTimestamp) return [payload as EvoData];
  return [];
}

function sortByTimestamp(items: EvoData[]) {
  return [...items].sort((a, b) => {
    const ta = Number(a.messageTimestamp ?? 0);
    const tb = Number(b.messageTimestamp ?? 0);
    return ta - tb;
  });
}

export async function ingestEvolutionPayload(
  payload: Record<string, unknown>,
  supabase: DbClient,
  options: { eventHint?: string | null } = {},
): Promise<IngestResult> {
  const event = normalizeEvent(options.eventHint ?? (payload.event as string | undefined));
  const items = sortByTimestamp(extractItems(payload));
  const result: IngestResult = { processed: 0, inserted: 0, skipped: 0, errors: 0 };

  const isMessageEvent =
    !event ||
    event === "messages.upsert" ||
    event === "send.message" ||
    event === "messages.update" ||
    event === "messages.set";

  if (!isMessageEvent) return result;

  for (const item of items) {
    result.processed += 1;
    const key = item.key;
    if (key?.remoteJid?.includes("@g.us") || key?.remoteJid?.includes("status@broadcast")) {
      result.skipped += 1;
      continue;
    }

    const phone = phoneFromJid(key?.remoteJid, key?.senderPn, key?.previousRemoteJid, payload.sender as string | undefined);
    if (!phone) {
      result.skipped += 1;
      continue;
    }

    const { text, type, media } = extractText(item.message);
    if (!text && !media) {
      result.skipped += 1;
      continue;
    }

    const evoId = key?.id ?? item.id ?? null;
    if (evoId) {
      const { data: dup } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("evolution_id", evoId)
        .maybeSingle();
      if (dup) {
        result.skipped += 1;
        continue;
      }
    }

    const fromMe = !!key?.fromMe;
    const direction: "in" | "out" = fromMe ? "out" : "in";
    const nowIso = timestampIso(item, payload.date_time);

    const { data: existing, error: existingErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, unread_count, contact_name, last_message_at")
      .eq("phone", phone)
      .maybeSingle();

    if (existingErr) {
      result.errors += 1;
      continue;
    }

    let convId: string;
    if (existing) {
      convId = existing.id as string;
      const previousTime = existing.last_message_at ? new Date(existing.last_message_at as string).getTime() : 0;
      const incomingTime = new Date(nowIso).getTime();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (!existing.contact_name && item.pushName && !fromMe) patch.contact_name = item.pushName;
      if (incomingTime >= previousTime) {
        patch.last_message_at = nowIso;
        patch.last_message_preview = (text ?? "").slice(0, 140) || `[${type}]`;
        if (direction === "in") patch.unread_count = ((existing.unread_count as number | null) ?? 0) + 1;
      }

      await supabase.from("whatsapp_conversations").update(patch).eq("id", convId);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("whatsapp_conversations")
        .insert({
          phone,
          contact_name: !fromMe ? item.pushName ?? null : null,
          last_message_at: nowIso,
          last_message_preview: (text ?? "").slice(0, 140) || `[${type}]`,
          unread_count: direction === "in" ? 1 : 0,
        })
        .select("id")
        .single();

      if (insErr || !inserted) {
        result.errors += 1;
        continue;
      }
      convId = inserted.id as string;
    }

    const { error: msgErr } = await supabase.from("whatsapp_messages").insert({
      conversation_id: convId,
      evolution_id: evoId,
      direction,
      type,
      content: text,
      media_url: media,
      sent_by: fromMe ? "human" : "customer",
      status: item.status ?? (fromMe ? "sent" : "received"),
      created_at: nowIso,
      raw: item,
    });

    if (msgErr) result.errors += 1;
    else result.inserted += 1;
  }

  return result;
}
