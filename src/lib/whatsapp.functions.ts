import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  assertAdminRole,
  evolutionConfig,
  evolutionFetch,
  extractEvolutionMessageId,
  fetchEvolutionWithTimeout,
  normalizeWhatsappPhone,
  publicWhatsappHostFromRequest,
  setEvolutionWebhook,
} from "./whatsapp-evolution.server";



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
    await assertAdminRole(context.supabase, context.userId);

    // fetch conversation
    const { data: conv, error: convErr } = await context.supabase
      .from("whatsapp_conversations")
      .select("id,phone,contact_name")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (convErr) throw new Error(convErr.message);
    if (!conv) throw new Error("Conversa não encontrada");

    const { base, key, instance } = evolutionConfig();
    let evoId: string | null = null;
    let evoError: string | null = null;
    let status = "pending";
    let rawPayload: Json | null = null;

    if (!base || !key || !instance) {
      evoError =
        "Evolution API não configurada (defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE). Mensagem salva localmente.";
      status = "pending";
    } else {
      try {
        const normalized = normalizeWhatsappPhone(conv.phone);
        if (!normalized || normalized.length < 10) {
          evoError = `Número inválido: "${conv.phone}". Corrija o telefone da conversa.`;
          status = "failed";
        } else {
        const webhookToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
        if (webhookToken) {
          try {
            const host = await publicWhatsappHostFromRequest();
            await setEvolutionWebhook({
              base,
              key,
              instance,
              url: `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(webhookToken)}`,
            });
          } catch {
            // O envio não deve falhar só porque a Evolution recusou reconfigurar
            // o webhook. A resposta de envio ainda será persistida/logada.
          }
        }
        // 1) Resolve o melhor destino. Em contatos migrados pelo WhatsApp,
        // a Evolution/Baileys pode receber mensagens com remoteJid @lid e
        // remoteJidAlt/senderPn com o telefone real. @lid é um identificador
        // interno e não é um destino confiável para sendText; o envio deve
        // priorizar número telefônico confirmado.
        const { data: knownRows } = await context.supabase
          .from("whatsapp_messages")
          .select("raw")
          .eq("conversation_id", conv.id)
          .not("raw", "is", null)
          .order("created_at", { ascending: false })
          .limit(60);

        const rawJids: string[] = [];
        for (const row of knownRows ?? []) {
          const raw = (row as { raw?: unknown }).raw;
          if (!raw || typeof raw !== "object") continue;
          const rec = raw as Record<string, unknown>;
          const key = rec.key && typeof rec.key === "object" ? (rec.key as Record<string, unknown>) : {};
          const send = rec.send && typeof rec.send === "object" ? (rec.send as Record<string, unknown>) : {};
          const response = send.response && typeof send.response === "object" ? (send.response as Record<string, unknown>) : {};
          const responseKey = response.key && typeof response.key === "object" ? (response.key as Record<string, unknown>) : {};
          const dataRec = response.data && typeof response.data === "object" ? (response.data as Record<string, unknown>) : {};
          const dataKey = dataRec.key && typeof dataRec.key === "object" ? (dataRec.key as Record<string, unknown>) : {};
          const verification = rec.verification && typeof rec.verification === "object" ? (rec.verification as Record<string, unknown>) : {};
          for (const value of [
            key.remoteJid,
            key.remoteJidAlt,
            key.senderPn,
            key.previousRemoteJid,
            key.participant,
            responseKey.remoteJid,
            responseKey.remoteJidAlt,
            dataKey.remoteJid,
            dataKey.remoteJidAlt,
            verification.knownLid,
            verification.knownPhoneJid,
            rec.remoteJid,
          ]) {
            if (typeof value === "string" && value && !value.includes("@g.us") && !value.includes("status@broadcast")) {
              rawJids.push(value.toLowerCase());
            }
          }
        }
        const knownLid = rawJids.find((jid) => jid.endsWith("@lid")) ?? null;
        const knownPhoneJid = rawJids.find((jid) => /@s\.whatsapp\.net$|@c\.us$/.test(jid)) ?? null;
        const knownPhoneDigits = knownPhoneJid ? normalizeWhatsappPhone(knownPhoneJid.split("@")[0] ?? "") : "";

        // 2) Confirma o número no WhatsApp antes de enviar.
        // Importante: a Evolution pode responder 400 quando UM item do array
        // não existe. Por isso testamos cada variante separadamente; assim um
        // telefone salvo sem o 9 não bloqueia a tentativa correta com o 9.
        const phoneCandidates = /^55\d{2}\d{8}$/.test(normalized)
          ? [normalized.slice(0, 4) + "9" + normalized.slice(4), normalized]
          : /^55\d{2}9\d{8}$/.test(normalized)
            ? [normalized, normalized.slice(0, 4) + normalized.slice(5)]
            : [normalized];
        const candidates = Array.from(new Set([
          ...phoneCandidates,
          ...(knownPhoneDigits ? [knownPhoneDigits] : []),
        ])).filter((candidate) => !candidate.includes("@lid"));

        let sendNumber: string | null = null;
        let verifiedJid: string | null = null;
        const checkUrl = `${base}/chat/whatsappNumbers/${encodeURIComponent(instance)}`;
        const checkReports: string[] = [];

        type NumberCheck = { exists?: boolean; jid?: string; number?: string | number };
        const unwrapChecks = (parsed: unknown): NumberCheck[] => {
          if (Array.isArray(parsed)) return parsed as NumberCheck[];
          if (!parsed || typeof parsed !== "object") return [];
          const rec = parsed as Record<string, unknown>;
          const buckets = [rec.response, rec.data, rec.result, rec.message];
          for (const bucket of buckets) {
            if (Array.isArray(bucket)) return bucket as NumberCheck[];
            if (bucket && typeof bucket === "object") {
              const nested = bucket as Record<string, unknown>;
              if (Array.isArray(nested.message)) return nested.message as NumberCheck[];
              if (Array.isArray(nested.numbers)) return nested.numbers as NumberCheck[];
              if (Array.isArray(nested.data)) return nested.data as NumberCheck[];
            }
          }
          return [];
        };

        for (const candidate of candidates) {
          const checkReq = { numbers: [candidate] };
          let checkStatus: number | string = "n/a";
          let checkBody = "";
          try {
            const check = await fetchEvolutionWithTimeout(checkUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: key },
              body: JSON.stringify(checkReq),
            });
            checkStatus = check.status;
            checkBody = await check.text();
            let arr: NumberCheck[] = [];
            try {
              arr = unwrapChecks(JSON.parse(checkBody));
            } catch {
              arr = [];
            }
            const found = arr.find((x) => x?.exists === true);
            if (found) {
              const foundNumber = String(found.number ?? "");
              const numberDigits = foundNumber.includes("@lid") ? "" : normalizeWhatsappPhone(foundNumber);
              const jid = String(found.jid ?? "");
              const jidDigits = jid.includes("@lid") ? "" : normalizeWhatsappPhone(jid.split("@")[0] ?? "");
              // Mesmo quando a verificação devolve um JID @lid, o endpoint
              // sendText deve receber o telefone. Enviar para @lid deixa a
              // mensagem presa em PENDING/ERROR em várias versões da Evolution.
              sendNumber = numberDigits || jidDigits || candidate;
              verifiedJid = jid || null;
              break;
            }
          } catch (err) {
            checkStatus = "exception";
            checkBody = err instanceof Error ? err.message : String(err);
          } finally {
            checkReports.push(
              `POST ${checkUrl}\n` +
                `→ payload: ${JSON.stringify(checkReq)}\n` +
                `← status: ${checkStatus}\n` +
                `← body: ${checkBody.slice(0, 900) || "(vazio)"}`,
            );
          }
        }

        const checkReport = checkReports.join("\n\n---\n\n");

        // Não bloqueia o envio só porque a verificação não confirmou: em alguns
        // números BR a Evolution confirma mal a existência, mas o sendText ainda
        // aceita o número correto. Se o envio real falhar, aí sim mostramos o
        // erro técnico completo retornado pelo endpoint de envio.
        if (!sendNumber) sendNumber = candidates[0] ?? normalized;
        const sendAttempts = Array.from(new Set([sendNumber, ...candidates]))
          .map((candidate) => normalizeWhatsappPhone(candidate))
          .filter((candidate) => candidate && !candidate.includes("@") && candidate.length >= 10);
        const targetNumber = sendAttempts[0] ?? normalizeWhatsappPhone(sendNumber);
        {
          const sendUrl = `${base}/message/sendText/${encodeURIComponent(instance)}`;
          let sendStatus: number | string = "n/a";
          let sendBody = "";
          let sendReq = {
            number: targetNumber,
            text: data.text,
            delay: 0,
            linkPreview: false,
          };
          const sendReports: string[] = [];
          try {
            let resp: Response | null = null;
            for (const attemptNumber of sendAttempts) {
              sendReq = {
                number: attemptNumber,
                text: data.text,
                delay: 0,
                linkPreview: false,
              };
              resp = await fetchEvolutionWithTimeout(sendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: key },
                body: JSON.stringify(sendReq),
              });
              sendStatus = resp.status;
              sendBody = await resp.text();
              sendReports.push(
                `POST ${sendUrl}\n` +
                  `→ payload: ${JSON.stringify(sendReq)}\n` +
                  `← status: ${sendStatus}\n` +
                  `← body: ${sendBody.slice(0, 600) || "(vazio)"}`,
              );
              if (resp.ok) break;
            }
            if (!resp) throw new Error("Nenhum número válido para envio.");
            sendStatus = resp.status;
            if (!resp.ok) {
              let friendly = `Evolution respondeu HTTP ${resp.status}`;
              try {
                const parsed = JSON.parse(sendBody);
                const arr = parsed?.response?.message;
                if (Array.isArray(arr) && arr[0] && arr[0].exists === false) {
                  friendly = `O número ${arr[0].number ?? sendNumber} não está registrado no WhatsApp.`;
                } else if (parsed?.message) {
                  friendly = `Evolution ${resp.status}: ${Array.isArray(parsed.message) ? JSON.stringify(parsed.message) : parsed.message}`;
                }
              } catch { /* mantém friendly */ }
              evoError =
                `❌ ${friendly}\n\n` +
                `[etapa 1: verificação de número]\n${checkReport}\n\n` +
                `[etapa 2: envio da mensagem]\n${sendReports.join("\n\n---\n\n")}`;
              status = "failed";
            } else {
              let parsed: Json | null = null;
              try {
                const j = JSON.parse(sendBody) as Record<string, unknown>;
                parsed = j as Json;
                const dataRec = (j.data ?? {}) as Record<string, unknown>;
                evoId = extractEvolutionMessageId(j);
                const evoStatus = String(j.status ?? dataRec.status ?? "sent").toLowerCase();
                // HTTP 2xx da Evolution significa que o aparelho aceitou a
                // mensagem para envio. O status "PENDING" é o estado interno
                // inicial da Evolution, não deve ficar como pendente infinito
                // no painel. Webhooks de ack atualizam depois para entregue/lida.
                status = evoStatus === "error" || evoStatus === "failed" ? "failed" : "sent";
                if (status === "failed") {
                  evoError =
                    `❌ Evolution aceitou a chamada mas retornou status ${evoStatus}.\n\n` +
                    `[etapa 1: verificação de número]\n${checkReport}\n\n` +
                    `[etapa 2: envio da mensagem]\nPOST ${sendUrl}\n` +
                    `→ payload: ${JSON.stringify(sendReq)}\n` +
                    `← status: ${sendStatus}\n` +
                    `← body: ${sendBody.slice(0, 900) || "(vazio)"}`;
                }
              } catch {
                evoId = null;
                status = "sent";
              }
              if (!evoId && !evoError) {
                evoError =
                  "⚠️ A Evolution aceitou a mensagem, mas não retornou o ID de rastreio. " +
                  "O status pode não atualizar para entregue/lida automaticamente.";
              }
              rawPayload = {
                verification: {
                  candidates,
                  selectedNumber: sendReq.number,
                  attemptedNumbers: sendAttempts,
                  verifiedJid: verifiedJid ?? undefined,
                  knownLid: knownLid ?? undefined,
                  knownPhoneJid: knownPhoneJid ?? undefined,
                },
                send: {
                  endpoint: sendUrl,
                  status: sendStatus,
                  response: parsed ?? sendBody.slice(0, 2000),
                },
              };
              // Se a conversa estava salva sem o 9 e a Evolution confirmou a
              // variante correta, deixa o cadastro pronto para os próximos envios.
              if (!sendReq.number.includes("@") && sendReq.number !== normalized) {
                await context.supabase
                  .from("whatsapp_conversations")
                  .update({ phone: sendReq.number })
                  .eq("id", conv.id);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            evoError =
              `❌ Falha de rede ao chamar Evolution: ${msg}\n\n` +
              `[etapa 1: verificação de número]\n${checkReport}\n\n` +
              `[etapa 2: envio da mensagem]\nPOST ${sendUrl}\n→ payload: ${JSON.stringify({ ...sendReq, verifiedJid })}\n← exception: ${msg}`;
            status = "failed";
          }
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
        direction: "out",
        type: "text",
        content: data.text,
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
    await assertAdminRole(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ ai_paused: data.paused })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateWhatsappConversationPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; phone: string }) =>
    z.object({ id: z.string().uuid(), phone: z.string().trim().min(8).max(32) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const phone = normalizeWhatsappPhone(data.phone);
    if (phone.length < 10 || phone.length > 15) {
      throw new Error("Telefone inválido. Use DDD + número, com ou sem +55.");
    }
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ phone, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) {
      if (/duplicate|unique|whatsapp_conversations_phone_key/i.test(error.message)) {
        throw new Error("Já existe uma conversa com esse telefone.");
      }
      throw new Error(error.message);
    }
    return { phone };
  });




