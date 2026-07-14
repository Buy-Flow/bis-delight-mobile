import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getWaAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("whatsapp_ai_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.string().optional(),
  system_prompt: z.string().max(4000).optional(),
  greeting_message: z.string().max(1000).optional(),
  fallback_message: z.string().max(1000).optional(),
  out_of_hours_message: z.string().max(1000).optional(),
  reply_delay_ms: z.number().int().min(0).max(15000).optional(),
  max_replies_per_hour: z.number().int().min(0).max(500).optional(),
  business_hours_only: z.boolean().optional(),
  pause_after_human_min: z.number().int().min(0).max(1440).optional(),
  handoff_keywords: z.array(z.string().min(1).max(80)).max(50).optional(),
  excluded_phones: z.array(z.string().min(3).max(30)).max(200).optional(),
  send_greeting: z.boolean().optional(),
  allow_stock: z.boolean().optional(),
  allow_price: z.boolean().optional(),
  allow_menu: z.boolean().optional(),
  allow_hours: z.boolean().optional(),
  allow_delivery: z.boolean().optional(),
  allow_promotions: z.boolean().optional(),
});

export const updateWaAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => settingsSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("whatsapp_ai_settings")
      .update(data)
      .eq("id", "default")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const testWaAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { message: string }) =>
    z.object({ message: z.string().min(1).max(1000) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getWaAiSettings } = await import("./whatsapp-ai.server");
    const { generateText, tool, stepCountIs } = await import("ai");
    const { z: zz } = await import("zod");
    const settings = await getWaAiSettings(supabaseAdmin);
    if (!settings) throw new Error("Settings não configurados");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(settings.model);

    // rebuild the same tool set in dry-run — reuse the same code path
    const toolsUsed: any[] = [];
    const modBuild = await import("./whatsapp-ai.server");
    // Since buildTools is not exported, replicate via a minimal set here
    // by calling generateText with a lightweight tool that consults DB.
    const t = (name: string, description: string, schema: any, exec: any) =>
      tool({ description, inputSchema: schema, execute: async (a: any) => {
        const r = await exec(a);
        toolsUsed.push({ name, args: a, result: r });
        return r;
      } });

    const started = Date.now();
    const result = await generateText({
      model,
      system: settings.system_prompt,
      messages: [{ role: "user", content: data.message }],
      tools: {
        check_stock: t("check_stock", "Consulta estoque de ingrediente", zz.object({ item_name: zz.string() }), async ({ item_name }: any) => {
          const { data } = await supabaseAdmin.from("inventory_items").select("name,stock,unit,low_stock_threshold").eq("active", true).ilike("name", `%${item_name}%`).limit(5);
          return { found: (data ?? []).length > 0, items: data };
        }),
        find_product: t("find_product", "Busca produto por nome", zz.object({ query: zz.string() }), async ({ query }: any) => {
          const { data } = await supabaseAdmin.from("products").select("name,category,base_price,paused_until,pause_reason").eq("active", true).ilike("name", `%${query}%`).limit(6);
          return { found: (data ?? []).length > 0, products: data };
        }),
        request_human: t("request_human", "Marca handoff humano", zz.object({ reason: zz.string() }), async ({ reason }: any) => ({ handoff: true, reason })),
      },
      stopWhen: stepCountIs(50),
    });

    return {
      reply: result.text,
      tools_used: toolsUsed,
      latency_ms: Date.now() - started,
      handoff: toolsUsed.some((t) => t.name === "request_human"),
    };
  });

export const listWaAiLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("whatsapp_ai_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const toggleConversationAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { conversation_id: string; ai_disabled?: boolean; pause_minutes?: number }) =>
    z.object({
      conversation_id: z.string().uuid(),
      ai_disabled: z.boolean().optional(),
      pause_minutes: z.number().int().min(0).max(10080).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const patch: any = {};
    if (typeof data.ai_disabled === "boolean") patch.ai_disabled = data.ai_disabled;
    if (typeof data.pause_minutes === "number") {
      patch.ai_paused_until = data.pause_minutes > 0
        ? new Date(Date.now() + data.pause_minutes * 60_000).toISOString()
        : null;
    }
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update(patch)
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
