// AI auto-reply engine for WhatsApp inbound messages.
// Tool-calling with Gemini via Lovable AI Gateway. Consults real data
// (stock, prices, menu, hours, delivery). Never invents numbers.

import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type DbClient = ReturnType<typeof import("@/integrations/supabase/client.server")["supabaseAdmin" & never]> extends never
  ? any // eslint-disable-line @typescript-eslint/no-explicit-any
  : never;

interface WaAiSettings {
  id: string;
  enabled: boolean;
  model: string;
  system_prompt: string;
  greeting_message: string;
  fallback_message: string;
  out_of_hours_message: string;
  reply_delay_ms: number;
  max_replies_per_hour: number;
  business_hours_only: boolean;
  pause_after_human_min: number;
  handoff_keywords: string[];
  excluded_phones: string[];
  send_greeting: boolean;
  allow_stock: boolean;
  allow_price: boolean;
  allow_menu: boolean;
  allow_hours: boolean;
  allow_delivery: boolean;
  allow_promotions: boolean;
}

export async function getWaAiSettings(db: any): Promise<WaAiSettings | null> {
  const { data } = await db.from("whatsapp_ai_settings").select("*").eq("id", "default").maybeSingle();
  return (data as WaAiSettings | null) ?? null;
}

function normPhone(p: string | null | undefined) {
  return (p ?? "").replace(/\D/g, "");
}

function nowInBrazil() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

async function isStoreOpen(db: any): Promise<{ open: boolean; hours: string }> {
  const { data } = await db.from("site_settings").select("hours").limit(1).maybeSingle();
  const hoursText: string = data?.hours ?? "10h às 23h";
  // simplistic parse "10h às 23h"
  const m = hoursText.match(/(\d{1,2})h?\s*(?:às|as|-|–)\s*(\d{1,2})h?/i);
  if (!m) return { open: true, hours: hoursText };
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  const h = nowInBrazil().getHours();
  const open = end > start ? h >= start && h < end : h >= start || h < end;
  return { open, hours: hoursText };
}

/**
 * Build the AI tools available to the model based on settings.
 * All tools query the DB with the admin client (server-only).
 */