export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; user_id: string | null }) =>
    z.object({ id: z.string().uuid(), user_id: z.string().uuid().nullable() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
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
    await assertAdminRole(context.supabase, context.userId);
    const now = new Date().toISOString();
    await context.supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.id);
    await context.supabase
      .from("whatsapp_messages")
      .update({ read_at: now })
      .eq("conversation_id", data.id)
      .eq("direction", "in")
      .is("read_at", null);
    return { ok: true };
  });

export const getWhatsappConfigStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { base, key, instance } = evolutionConfig();
    return {
      configured: !!(base && key && instance),
      hasBase: !!base,
      hasKey: !!key,
      hasInstance: !!instance,
      instance,
    };
  });

/** Sincroniza as mensagens recentes do telefone conectado, inclusive as enviadas direto pelo celular. */
export const syncWhatsappRecentMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v?: { limit?: number }) =>
    z.object({ limit: z.number().int().min(10).max(200).default(80) }).parse(v ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { base, key, instance } = evolutionConfig();
    const { syncWhatsappRecentMessagesFromEvolution } = await import("./whatsapp-sync.server");
    return syncWhatsappRecentMessagesFromEvolution({
      supabase: context.supabase,
      base,
      key,
      instance,
      limit: data.limit,
    });
  });

