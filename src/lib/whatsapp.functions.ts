import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  assertAdminRole,
  connectEvolutionInstance,
  evolutionConfig,
  evolutionErrorMessage,
  evolutionFetch,
  evolutionRequest,
  getEvolutionConnectionSnapshot,
  getEvolutionWebhook,
  normalizeWhatsappPhone,
  publicWhatsappHostFromRequest,
  sendEvolutionText,
  setEvolutionWebhook,
} from "./whatsapp-evolution.server";

export const getWhatsappConfigStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { base, key, instance } = evolutionConfig();
    const hasToken = !!process.env.EVOLUTION_WEBHOOK_TOKEN;
    return {
      configured: !!(base && key && instance),
      fullyConfigured: !!(base && key && instance && hasToken),
      hasBase: !!base,
      hasKey: !!key,
      hasInstance: !!instance,
      hasToken,
      instance,
    };
  });

export const getWhatsappConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    return getEvolutionConnectionSnapshot();
  });

export const getWhatsappQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    return connectEvolutionInstance();
  });

export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { instance } = evolutionConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
    await evolutionFetch(`/instance/logout/${encodeURIComponent(instance)}`, { method: "DELETE" });
    return { ok: true };
  });

export const getWhatsappWebhookInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN ?? "";
    const host = await publicWhatsappHostFromRequest();
    const url = host && token ? `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}` : "";
    let currentUrl: string | null = null;
    let configured = false;
    let enabled = false;
    let error: string | null = null;
    try {
      if (url) {
        const current = await getEvolutionWebhook();
        currentUrl = current.url;
        enabled = current.enabled;
        configured = !!currentUrl && currentUrl === url && enabled;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    return { url, currentUrl, configured, enabled, hasToken: !!token, error };
  });

export const configureWhatsappWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (!token) throw new Error("EVOLUTION_WEBHOOK_TOKEN não configurado.");
    const host = await publicWhatsappHostFromRequest();
    const url = `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}`;
    await setEvolutionWebhook({ url });
    return { ok: true, url };
  });

export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const started = Date.now();
    const { base, key, instance } = evolutionConfig();
    const checks: Array<{ name: string; ok: boolean; detail: string; ms?: number }> = [];

    checks.push({
      name: "Secrets",
      ok: !!(base && key && instance),
      detail: base && key && instance ? "URL, API key e instância encontradas" : "Falta URL, API key ou instância",
    });

    if (base && key && instance) {
      const t0 = Date.now();
      try {
        const state = await getEvolutionConnectionSnapshot();
        checks.push({
          name: "Instância",
          ok: state.exists && state.state === "open",
          detail: state.exists ? `Estado: ${state.state}` : "Instância não existe",
          ms: Date.now() - t0,
        });
      } catch (e) {
        checks.push({ name: "Instância", ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
      }

      const t1 = Date.now();
      try {
        const hook = await getEvolutionWebhook();
        checks.push({
          name: "Webhook Evolution",
          ok: !!hook.url && hook.enabled,
          detail: hook.url ? `URL atual: ${hook.url}` : "Webhook sem URL",
          ms: Date.now() - t1,
        });
      } catch (e) {
        checks.push({ name: "Webhook Evolution", ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t1 });
      }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await context.supabase
      .from("whatsapp_ingest_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    checks.push({ name: "Eventos recebidos", ok: (count ?? 0) > 0, detail: `${count ?? 0} evento(s) nas últimas 24h` });

    return { ok: checks.every((c) => c.ok), elapsedMs: Date.now() - started, checks };
  });

export const createWhatsappConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { phone: string; name?: string }) =>
    z.object({ phone: z.string().trim().min(8).max(32), name: z.string().trim().max(120).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const phone = normalizeWhatsappPhone(data.phone);
    if (phone.length < 10 || phone.length > 15) throw new Error("Telefone inválido. Use DDD + número, com ou sem +55.");

    const { data: existing, error: existingErr } = await context.supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) return { conversation: existing, created: false };

    const { data: conversation, error } = await context.supabase
      .from("whatsapp_conversations")
      .insert({
        phone,
        contact_name: data.name?.trim() || null,
        last_message_at: new Date().toISOString(),
        last_message_preview: "Nova conversa",
        unread_count: 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { conversation, created: true };
  });

export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { conversation_id: string; text: string }) =>
    z.object({ conversation_id: z.string().uuid(), text: z.string().trim().min(1).max(4000) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { data: conv, error: convErr } = await context.supabase
      .from("whatsapp_conversations")
      .select("id,phone,contact_name")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (convErr) throw new Error(convErr.message);
    if (!conv) throw new Error("Conversa não encontrada.");

    const { base, key, instance } = evolutionConfig();
    let evolutionId: string | null = null;
    let status = "failed";
    let error: string | null = null;
    let raw: Json | null = null;

    if (!base || !key || !instance) {
      error = "Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.";
    } else {
      try {
        const connection = await getEvolutionConnectionSnapshot();
        if (connection.state !== "open") {
          error = `WhatsApp não está conectado. Estado atual: ${connection.state}.`;
        } else {
          const sent = await sendEvolutionText(conv.phone, data.text);
          evolutionId = sent.evolutionId;
          status = sent.appStatus;
          error = sent.error;
          raw = sent.raw as Json;
          if (sent.selectedNumber && sent.selectedNumber !== conv.phone) {
            await context.supabase.from("whatsapp_conversations").update({ phone: sent.selectedNumber }).eq("id", conv.id);
          }
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }

    const { data: msg, error: msgErr } = await context.supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conv.id,
        evolution_id: evolutionId,
        direction: "out",
        type: "text",
        content: data.text,
        sent_by: "human",
        operator_id: context.userId,
        status,
        error,
        raw,
      })
      .select("*")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    await context.supabase
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: data.text.slice(0, 140), unread_count: 0 })
      .eq("id", conv.id);

    return { message: msg, warning: error };
  });

