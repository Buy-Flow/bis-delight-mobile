import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UIMessage } from "ai";

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
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("copilot_messages").delete().eq("thread_id", data.id);
    await context.supabase.from("copilot_actions").delete().eq("thread_id", data.id);
    const { error } = await context.supabase.from("copilot_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
    const messages: UIMessage[] = ((rows ?? []) as Array<{ id: string; role: string; parts: unknown }>).map(r => ({
      id: r.id,
      role: r.role as UIMessage["role"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parts: (r.parts ?? []) as any,
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