/** Estado atual da instância (open = conectado, connecting = aguardando QR, close = desconectado). */
export const getWhatsappConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { instance } = evolutionConfig();
    if (!instance)
      return {
        state: "unconfigured",
        exists: false,
        ownerJid: null,
        profileName: null,
        disconnectionAt: null,
        disconnectionCode: null,
      };
    try {
      const j = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
      let state =
        ((j?.instance as Record<string, unknown> | undefined)?.state as string | undefined) ??
        (j?.state as string | undefined) ??
        "unknown";

      // /connectionState às vezes devolve "open" mesmo quando o WhatsApp
      // fez logout (401). /instance/fetchInstances tem o campo real
      // (disconnectionAt + disconnectionReasonCode + connectionStatus).
      let ownerJid: string | null = null;
      let profileName: string | null = null;
      let disconnectionAt: string | null = null;
      let disconnectionCode: number | null = null;
      try {
        const list = await evolutionFetch(
          `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`,
        );
        const arr = Array.isArray(list)
          ? list
          : Array.isArray((list as { data?: unknown })?.data)
            ? ((list as { data: unknown[] }).data)
            : [];
        const inst = (arr as Array<Record<string, unknown>>)[0] ?? null;
        if (inst) {
          ownerJid = (inst.ownerJid as string | null) ?? null;
          profileName = (inst.profileName as string | null) ?? null;
          disconnectionAt = (inst.disconnectionAt as string | null) ?? null;
          disconnectionCode = (inst.disconnectionReasonCode as number | null) ?? null;
          const connStatus = (inst.connectionStatus as string | undefined) ?? null;
          if (disconnectionAt && (connStatus === "close" || disconnectionCode === 401)) {
            state = "close";
          }
        }
      } catch { /* ignora, mantém state do connectionState */ }

      return { state, exists: true, ownerJid, profileName, disconnectionAt, disconnectionCode };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404/.test(msg))
        return {
          state: "not_found",
          exists: false,
          ownerJid: null,
          profileName: null,
          disconnectionAt: null,
          disconnectionCode: null,
        };
      throw e;
    }
  });

