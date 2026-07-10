import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
        userAgent: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        endpoint: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendAdminTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Apenas administradores podem enviar teste de notificação.");

    const projectUrl = process.env.SUPABASE_URL;
    const notifyToken = process.env.ORDER_NOTIFY_TOKEN;
    if (!projectUrl || !notifyToken) throw new Error("Configuração de notificação incompleta.");

    const response = await fetch(`${projectUrl}/functions/v1/notify-admin-order`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${notifyToken}`,
      },
      body: JSON.stringify({ test: true, userId: context.userId }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      sent?: number;
      total?: number;
      failed?: number;
      error?: string;
    };

    if (!response.ok) throw new Error(result.error || "Falha ao enviar teste de notificação.");
    return {
      sent: Number(result.sent ?? 0),
      total: Number(result.total ?? 0),
      failed: Number(result.failed ?? 0),
    };
  });