export const setAiPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; paused: boolean }) => z.object({ id: z.string().uuid(), paused: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { error } = await context.supabase.from("whatsapp_conversations").update({ ai_paused: data.paused }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateWhatsappConversationPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; phone: string }) => z.object({ id: z.string().uuid(), phone: z.string().trim().min(8).max(32) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const phone = normalizeWhatsappPhone(data.phone);
    if (phone.length < 10 || phone.length > 15) throw new Error("Telefone inválido. Use DDD + número, com ou sem +55.");

    const { data: current, error: currentErr } = await context.supabase.from("whatsapp_conversations").select("id, phone").eq("id", data.id).maybeSingle();
    if (currentErr) throw new Error(currentErr.message);
    if (!current) throw new Error("Conversa não encontrada.");
    if (current.phone === phone) return { id: current.id, phone, merged: false as const };

    const { data: existing, error: existingErr } = await context.supabase.from("whatsapp_conversations").select("id").eq("phone", phone).neq("id", data.id).maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: moveErr } = await supabaseAdmin.from("whatsapp_messages").update({ conversation_id: existing.id }).eq("conversation_id", data.id);
      if (moveErr) throw new Error(`Falha ao mesclar mensagens: ${moveErr.message}`);
      const { error: delErr } = await supabaseAdmin.from("whatsapp_conversations").delete().eq("id", data.id);
      if (delErr) throw new Error(`Falha ao remover duplicata: ${delErr.message}`);
      await supabaseAdmin.from("whatsapp_conversations").update({ updated_at: new Date().toISOString() }).eq("id", existing.id);
      return { id: existing.id, phone, merged: true as const };
    }

    const { error } = await context.supabase.from("whatsapp_conversations").update({ phone, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id, phone, merged: false as const };
  });

export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; user_id: string | null }) => z.object({ id: z.string().uuid(), user_id: z.string().uuid().nullable() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { error } = await context.supabase.from("whatsapp_conversations").update({ assigned_to: data.user_id }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const now = new Date().toISOString();
    await context.supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", data.id);
    await context.supabase.from("whatsapp_messages").update({ read_at: now }).eq("conversation_id", data.id).eq("direction", "in").is("read_at", null);
    return { ok: true };
  });

export const syncWhatsappRecentMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v?: { limit?: number }) => z.object({ limit: z.number().int().min(10).max(200).default(80) }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { base, key, instance } = evolutionConfig();
    const { syncWhatsappRecentMessagesFromEvolution } = await import("./whatsapp-sync.server");
    return syncWhatsappRecentMessagesFromEvolution({ supabase: context.supabase, base, key, instance, limit: data.limit });
  });

