import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI Growth Engine
 *
 * Detects revenue opportunities (deterministic segments on real data) and
 * provides a threaded consultant chat with optional web search.
 * The consultant NEVER modifies the site — it is advisory only.
 */

export type GrowthClient = {
  user_id: string;
  name: string;
  phone: string | null;
  last_order_at: string | null;
  last_total: number;
  ltv: number;
  orders: number;
  favorite_category: string | null;
  reason: string;
};

export type GrowthInsight = {
  id: string;
  priority: "ALTA" | "MEDIA" | "OPORTUNIDADE";
  category: string;
  title: string;
  count: number;
  impacto: number;
  clientes: GrowthClient[];
  mensagem: string;
  status: "pending" | "dispatched" | "dismissed";
  created_at: string;
  expires_at: string;
};

export type GrowthReport = {
  generatedAt: string;
  potentialRevenue: number;
  opportunitiesCount: number;
  churnRate: number;
  avgTicket: number;
  totalActive: number;
  insights: GrowthInsight[];
  aiError?: string;
};

export type GrowthThread = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
};

export type GrowthChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const DAY = 86400000;

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (
      n: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await sb.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

type OrderRow = {
  id: string;
  user_id: string | null;
  total: number | string;
  status: string;
  created_at: string;
  customer_name: string | null;
  phone: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  birthday: string | null;
};

type ItemRow = {
  order_id: string;
  product_id: string | null;
  name: string | null;
};

type ProductRow = { id: string; category: string | null };

type CartRow = {
  user_id: string;
  subtotal: number | string;
  created_at: string;
  recovered_at: string | null;
  items: unknown;
};

type ClientAgg = {
  user_id: string;
  name: string;
  phone: string | null;
  orders: number;
  ltv: number;
  last_order_at: string;
  last_total: number;
  categories: Record<string, number>;
};

function fmtPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function pickTopCategory(map: Record<string, number>): string | null {
  const entries = Object.entries(map);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export const generateGrowthInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ refresh: z.boolean().default(false) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<GrowthReport> => {
    await assertAdmin(context);
    const { supabase } = context;

    if (!data.refresh) {
      const { data: cached } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("impacto", { ascending: false });
      if (cached && cached.length) {
        const totalPotential = cached.reduce(
          (s, r) => s + Number(r.impacto || 0),
          0,
        );
        return {
          generatedAt: new Date().toISOString(),
          potentialRevenue: Math.round(totalPotential),
          opportunitiesCount: cached.length,
          churnRate: 0,
          avgTicket: 0,
          totalActive: 0,
          insights: cached.map((r) => ({
            id: r.id,
            priority: r.priority as GrowthInsight["priority"],
            category: r.category,
            title: r.title,
            count: r.count,
            impacto: Number(r.impacto),
            clientes: (r.clientes as GrowthClient[]) ?? [],
            mensagem: r.mensagem,
            status: r.status as GrowthInsight["status"],
            created_at: r.created_at,
            expires_at: r.expires_at,
          })),
        };
      }
    }

    const now = Date.now();
    const from180 = new Date(now - 180 * DAY).toISOString();

    const [ordersRes, profilesRes, itemsRes, productsRes, cartsRes] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id,user_id,total,status,created_at,customer_name,phone")
          .gte("created_at", from180)
          .not("status", "eq", "cancelado")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,phone,birthday"),
        supabase.from("order_items").select("order_id,product_id,name"),
        supabase.from("products").select("id,category"),
        supabase
          .from("abandoned_carts")
          .select("user_id,subtotal,created_at,recovered_at,items")
          .is("recovered_at", null)
          .gte("created_at", new Date(now - 14 * DAY).toISOString()),
      ]);
    if (ordersRes.error) throw new Error(ordersRes.error.message);

    const orders: OrderRow[] = (ordersRes.data ?? []) as OrderRow[];
    const profiles: ProfileRow[] = (profilesRes.data ?? []) as ProfileRow[];
    const items: ItemRow[] = (itemsRes.data ?? []) as ItemRow[];
    const products: ProductRow[] = (productsRes.data ?? []) as ProductRow[];
    const carts: CartRow[] = (cartsRes.data ?? []) as CartRow[];

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const productCategoryById = new Map(
      products.map((p) => [p.id, p.category ?? "outros"]),
    );
    const categoryByOrder = new Map<string, string>();
    for (const it of items) {
      if (!it.product_id) continue;
      const cat = productCategoryById.get(it.product_id);
      if (cat && !categoryByOrder.has(it.order_id)) {
        categoryByOrder.set(it.order_id, cat);
      }
    }

    const clients = new Map<string, ClientAgg>();
    for (const o of orders) {
      if (!o.user_id) continue;
      const prof = profileById.get(o.user_id);
      const total = Number(o.total) || 0;
      const cur = clients.get(o.user_id);
      const cat = categoryByOrder.get(o.id);
      if (!cur) {
        clients.set(o.user_id, {
          user_id: o.user_id,
          name: prof?.full_name ?? o.customer_name ?? "Cliente",
          phone: prof?.phone ?? o.phone ?? null,
          orders: 1,
          ltv: total,
          last_order_at: o.created_at,
          last_total: total,
          categories: cat ? { [cat]: 1 } : {},
        });
      } else {
        cur.orders += 1;
        cur.ltv += total;
        if (o.created_at > cur.last_order_at) {
          cur.last_order_at = o.created_at;
          cur.last_total = total;
        }
        if (cat) cur.categories[cat] = (cur.categories[cat] ?? 0) + 1;
      }
    }
    const allClients = Array.from(clients.values());
    const avgTicket = allClients.length
      ? allClients.reduce((s, c) => s + c.ltv, 0) /
        Math.max(1, allClients.reduce((s, c) => s + c.orders, 0))
      : 0;

    const daysSince = (iso: string) => (now - new Date(iso).getTime()) / DAY;

    type Segment = {
      key: string;
      category: string;
      titleHint: string;
      clients: GrowthClient[];
      impact: number;
      basePriority: "ALTA" | "MEDIA" | "OPORTUNIDADE";
    };
    const segments: Segment[] = [];

    const ltvSorted = [...allClients].sort((a, b) => b.ltv - a.ltv);
    const vipCut = ltvSorted[Math.floor(ltvSorted.length * 0.3)]?.ltv ?? 0;
    const churnedVIP = allClients.filter((c) => {
      const d = daysSince(c.last_order_at);
      return d >= 30 && d <= 90 && c.ltv >= Math.max(100, vipCut);
    });
    if (churnedVIP.length) {
      segments.push({
        key: "churn_vip",
        category: "reativacao",
        titleHint: "VIPs sumidos há mais de 30 dias",
        clients: churnedVIP.slice(0, 20).map((c) => ({
          user_id: c.user_id,
          name: c.name,
          phone: fmtPhone(c.phone),
          last_order_at: c.last_order_at,
          last_total: c.last_total,
          ltv: Math.round(c.ltv * 100) / 100,
          orders: c.orders,
          favorite_category: pickTopCategory(c.categories),
          reason: `LTV R$ ${c.ltv.toFixed(0)} • sem pedir há ${Math.round(daysSince(c.last_order_at))}d`,
        })),
        impact: churnedVIP.reduce((s, c) => s + c.ltv / c.orders, 0),
        basePriority: "ALTA",
      });
    }

    const thisMonth = new Date().getMonth() + 1;
    const birthdayClients = profiles.filter((p) => {
      if (!p.birthday) return false;
      const m = Number(p.birthday.slice(5, 7));
      return m === thisMonth;
    });
    if (birthdayClients.length) {
      segments.push({
        key: "birthdays",
        category: "aniversario",
        titleHint: "Aniversariantes do mês",
        clients: birthdayClients.slice(0, 25).map((p) => {
          const agg = clients.get(p.id);
          return {
            user_id: p.id,
            name: p.full_name ?? "Cliente",
            phone: fmtPhone(p.phone),
            last_order_at: agg?.last_order_at ?? null,
            last_total: agg?.last_total ?? 0,
            ltv: Math.round((agg?.ltv ?? 0) * 100) / 100,
            orders: agg?.orders ?? 0,
            favorite_category: agg ? pickTopCategory(agg.categories) : null,
            reason: `Aniversário em ${(p.birthday ?? "").slice(8, 10)}/${(p.birthday ?? "").slice(5, 7)}`,
          };
        }),
        impact: birthdayClients.length * Math.max(avgTicket, 25),
        basePriority: "MEDIA",
      });
    }

    if (carts.length) {
      const cartClients: GrowthClient[] = carts
        .slice(0, 20)
        .map((c) => {
          const prof = profileById.get(c.user_id);
          const agg = clients.get(c.user_id);
          const sub = Number(c.subtotal) || 0;
          return {
            user_id: c.user_id,
            name: prof?.full_name ?? "Cliente",
            phone: fmtPhone(prof?.phone),
            last_order_at: agg?.last_order_at ?? null,
            last_total: sub,
            ltv: Math.round((agg?.ltv ?? 0) * 100) / 100,
            orders: agg?.orders ?? 0,
            favorite_category: agg ? pickTopCategory(agg.categories) : null,
            reason: `Carrinho de R$ ${sub.toFixed(2)} abandonado há ${Math.round(daysSince(c.created_at))}d`,
          };
        })
        .filter((c) => c.phone);
      if (cartClients.length) {
        segments.push({
          key: "abandoned_cart",
          category: "carrinho",
          titleHint: "Carrinhos abandonados nos últimos 14 dias",
          clients: cartClients,
          impact: carts.reduce((s, c) => s + (Number(c.subtotal) || 0), 0),
          basePriority: "ALTA",
        });
      }
    }

    const oneShots = allClients.filter(
      (c) =>
        c.orders === 1 &&
        daysSince(c.last_order_at) >= 30 &&
        daysSince(c.last_order_at) <= 60,
    );
    if (oneShots.length >= 3) {
      segments.push({
        key: "one_shot",
        category: "primeira_recompra",
        titleHint: "Clientes de primeira compra sem retorno",
        clients: oneShots.slice(0, 20).map((c) => ({
          user_id: c.user_id,
          name: c.name,
          phone: fmtPhone(c.phone),
          last_order_at: c.last_order_at,
          last_total: c.last_total,
          ltv: Math.round(c.ltv * 100) / 100,
          orders: c.orders,
          favorite_category: pickTopCategory(c.categories),
          reason: `1 pedido apenas há ${Math.round(daysSince(c.last_order_at))}d`,
        })),
        impact: oneShots.length * Math.max(avgTicket, 25),
        basePriority: "MEDIA",
      });
    }

    const catFans: Record<string, GrowthClient[]> = {};
    for (const c of allClients) {
      if (c.orders < 3) continue;
      const cat = pickTopCategory(c.categories);
      if (!cat) continue;
      const d = daysSince(c.last_order_at);
      if (d < 15 || d > 60) continue;
      (catFans[cat] ??= []).push({
        user_id: c.user_id,
        name: c.name,
        phone: fmtPhone(c.phone),
        last_order_at: c.last_order_at,
        last_total: c.last_total,
        ltv: Math.round(c.ltv * 100) / 100,
        orders: c.orders,
        favorite_category: cat,
        reason: `${c.orders} pedidos de ${cat} • ${Math.round(d)}d sem voltar`,
      });
    }
    for (const [cat, list] of Object.entries(catFans)) {
      if (list.length < 3) continue;
      segments.push({
        key: `fans_${cat}`,
        category: "cross_sell",
        titleHint: `Fãs de ${cat} parados`,
        clients: list.slice(0, 20),
        impact: list.length * Math.max(avgTicket, 25),
        basePriority: "OPORTUNIDADE",
      });
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    let aiError: string | undefined;
    const enriched: Array<{
      key: string;
      title: string;
      priority: "ALTA" | "MEDIA" | "OPORTUNIDADE";
      mensagem: string;
    }> = [];

    if (segments.length && apiKey) {
      const briefing = segments.map((s) => ({
        key: s.key,
        hint: s.titleHint,
        count: s.clients.length,
        impact_brl: Math.round(s.impact),
        sample_reasons: s.clients.slice(0, 3).map((c) => c.reason),
      }));
      try {
        const resp = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Você é o head de crescimento de uma loja de açaí premium no Brasil ("Quero Bis").
Recebe segmentos reais de clientes e devolve, para cada segmento:
- title: em português, curto, empolgante, aponta o problema/oportunidade (máx 60 chars).
- priority: ALTA (churn/dinheiro parado), MEDIA (recompra, aniversário), OPORTUNIDADE (upsell/fãs).
- mensagem: WhatsApp curto (máx 240 chars), tom caloroso, sem emoji excessivo, com CTA claro. Use placeholder {nome} onde couber, sem "Olá cliente".
Responda apenas JSON válido.`,
                },
                {
                  role: "user",
                  content: `Segmentos: ${JSON.stringify(briefing)}
Devolva JSON:
{ "items": [ { "key": "...", "title": "...", "priority": "ALTA|MEDIA|OPORTUNIDADE", "mensagem": "..." } ] }`,
                },
              ],
              response_format: { type: "json_object" },
              temperature: 0.7,
            }),
          },
        );
        if (resp.status === 429)
          aiError = "Muitas requisições agora. Tente de novo em instantes.";
        else if (resp.status === 402)
          aiError =
            "Créditos de IA esgotados. Adicione créditos ao workspace para continuar.";
        else if (!resp.ok) aiError = `IA indisponível (${resp.status}).`;
        else {
          const payload = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const raw = payload.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(raw) as {
            items?: Array<{
              key: string;
              title: string;
              priority: string;
              mensagem: string;
            }>;
          };
          for (const it of parsed.items ?? []) {
            enriched.push({
              key: it.key,
              title: String(it.title || "").slice(0, 80),
              priority: (["ALTA", "MEDIA", "OPORTUNIDADE"].includes(it.priority)
                ? it.priority
                : "MEDIA") as "ALTA" | "MEDIA" | "OPORTUNIDADE",
              mensagem: String(it.mensagem || "").slice(0, 400),
            });
          }
        }
      } catch (e) {
        aiError = `Falha ao consultar IA: ${(e as Error).message}`;
      }
    } else if (!apiKey) {
      aiError = "LOVABLE_API_KEY ausente no servidor.";
    }

    await supabase.from("ai_insights").delete().eq("status", "pending");

    const toInsert = segments.map((s) => {
      const ai = enriched.find((e) => e.key === s.key);
      const title = ai?.title ?? s.titleHint;
      const mensagem =
        ai?.mensagem ??
        `Oi {nome}! Sentimos sua falta na Quero Bis 💜 Que tal um açaí hoje? Preparamos algo especial pra você.`;
      return {
        priority: ai?.priority ?? s.basePriority,
        category: s.category,
        title,
        count: s.clients.length,
        impacto: Math.round(s.impact * 100) / 100,
        clientes: s.clients,
        mensagem,
      };
    });

    let saved: GrowthInsight[] = [];
    if (toInsert.length) {
      const { data: ins, error: insErr } = await supabase
        .from("ai_insights")
        .insert(toInsert)
        .select("*");
      if (insErr) throw new Error(insErr.message);
      saved = (ins ?? []).map((r) => ({
        id: r.id,
        priority: r.priority as GrowthInsight["priority"],
        category: r.category,
        title: r.title,
        count: r.count,
        impacto: Number(r.impacto),
        clientes: (r.clientes as GrowthClient[]) ?? [],
        mensagem: r.mensagem,
        status: r.status as GrowthInsight["status"],
        created_at: r.created_at,
        expires_at: r.expires_at,
      }));
    }

    saved.sort((a, b) => b.impacto - a.impacto);

    const activeClients = allClients.filter(
      (c) => daysSince(c.last_order_at) <= 60,
    ).length;
    const churnedClients = allClients.filter(
      (c) => daysSince(c.last_order_at) > 60,
    ).length;
    const churnRate =
      allClients.length > 0
        ? (churnedClients / allClients.length) * 100
        : 0;

    return {
      generatedAt: new Date().toISOString(),
      potentialRevenue: Math.round(saved.reduce((s, i) => s + i.impacto, 0)),
      opportunitiesCount: saved.length,
      churnRate: Math.round(churnRate * 10) / 10,
      avgTicket: Math.round(avgTicket * 100) / 100,
      totalActive: activeClients,
      insights: saved,
      aiError,
    };
  });

export const dismissGrowthInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("ai_insights")
      .update({ status: "dismissed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dispatchGrowthCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        insight_id: z.string().uuid(),
        message: z.string().min(4).max(600),
        recipient_ids: z.array(z.string().uuid()).min(1).max(200),
        channel: z.enum(["whatsapp", "push"]).default("whatsapp"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    const { data: insight, error: insightErr } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("id", data.insight_id)
      .maybeSingle();
    if (insightErr) throw new Error(insightErr.message);
    if (!insight) throw new Error("Insight não encontrado");

    const clientes = (insight.clientes as GrowthClient[]) ?? [];
    const selected = clientes.filter((c) =>
      data.recipient_ids.includes(c.user_id),
    );

    const links = selected
      .filter((c) => c.phone)
      .map((c) => {
        const msg = data.message
          .replace(/\{nome\}/gi, c.name.split(" ")[0] ?? "")
          .replace(/\{cliente\}/gi, c.name);
        return {
          user_id: c.user_id,
          name: c.name,
          phone: c.phone,
          message: msg,
          whatsapp_url: `https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`,
        };
      });

    await supabase.from("ai_campaigns").insert({
      insight_id: data.insight_id,
      channel: data.channel,
      message: data.message,
      recipients: links,
      recipients_count: links.length,
      dispatched_by: userId,
      status: "sent",
    });

    await supabase
      .from("ai_insights")
      .update({ status: "dispatched" })
      .eq("id", data.insight_id);

    return { links, dispatched: links.length };
  });

// ============ Threaded Consultant Chat ============

export const listGrowthThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ threads: GrowthThread[] }> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("ai_growth_threads")
      .select("id,title,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { threads: (data ?? []) as GrowthThread[] };
  });

export const createGrowthThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ title: z.string().max(80).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ thread: GrowthThread }> => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("ai_growth_threads")
      .insert({
        user_id: context.userId,
        title: data.title ?? "Nova conversa",
      })
      .select("id,title,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { thread: row as GrowthThread };
  });

export const renameGrowthThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), title: z.string().min(1).max(80) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("ai_growth_threads")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGrowthThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("ai_growth_threads")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGrowthThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ thread_id: z.string().uuid() }).parse(data),
  )
  .handler(
    async ({ data, context }): Promise<{ messages: GrowthChatMessage[] }> => {
      await assertAdmin(context);
      const { data: rows, error } = await context.supabase
        .from("ai_growth_chat")
        .select("id,role,content,created_at")
        .eq("user_id", context.userId)
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      const messages = (rows ?? [])
        .filter((r) => r.role === "user" || r.role === "assistant")
        .map((r) => ({
          id: r.id as string,
          role: r.role as "user" | "assistant",
          content: r.content as string,
          created_at: r.created_at as string,
        }));
      return { messages };
    },
  );

async function callGatewayChat(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ content: string; citations?: string[] }> {
  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );
  if (resp.status === 429)
    throw new Error("Muitas requisições — tente em instantes.");
  if (resp.status === 402)
    throw new Error(
      "Créditos de IA esgotados. Adicione créditos ao workspace.",
    );
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`IA indisponível (${resp.status}). ${text.slice(0, 200)}`);
  }
  const payload = (await resp.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        annotations?: Array<{
          type?: string;
          url_citation?: { url?: string; title?: string };
        }>;
      };
    }>;
    citations?: string[];
  };
  const msg = payload.choices?.[0]?.message;
  const content = msg?.content?.trim() ?? "";
  const annotations = msg?.annotations ?? [];
  const citations: string[] = [];
  for (const a of annotations) {
    const url = a.url_citation?.url;
    if (url && !citations.includes(url)) citations.push(url);
  }
  for (const c of payload.citations ?? []) {
    if (!citations.includes(c)) citations.push(c);
  }
  return { content, citations };
}

export const growthChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        thread_id: z.string().uuid(),
        message: z.string().min(1).max(2000),
        web_search: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    // Verify thread ownership
    const { data: thread, error: threadErr } = await supabase
      .from("ai_growth_threads")
      .select("id,title")
      .eq("id", data.thread_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (threadErr) throw new Error(threadErr.message);
    if (!thread) throw new Error("Conversa não encontrada");

    // KPIs context (last 90d)
    const now = Date.now();
    const from90 = new Date(now - 90 * DAY).toISOString();
    const { data: recent } = await supabase
      .from("orders")
      .select("total,created_at,status,user_id")
      .gte("created_at", from90)
      .not("status", "eq", "cancelado");

    const totals = (recent ?? []).reduce(
      (acc, o) => {
        const t = Number(o.total) || 0;
        acc.count += 1;
        acc.revenue += t;
        if (o.user_id) acc.users.add(o.user_id);
        return acc;
      },
      { count: 0, revenue: 0, users: new Set<string>() },
    );

    const kpis = {
      pedidos_90d: totals.count,
      receita_90d: Math.round(totals.revenue),
      ticket_medio: totals.count
        ? Math.round(totals.revenue / totals.count)
        : 0,
      clientes_unicos_90d: totals.users.size,
    };

    // History for this thread only
    const { data: history } = await supabase
      .from("ai_growth_chat")
      .select("role,content")
      .eq("user_id", userId)
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true })
      .limit(60);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const today = new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const systemPrompt = `Você é um consultor sênior de crescimento e marketing para uma loja de açaí premium no Brasil ("Quero Bis").

📌 SEU PAPEL É **CONSULTIVO** — você conversa, dá ideias, sugere estratégias, analisa tendências. **Você NÃO tem acesso ao sistema da loja e NÃO executa alterações** (não cria cupons, não muda preços, não dispara campanhas). Apenas aconselha.

Hoje é ${today}.

Contexto real da loja (últimos 90 dias):
- Pedidos: ${kpis.pedidos_90d}
- Receita: R$ ${kpis.receita_90d}
- Ticket médio: R$ ${kpis.ticket_medio}
- Clientes únicos: ${kpis.clientes_unicos_90d}

Diretrizes:
- Responda em pt-BR, tom de consultor experiente, prático e direto.
- Estruture com títulos curtos e bullets quando útil. Use markdown.
- Traga números, benchmarks e exemplos reais quando fizer sentido.
- Se usar web search, cite fontes ao final como lista.
- Se o usuário pedir para "fazer/criar/enviar" algo no sistema, explique que você é consultor e sugira o que ele mesmo pode configurar no painel (menu de Automações, Copiloto, Push, Cupons, etc.).
- Foco: tendências de mercado, cardápio, precificação, mídia social, retenção, upsell, sazonalidade, campanhas.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...((history ?? []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      }))),
      { role: "user" as const, content: data.message },
    ];

    // Model + optional web search
    // OpenRouter's `:online` suffix enables the web plugin for grounded, cited answers.
    const model = data.web_search
      ? "google/gemini-2.5-flash:online"
      : "google/gemini-2.5-flash";

    const { content: reply, citations } = await callGatewayChat(apiKey, {
      model,
      messages,
      temperature: 0.7,
    });

    // Persist both turns
    await supabase.from("ai_growth_chat").insert([
      {
        user_id: userId,
        thread_id: data.thread_id,
        role: "user",
        content: data.message,
      },
      {
        user_id: userId,
        thread_id: data.thread_id,
        role: "assistant",
        content: reply,
      },
    ]);

    // Bump thread updated_at + auto-title on first exchange
    const isFirst = !(history ?? []).length;
    const auto = data.message.trim().slice(0, 60);
    const patch: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (isFirst && auto) patch.title = auto;
    await supabase
      .from("ai_growth_threads")
      .update(patch)
      .eq("id", data.thread_id)
      .eq("user_id", userId);

    return { reply, kpis, citations, used_web: data.web_search };
  });