/** Cria a instância se necessário e retorna o QR code base64 para pareamento. */
export const getWhatsappQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { instance } = evolutionConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");

    let exists = true;
    try {
      await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
    } catch (e) {
      if (/404/.test(e instanceof Error ? e.message : String(e))) exists = false;
      else throw e;
    }

    if (!exists) {
      await evolutionFetch(`/instance/create`, {
        method: "POST",
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
    }

    const j = await evolutionFetch(`/instance/connect/${encodeURIComponent(instance)}`);
    const rec = (j ?? {}) as Record<string, unknown>;
    const qrObj = (rec.qrcode as Record<string, unknown> | undefined) ?? rec;
    let base64 =
      (qrObj.base64 as string | undefined) ??
      (rec.base64 as string | undefined) ??
      null;
    const code =
      (qrObj.code as string | undefined) ?? (rec.code as string | undefined) ?? null;
    const pairingCode =
      (rec.pairingCode as string | undefined) ??
      (qrObj.pairingCode as string | undefined) ??
      null;
    if (base64 && !base64.startsWith("data:")) base64 = `data:image/png;base64,${base64}`;
    return { base64, code, pairingCode };
  });

/** Faz logout da sessão do WhatsApp (desconecta o telefone). */
export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { instance } = evolutionConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
    await evolutionFetch(`/instance/logout/${encodeURIComponent(instance)}`, { method: "DELETE" });
    return { ok: true };
  });

