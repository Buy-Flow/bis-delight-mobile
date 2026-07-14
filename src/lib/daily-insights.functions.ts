// Client-callable server functions for the Proactive Copilot (daily insights).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SettingsPatch = z.object({
  enabled: z.boolean().optional(),
  timezone: z.string().min(2).max(64).optional(),
  send_hour: z.number().int().min(0).max(23).optional(),
  send_minute: z.number().int().min(0).max(59).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  min_severity: z.enum(["info", "warning", "critical"]).optional(),
  compare_window_days: z.number().int().min(1).max(60).optional(),
  category_drop_threshold: z.number().min(1).max(100).optional(),
  product_drop_threshold: z.number().min(1).max(100).optional(),
  revenue_drop_threshold: z.number().min(1).max(100).optional(),
  rating_drop_threshold: z.number().min(0.1).max(5).optional(),
  cart_abandon_threshold: z.number().min(1).max(100).optional(),
  monitor_categories: z.boolean().optional(),
  monitor_products: z.boolean().optional(),
  monitor_revenue: z.boolean().optional(),
  monitor_reviews: z.boolean().optional(),
  monitor_carts: z.boolean().optional(),
  monitor_new_customers: z.boolean().optional(),
  send_whatsapp: z.boolean().optional(),
  whatsapp_target: z.string().max(30).nullable().optional(),
  send_push: z.boolean().optional(),
  ai_tone: z.enum(["coach", "direto", "descontraido", "executivo"]).optional(),
  ai_model: z.string().min(2).max(80).optional(),
  max_insights_per_run: z.number().int().min(1).max(20).optional(),
});

async function assertAdminOrManager(sb: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sb as any;
  const [a, m] = await Promise.all([
    s.rpc("has_role", { _user_id: userId, _role: "admin" }),
    s.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (!a.data && !m.data) throw new Error("Sem permissão.");
}
async function assertAdmin(sb: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sb as any;
  const { data } = await s.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores.");
}

export const getDailyInsightSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("daily_insight_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateDailyInsightSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SettingsPatch.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("daily_insight_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const runDailyInsightsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ dry_run: z.boolean().optional() }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runDailyInsights } = await import("./daily-insights.server");
    return await runDailyInsights({
      supabaseAdmin: supabaseAdmin as never,
      triggeredBy: "manual",
      dryRun: data.dry_run ?? false,
    });
  });

export const listDailyInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      status: z.enum(["all", "new", "read", "done", "dismissed", "snoozed"]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    let q = context.supabase.from("daily_insights").select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateInsightStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "read", "done", "dismissed", "snoozed"]),
      snoozed_until: z.string().optional(),
      notes: z.string().max(600).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "read") patch.read_at = new Date().toISOString();
    if (data.status === "done" || data.status === "dismissed") patch.resolved_at = new Date().toISOString();
    if (data.status === "snoozed" && data.snoozed_until) patch.snoozed_until = data.snoozed_until;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await context.supabase.from("daily_insights").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("daily_insights").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInsightStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    const sb = context.supabase;
    const [total, newN, done, critical] = await Promise.all([
      sb.from("daily_insights").select("id", { count: "exact", head: true }),
      sb.from("daily_insights").select("id", { count: "exact", head: true }).eq("status", "new"),
      sb.from("daily_insights").select("id", { count: "exact", head: true }).eq("status", "done"),
      sb.from("daily_insights").select("id", { count: "exact", head: true })
        .eq("severity", "critical").eq("status", "new"),
    ]);
    return {
      total: total.count ?? 0,
      new: newN.count ?? 0,
      done: done.count ?? 0,
      critical: critical.count ?? 0,
    };
  });
