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
    if (!email) throw new Error("Email inválido");

    // Look up existing auth user by email (paged listing)
    let userId: string | null = null;
    let page = 1;
    while (page <= 20) {
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
      // Grant via admin client (bypass RLS) and log audit manually so it still shows the actor
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: data.role });
      if (insErr && !/(duplicate|unique)/i.test(insErr.message)) {
        throw new Error(insErr.message);
      }
      await supabaseAdmin.from("user_role_audit").insert({
        actor_id: context.userId,
        target_user_id: userId,
        action: "grant",
        role: data.role,
        note: data.note ?? "Papel atribuído diretamente",
      });
      // Ensure a couriers row exists so the person appears in Entregas
      if (data.role === "delivery") {
        const { data: existingCourier } = await supabaseAdmin
          .from("couriers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!existingCourier) {
          await supabaseAdmin.from("couriers").insert({
            user_id: userId,
            name: data.fullName || email.split("@")[0],
            active: true,
          });
        }
      }
      return { status: "granted" as const, userId };
    }

    // No account yet — store as pending; trigger applies on signup.
    // Use admin client to guarantee write regardless of RLS state.
    const { data: existing } = await supabaseAdmin
      .from("pending_role_grants")
      .select("id")
      .eq("email", email)
      .eq("role", data.role)
      .is("applied_at", null)
      .maybeSingle();

    if (existing?.id) {
      const { error: upErr } = await supabaseAdmin
        .from("pending_role_grants")
        .update({
          full_name: data.fullName ?? null,
          note: data.note ?? null,
          granted_by: context.userId,
        })
        .eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await supabaseAdmin.from("pending_role_grants").insert({
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