function buildTools(db: any, settings: WaAiSettings, toolsUsed: any[]) {
  const track = (name: string, args: any, result: any) => {
    toolsUsed.push({ name, args, result: typeof result === "string" ? result.slice(0, 300) : result });
  };

  const tools: Record<string, any> = {};

  if (settings.allow_stock) {
    tools.check_stock = tool({
      description:
        "Verifica se um ingrediente/insumo específico está disponível no estoque. Use quando cliente pergunta 'tem morango?', 'tem leite condensado?', etc. Retorna quantidade real.",
      inputSchema: z.object({
        item_name: z.string().describe("Nome do item/ingrediente (ex: morango, leite condensado, granola)"),
      }),
      execute: async ({ item_name }) => {
        const { data } = await db
          .from("inventory_items")
          .select("name, stock, unit, low_stock_threshold, active")
          .eq("active", true)
          .ilike("name", `%${item_name}%`)
          .limit(5);
        if (!data || data.length === 0) {
          const r = { found: false, message: `Não achei "${item_name}" no estoque` };
          track("check_stock", { item_name }, r);
          return r;
        }
        const r = {
          found: true,
          items: data.map((i: any) => ({
            name: i.name,
            stock: Number(i.stock),
            unit: i.unit,
            status:
              Number(i.stock) <= 0 ? "esgotado" : Number(i.stock) <= Number(i.low_stock_threshold) ? "acabando" : "disponível",
          })),
        };
        track("check_stock", { item_name }, r);
        return r;
      },
    });
  }

  if (settings.allow_price || settings.allow_menu) {
    tools.find_product = tool({
      description:
        "Busca um produto no cardápio por nome. Retorna preço, tamanhos, descrição e se está pausado. Use para 'quanto custa X', 'tem shake de Y', 'qual o preço do açaí grande'.",
      inputSchema: z.object({
        query: z.string().describe("Nome ou parte do nome do produto"),
      }),
      execute: async ({ query }) => {
        const { data } = await db
          .from("products")
          .select("id,name,category,description,base_price,sizes,active,paused_until,pause_reason,stock")
          .eq("active", true)
          .ilike("name", `%${query}%`)
          .limit(6);
        if (!data || data.length === 0) {
          const { data: byCat } = await db
            .from("products")
            .select("id,name,category,base_price")
            .eq("active", true)
            .ilike("category", `%${query}%`)
            .limit(6);
          const r = { found: false, suggestions: byCat ?? [] };
          track("find_product", { query }, r);
          return r;
        }
        const r = {
          found: true,
          products: data.map((p: any) => {
            const paused = p.paused_until && new Date(p.paused_until) > new Date();
            return {
              name: p.name,
              category: p.category,
              description: (p.description ?? "").slice(0, 200),
              price_brl: settings.allow_price ? Number(p.base_price) : undefined,
              sizes: settings.allow_price ? p.sizes : undefined,
              status: paused ? `pausado (${p.pause_reason ?? "sem estoque"})` : Number(p.stock ?? 999) <= 0 ? "esgotado" : "disponível",
            };
          }),
        };
        track("find_product", { query }, r);
        return r;
      },
    });
  }

  if (settings.allow_menu) {
    tools.list_menu = tool({
      description: "Lista produtos por categoria ou lista as categorias disponíveis. Use para 'quais sabores tem', 'qual o cardápio', 'que açaí vocês fazem'.",
      inputSchema: z.object({
        category: z.string().optional().describe("Categoria (opcional): açaí, shake, sorvete, combo, etc."),
      }),
      execute: async ({ category }) => {
        if (!category) {
          const { data } = await db.from("products").select("category").eq("active", true);
          const cats = Array.from(new Set((data ?? []).map((r: any) => r.category)));
          const r = { categories: cats };
          track("list_menu", {}, r);
          return r;
        }
        const { data } = await db
          .from("products")
          .select("name, base_price, category")
          .eq("active", true)
          .ilike("category", `%${category}%`)
          .order("sort_order")
          .limit(20);
        const r = {
          category,
          products: (data ?? []).map((p: any) => ({
            name: p.name,
            price_brl: settings.allow_price ? Number(p.base_price) : undefined,
          })),
        };
        track("list_menu", { category }, r);
        return r;
      },
    });
  }

  if (settings.allow_hours) {
    tools.store_hours = tool({
      description: "Retorna o horário de funcionamento e se a loja está ABERTA agora. Use para 'que horas abre', 'estão abertos', 'até que horas'.",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await isStoreOpen(db);
        track("store_hours", {}, r);
        return r;
      },
    });
  }

  if (settings.allow_delivery) {
    tools.delivery_info = tool({
      description: "Retorna informações de entrega: taxa, pedido mínimo, frete grátis. Use para 'qual a taxa de entrega', 'tem entrega', 'pedido mínimo'.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db.from("site_settings").select("delivery_fee, min_order, free_delivery_threshold, address").limit(1).maybeSingle();
        const r = {
          delivery_fee_brl: Number(data?.delivery_fee ?? 0),
          min_order_brl: Number(data?.min_order ?? 0),
          free_delivery_over_brl: Number(data?.free_delivery_threshold ?? 0),
          address: data?.address ?? null,
        };
        track("delivery_info", {}, r);
        return r;
      },
    });
  }

  if (settings.allow_promotions) {
    tools.active_promotions = tool({
      description: "Lista cupons/promoções ativos disponíveis para divulgar. Use quando cliente pergunta 'tem promoção', 'tem cupom', 'tem desconto'.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db
          .from("promo_coupons")
          .select("code, discount_type, discount_value, min_order, valid_until, active")
          .eq("active", true)
          .limit(5);
        const now = new Date();
        const active = (data ?? []).filter((c: any) => !c.valid_until || new Date(c.valid_until) > now);
        const r = { count: active.length, coupons: active };
        track("active_promotions", {}, r);
        return r;
      },
    });
  }

  tools.request_human = tool({
    description: "Sinaliza que o cliente precisa falar com um humano. Use quando: (1) o cliente pediu explicitamente atendente, (2) a pergunta envolve reclamação, cancelamento, problema com pedido, (3) você não tem certeza da resposta. NÃO responde ao cliente — apenas marca handoff.",
    inputSchema: z.object({
      reason: z.string().describe("Motivo curto do handoff"),
    }),
    execute: async ({ reason }) => {
      const r = { handoff: true, reason };
      track("request_human", { reason }, r);
      return r;
    },
  });

  return tools;
}

