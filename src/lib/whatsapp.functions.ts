import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SendInput = z.object({
  conversationId: z.string().uuid(),
  text: z.string().min(1).max(4000),
});

export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendText } = await import("@/lib/evolution.server");

    const { data: conv, error: convErr } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, phone")
      .eq("id", data.conversationId)
      .single();
    if (convErr || !conv) throw new Error("Conversation not found");

    let evoResp: any = null;
    let errorMsg: string | null = null;
    try {
      evoResp = await sendText(conv.phone, data.text);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    const { error: insertErr } = await supabaseAdmin.from("whatsapp_messages").insert({
      conversation_id: conv.id,
      evolution_id: evoResp?.key?.id ?? null,
      direction: "out",
      type: "text",
      content: data.text,
      sent_by: "human",
      operator_id: context.userId,
      status: errorMsg ? "failed" : "sent",
      error: errorMsg,
      raw: evoResp,
    });
    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: data.text.slice(0, 200),
      })
      .eq("id", conv.id);

    if (errorMsg) throw new Error(errorMsg);
    return { ok: true };
  });

const ToggleAiInput = z.object({
  conversationId: z.string().uuid(),
  paused: z.boolean(),
});

export const toggleConversationAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ToggleAiInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        ai_paused: data.paused,
        assigned_to: data.paused ? context.userId : null,
      })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

const MarkReadInput = z.object({
  conversationId: z.string().uuid(),
});

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MarkReadInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

// Get connection state + QR (Fase 1: pairing helper for admin)
export const getEvolutionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { connectionState, connectInstance, createInstance, setWebhook } = await import(
      "@/lib/evolution.server"
    );
    try {
      const stateResp = await connectionState();
      const s = stateResp?.instance?.state ?? stateResp?.state;
      if (s === "open") {
        return { ok: true, state: stateResp };
      }
      // Not connected — fetch QR from /instance/connect
      const qr = await connectInstance();
      return { ok: true, state: { ...stateResp, ...qr } };
    } catch {
      // Instance likely doesn't exist — create it, then fetch QR
      try {
        await createInstance();
      } catch {
        /* may already exist */
      }
      const qr = await connectInstance();
      return { ok: true, state: qr, created: true };
    }
  });

const ConfigureWebhookInput = z.object({
  webhookUrl: z.string().url(),
});

export const configureEvolutionWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConfigureWebhookInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { setWebhook } = await import("@/lib/evolution.server");
    const res = await setWebhook(data.webhookUrl);
    return { ok: true, res };
  });
