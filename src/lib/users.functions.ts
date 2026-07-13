import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["admin", "manager", "staff", "kitchen", "delivery", "user"] as const;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/**
 * Attribui um papel diretamente a um email — sem envio de convite.
 * - Se o email já tem conta: concede o papel imediatamente.
 * - Se ainda não tem conta: registra em `pending_role_grants` e o papel
 *   é aplicado automaticamente quando a pessoa criar conta com esse email.
 */
export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().optional(),
        role: z.enum(ROLES),
        note: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    // Look up existing auth user by email
    let userId: string | null = null;
    let page = 1;
    while (page <= 10) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const match = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      if (match) { userId = match.id; break; }
      if (!list?.users || list.users.length < 200) break;
      page++;
    }

    if (userId) {
      if (data.fullName) {
        await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", userId);
      }
      const { error: grantErr } = await context.supabase.rpc("admin_grant_role", {
        _target: userId,
        _role: data.role,
        _note: data.note ?? "Papel atribuído diretamente",
      });
      if (grantErr) throw new Error(grantErr.message);
      return { status: "granted" as const, userId };
    }

    // No account yet — store as pending, applied on signup via trigger
    const { error: pendErr } = await context.supabase
      .from("pending_role_grants")
      .upsert(
        {
          email,
          role: data.role,
          full_name: data.fullName ?? null,
          note: data.note ?? null,
          granted_by: context.userId,
          applied_at: null,
          applied_user_id: null,
        },
        { onConflict: "email,role", ignoreDuplicates: false },
      );
    if (pendErr) {
      // fallback: plain insert if upsert conflict target isn't accepted
      const { error: insErr } = await context.supabase.from("pending_role_grants").insert({
        email,
        role: data.role,
        full_name: data.fullName ?? null,
        note: data.note ?? null,
        granted_by: context.userId,
      });
      if (insErr) throw new Error(insErr.message);
    }
    return { status: "pending" as const, userId: null };
  });
