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
    const { connectionState, connectInstance, createInstance } = await import(
      "@/lib/evolution.server"
    );
    try {
      const stateResp = await connectionState();
      const s = stateResp?.instance?.state ?? stateResp?.state;
      if (s === "open") {
        return { ok: true, state: stateResp };
      }
      // Not connected — fetch QR from /instance/connect
      try {
        const qr = await connectInstance();
        return { ok: true, state: { ...stateResp, ...qr } };
      } catch (err) {
        return {
          ok: false,
          recoverable: true,
          state: stateResp,
          message:
            err instanceof Error
              ? err.message
              : "Não consegui gerar o QR code agora.",
        };
      }
    } catch (err) {
      // Instance likely doesn't exist — create it, then fetch QR
      try {
        await createInstance();
      } catch {
        /* may already exist */
      }
      try {
        const qr = await connectInstance();
        return { ok: true, state: qr, created: true };
      } catch (connectErr) {
        return {
          ok: false,
          recoverable: true,
          state: null,
          message:
            connectErr instanceof Error
              ? connectErr.message
              : err instanceof Error
              ? err.message
              : "A Evolution não respondeu agora.",
        };
      }
    }
  });

export const getEvolutionConnectionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { connectionState } = await import("@/lib/evolution.server");
    try {
      const state = await connectionState();
      return { ok: true, state };
    } catch (err) {
      return {
        ok: false,
        recoverable: true,
        state: null,
        message: err instanceof Error ? err.message : "A Evolution não respondeu agora.",
      };
    }
  });

export const resetEvolutionInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { connectInstance, createInstance, deleteInstance, logoutInstance } = await import(
      "@/lib/evolution.server"
    );
    try {
      await logoutInstance();
    } catch {
      /* already disconnected */
    }
    try {
      await deleteInstance();
    } catch {
      /* may not exist */
    }
    try {
      await createInstance();
    } catch {
      /* if delete is unavailable, reuse the existing logged-out instance */
    }
    try {
      const qr = await connectInstance();
      return { ok: true, state: qr, reset: true };
    } catch (err) {
      return {
        ok: false,
        recoverable: true,
        state: null,
        reset: false,
        message: err instanceof Error ? err.message : "Não consegui recriar a conexão agora.",
      };
    }
  });