/** Retorna a URL pública do webhook (o operador pode colar manualmente se necessário). */
export const getWhatsappWebhookInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN ?? "";
    const host = await publicWhatsappHostFromRequest();
    const url = host ? `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}` : "";
    let currentUrl: string | null = null;
    let configured = false;
    try {
      const { instance } = evolutionConfig();
      if (instance) {
        const j = await evolutionFetch(`/webhook/find/${encodeURIComponent(instance)}`);
        const rec = (j ?? {}) as Record<string, unknown>;
        const w = (rec.webhook as Record<string, unknown> | undefined) ?? rec;
        currentUrl = (w.url as string | undefined) ?? null;
        configured = !!currentUrl && !!url && currentUrl === url;
      }
    } catch {
      /* webhook não configurado ainda */
    }
    return { url, currentUrl, configured, hasToken: !!token };
  });

/** Configura o webhook na instância Evolution para receber mensagens em tempo real. */
export const configureWhatsappWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { instance } = evolutionConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (!token) throw new Error("EVOLUTION_WEBHOOK_TOKEN não configurado.");
    const host = await publicWhatsappHostFromRequest();
    if (!host) throw new Error("Não foi possível determinar a URL pública do app.");
    const url = `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}`;
    const { base, key } = evolutionConfig();
    await setEvolutionWebhook({ base, key, instance, url });
    return { ok: true, url };
  });