interface ReplyContext {
  db: any;
  conversationId: string;
  phone: string;
  incomingText: string;
  contactName?: string | null;
  isFirstMessage?: boolean;
}

interface ReplyOutcome {
  sent: boolean;
  reply?: string;
  reason?: string;
  handoff?: boolean;
  toolsUsed?: any[];
  latencyMs?: number;
}

async function loadRecentHistory(db: any, conversationId: string, limit = 12) {
  const { data } = await db
    .from("whatsapp_messages")
    .select("direction, content, sent_by, created_at, type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []).reverse();
  return rows
    .filter((m: any) => m.type === "text" && m.content)
    .map((m: any) => ({
      role: (m.direction === "in" ? "user" : "assistant") as "user" | "assistant",
      content: m.content as string,
    }));
}

/**
 * Main entry point. Called by the webhook after persisting an inbound message.
 * Handles all guardrails (enabled, hours, keyword handoff, rate limit, pause).
 */
export async function maybeReplyWithAI(ctx: ReplyContext): Promise<ReplyOutcome> {
  const { db, conversationId, phone, incomingText } = ctx;
  const started = Date.now();
  const settings = await getWaAiSettings(db);
  if (!settings || !settings.enabled) return { sent: false, reason: "disabled" };

  if (!incomingText || !incomingText.trim()) return { sent: false, reason: "no-text" };

  // exclusion list
  const cleanPhone = normPhone(phone);
  if (settings.excluded_phones.some((p) => normPhone(p) === cleanPhone)) {
    return { sent: false, reason: "excluded-phone" };
  }

  // per-conversation kill switch / pause after human
  const { data: conv } = await db
    .from("whatsapp_conversations")
    .select("id, ai_paused_until, ai_disabled")
    .eq("id", conversationId)
    .maybeSingle();
  if (conv?.ai_disabled) return { sent: false, reason: "conv-disabled" };
  if (conv?.ai_paused_until && new Date(conv.ai_paused_until) > new Date()) {
    return { sent: false, reason: "conv-paused" };
  }

  // If a human/operator replied recently, pause AI
  if (settings.pause_after_human_min > 0) {
    const since = new Date(Date.now() - settings.pause_after_human_min * 60_000).toISOString();
    const { data: lastHuman } = await db
      .from("whatsapp_messages")
      .select("id, created_at, sent_by, direction")
      .eq("conversation_id", conversationId)
      .eq("direction", "out")
      .eq("sent_by", "human")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (lastHuman) return { sent: false, reason: "human-recent" };
  }

  // rate limit per hour, globally
  if (settings.max_replies_per_hour > 0) {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("sent_by", "ai")
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= settings.max_replies_per_hour) {
      return { sent: false, reason: "rate-limit" };
    }
  }

  // handoff keywords → mark and skip
  const lower = incomingText.toLowerCase();
  const kwHit = settings.handoff_keywords.find((k) => lower.includes(k.toLowerCase()));
  if (kwHit) {
    await logAi(db, { conversationId, phone, incomingText, reply: null, tools: [{ name: "handoff-keyword", args: { keyword: kwHit }, result: null }], handoff: true, model: settings.model });
    return { sent: false, reason: "handoff-keyword", handoff: true };
  }

  // business hours guard
  if (settings.business_hours_only) {
    const { open } = await isStoreOpen(db);
    if (!open) {
      await sendAiText(db, conversationId, phone, settings.out_of_hours_message);
      await logAi(db, {
        conversationId,
        phone,
        incomingText,
        reply: settings.out_of_hours_message,
        tools: [{ name: "out-of-hours", args: {}, result: null }],
        handoff: false,
        model: settings.model,
        latencyMs: Date.now() - started,
      });
      return { sent: true, reply: settings.out_of_hours_message };
    }
  }

  // First-time greeting?
  if (settings.send_greeting && ctx.isFirstMessage) {
    // Prepend as separate short message
    await sendAiText(db, conversationId, phone, settings.greeting_message);
  }

  const history = await loadRecentHistory(db, conversationId);

  // Compose LLM call with tools
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { sent: false, reason: "no-api-key" };

  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway(settings.model);
  const toolsUsed: any[] = [];
  const tools = buildTools(db, settings, toolsUsed);

  try {
    const result = await generateText({
      model,
      system: `${settings.system_prompt}\n\nData/hora agora: ${nowInBrazil().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.\nNome do cliente: ${ctx.contactName ?? "desconhecido"}.\nRegras: nunca invente valores — use ferramentas. Se a ferramenta retornar "not found", diga que não temos. Se acabou o estoque, seja transparente. Máximo 3 frases por resposta.`,
      messages: [
        ...history,
        { role: "user", content: incomingText },
      ],
      tools,
      stopWhen: stepCountIs(50),
    });

    const handoff = toolsUsed.some((t) => t.name === "request_human");
    const replyText = (result.text ?? "").trim();

    if (handoff && !replyText) {
      // Do not send anything; mark handoff
      await logAi(db, { conversationId, phone, incomingText, reply: null, tools: toolsUsed, handoff: true, model: settings.model, latencyMs: Date.now() - started });
      return { sent: false, reason: "handoff", handoff: true, toolsUsed };
    }

    if (!replyText) {
      await sendAiText(db, conversationId, phone, settings.fallback_message);
      await logAi(db, { conversationId, phone, incomingText, reply: settings.fallback_message, tools: toolsUsed, handoff: true, model: settings.model, latencyMs: Date.now() - started });
      return { sent: true, reply: settings.fallback_message, handoff: true, toolsUsed };
    }

    // natural typing delay
    if (settings.reply_delay_ms > 0) {
      await new Promise((r) => setTimeout(r, Math.min(settings.reply_delay_ms, 4000)));
    }

    await sendAiText(db, conversationId, phone, replyText);
    await logAi(db, { conversationId, phone, incomingText, reply: replyText, tools: toolsUsed, handoff, model: settings.model, latencyMs: Date.now() - started });
    return { sent: true, reply: replyText, handoff, toolsUsed, latencyMs: Date.now() - started };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[wa-ai] generation failed", msg);
    await logAi(db, { conversationId, phone, incomingText, reply: null, tools: toolsUsed, handoff: false, model: settings.model, error: msg, latencyMs: Date.now() - started });
    return { sent: false, reason: `error: ${msg}` };
  }
}

