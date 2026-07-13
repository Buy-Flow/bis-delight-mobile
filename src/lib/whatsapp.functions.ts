import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

function evoConfig() {
  const base = (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY ?? "";
  const instance = process.env.EVOLUTION_INSTANCE ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";
  return { base, key, instance };
}

/**
 * Envia mensagem de texto pelo Evolution API e persiste em whatsapp_messages.
 * Também atualiza last_message_* na conversa.
 */
export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { conversation_id: string; text: string }) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        text: z.string().trim().min(1).max(4000),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // fetch conversation
    const { data: conv, error: convErr } = await context.supabase
      .from("whatsapp_conversations")
      .select("id,phone,contact_name")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (convErr) throw new Error(convErr.message);
    if (!conv) throw new Error("Conversa não encontrada");

    const { base, key, instance } = evoConfig();
    let evoId: string | null = null;
    let evoError: string | null = null;
    let status = "sent";

    if (!base || !key || !instance) {
      evoError =
        "Evolution API não configurada (defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE). Mensagem salva localmente.";
      status = "pending";
    } else {
      try {
        const resp = await fetch(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
          },
          body: JSON.stringify({
            number: conv.phone,
            text: data.text,
            options: { delay: 0, presence: "composing" },
          }),
        });
        const body = await resp.text();
        if (!resp.ok) {
          evoError = `Evolution ${resp.status}: ${body.slice(0, 200)}`;
          status = "failed";
        } else {
          try {
            const j = JSON.parse(body);
            evoId =
              j?.key?.id ??
              j?.messageId ??
              j?.id ??
              j?.data?.key?.id ??
              null;
          } catch {
            evoId = null;
          }
        }
      } catch (e) {
        evoError = e instanceof Error ? e.message : String(e);
        status = "failed";
      }
    }

    // persist message
    const { data: msg, error: msgErr } = await context.supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conv.id,
        evolution_id: evoId,
        direction: "outbound",
        type: "text",
        content: data.text,
        sent_by: "operator",
        operator_id: context.userId,
        status,
        error: evoError,
      })
      .select("*")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    await context.supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: data.text.slice(0, 140),
        unread_count: 0,
      })
      .eq("id", conv.id);

    return { message: msg, warning: evoError };
  });

export const setAiPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; paused: boolean }) =>
    z.object({ id: z.string().uuid(), paused: z.boolean() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ ai_paused: data.paused })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; user_id: string | null }) =>
    z.object({ id: z.string().uuid(), user_id: z.string().uuid().nullable() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ assigned_to: data.user_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const now = new Date().toISOString();
    await context.supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.id);
    await context.supabase
      .from("whatsapp_messages")
      .update({ read_at: now })
      .eq("conversation_id", data.id)
      .eq("direction", "inbound")
      .is("read_at", null);
    return { ok: true };
  });

export const getWhatsappConfigStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { base, key, instance } = evoConfig();
    return {
      configured: !!(base && key && instance),
      hasBase: !!base,
      hasKey: !!key,
      hasInstance: !!instance,
    };
  });
