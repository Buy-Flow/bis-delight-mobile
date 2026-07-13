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

/** Normaliza número para o formato aceito pelo Evolution/WhatsApp (dígitos, com DDI). */
function normalizePhone(raw: string): string {
  let n = String(raw ?? "").replace(/@.*$/, "").replace(/\D+/g, "");
  if (!n) return "";
  n = n.replace(/^0+/, "");
  // BR sem DDI → adiciona 55
  if (n.length === 10 || n.length === 11) n = "55" + n;
  // 55 duplicado (55 55 + numero)
  while (n.length > 13 && n.startsWith("5555")) n = n.slice(2);
  return n;
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
    let status = "pending";

    if (!base || !key || !instance) {
      evoError =
        "Evolution API não configurada (defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE). Mensagem salva localmente.";
      status = "pending";
    } else {
      try {
        const normalized = normalizePhone(conv.phone);
        if (!normalized || normalized.length < 10) {
          evoError = `Número inválido: "${conv.phone}". Corrija o telefone da conversa.`;
          status = "failed";
        } else {
        // 1) Confirma o número no WhatsApp antes de enviar.
        // Importante: a Evolution pode responder 400 quando UM item do array
        // não existe. Por isso testamos cada variante separadamente; assim um
        // telefone salvo sem o 9 não bloqueia a tentativa correta com o 9.
        const candidates = /^55\d{2}\d{8}$/.test(normalized)
          ? [normalized.slice(0, 4) + "9" + normalized.slice(4), normalized]
          : /^55\d{2}9\d{8}$/.test(normalized)
            ? [normalized, normalized.slice(0, 4) + normalized.slice(5)]
            : [normalized];

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

        for (const candidate of Array.from(new Set(candidates))) {
          const checkReq = { numbers: [candidate] };
          let checkStatus: number | string = "n/a";
          let checkBody = "";
          try {
            const check = await fetch(checkUrl, {
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
              const numberDigits = normalizePhone(String(found.number ?? ""));
              const jid = String(found.jid ?? "");
              const jidDigits = jid.includes("@lid") ? "" : normalizePhone(jid.split("@")[0] ?? "");
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

        if (!sendNumber) {
          const variants = Array.from(new Set(candidates)).join(", ");
          evoError =
            `❌ A Evolution não confirmou esse contato no WhatsApp.\n` +
            `Número salvo: ${conv.phone}. Normalizado: ${normalized}. Variantes testadas: ${variants}.\n` +
            `Se esse contato existe, corrija o telefone no cadastro/conversa ou confira se a instância está conectada.\n\n` +
            `[etapa 1: verificação de número]\n${checkReport}`;
          status = "failed";
        } else {
          const sendUrl = `${base}/message/sendText/${encodeURIComponent(instance)}`;
          const sendReq = {
            number: sendNumber,
            text: data.text,
            delay: 0,
            linkPreview: false,
          };
          let sendStatus: number | string = "n/a";
          let sendBody = "";
          try {
            const resp = await fetch(sendUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: key },
              body: JSON.stringify(sendReq),
            });
            sendStatus = resp.status;
            sendBody = await resp.text();
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
              const sendReport =
                `POST ${sendUrl}\n` +
                `→ payload: ${JSON.stringify(sendReq)}\n` +
                `← status: ${sendStatus}\n` +
                `← body: ${sendBody.slice(0, 600) || "(vazio)"}`;
              evoError =
                `❌ ${friendly}\n\n` +
                `[etapa 1: verificação de número]\n${checkReport}\n\n` +
                `[etapa 2: envio da mensagem]\n${sendReport}`;
              status = "failed";
            } else {
              try {
                const j = JSON.parse(sendBody);
                evoId = j?.key?.id ?? j?.messageId ?? j?.id ?? j?.data?.key?.id ?? null;
                status = String(j?.status ?? j?.data?.status ?? "pending").toLowerCase();
                if (status === "sent") status = "pending";
              } catch {
                evoId = null;
                status = "pending";
              }
              // Se a conversa estava salva sem o 9 e a Evolution confirmou a
              // variante correta, deixa o cadastro pronto para os próximos envios.
              if (sendNumber !== normalized) {
                await context.supabase
                  .from("whatsapp_conversations")
                  .update({ phone: sendNumber })
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
      .eq("direction", "in")
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
    await assertAdmin(context.supabase, context.userId);
    const { base, key, instance } = evoConfig();
    const { syncWhatsappRecentMessagesFromEvolution } = await import("./whatsapp-sync.server");
    return syncWhatsappRecentMessagesFromEvolution({
      supabase: context.supabase,
      base,
      key,
      instance,
      limit: data.limit,
    });
  });

async function evoFetch(path: string, init?: RequestInit) {
  const { base, key } = evoConfig();
  if (!base || !key) throw new Error("Evolution API não configurada (URL/KEY ausentes).");
  const resp = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      ...(init?.headers || {}),
    },
  });
  const txt = await resp.text();
  let json: unknown = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* raw */ }
  if (!resp.ok) {
    const msg =
      (json && typeof json === "object" && "message" in json
        ? String((json as Record<string, unknown>).message)
        : "") || txt.slice(0, 240);
    throw new Error(`Evolution ${resp.status}: ${msg}`);
  }
  return json as Record<string, unknown> | null;
}

/** Estado atual da instância (open = conectado, connecting = aguardando QR, close = desconectado). */
export const getWhatsappConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { instance } = evoConfig();
    if (!instance) return { state: "unconfigured", exists: false };
    try {
      const j = await evoFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
      const state =
        ((j?.instance as Record<string, unknown> | undefined)?.state as string | undefined) ??
        (j?.state as string | undefined) ??
        "unknown";
      return { state, exists: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404/.test(msg)) return { state: "not_found", exists: false };
      throw e;
    }
  });

/** Cria a instância se necessário e retorna o QR code base64 para pareamento. */
export const getWhatsappQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { instance } = evoConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");

    let exists = true;
    try {
      await evoFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
    } catch (e) {
      if (/404/.test(e instanceof Error ? e.message : String(e))) exists = false;
      else throw e;
    }

    if (!exists) {
      await evoFetch(`/instance/create`, {
        method: "POST",
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
    }

    const j = await evoFetch(`/instance/connect/${encodeURIComponent(instance)}`);
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
    await assertAdmin(context.supabase, context.userId);
    const { instance } = evoConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
    await evoFetch(`/instance/logout/${encodeURIComponent(instance)}`, { method: "DELETE" });
    return { ok: true };
  });

async function publicHostFromRequest(): Promise<string> {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  try {
    const mod = await import("@tanstack/react-start/server");
    const getRequest = (mod as unknown as { getRequest?: () => Request }).getRequest;
    if (!getRequest) return "";
    const req = getRequest();
    const url = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

/** Retorna a URL pública do webhook (o operador pode colar manualmente se necessário). */
export const getWhatsappWebhookInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN ?? "";
    const host = await publicHostFromRequest();
    const url = host ? `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}` : "";
    let currentUrl: string | null = null;
    let configured = false;
    try {
      const { instance } = evoConfig();
      if (instance) {
        const j = await evoFetch(`/webhook/find/${encodeURIComponent(instance)}`);
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
    await assertAdmin(context.supabase, context.userId);
    const { instance } = evoConfig();
    if (!instance) throw new Error("EVOLUTION_INSTANCE não configurado.");
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (!token) throw new Error("EVOLUTION_WEBHOOK_TOKEN não configurado.");
    const host = await publicHostFromRequest();
    if (!host) throw new Error("Não foi possível determinar a URL pública do app.");
    const url = `${host}/api/public/whatsapp-webhook?token=${encodeURIComponent(token)}`;
    // Lista de eventos — nomes SCREAMING_SNAKE aceitos pelo schema do Evolution v2.
    // Fonte: EvolutionAPI/evolution-api src/api/integrations/event/webhook/webhook.schema.ts
    const events = [
      "MESSAGES_SET",
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "MESSAGES_EDITED",
      "MESSAGES_DELETE",
      "SEND_MESSAGE",
      "SEND_MESSAGE_UPDATE",
      "CONNECTION_UPDATE",
      "QRCODE_UPDATED",
      "CONTACTS_UPSERT",
      "CONTACTS_UPDATE",
      "CHATS_UPSERT",
    ];

    // Shape v2 canônico (source: webhook.schema.ts) — chaves camelCase `byEvents`/`base64`
    // aninhadas em `webhook`. Este é o formato validado pelo mainline atual.
    const bodyV2 = {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        events,
      },
    };
    // Fallback 1: alguns builds ainda expõem as chaves com o prefixo `webhook*`
    // (nomes das colunas no Prisma) — tentamos como segunda opção.
    const bodyV2Prefixed = {
      webhook: {
        enabled: true,
        url,
        webhookByEvents: false,
        webhookBase64: false,
        events,
      },
    };
    // Fallback 2: v1/forks legados aceitam o corpo achatado com snake_case.
    const bodyFlat = {
      enabled: true,
      url,
      webhook_by_events: false,
      webhook_base64: false,
      events,
    };

    let lastErr: unknown = null;
    for (const body of [bodyV2, bodyV2Prefixed, bodyFlat]) {
      try {
        await evoFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return { ok: true, url };
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(
      "Falha ao configurar webhook: " +
        (lastErr instanceof Error ? lastErr.message : String(lastErr)),
    );
  });

