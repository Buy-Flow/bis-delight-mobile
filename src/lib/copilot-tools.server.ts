import { tool } from "ai";
import { z } from "zod";
import { generateAndUploadBanner } from "./copilot-image.server";

type SB = {
  from: (t: string) => {
    select: (cols?: string) => {
      eq: (c: string, v: unknown) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
      ilike?: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      order?: (c: string, o?: { ascending?: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    insert: (v: unknown) => {
      select: (c?: string) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (v: unknown) => {
      eq: (c: string, v: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
  rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  storage: unknown;
};

type Ctx = {
  supabaseAdmin: SB;
  apiKey: string;
  userId: string;
  threadId?: string | null;
};

async function logAction(ctx: Ctx, opts: {
  action_type: string;
  params: unknown;
  result?: unknown;
  status?: "executed" | "failed";
  target_table?: string | null;
  target_id?: string | null;
}) {
  try {
    await ctx.supabaseAdmin.from("copilot_actions").insert({
      user_id: ctx.userId,
      thread_id: ctx.threadId ?? null,
      action_type: opts.action_type,
      params: opts.params,
      result: opts.result ?? null,
      status: opts.status ?? "executed",
      target_table: opts.target_table ?? null,
      target_id: opts.target_id ?? null,
    });
  } catch {
    /* ignore log failures */
  }
}

export function buildCopilotTools(ctx: Ctx) {
  return {
    resumo_status: tool({
      description:
        "Retorna um panorama rápido da loja: nome, se está aberta agora, pedidos ativos, top categorias, quantidade de assinaturas de push. Use para se orientar antes de criar campanhas.",
      inputSchema: z.object({}),
      execute: async () => {
        const sb = ctx.supabaseAdmin;
        const [settings, orders, subs, cats] = await Promise.all([
          sb.from("site_settings").select("*").limit(1),
          sb.from("orders").select("id,status,total,created_at").order?.("created_at", { ascending: false }).limit(50) ?? Promise.resolve({ data: [], error: null }),
          sb.from("push_subscriptions").select("id").limit(9999),
          sb.from("categories").select("id,name,active").limit(50),
        ]);
        return {
          settings: (settings.data as unknown[])?.[0] ?? null,
          recent_orders_count: (orders as { data?: unknown[] }).data?.length ?? 0,
          push_subscribers: (subs.data as unknown[])?.length ?? 0,
          categories: (cats.data as unknown[]) ?? [],
        };
      },
    }),

    buscar_produtos: tool({
      description:
        "Lista produtos filtrados por categoria (opcional) ou por texto no nome. Use para descobrir IDs antes de pausar/despausar. Retorna até 30 itens.",
      inputSchema: z.object({
        categoria: z.string().nullable().describe("ID da categoria (ex: 'shakes','acai','sorvetes'). Deixe null para todas."),
        busca_nome: z.string().nullable().describe("Termo para buscar no nome. Null para não filtrar."),
      }),
      execute: async ({ categoria, busca_nome }) => {
        const q = ctx.supabaseAdmin.from("products").select("id,name,category,base_price,active,paused_until,pause_reason,stock");
        // simple approach: fetch and filter in JS since typed chain differs
        const { data, error } = await q.limit(500);
        if (error) throw new Error(error.message);
        let rows = ((data as Array<Record<string, unknown>>) ?? []).filter(r => r.active !== false);
        if (categoria) rows = rows.filter(r => String(r.category).toLowerCase() === categoria.toLowerCase());
        if (busca_nome) {
          const t = busca_nome.toLowerCase();
          rows = rows.filter(r => String(r.name).toLowerCase().includes(t));
        }
        return { count: rows.length, produtos: rows.slice(0, 30) };
      },
    }),

    gerar_imagem_banner: tool({
      description:
        "Gera uma imagem de banner promocional com IA e retorna uma URL usável em popups/campanhas. SEMPRE chame esta ferramenta ANTES de criar um popup que precise de imagem. O prompt deve descrever o conteúdo visual (ex: 'promoção relâmpago 20% off milk shakes, com copo derretendo neon').",
      inputSchema: z.object({
        prompt: z.string().min(4).describe("Descrição visual da imagem em português ou inglês. Não precisa incluir estilo — a marca é aplicada automaticamente."),
      }),
      execute: async ({ prompt }) => {
        try {
          const r = await generateAndUploadBanner({
            prompt,
            apiKey: ctx.apiKey,
            supabaseAdmin: ctx.supabaseAdmin as unknown as Parameters<typeof generateAndUploadBanner>[0]["supabaseAdmin"],
          });
          await logAction(ctx, { action_type: "gerar_imagem_banner", params: { prompt }, result: r, target_table: "storage", target_id: r.key });
          return { image_url: r.image_url, key: r.key };
        } catch (e) {
          await logAction(ctx, { action_type: "gerar_imagem_banner", params: { prompt }, status: "failed", result: { error: String(e) } });
          throw e;
        }
      },
    }),

    criar_popup: tool({
      description:
        "Cria um popup no site com título, corpo, imagem, CTA e agendamento. Use após gerar_imagem_banner. O popup fica ativo entre starts_at e ends_at.",
      inputSchema: z.object({
        name: z.string().describe("Nome interno do popup (ex: 'Promoção relâmpago shakes 16h')"),
        title: z.string().max(60).describe("Título curto que aparece no popup"),
        body: z.string().max(140).describe("Texto principal. Se houver cupom, inclua o código aqui."),
        image_url: z.string().url().describe("URL da imagem (use a retornada por gerar_imagem_banner)"),
        cta: z.string().max(20).describe("Texto do botão (ex: 'Aproveitar')"),
        link: z.string().default("/cardapio").describe("Rota para onde o CTA leva. Padrão '/cardapio'"),
        starts_at: z.string().describe("Data/hora ISO 8601 de início (ex: '2026-07-11T16:00:00-03:00')"),
        ends_at: z.string().describe("Data/hora ISO 8601 de término"),
        priority: z.number().int().default(50),
      }),
      execute: async (input) => {
        const { data, error } = await ctx.supabaseAdmin
          .from("site_popups")
          .insert({
            name: input.name,
            title: input.title,
            body: input.body,
            image_url: input.image_url,
            cta: input.cta,
            link: input.link,
            priority: input.priority,
            active: true,
            frequency: "once_per_session",
            audience: "all",
            days_of_week: [0, 1, 2, 3, 4, 5, 6],
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            image_pos_x: 0,
            image_pos_y: 0,
            image_scale: 1,
          })
          .select("id,name,title,starts_at,ends_at")
          .single();
        if (error) {
          await logAction(ctx, { action_type: "criar_popup", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro ao criar popup: " + error.message);
        }
        const row = data as { id: string };
        await logAction(ctx, { action_type: "criar_popup", params: input, result: data, target_table: "site_popups", target_id: row.id });
        return { ok: true, popup: data };
      },
    }),

    criar_cupom: tool({
      description:
        "Cria um cupom de desconto na loja. Códigos em MAIÚSCULAS e sem espaços/acentos. Aprovação automática se discount_value ≤ 20 (fixed ou percentage) e max_uses ≤ 100; caso contrário, você deve confirmar com o admin no chat antes de chamar.",
      inputSchema: z.object({
        code: z.string().min(3).max(20).describe("Código curto MAIÚSCULO sem espaços (ex: 'SHAKE20')"),
        discount_type: z.enum(["fixed", "percent"]).describe("'fixed' = R$ fixo; 'percent' = % do total"),
        discount_value: z.number().positive().describe("Valor do desconto (em R$ ou %)"),
        min_order: z.number().min(0).default(0).describe("Pedido mínimo em R$"),
        max_uses: z.number().int().positive().nullable().describe("Total de usos permitidos (null = ilimitado)"),
        per_user_limit: z.number().int().positive().default(1),
        expires_at: z.string().nullable().describe("ISO 8601 de expiração (null = sem expiração)"),
        note: z.string().nullable().describe("Nota interna sobre a campanha"),
      }),
      execute: async (input) => {
        const code = input.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const { data, error } = await ctx.supabaseAdmin
          .from("promo_coupons")
          .insert({
            code,
            discount_type: input.discount_type,
            discount_value: input.discount_value,
            min_order: input.min_order,
            max_uses: input.max_uses,
            per_user_limit: input.per_user_limit,
            expires_at: input.expires_at,
            note: input.note,
            active: true,
          })
          .select("id,code,discount_type,discount_value,expires_at,max_uses")
          .single();
        if (error) {
          await logAction(ctx, { action_type: "criar_cupom", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro ao criar cupom: " + error.message);
        }
        const row = data as { id: string };
        await logAction(ctx, { action_type: "criar_cupom", params: input, result: data, target_table: "promo_coupons", target_id: row.id });
        return { ok: true, cupom: data };
      },
    }),

    pausar_produto: tool({
      description:
        "Pausa um produto até um horário (paused_until). Use quando 'acabou o morango hoje' etc. Passe o ID do produto (encontre com buscar_produtos).",
      inputSchema: z.object({
        product_id: z.string().describe("ID do produto"),
        paused_until: z.string().describe("ISO 8601 até quando fica pausado"),
        pause_reason: z.string().max(60).describe("Motivo curto (ex: 'Sem morango hoje')"),
      }),
      execute: async (input) => {
        const { error } = await ctx.supabaseAdmin
          .from("products")
          .update({ paused_until: input.paused_until, pause_reason: input.pause_reason })
          .eq("id", input.product_id);
        if (error) {
          await logAction(ctx, { action_type: "pausar_produto", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro ao pausar: " + error.message);
        }
        await logAction(ctx, { action_type: "pausar_produto", params: input, result: { ok: true }, target_table: "products", target_id: input.product_id });
        return { ok: true };
      },
    }),

    despausar_produto: tool({
      description: "Remove a pausa temporária de um produto.",
      inputSchema: z.object({
        product_id: z.string(),
      }),
      execute: async (input) => {
        const { error } = await ctx.supabaseAdmin
          .from("products")
          .update({ paused_until: null, pause_reason: null })
          .eq("id", input.product_id);
        if (error) throw new Error("Erro ao despausar: " + error.message);
        await logAction(ctx, { action_type: "despausar_produto", params: input, result: { ok: true }, target_table: "products", target_id: input.product_id });
        return { ok: true };
      },
    }),

    banner_urgencia: tool({
      description:
        "Configura o banner de urgência com contagem regressiva que aparece no topo do site. Passe título curto e endsAt (ISO). Passe 'disable: true' para desligar.",
      inputSchema: z.object({
        disable: z.boolean().default(false),
        title: z.string().nullable(),
        ends_at: z.string().nullable().describe("ISO 8601 do fim da urgência"),
      }),
      execute: async (input) => {
        const { data: rows } = await ctx.supabaseAdmin.from("site_settings").select("id").limit(1);
        const list = (rows as Array<{ id: string }>) ?? [];
        if (!list.length) throw new Error("site_settings vazio");
        const id = list[0].id;
        const patch: Record<string, unknown> = { urgency_active: !input.disable };
        if (input.title) patch.urgency_text = input.title;
        if (input.ends_at) patch.urgency_ends_at = input.ends_at;
        const { error } = await ctx.supabaseAdmin.from("site_settings").update(patch).eq("id", id);
        if (error) throw new Error("Erro: " + error.message);
        await logAction(ctx, { action_type: "banner_urgencia", params: input, result: { ok: true }, target_table: "site_settings", target_id: id });
        return { ok: true, patch };
      },
    }),

    disparar_push: tool({
      description:
        "Cria uma campanha de push notification e a dispara para o público segmentado. ⚠️ AÇÃO IRREVERSÍVEL. SEMPRE confirme no chat com o admin ANTES de chamar (ex: 'Vou disparar pra 312 pessoas, ok?') e aguarde ele responder afirmativamente ANTES de usar esta ferramenta.",
      inputSchema: z.object({
        title: z.string().max(60),
        body: z.string().max(160),
        url: z.string().default("/cardapio"),
        audience: z.enum(["all", "vip", "abandoned", "category"]).default("all"),
        audience_category: z.string().nullable().describe("Se audience='category', qual categoria (ex: 'shakes')"),
        image: z.string().nullable().describe("URL da imagem do push (opcional)"),
      }),
      execute: async (input) => {
        const { data, error } = await ctx.supabaseAdmin
          .from("push_campaigns")
          .insert({
            title: input.title,
            body: input.body,
            url: input.url,
            audience: input.audience,
            audience_category: input.audience_category,
            image: input.image,
            status: "sending",
            created_by: ctx.userId,
          })
          .select("id,title,audience,audience_category")
          .single();
        if (error) {
          await logAction(ctx, { action_type: "disparar_push", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro: " + error.message);
        }
        const campaign = data as { id: string };
        // Trigger edge function send-push
        try {
          const supaUrl = process.env.SUPABASE_URL!;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          await fetch(`${supaUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({ campaignId: campaign.id }),
          });
        } catch (e) {
          console.error("send-push invoke failed", e);
        }
        await logAction(ctx, { action_type: "disparar_push", params: input, result: data, target_table: "push_campaigns", target_id: campaign.id });
        return { ok: true, campaign: data };
      },
    }),

    atualizar_produto: tool({
      description:
        "Atualiza campos de um produto existente: preço, nome, descrição, badge, ativo/inativo, hero, categoria. Passe apenas os campos que quer mudar (os outros ficam iguais). Use buscar_produtos primeiro pra pegar o ID.",
      inputSchema: z.object({
        product_id: z.string().describe("ID do produto"),
        name: z.string().nullable(),
        description: z.string().nullable(),
        base_price: z.number().positive().nullable().describe("Novo preço base em R$"),
        category: z.string().nullable().describe("Novo id de categoria (ex: 'shakes')"),
        badge: z.string().nullable().describe("Selo curto ex: 'NOVO', 'PROMO', 'MAIS PEDIDO'"),
        active: z.boolean().nullable(),
        hero: z.boolean().nullable().describe("Destaque na home"),
      }),
      execute: async (input) => {
        const patch: Record<string, unknown> = {};
        if (input.name !== null) patch.name = input.name;
        if (input.description !== null) patch.description = input.description;
        if (input.base_price !== null) patch.base_price = input.base_price;
        if (input.category !== null) patch.category = input.category;
        if (input.badge !== null) patch.badge = input.badge;
        if (input.active !== null) patch.active = input.active;
        if (input.hero !== null) patch.hero = input.hero;
        if (!Object.keys(patch).length) return { ok: true, noop: true };
        const { error } = await ctx.supabaseAdmin.from("products").update(patch).eq("id", input.product_id);
        if (error) {
          await logAction(ctx, { action_type: "atualizar_produto", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro ao atualizar: " + error.message);
        }
        await logAction(ctx, { action_type: "atualizar_produto", params: input, result: { ok: true, patch }, target_table: "products", target_id: input.product_id });
        return { ok: true, patch };
      },
    }),

    desconto_massa: tool({
      description:
        "Aplica um desconto percentual em vários produtos ao mesmo tempo. IMPORTANTE: se categoria=null E product_ids=null, aplica em TODOS os produtos ativos da loja — isso é totalmente suportado e esperado. Salva o preço original em original_price para permitir reverter depois com reverter_desconto_massa. ⚠️ Confirme com o admin ANTES (mostre quantos produtos e o %) e aguarde 'ok'.",
      inputSchema: z.object({
        percent_off: z.number().min(1).max(90).describe("Desconto em % (1-90)"),
        categoria: z.string().nullable().describe("ID de categoria. Null = todas."),
        product_ids: z.array(z.string()).nullable().describe("Lista de IDs específicos. Null = todos que passam no filtro categoria."),
      }),
      execute: async (input) => {
        const { data: rows, error: qErr } = await ctx.supabaseAdmin.from("products").select("id,name,base_price,category,active,original_price").limit(2000);
        if (qErr) throw new Error(qErr.message);
        let list = ((rows as Array<{ id: string; name: string; base_price: number; category: string; active: boolean; original_price: number | null }>) ?? []).filter(r => r.active !== false);
        if (input.categoria) list = list.filter(r => String(r.category).toLowerCase() === input.categoria!.toLowerCase());
        if (input.product_ids && input.product_ids.length) list = list.filter(r => input.product_ids!.includes(r.id));
        if (!list.length) throw new Error("Nenhum produto encontrado com esse filtro.");
        const factor = 1 - input.percent_off / 100;
        const updates: Array<{ id: string; name: string; from: number; to: number }> = [];
        for (const p of list) {
          const baseline = p.original_price ?? p.base_price;
          const newPrice = Math.round(baseline * factor * 100) / 100;
          const patch: Record<string, unknown> = { base_price: newPrice };
          if (p.original_price == null) patch.original_price = p.base_price;
          const { error } = await ctx.supabaseAdmin.from("products").update(patch).eq("id", p.id);
          if (!error) updates.push({ id: p.id, name: p.name, from: p.base_price, to: newPrice });
        }
        await logAction(ctx, { action_type: "desconto_massa", params: input, result: { count: updates.length, updates } });
        return { ok: true, updated: updates.length, percent_off: input.percent_off, sample: updates.slice(0, 5) };
      },
    }),

    reverter_desconto_massa: tool({
      description:
        "Reverte descontos em massa: restaura base_price a partir de original_price para os produtos afetados. Passe categoria/product_ids para escopo, ou ambos null para reverter TODOS os produtos com original_price salvo.",
      inputSchema: z.object({
        categoria: z.string().nullable(),
        product_ids: z.array(z.string()).nullable(),
      }),
      execute: async (input) => {
        const { data: rows, error } = await ctx.supabaseAdmin.from("products").select("id,name,base_price,category,original_price").limit(2000);
        if (error) throw new Error(error.message);
        let list = ((rows as Array<{ id: string; name: string; base_price: number; category: string; original_price: number | null }>) ?? []).filter(r => r.original_price != null);
        if (input.categoria) list = list.filter(r => String(r.category).toLowerCase() === input.categoria!.toLowerCase());
        if (input.product_ids && input.product_ids.length) list = list.filter(r => input.product_ids!.includes(r.id));
        if (!list.length) throw new Error("Nenhum produto com preço original salvo para reverter.");
        const restored: Array<{ id: string; name: string; from: number; to: number }> = [];
        for (const p of list) {
          const { error: e } = await ctx.supabaseAdmin.from("products").update({ base_price: p.original_price, original_price: null }).eq("id", p.id);
          if (!e) restored.push({ id: p.id, name: p.name, from: p.base_price, to: p.original_price! });
        }
        await logAction(ctx, { action_type: "reverter_desconto_massa", params: input, result: { count: restored.length, restored } });
        return { ok: true, restored: restored.length, sample: restored.slice(0, 5) };
      },
    }),


    atualizar_config_loja: tool({
      description:
        "Atualiza configurações globais da loja: nome, taxa de entrega, pedido mínimo, cores, texturas, redes sociais, WhatsApp, endereço. Passe só os campos que quer mudar (outros ficam iguais).",
      inputSchema: z.object({
        name: z.string().nullable(),
        tagline: z.string().nullable(),
        delivery_fee: z.number().min(0).nullable().describe("Taxa de entrega em R$"),
        min_order: z.number().min(0).nullable().describe("Pedido mínimo em R$"),
        free_delivery_threshold: z.number().min(0).nullable().describe("Frete grátis a partir de R$"),
        whatsapp: z.string().nullable(),
        instagram: z.string().nullable(),
        address: z.string().nullable(),
        announcement_text: z.string().nullable().describe("Texto do anúncio no topo do site"),
        announcement_active: z.boolean().nullable(),
        accepts_delivery: z.boolean().nullable(),
        accepts_pickup: z.boolean().nullable(),
        bg_color: z.string().nullable().describe("Cor de fundo hex ex: #0b0518"),
        accent_color: z.string().nullable().describe("Cor de destaque hex ex: #facc15"),
      }),
      execute: async (input) => {
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input)) if (v !== null) patch[k] = v;
        if (!Object.keys(patch).length) return { ok: true, noop: true };
        const { data: rows } = await ctx.supabaseAdmin.from("site_settings").select("id").limit(1);
        const id = (rows as Array<{ id: number }>)?.[0]?.id ?? 1;
        const { error } = await ctx.supabaseAdmin.from("site_settings").update(patch).eq("id", id);
        if (error) {
          await logAction(ctx, { action_type: "atualizar_config_loja", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro ao atualizar config: " + error.message);
        }
        await logAction(ctx, { action_type: "atualizar_config_loja", params: input, result: { ok: true, patch }, target_table: "site_settings", target_id: String(id) });
        return { ok: true, patch };
      },
    }),

    forcar_status_loja: tool({
      description:
        "Força o status da loja: 'open' força aberta, 'closed' força fechada, null volta ao horário automático. Use pra fechar antes da hora ou abrir excepcionalmente.",
      inputSchema: z.object({
        override: z.enum(["open", "closed", "auto"]).describe("'open', 'closed' ou 'auto'"),
      }),
      execute: async (input) => {
        const val = input.override === "auto" ? null : input.override;
        const { data: rows } = await ctx.supabaseAdmin.from("site_settings").select("id").limit(1);
        const id = (rows as Array<{ id: number }>)?.[0]?.id ?? 1;
        const { error } = await ctx.supabaseAdmin.from("site_settings").update({ open_override: val }).eq("id", id);
        if (error) throw new Error("Erro: " + error.message);
        await logAction(ctx, { action_type: "forcar_status_loja", params: input, result: { override: val }, target_table: "site_settings", target_id: String(id) });
        return { ok: true, override: val };
      },
    }),

    atualizar_novidades_home: tool({
      description:
        "Configura a seção de novidades da home (news_title, subtitle, ticker rodando embaixo do hero). Passe null pros campos que quer manter, ou active=false pra desligar.",
      inputSchema: z.object({
        active: z.boolean().nullable(),
        title: z.string().nullable(),
        subtitle: z.string().nullable(),
        ticker: z.string().nullable().describe("Texto do ticker rolante"),
      }),
      execute: async (input) => {
        const patch: Record<string, unknown> = {};
        if (input.active !== null) patch.news_active = input.active;
        if (input.title !== null) patch.news_title = input.title;
        if (input.subtitle !== null) patch.news_subtitle = input.subtitle;
        if (input.ticker !== null) patch.news_ticker = input.ticker;
        if (!Object.keys(patch).length) return { ok: true, noop: true };
        const { data: rows } = await ctx.supabaseAdmin.from("site_settings").select("id").limit(1);
        const id = (rows as Array<{ id: number }>)?.[0]?.id ?? 1;
        const { error } = await ctx.supabaseAdmin.from("site_settings").update(patch).eq("id", id);
        if (error) throw new Error("Erro: " + error.message);
        await logAction(ctx, { action_type: "atualizar_novidades_home", params: input, result: patch, target_table: "site_settings", target_id: String(id) });
        return { ok: true, patch };
      },
    }),

    criar_categoria: tool({
      description:
        "Cria uma nova categoria de produtos. O id deve ser um slug curto minúsculo sem espaços (ex: 'combos'). Emoji opcional.",
      inputSchema: z.object({
        id: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/, "slug minúsculo sem espaço"),
        name: z.string().min(2).max(40),
        emoji: z.string().max(4).nullable(),
      }),
      execute: async (input) => {
        const { data, error } = await ctx.supabaseAdmin
          .from("categories")
          .insert({ id: input.id, name: input.name, emoji: input.emoji ?? "🍧", active: true, sort_order: 999 })
          .select("id,name")
          .single();
        if (error) {
          await logAction(ctx, { action_type: "criar_categoria", params: input, status: "failed", result: { error: error.message } });
          throw new Error("Erro ao criar categoria: " + error.message);
        }
        await logAction(ctx, { action_type: "criar_categoria", params: input, result: data, target_table: "categories", target_id: input.id });
        return { ok: true, categoria: data };
      },
    }),
  };
}
