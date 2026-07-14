// Client-callable server functions for the Win-back reactivation feature.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SettingsPatch = z.object({
  enabled: z.boolean().optional(),
  days_inactive: z.number().int().min(7).max(365).optional(),
  min_orders: z.number().int().min(1).max(500).optional(),
  min_lifetime_spent: z.number().min(0).optional(),
  require_phone: z.boolean().optional(),
  cooldown_days: z.number().int().min(7).max(365).optional(),
  max_per_run: z.number().int().min(1).max(500).optional(),
  send_hour: z.number().int().min(0).max(23).optional(),
  send_minute: z.number().int().min(0).max(59).optional(),
  timezone: z.string().min(2).max(64).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  coupon_prefix: z.string().min(2).max(12).optional(),
  discount_type: z.enum(["percent", "fixed"]).optional(),
  discount_value: z.number().positive().optional(),
  min_order: z.number().min(0).optional(),
  validity_days: z.number().int().min(1).max(90).optional(),
  message_template: z.string().min(20).max(1000).optional(),
  push_title: z.string().min(2).max(120).optional(),
  push_body: z.string().min(2).max(240).optional(),
  send_whatsapp: z.boolean().optional(),
  send_push: z.boolean().optional(),
  order_link_path: z.string().min(1).max(120).optional(),
});

async function assertAdminOrManager(supabase: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: isAdmin }, { data: isMgr }] = await Promise.all([
    sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
    sb.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (!isAdmin && !isMgr) throw new Error("Sem permissão.");
  return { isAdmin: !!isAdmin, isManager: !!isMgr };
}

async function assertAdmin(supabase: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores.");
}

export const getWinbackSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("winback_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateWinbackSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SettingsPatch.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("winback_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const previewWinbackCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        days_inactive: z.number().int().min(1).max(365).optional(),
        min_orders: z.number().int().min(1).max(500).optional(),
        min_lifetime_spent: z.number().min(0).optional(),
        require_phone: z.boolean().optional(),
        cooldown_days: z.number().int().min(0).max(365).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    const { data: s } = await context.supabase.from("winback_settings").select("*").eq("id", 1).maybeSingle();
    const settings = (s ?? {}) as Record<string, unknown>;
    const { data: rows, error } = await context.supabase.rpc("get_winback_candidates", {
      _days: data.days_inactive ?? (settings.days_inactive as number) ?? 30,
      _min_orders: data.min_orders ?? (settings.min_orders as number) ?? 1,
      _min_spent: data.min_lifetime_spent ?? (settings.min_lifetime_spent as number) ?? 0,
      _require_phone: data.require_phone ?? (settings.require_phone as boolean) ?? true,
      _cooldown_days: data.cooldown_days ?? (settings.cooldown_days as number) ?? 60,
      _limit: data.limit ?? 100,
    });
    if (error) throw new Error(error.message);
    return { candidates: rows ?? [] };
  });

export const runWinbackNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        user_ids: z.array(z.string().uuid()).max(500).optional(),
        dry_run: z.boolean().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runWinback } = await import("./winback.server");
    return await runWinback({
      supabaseAdmin: supabaseAdmin as never,
      triggeredBy: "manual",
      triggeredUser: context.userId,
      onlyUserIds: data.user_ids ?? null,
      dryRun: data.dry_run ?? false,
    });
  });

export const listWinbackSends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional(),
        user_id: z.string().uuid().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    let q = context.supabase
      .from("winback_sends")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getWinbackStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrManager(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("get_winback_stats");
    if (error) throw new Error(error.message);
    return data as Record<string, number>;
  });
