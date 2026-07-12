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
 * Invite a new team user by email. Creates the auth user (or reuses if exists),
 * sends an invitation email, and optionally grants a role right away.
 */
export const inviteTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().optional(),
        role: z.enum(ROLES).optional(),
        note: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    let userId: string | null = null;
    let invited = false;

    // Try to invite by email — if user exists, fall back to lookup
    const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: data.fullName ? { full_name: data.fullName } : undefined,
    });
    if (inv?.user) {
      userId = inv.user.id;
      invited = true;
    } else if (invErr) {
      // User may already exist — look them up via listUsers
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      if (match) {
        userId = match.id;
      } else {
        throw new Error(invErr.message || "Falha ao convidar usuário");
      }
    }

    if (!userId) throw new Error("Não foi possível localizar/criar o usuário");

    // Best-effort profile update
    if (data.fullName) {
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName })
        .eq("id", userId);
    }

    if (data.role) {
      const { error: grantErr } = await context.supabase.rpc("admin_grant_role", {
        _target: userId,
        _role: data.role,
        _note: data.note ?? (invited ? "Convite enviado" : "Papel atribuído"),
      });
      if (grantErr) throw new Error(grantErr.message);
    }

    return { userId, invited };
  });

/**
 * Send a password-reset / magic re-invite email to an existing user.
 */
export const resendUserInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email.trim().toLowerCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });
