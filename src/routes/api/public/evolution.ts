import { createFileRoute } from "@tanstack/react-router";

// Public webhook endpoint that Evolution API posts to on WhatsApp events.
// This lives under /api/public/* so Lovable's edge auth bypasses it, but we
// verify the Evolution `apikey` header ourselves before processing.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization",
};

export const Route = createFileRoute("/api/public/evolution")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const expectedKey = process.env.EVOLUTION_API_KEY;
        const providedKey = request.headers.get("apikey") ?? request.headers.get("authorization");
        if (!expectedKey || !providedKey || !providedKey.includes(expectedKey)) {
          return new Response("Unauthorized", { status: 401, headers: CORS });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { fromJid } = await import("@/lib/evolution.server");

        const event = payload?.event as string | undefined;

        try {
          if (event === "messages.upsert") {
            const data = payload.data;
            const key = data?.key;
            const msg = data?.message;
            if (!key || !msg) return new Response("ok", { status: 200, headers: CORS });
            // Ignore outbound echoes (messages we sent) — we already stored them.
            if (key.fromMe) return new Response("ok", { status: 200, headers: CORS });
            // Ignore groups for now
            if (key.remoteJid?.endsWith("@g.us")) return new Response("ok", { status: 200, headers: CORS });

            const phone = fromJid(key.remoteJid ?? "");
            if (!phone) return new Response("ok", { status: 200, headers: CORS });

            const pushName: string | undefined = data.pushName;

            // Detect message type + content
            let type: "text" | "image" | "audio" | "video" | "document" | "sticker" = "text";
            let content = "";
            let mediaUrl: string | null = null;

            if (msg.conversation) {
              content = msg.conversation;
            } else if (msg.extendedTextMessage?.text) {
              content = msg.extendedTextMessage.text;
            } else if (msg.imageMessage) {
              type = "image";
              content = msg.imageMessage.caption ?? "";
              mediaUrl = data.message?.imageMessage?.url ?? null;
            } else if (msg.audioMessage) {
              type = "audio";
              mediaUrl = data.message?.audioMessage?.url ?? null;
            } else if (msg.videoMessage) {
              type = "video";
              content = msg.videoMessage.caption ?? "";
            } else if (msg.documentMessage) {
              type = "document";
              content = msg.documentMessage.fileName ?? "";
            } else if (msg.stickerMessage) {
              type = "sticker";
            }

            // Upsert conversation
            const preview = content || (type === "image" ? "📷 Foto" : type === "audio" ? "🎤 Áudio" : type === "video" ? "🎬 Vídeo" : type === "document" ? "📎 Documento" : type === "sticker" ? "Sticker" : "");

            const { data: existing } = await supabaseAdmin
              .from("whatsapp_conversations")
              .select("id, unread_count, contact_name")
              .eq("phone", phone)
              .maybeSingle();

            let conversationId: string;
            if (existing) {
              conversationId = existing.id;
              await supabaseAdmin
                .from("whatsapp_conversations")
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: preview.slice(0, 200),
                  unread_count: (existing.unread_count ?? 0) + 1,
                  contact_name: existing.contact_name || pushName || null,
                })
                .eq("id", conversationId);
            } else {
              // Try to link to an existing user by phone
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id, full_name")
                .ilike("phone", `%${phone.slice(-8)}%`)
                .limit(1)
                .maybeSingle();

              const { data: inserted, error } = await supabaseAdmin
                .from("whatsapp_conversations")
                .insert({
                  phone,
                  user_id: profile?.id ?? null,
                  contact_name: pushName || profile?.full_name || null,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: preview.slice(0, 200),
                  unread_count: 1,
                })
                .select("id")
                .single();
              if (error || !inserted) {
                console.error("conv insert failed", error);
                return new Response("db-error", { status: 500, headers: CORS });
              }
              conversationId = inserted.id;
            }

            // Insert message (dedupe on evolution_id)
            const { error: msgErr } = await supabaseAdmin.from("whatsapp_messages").insert({
              conversation_id: conversationId,
              evolution_id: key.id,
              direction: "in",
              type,
              content,
              media_url: mediaUrl,
              sent_by: "customer",
              raw: data,
            });
            if (msgErr && !msgErr.message?.includes("duplicate")) {
              console.error("msg insert failed", msgErr);
            }

            // TODO Fase 2: dispatch aiRespond() here if ai_paused=false
          }
        } catch (err) {
          console.error("evolution webhook error", err);
        }

        return new Response("ok", { status: 200, headers: CORS });
      },
    },
  },
});