export const runWhatsappDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const started = Date.now();
    const { base, key, instance } = evolutionConfig();
    const hasToken = !!process.env.EVOLUTION_WEBHOOK_TOKEN;
    const config = { hasBase: !!base, hasKey: !!key, hasInstance: !!instance, hasToken, instance, configured: !!(base && key && instance && hasToken) };

    let connection: { state: string; ownerJid: string | null; profileName: string | null; disconnectionAt: string | null; disconnectionCode: number | null; error: string | null } = {
      state: config.hasInstance ? "unknown" : "unconfigured",
      ownerJid: null,
      profileName: null,
      disconnectionAt: null,
      disconnectionCode: null,
      error: null,
    };
    if (base && key && instance) {
      try {
        const snapshot = await getEvolutionConnectionSnapshot();
        connection = { state: snapshot.state, ownerJid: snapshot.ownerJid, profileName: snapshot.profileName, disconnectionAt: snapshot.disconnectionAt, disconnectionCode: snapshot.disconnectionCode, error: null };
      } catch (e) {
        connection.error = e instanceof Error ? e.message : String(e);
      }
    }

    const webhook = { expected: "", current: null as string | null, configured: false, enabled: false, error: null as string | null };
    try {
      const host = await publicWhatsappHostFromRequest();
      const token = process.env.EVOLUTION_WEBHOOK_TOKEN ?? "";
      webhook.expected = host && token ? `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}` : "";
      if (base && key && instance) {
        const current = await getEvolutionWebhook();
        webhook.current = current.url;
        webhook.enabled = current.enabled;
        webhook.configured = !!current.url && current.url === webhook.expected && current.enabled;
      }
    } catch (e) {
      webhook.error = e instanceof Error ? e.message : String(e);
    }

    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: msgs24 } = await context.supabase.from("whatsapp_messages").select("status,error,read_at,created_at").eq("direction", "out").gte("created_at", since24).limit(5000);
    const outbound = Array.isArray(msgs24) ? msgs24 : [];
    let delivered = 0;
    let read = 0;
    let errored = 0;
    let pending = 0;
    for (const m of outbound as Array<{ status: string | null; error: string | null; read_at: string | null }>) {
      const s = (m.status ?? "").toLowerCase();
      if (m.read_at || s === "read") read += 1;
      if (s === "delivered" || s === "read" || m.read_at) delivered += 1;
      if (s === "failed" || s === "error" || m.error) errored += 1;
      if (s === "sent" || s === "pending" || s === "sending") pending += 1;
    }
    const total = outbound.length;

    const { data: failuresRaw } = await context.supabase
      .from("whatsapp_messages")
      .select("id,created_at,error,status,conversation_id,content")
      .eq("direction", "out")
      .or("status.eq.error,status.eq.failed,error.not.is.null")
      .order("created_at", { ascending: false })
      .limit(10);

    const since6 = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: ingestRaw } = await context.supabase.from("whatsapp_ingest_logs").select("status,error,created_at").gte("created_at", since6).limit(5000);
    const ingest = Array.isArray(ingestRaw) ? ingestRaw : [];
    const ingestByStatus: Record<string, number> = {};
    for (const row of ingest as Array<{ status: string | null }>) {
      const k = String(row.status ?? "unknown");
      ingestByStatus[k] = (ingestByStatus[k] ?? 0) + 1;
    }

    const { data: ingestErrors } = await context.supabase.from("whatsapp_ingest_logs").select("created_at,event,status,phone,error").eq("status", "error").order("created_at", { ascending: false }).limit(5);
    const { count: webhookCount24h } = await context.supabase.from("whatsapp_ingest_logs").select("id", { count: "exact", head: true }).eq("source", "webhook").gte("created_at", since24);
    const { data: lastWebhookRow } = await context.supabase.from("whatsapp_ingest_logs").select("created_at,event,status").eq("source", "webhook").order("created_at", { ascending: false }).limit(1).maybeSingle();

    return {
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      config,
      connection,
      webhook: { ...webhook, count24h: webhookCount24h ?? 0, lastEventAt: lastWebhookRow?.created_at ?? null, lastEvent: lastWebhookRow?.event ?? null, lastStatus: lastWebhookRow?.status ?? null },
      metrics24h: { total, delivered, read, errored, pending, deliveryRate: total ? Math.round((delivered / total) * 100) : null, errorRate: total ? Math.round((errored / total) * 100) : null },
      failures: (failuresRaw ?? []).map((f: Record<string, unknown>) => ({ id: String(f.id), created_at: String(f.created_at), error: (f.error as string | null) ?? null, status: (f.status as string | null) ?? null, preview: String(f.content ?? "").slice(0, 120) })),
      ingest6h: { total: ingest.length, byStatus: ingestByStatus, recentErrors: ingestErrors ?? [] },
    };
  });

export const probeWhatsappNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { phone: string }) => z.object({ phone: z.string().trim().min(8).max(32) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { instance } = evolutionConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
    const number = normalizeWhatsappPhone(data.phone);
    const result = await evolutionRequest(`/chat/whatsappNumbers/${encodeURIComponent(instance)}`, { method: "POST", body: JSON.stringify({ numbers: [number] }) });
    return { ok: result.ok, status: result.status, response: result.json ?? result.text, error: result.ok ? null : evolutionErrorMessage(result) };
  });