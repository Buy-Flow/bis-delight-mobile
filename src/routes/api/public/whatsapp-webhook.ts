import { createFileRoute } from "@tanstack/react-router";

// Evolution API webhook receiver.
// URL: https://<host>/api/public/whatsapp-webhook?token=<EVOLUTION_WEBHOOK_TOKEN>
// Handles messages.upsert (both inbound and outbound/fromMe), connection.update, contacts.update.

type EvoKey = { remoteJid?: string; fromMe?: boolean; id?: string };
type EvoMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; url?: string };
  videoMessage?: { caption?: string; url?: string };
  audioMessage?: { url?: string };
  documentMessage?: { fileName?: string; url?: string };
  stickerMessage?: { url?: string };
};
type EvoData = {
  key?: EvoKey;
  pushName?: string;
  message?: EvoMessage;
  messageType?: string;
  messageTimestamp?: number;
  status?: string;
};

function phoneFromJid(jid?: string): string | null {
  if (!jid) return null;
  const digits = jid.split("@")[0]?.replace(/\D/g, "") ?? "";
  return digits || null;
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
  return { text: null, type: "unknown", media: null };
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
        const ok = !!expected && token === expected;
        return Response.json({ ok, service: "whatsapp-webhook" });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Evolution can send: { event, instance, data } OR { event, data } OR direct event objects.
        const rawEvent = (payload.event as string | undefined) ?? "";
        const event = rawEvent.toLowerCase().replace(/_/g, ".");
        const data = (payload.data as EvoData | EvoData[] | undefined) ?? undefined;
        const items: EvoData[] = Array.isArray(data) ? data : data ? [data] : [];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          if (event === "messages.upsert" || event === "send.message" || event === "messages.update") {
            for (const item of items) {
              const key = item.key;
              const phone = phoneFromJid(key?.remoteJid);
              if (!phone) continue;
              // Skip group chats (contain '-' before @g.us)
              if (key?.remoteJid?.includes("@g.us")) continue;

              const fromMe = !!key?.fromMe;
              const direction: "in" | "out" = fromMe ? "out" : "in";
              const { text, type, media } = extractText(item.message);
              const evoId = key?.id ?? null;

              // Skip if empty and no media
              if (!text && !media) continue;

              // Upsert conversation by phone
              const nowIso = new Date().toISOString();
              const { data: existing } = await supabaseAdmin
                .from("whatsapp_conversations")
                .select("id, unread_count, contact_name")
                .eq("phone", phone)
                .maybeSingle();

              let convId: string;
              if (existing) {
                convId = existing.id as string;
                const patch: {
                  last_message_at: string;
                  last_message_preview: string;
                  updated_at: string;
                  contact_name?: string;
                  unread_count?: number;
                } = {
                  last_message_at: nowIso,
                  last_message_preview: (text ?? "").slice(0, 140) || `[${type}]`,
                  updated_at: nowIso,
                };
                if (!existing.contact_name && item.pushName) patch.contact_name = item.pushName;
                if (direction === "inbound") patch.unread_count = ((existing.unread_count as number | null) ?? 0) + 1;
                await supabaseAdmin.from("whatsapp_conversations").update(patch).eq("id", convId);
              } else {
                const { data: inserted, error: insErr } = await supabaseAdmin
                  .from("whatsapp_conversations")
                  .insert({
                    phone,
                    contact_name: item.pushName ?? null,
                    last_message_at: nowIso,
                    last_message_preview: (text ?? "").slice(0, 140) || `[${type}]`,
                    unread_count: direction === "inbound" ? 1 : 0,
                  })
                  .select("id")
                  .single();
                if (insErr || !inserted) {
                  console.error("[wa-webhook] insert conv failed", insErr);
                  continue;
                }
                convId = inserted.id as string;
              }

              // Dedupe by evolution_id when available
              if (evoId) {
                const { data: dup } = await supabaseAdmin
                  .from("whatsapp_messages")
                  .select("id")
                  .eq("evolution_id", evoId)
                  .maybeSingle();
                if (dup) continue;
              }

              await supabaseAdmin.from("whatsapp_messages").insert({
                conversation_id: convId,
                evolution_id: evoId,
                direction,
                type,
                content: text,
                media_url: media,
                sent_by: fromMe ? "external" : "customer",
                status: item.status ?? "received",
                raw: item as unknown as import("@/integrations/supabase/types").Json,
              });
            }
          }
          // Other events (connection.update, contacts.update, etc.) can be added here.
        } catch (e) {
          console.error("[wa-webhook] processing error", e);
          return new Response("Server error", { status: 500 });
        }

        return Response.json({ ok: true });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
