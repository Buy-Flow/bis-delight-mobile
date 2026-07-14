type EvoKey = {
  remoteJid?: string;
  remoteJidAlt?: string;
  fromMe?: boolean;
  id?: string;
  participant?: string;
  participantAlt?: string;
  senderPn?: string;
  previousRemoteJid?: string;
};

type EvoMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; url?: string };
  videoMessage?: { caption?: string; url?: string };
  audioMessage?: { url?: string; ptt?: boolean };
  documentMessage?: { fileName?: string; url?: string };
  documentWithCaptionMessage?: { message?: { documentMessage?: { fileName?: string; url?: string; caption?: string } } };
  stickerMessage?: { url?: string };
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string };
  contactMessage?: { displayName?: string };
  reactionMessage?: { text?: string; key?: { id?: string } };
};

type EvoData = {
  id?: string;
  key?: EvoKey;
  keyId?: string;
  remoteJid?: string;
  fromMe?: boolean;
  participant?: string;
  pushName?: string;
  message?: EvoMessage;
  messageType?: string;
  messageTimestamp?: number | string;
  status?: string | number;
  ack?: string | number;
};

type IngestResult = {
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
  updated?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

// Mapa ack numérico → nome textual usado pelo Baileys/Evolution.
// Versões/forks podem enviar string em `status` ou número em `ack/status`.
const ACK_MAP: Record<number, string> = {
  [-1]: "ERROR",
  0: "PENDING",
  1: "SERVER_ACK",
  2: "DELIVERY_ACK",
  3: "READ",
  4: "PLAYED",
};

function normalizeStatus(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number") return ACK_MAP[raw] ?? null;
  const s = String(raw).trim().toUpperCase();
  return s || null;
}

function appMessageStatus(raw: unknown, fromMe: boolean): string {
  const statusName = normalizeStatus(raw);
  if (!statusName) return fromMe ? "sent" : "received";
  // ERROR/failed só faz sentido para mensagens enviadas por nós. Para uma
  // mensagem recebida do cliente um ack -1 no payload não significa que
  // a mensagem "falhou" — ela chegou. Nunca marcar inbound como failed.
  if (statusName === "ERROR") return fromMe ? "failed" : "received";
  if (statusName === "DELIVERY_ACK") return fromMe ? "delivered" : "received";
  if (statusName === "READ" || statusName === "PLAYED") return fromMe ? "read" : "received";
  // PENDING/SERVER_ACK são estados internos iniciais da Evolution: o aparelho
  // aceitou a mensagem. No painel isso deve aparecer como enviada, não como
  // pendente infinito; webhooks posteriores elevam para entregue/lida.
  return fromMe ? "sent" : "received";
}

function normalizeEvent(raw?: string | null) {
  return (raw || "")
    .toLowerCase()
    .replace(/_/g, ".")
    .replace(/-/g, ".");
}

// Escolhe o melhor JID "conversacional" priorizando remoteJidAlt quando
// o principal é @lid (migração de identidade da WhatsApp).
function pickConversationJid(key?: EvoKey, item?: EvoData): string | undefined {
  const primary = key?.remoteJid ?? item?.remoteJid;
  if (primary && !primary.endsWith("@lid")) return primary;
  return key?.remoteJidAlt ?? primary;
}

function phoneFromJid(...jids: Array<string | undefined | null>): string | null {
  for (const jid of jids) {
    if (!jid) continue;
    if (jid.includes("@g.us") || jid.includes("status@broadcast")) continue;
    // @lid é um identificador interno anônimo da WhatsApp — NÃO é telefone.
    // Só extrai dígitos de JIDs reais (@s.whatsapp.net / @c.us) ou strings puras.
    if (jid.includes("@lid")) continue;
    const first = jid.split("@")[0] ?? "";
    if (first.endsWith(":0")) continue;
    const digits = first.replace(/\D/g, "");
    // Telefones válidos globais: 10 a 15 dígitos. LIDs costumam ter 14-15 dígitos
    // aleatórios; então também rejeitamos qualquer coisa com mais de 15.
    if (digits.length < 10 || digits.length > 15) continue;
    return digits;
  }
  return null;
}


function extractText(m?: EvoMessage): { text: string | null; type: string; media: string | null } {
  if (!m) return { text: null, type: "unknown", media: null };
  if (m.conversation) return { text: m.conversation, type: "text", media: null };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, type: "text", media: null };
  if (m.imageMessage) return { text: m.imageMessage.caption ?? "[imagem]", type: "image", media: m.imageMessage.url ?? null };
  if (m.videoMessage) return { text: m.videoMessage.caption ?? "[vídeo]", type: "video", media: m.videoMessage.url ?? null };
  if (m.audioMessage) {
    return { text: m.audioMessage.ptt ? "[áudio]" : "[áudio]", type: "audio", media: m.audioMessage.url ?? null };
  }
  const doc = m.documentMessage ?? m.documentWithCaptionMessage?.message?.documentMessage;
  if (doc) return { text: `[documento] ${doc.fileName ?? ""}`.trim(), type: "document", media: doc.url ?? null };
  if (m.stickerMessage) return { text: "[figurinha]", type: "sticker", media: m.stickerMessage.url ?? null };
  if (m.locationMessage) {
    const label = m.locationMessage.name ? `[localização] ${m.locationMessage.name}` : "[localização]";
    return { text: label, type: "location", media: null };
  }
  if (m.contactMessage) return { text: `[contato] ${m.contactMessage.displayName ?? ""}`.trim(), type: "contact", media: null };
  if (m.reactionMessage) return { text: `[reação] ${m.reactionMessage.text ?? ""}`.trim(), type: "reaction", media: null };
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
    if (rec.key || rec.message || rec.messageTimestamp || rec.keyId || rec.messageId || rec.id || rec.remoteJid || rec.status || rec.ack) {
      return [rec as EvoData];
    }
  }

  if (payload.key || payload.message || payload.messageTimestamp || payload.keyId || payload.messageId || payload.id || payload.remoteJid || payload.status || payload.ack) {
    return [payload as EvoData];
  }
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
  options: { eventHint?: string | null; source?: string } = {},
): Promise<IngestResult> {
  const event = normalizeEvent(options.eventHint ?? (payload.event as string | undefined));
  const source = options.source ?? "webhook";
  const items = sortByTimestamp(extractItems(payload));
  const result: IngestResult = { processed: 0, inserted: 0, skipped: 0, errors: 0 };

  const logRow = async (row: {
    status: "ok" | "skipped" | "error" | "noise";
    phone?: string | null;
    evolution_id?: string | null;
    from_me?: boolean | null;
    message_type?: string | null;
    preview?: string | null;
    error?: string | null;
    payload?: unknown;
  }) => {
    try {
      await supabase.from("whatsapp_ingest_logs").insert({
        source,
        event: event || null,
        status: row.status,
        phone: row.phone ?? null,
        evolution_id: row.evolution_id ?? null,
        from_me: row.from_me ?? null,
        message_type: row.message_type ?? null,
        preview: row.preview ? row.preview.slice(0, 240) : null,
        error: row.error ?? null,
        payload: row.payload ?? null,
      });
    } catch {
      // never let logging break ingestion
    }
  };

  const isStatusUpdate = event === "messages.update" || event === "send.message.update";
  const isMessageEvent =
    !event ||
    event === "messages.upsert" ||
    event === "send.message" ||
    event === "messages.edited" ||
    event === "messages.set";

  // ---------- messages.update / send.message.update ----------
  // Esses eventos NÃO carregam a mensagem completa; carregam apenas o par
  // (keyId, remoteJid, fromMe, status) para atualizar ack/leitura de uma
  // mensagem já persistida. Fonte: whatsapp.baileys.service.ts:1258-1350.
  if (isStatusUpdate) {
    if (items.length === 0) {
      await logRow({ status: "noise", error: "status update sem itens", payload });
      return result;
    }

    for (const item of items) {
      result.processed += 1;
      const rec = item as unknown as Record<string, unknown>;
      const key = item.key;
      const evoId =
        key?.id ??
        (rec.keyId as string | undefined) ??
        (rec.id as string | undefined) ??
        null;
      const statusName = normalizeStatus(item.status ?? item.ack ?? (rec.status as string | number | undefined) ?? (rec.ack as string | number | undefined));
      if (!evoId || !statusName) {
        result.skipped += 1;
        await logRow({
          status: "skipped",
          error: "status update sem keyId ou status",
          evolution_id: evoId,
          payload: item,
        });
        continue;
      }
      const fromMe = typeof item.fromMe === "boolean" ? item.fromMe : true;
      const appStatus = appMessageStatus(statusName, fromMe);
      const patch: Record<string, unknown> = { status: appStatus };
      if (appStatus === "failed") {
        patch.error = "Evolution retornou ERROR para esta mensagem. O WhatsApp não confirmou a entrega.";
      }
      if (statusName === "READ" || statusName === "PLAYED") {
        patch.read_at = new Date().toISOString();
      }
      // Nunca sobrescreve o status de uma mensagem inbound com "failed":
      // ack -1 vindo em update para mensagens recebidas é ruído da Evolution.
      let { data: upd, error: updErr } = await supabase
        .from("whatsapp_messages")
        .update(patch)
        .eq("evolution_id", evoId)
        .neq("direction", "in")
        .select("id")
        .maybeSingle();

      if (!upd && !updErr) {
        const jidPhone = phoneFromJid(
          key?.remoteJid,
          key?.remoteJidAlt,
          (rec.remoteJid as string | undefined),
          (rec.remoteJidAlt as string | undefined),
          (rec.senderPn as string | undefined),
        );
        if (jidPhone) {
          const { data: conv } = await supabase
            .from("whatsapp_conversations")
            .select("id")
            .eq("phone", jidPhone)
            .maybeSingle();
          if (conv?.id) {
            const { data: latest } = await supabase
              .from("whatsapp_messages")
              .select("id")
              .eq("conversation_id", conv.id)
              .eq("direction", "out")
              .in("status", ["pending", "sending", "sent"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latest?.id) {
              const { data: fallbackUpd, error: fallbackErr } = await supabase
                .from("whatsapp_messages")
                .update({ ...patch, evolution_id: evoId })
                .eq("id", latest.id)
                .select("id")
                .maybeSingle();
              upd = fallbackUpd;
              updErr = fallbackErr;
            }
          }
        }
      }
      if (updErr) {
        result.errors += 1;
        await logRow({
          status: "error",
          error: `status update: ${updErr.message ?? updErr}`,
          evolution_id: evoId,
          payload: item,
        });
        continue;
      }
      if (!upd) {
        result.skipped += 1;
        await logRow({
          status: "skipped",
          error: "mensagem alvo do status não encontrada",
          evolution_id: evoId,
          preview: statusName,
        });
        continue;
      }
      result.updated = (result.updated ?? 0) + 1;
      // Auto-retry BR 9-digit variant on delivery failure.
      // Muitas linhas antigas de WhatsApp guardam o JID sem o "9" extra,
      // então quando Evolution devolve ack=-1 tentamos o outro formato uma vez.
      if (appStatus === "failed") {
        try {
          await retryAlt9DigitOnFailure(supabase, upd.id);
        } catch (retryErr) {
          console.error("[wa-ingest] auto-retry error", retryErr);
        }
      }
      await logRow({
        status: "ok",
        evolution_id: evoId,
        preview: `status=${statusName}→${appStatus}`,
      });

    }
    return result;
  }

  if (!isMessageEvent) {
    await logRow({ status: "noise", error: `evento de plataforma: ${event}`, payload });
    return result;
  }

  if (items.length === 0) {
    await logRow({ status: "noise", error: "payload sem itens de mensagem", payload });
    return result;
  }


  for (const item of items) {
    result.processed += 1;
    const key = item.key;
    const conversationJid = pickConversationJid(key, item);
    if (
      conversationJid?.includes("@g.us") ||
      conversationJid?.includes("status@broadcast") ||
      key?.remoteJid?.includes("@g.us") ||
      key?.remoteJid?.includes("status@broadcast")
    ) {
      result.skipped += 1;
      await logRow({
        status: "skipped",
        error: "mensagem de grupo ou status broadcast",
        evolution_id: key?.id ?? item.id ?? null,
        payload: item,
      });
      continue;
    }

    const phone = phoneFromJid(
      conversationJid,
      key?.remoteJid,
      key?.remoteJidAlt,
      key?.senderPn,
      key?.previousRemoteJid,
      key?.participant,
      payload.sender as string | undefined,
    );
    if (!phone) {
      result.skipped += 1;
      await logRow({
        status: "skipped",
        error: `no phone from jid (${conversationJid ?? key?.remoteJid ?? "n/a"})`,
        evolution_id: key?.id ?? item.id ?? null,
        payload: item,
      });
      continue;
    }

    const { text, type, media } = extractText(item.message);
    if (!text && !media) {
      result.skipped += 1;
      await logRow({
        status: "skipped",
        error: `empty message (type=${type})`,
        phone,
        evolution_id: key?.id ?? item.id ?? null,
        from_me: !!key?.fromMe,
        message_type: type,
        payload: item,
      });
      continue;
    }

    const evoId = key?.id ?? item.id ?? null;
    const fromMe = !!key?.fromMe;
    const direction: "in" | "out" = fromMe ? "out" : "in";
    const nowIso = timestampIso(item, payload.date_time);

    // Dedup #1: evolution_id match (fast path). The table has a UNIQUE index
    // on evolution_id, but we still check first to skip cleanly without a
    // wasted conversation lookup/insert.
    if (evoId) {
      const { data: dup } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("evolution_id", evoId)
        .maybeSingle();
      if (dup) {
        result.skipped += 1;
        await logRow({
          status: "skipped",
          error: "duplicata (mensagem já recebida)",
          phone,
          evolution_id: evoId,
          from_me: fromMe,
          message_type: type,
          preview: text,
        });
        continue;
      }
    }

    const { data: existing, error: existingErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, unread_count, contact_name, last_message_at")
      .eq("phone", phone)
      .maybeSingle();

    if (existingErr) {
      result.errors += 1;
      await logRow({
        status: "error",
        error: `conversation lookup: ${existingErr.message ?? existingErr}`,
        phone,
        evolution_id: evoId,
        from_me: fromMe,
        message_type: type,
        preview: text,
        payload: item,
      });
      continue;
    }

    let convId: string;
    if (existing) {
      convId = existing.id as string;
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
        await logRow({
          status: "error",
          error: `conversation insert: ${insErr?.message ?? "unknown"}`,
          phone,
          evolution_id: evoId,
          from_me: fromMe,
          message_type: type,
          preview: text,
          payload: item,
        });
        continue;
      }
      convId = inserted.id as string;
    }

    // Dedup #2: content + time window fallback for events without evolution_id
    // (Evolution may resend the same message via status updates without keys).
    if (!evoId && text) {
      const winStart = new Date(new Date(nowIso).getTime() - 10_000).toISOString();
      const winEnd = new Date(new Date(nowIso).getTime() + 10_000).toISOString();
      const { data: contentDup } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", convId)
        .eq("direction", direction)
        .eq("content", text)
        .gte("created_at", winStart)
        .lte("created_at", winEnd)
        .limit(1)
        .maybeSingle();
      if (contentDup) {
        result.skipped += 1;
        await logRow({
          status: "skipped",
          error: "duplicata por conteúdo (janela 10s)",
          phone,
          evolution_id: null,
          from_me: fromMe,
          message_type: type,
          preview: text,
        });
        continue;
      }
    }

    const { error: msgErr } = await supabase.from("whatsapp_messages").insert({
      conversation_id: convId,
      evolution_id: evoId,
      direction,
      type,
      content: text,
      media_url: media,
      sent_by: fromMe ? "human" : "customer",
      status: appMessageStatus(item.status ?? item.ack, fromMe),
      created_at: nowIso,
      raw: item,
    });

    if (msgErr) {
      // Postgres unique_violation on evolution_id → race with a concurrent
      // webhook delivery. Treat as duplicate, not error.
      const code = (msgErr as { code?: string }).code;
      const msg = (msgErr as { message?: string }).message ?? String(msgErr);
      const isDup = code === "23505" || /duplicate key|unique/i.test(msg);
      if (isDup) {
        result.skipped += 1;
        await logRow({
          status: "skipped",
          error: "duplicata detectada ao gravar",
          phone,
          evolution_id: evoId,
          from_me: fromMe,
          message_type: type,
          preview: text,
        });
        continue;
      }
      result.errors += 1;
      await logRow({
        status: "error",
        error: `message insert: ${msg}`,
        phone,
        evolution_id: evoId,
        from_me: fromMe,
        message_type: type,
        preview: text,
        payload: item,
      });
      continue;
    }

    // Only update the conversation's last_message_* AFTER the message is
    // committed, so a dedup skip doesn't inflate unread counts.
    {
      const previousTime = existing?.last_message_at
        ? new Date(existing.last_message_at as string).getTime()
        : 0;
      const incomingTime = new Date(nowIso).getTime();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (existing && !existing.contact_name && item.pushName && !fromMe) {
        patch.contact_name = item.pushName;
      }
      if (incomingTime >= previousTime) {
        patch.last_message_at = nowIso;
        patch.last_message_preview = (text ?? "").slice(0, 140) || `[${type}]`;
        if (direction === "in") {
          const prevUnread = (existing?.unread_count as number | null) ?? 0;
          patch.unread_count = prevUnread + 1;
        }
      }
      await supabase.from("whatsapp_conversations").update(patch).eq("id", convId);
    }

    result.inserted += 1;
    await logRow({
      status: "ok",
      phone,
      evolution_id: evoId,
      from_me: fromMe,
      message_type: type,
      preview: text,
    });

    // 🤖 AI auto-reply (inbound text only). Fire and await so Evolution
    // sees a completed webhook; latency stays under a few seconds.
    if (!fromMe && type === "text" && text && text.trim()) {
      try {
        const { maybeReplyWithAI } = await import("./whatsapp-ai.server");
        await maybeReplyWithAI({
          db: supabase,
          conversationId: convId,
          phone,
          incomingText: text,
          contactName: (existing?.contact_name as string | null | undefined) ?? item.pushName ?? null,
          isFirstMessage: !existing,
        });
      } catch (e) {
        console.error("[wa-ai] reply failed", e);
      }
    }
  }

  return result;
}

/**
 * Quando o WhatsApp devolve ack=-1 (ERROR) para uma mensagem outbound, tenta
 * reenviar UMA vez usando a variante alternativa de 9 dígitos (BR).
 * Muitos contatos migrados guardam o número sem o "9" extra e o sendText só
 * funciona no formato correto — que a Evolution não descobre sozinha.
 */
async function retryAlt9DigitOnFailure(supabase: DbClient, messageId: string) {
  const { data: msg } = await supabase
    .from("whatsapp_messages")
    .select("id, content, type, conversation_id, raw, direction")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || msg.direction !== "out" || msg.type !== "text" || !msg.content) return;
  const rawObj: Record<string, unknown> =
    msg.raw && typeof msg.raw === "object" ? (msg.raw as Record<string, unknown>) : {};
  if (rawObj.retriedAlt9 === true || rawObj.retryOf) return;

  const { evolutionConfig, normalizeWhatsappPhone, extractEvolutionMessageId } = await import(
    "./whatsapp-evolution.server"
  );
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("phone")
    .eq("id", msg.conversation_id)
    .maybeSingle();
  const phone = conv?.phone ? normalizeWhatsappPhone(String(conv.phone)) : "";
  let alt: string | null = null;
  if (/^55\d{2}9\d{8}$/.test(phone)) alt = phone.slice(0, 4) + phone.slice(5);
  else if (/^55\d{2}\d{8}$/.test(phone)) alt = phone.slice(0, 4) + "9" + phone.slice(4);
  if (!alt) return;

  const cfg = evolutionConfig();
  if (!cfg.base || !cfg.key || !cfg.instance) return;
  const sendUrl = `${cfg.base}/message/sendText/${encodeURIComponent(cfg.instance)}`;
  const resp = await fetch(sendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.key },
    body: JSON.stringify({ number: alt, text: msg.content, delay: 0, linkPreview: false }),
  });
  const bodyText = await resp.text();
  let newEvoId: string | null = null;
  try {
    newEvoId = extractEvolutionMessageId(JSON.parse(bodyText));
  } catch {
    /* ignore */
  }

  if (resp.ok && newEvoId) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: msg.conversation_id,
      direction: "out",
      type: "text",
      content: msg.content,
      evolution_id: newEvoId,
      status: "sent",
      raw: { retryOf: msg.id, sentTo: alt, originalPhone: phone },
    });
    await supabase
      .from("whatsapp_messages")
      .update({
        raw: { ...rawObj, retriedAlt9: true, retryTarget: alt },
        error: `WhatsApp rejeitou a entrega em ${phone}. Reenviado automaticamente para ${alt}.`,
      })
      .eq("id", msg.id);
  } else {
    await supabase
      .from("whatsapp_messages")
      .update({
        raw: { ...rawObj, retriedAlt9: true, retryTarget: alt, retryError: bodyText.slice(0, 400) },
        error: `WhatsApp rejeitou entrega em ${phone}. Tentativa em ${alt} também falhou (HTTP ${resp.status}). O número pode não ter WhatsApp.`,
      })
      .eq("id", msg.id);
  }
}