async function logAi(
  db: any,
  args: {
    conversationId: string;
    phone: string;
    incomingText: string;
    reply: string | null;
    tools: any[];
    handoff: boolean;
    model: string;
    error?: string;
    latencyMs?: number;
  },
) {
  try {
    await db.from("whatsapp_ai_logs").insert({
      conversation_id: args.conversationId,
      phone: args.phone,
      user_message: args.incomingText,
      ai_reply: args.reply,
      tools_used: args.tools,
      handoff: args.handoff,
      model: args.model,
      error: args.error ?? null,
      latency_ms: args.latencyMs ?? null,
    });
  } catch (e) {
    console.error("[wa-ai] log failed", e);
  }
}

/**
 * Send an outbound text through Evolution API and persist as sent_by='ai'.
 * Minimal path — reuses evolutionConfig. Assumes conversation phone is valid.
 */
export async function sendAiText(db: any, conversationId: string, phone: string, text: string): Promise<void> {
  const { evolutionConfig, normalizeWhatsappPhone, fetchEvolutionWithTimeout } = await import("./whatsapp-evolution.server");
  const { base, key, instance } = evolutionConfig();

  // Persist optimistically
  const { data: inserted } = await db
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      direction: "out",
      type: "text",
      content: text,
      sent_by: "ai",
      status: base && key && instance ? "sending" : "pending",
    })
    .select("id")
    .single();

  await db
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 140),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (!base || !key || !instance) return;

  const number = normalizeWhatsappPhone(phone);
  if (!number || number.length < 10) return;

  try {
    const resp = await fetchEvolutionWithTimeout(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number, text, delay: 0, linkPreview: false }),
    });
    const body = await resp.text();
    let evoId: string | null = null;
    try {
      const parsed = JSON.parse(body);
      evoId = parsed?.key?.id ?? parsed?.data?.key?.id ?? null;
    } catch { /* noop */ }
    if (inserted?.id) {
      await db
        .from("whatsapp_messages")
        .update({
          status: resp.ok ? "sent" : "failed",
          error: resp.ok ? null : body.slice(0, 500),
          evolution_id: evoId,
        })
        .eq("id", inserted.id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (inserted?.id) {
      await db.from("whatsapp_messages").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", inserted.id);
    }
  }
}
