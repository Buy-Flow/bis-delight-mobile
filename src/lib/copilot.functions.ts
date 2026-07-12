import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export type CopilotThread = {
  id: string;
  title: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const listCopilotThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("copilot_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as CopilotThread[];
  });

export const createCopilotThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { title?: string }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const title = (data.title ?? "Nova conversa").slice(0, 80);
    const { data: row, error } = await context.supabase
      .from("copilot_threads")
      .insert({ user_id: context.userId, title })
      .select("id,title,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as CopilotThread;
  });

export const renameCopilotThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; title: string }) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(80) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("copilot_threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCopilotThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; revertActions?: boolean }) =>
    z.object({ id: z.string().uuid(), revertActions: z.boolean().optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let reverted = 0;
    if (data.revertActions) reverted = await revertActionsForThread(data.id);
    await context.supabase.from("copilot_messages").delete().eq("thread_id", data.id);
    await context.supabase.from("copilot_actions").delete().eq("thread_id", data.id);
    const { error } = await context.supabase.from("copilot_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, reverted };
  });

export const revertCopilotThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const reverted = await revertActionsForThread(data.id);
    return { ok: true, reverted };
  });

async function revertActionsForThread(threadId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;
  const { data: actions } = await sb
    .from("copilot_actions")
    .select("id,action_type,params,result,status,target_table,target_id,reverted_at")
    .eq("thread_id", threadId)
    .eq("status", "executed")
    .is("reverted_at", null)
    .order("created_at", { ascending: false });
  const rows = (actions ?? []) as Array<{
    id: string;
    action_type: string;
    params: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    target_table: string | null;
    target_id: string | null;
  }>;
  let count = 0;
  for (const a of rows) {
    try {
      switch (a.action_type) {
        case "criar_popup":
          if (a.target_id) await sb.from("site_popups").update({ active: false }).eq("id", a.target_id);
          break;
        case "criar_cupom":
          if (a.target_id) await sb.from("promo_coupons").update({ active: false }).eq("id", a.target_id);
          break;
        case "pausar_produto":
          if (a.target_id) await sb.from("products").update({ paused_until: null, pause_reason: null }).eq("id", a.target_id);
          break;
        case "banner_urgencia":
          if (a.target_id) await sb.from("site_settings").update({ urgency_active: false }).eq("id", a.target_id);
          break;
        case "forcar_status_loja":
          if (a.target_id) await sb.from("site_settings").update({ open_override: null }).eq("id", a.target_id);
          break;
        case "criar_categoria":
          if (a.target_id) await sb.from("categories").delete().eq("id", a.target_id);
          break;
        case "desconto_massa": {
          const updates = (a.result?.updates as Array<{ id: string; from: number }> | undefined) ?? [];
          for (const u of updates) {
            await sb.from("products").update({ base_price: u.from }).eq("id", u.id);
          }
          break;
        }
        default:
          continue;
      }
      await sb.from("copilot_actions").update({ reverted_at: new Date().toISOString() }).eq("id", a.id);
      count++;
    } catch (e) {
      console.error("[copilot revert]", a.action_type, e);
    }
  }
  return count;
}

export const getCopilotThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("copilot_messages")
      .select("id,role,parts,created_at")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const messages = ((rows ?? []) as Array<{ id: string; role: string; parts: unknown }>).map(r => ({
      id: r.id,
      role: r.role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parts: JSON.parse(JSON.stringify(r.parts ?? [])) as any,
    }));
    return messages;
  });

export const listCopilotActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { threadId?: string | null }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("copilot_actions")
      .select("id,action_type,params,result,status,target_table,target_id,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.threadId) q = q.eq("thread_id", data.threadId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
