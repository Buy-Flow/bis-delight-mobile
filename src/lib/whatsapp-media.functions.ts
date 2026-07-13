import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  assertAdminRole,
  evolutionConfig,
  extractEvolutionMessageId,
  fetchEvolutionWithTimeout,
  normalizeWhatsappPhone,
} from "./whatsapp-evolution.server";

const BUCKET = "whatsapp-media";

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const m = mime.toLowerCase();
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m.includes("aac") || m.includes("mp4a")) return "m4a";
  if (m.includes("webm")) return "webm";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp")) return "webp";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("quicktime")) return "mov";
  if (m.includes("pdf")) return "pdf";
  return "bin";
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function uploadToBucket(
  supabase: unknown,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload: ${error.message}`);
  const { data: signed, error: signErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw new Error(`signed url: ${signErr.message}`);
  return signed.signedUrl as string;
}

/**
 * Baixa (via Evolution) o binário decodificado de uma mensagem de mídia
 * recebida, sobe no bucket privado e devolve URL assinada de longa duração.
 * Também atualiza o registro `whatsapp_messages.media_url` para essa URL.
 */
export const resolveWhatsappInboundMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { message_id: string }) =>
    z.object({ message_id: z.string().uuid() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { base, key, instance } = evolutionConfig();
    if (!base || !key || !instance) throw new Error("Evolution não configurada.");

    const { data: row, error } = await context.supabase
      .from("whatsapp_messages")
      .select("id, evolution_id, raw, media_url, type, conversation_id")
      .eq("id", data.message_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Mensagem não encontrada");

    // Se já tem URL usável (http/https e não é a URL crua do WhatsApp CDN
    // criptografado), retorna como está.
    const currentUrl = (row as { media_url?: string | null }).media_url ?? null;
    if (currentUrl && !/mmg\.whatsapp\.net|\.enc($|\?)/i.test(currentUrl) && currentUrl.startsWith("http")) {
      return { url: currentUrl, cached: true };
    }

    const raw = (row as { raw?: Record<string, unknown> | null }).raw ?? null;
    if (!raw || typeof raw !== "object") throw new Error("Payload original ausente. Não é possível baixar a mídia.");

    const evoPath = `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`;
    const bodies = [
      { message: raw, convertToMp4: false },
      { key: (raw as Record<string, unknown>).key, message: (raw as Record<string, unknown>).message, convertToMp4: false },
    ];

    let lastErr = "";
    for (const body of bodies) {
      try {
        const resp = await fetchEvolutionWithTimeout(`${base}${evoPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: key },
          body: JSON.stringify(body),
        });
        const txt = await resp.text();
        if (!resp.ok) {
          lastErr = `${resp.status}: ${txt.slice(0, 200)}`;
          continue;
        }
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(txt) as Record<string, unknown>;
        } catch {
          lastErr = "resposta não-JSON";
          continue;
        }
        const b64 = (json.base64 as string | undefined) ?? (json.data as string | undefined);
        const mimetype =
          (json.mimetype as string | undefined) ??
          (json.mimeType as string | undefined) ??
          (json.type as string | undefined) ??
          "application/octet-stream";
        if (!b64) {
          lastErr = "resposta sem base64";
          continue;
        }
        const bytes = b64ToBytes(b64);
        const ext = extFromMime(mimetype);
        const path = `inbound/${row.conversation_id}/${row.id}.${ext}`;
        const url = await uploadToBucket(context.supabase, path, bytes, mimetype);
        await context.supabase
          .from("whatsapp_messages")
          .update({ media_url: url })
          .eq("id", row.id);
        return { url, cached: false, mimetype };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(`Não foi possível baixar a mídia da Evolution: ${lastErr}`);
  });

/**
 * Envia uma mídia (imagem, vídeo, áudio ou documento) via Evolution.
 * O cliente envia o arquivo como base64 data URL.
 */
export const sendWhatsappMediaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: {
    conversation_id: string;
    kind: "image" | "video" | "audio" | "document";
    base64: string;
    mimetype: string;
    filename?: string;
    caption?: string;
  }) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        kind: z.enum(["image", "video", "audio", "document"]),
        base64: z.string().min(20),
        mimetype: z.string().min(3).max(120),
        filename: z.string().max(200).optional(),
        caption: z.string().max(1024).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { base, key, instance } = evolutionConfig();
    if (!base || !key || !instance) throw new Error("Evolution não configurada.");

    const { data: conv, error: convErr } = await context.supabase
      .from("whatsapp_conversations")
      .select("id, phone")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (convErr) throw new Error(convErr.message);
    if (!conv) throw new Error("Conversa não encontrada");

    const number = normalizeWhatsappPhone(conv.phone);
    if (!number || number.length < 10) throw new Error("Telefone da conversa é inválido.");

    // 1) Persiste o arquivo no bucket para exibir imediatamente no painel.
    const bytes = b64ToBytes(data.base64);
    const ext = extFromMime(data.mimetype);
    const objectPath = `outbound/${conv.id}/${crypto.randomUUID()}.${ext}`;
    const localUrl = await uploadToBucket(context.supabase, objectPath, bytes, data.mimetype);

    // 2) Chama Evolution. Áudio de voz usa endpoint dedicado; demais usam sendMedia.
    const cleanB64 = data.base64.includes(",") ? data.base64.split(",")[1] : data.base64;
    let evoUrl = `${base}/message/sendMedia/${encodeURIComponent(instance)}`;
    let payload: Record<string, unknown>;

    if (data.kind === "audio") {
      evoUrl = `${base}/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`;
      payload = {
        number,
        audio: cleanB64,
        delay: 0,
      };
    } else {
      payload = {
        number,
        mediatype: data.kind, // image | video | document
        mimetype: data.mimetype,
        media: cleanB64,
        fileName: data.filename ?? `arquivo.${ext}`,
        caption: data.caption ?? "",
        delay: 0,
      };
    }

    let evoId: string | null = null;
    let status: string = "sent";
    let evoError: string | null = null;
    let rawPayload: Json | null = null;

    try {
      const resp = await fetchEvolutionWithTimeout(evoUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify(payload),
      });
      const txt = await resp.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(txt) as Record<string, unknown>;
      } catch {
        /* raw */
      }
      rawPayload = { endpoint: evoUrl, status: resp.status, response: parsed ?? txt.slice(0, 1500) } as Json;
      if (!resp.ok) {
        status = "failed";
        evoError = `Evolution ${resp.status}: ${txt.slice(0, 400)}`;
      } else {
        evoId = extractEvolutionMessageId(parsed ?? {}) ?? null;
      }
    } catch (e) {
      status = "failed";
      evoError = e instanceof Error ? e.message : String(e);
    }

    const contentPreview =
      data.caption?.trim() ||
      (data.kind === "audio"
        ? "[áudio]"
        : data.kind === "image"
          ? "[imagem]"
          : data.kind === "video"
            ? "[vídeo]"
            : `[documento] ${data.filename ?? ""}`.trim());

    const { data: msg, error: msgErr } = await context.supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conv.id,
        evolution_id: evoId,
        direction: "out",
        type: data.kind,
        content: data.caption?.trim() || null,
        media_url: localUrl,
        sent_by: "human",
        operator_id: context.userId,
        status,
        error: evoError,
        raw: rawPayload,
      })
      .select("*")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    await context.supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: contentPreview.slice(0, 140),
        unread_count: 0,
      })
      .eq("id", conv.id);

    return { message: msg, warning: evoError };
  });
