import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Garante que o usuário logado tenha um registro em `couriers` vinculado ao
 * seu `user_id`. Fluxo:
 *  1. Se já existe courier com `user_id` = auth.uid → retorna.
 *  2. Se o usuário tem papel `delivery` e existe um courier sem `user_id`
 *     com o mesmo email do perfil → vincula.
 *  3. Se o usuário tem papel `delivery` e nenhum courier existente casa
 *     → cria um courier básico (nome do perfil, sem veículo definido) e
 *     vincula.
 *  4. Se o usuário NÃO tem papel `delivery` → retorna { linked: false }.
 */
export const ensureCourierLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    // 1) Já vinculado?
    const { data: existing } = await supabase
      .from("couriers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.id) return { linked: true, courierId: existing.id, created: false };

    // Confirma papel `delivery` antes de criar/vincular.
    const { data: hasDelivery } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "delivery",
    });
    if (!hasDelivery) return { linked: false, reason: "no_delivery_role" };

    // Precisamos do email/nome. Perfil não expõe email; usamos claims + profiles.
    const email = (context.claims?.email as string | undefined)?.toLowerCase() ?? null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2) Tenta casar por email em couriers órfãos (user_id null).
    if (email) {
      const { data: byEmail } = await supabaseAdmin
        .from("couriers")
        .select("id, user_id")
        .ilike("email", email)
        .is("user_id", null)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) {
        const { error: linkErr } = await supabaseAdmin
          .from("couriers")
          .update({ user_id: userId })
          .eq("id", byEmail.id);
        if (linkErr) throw new Error(linkErr.message);
        return { linked: true, courierId: byEmail.id, created: false };
      }
    }

    // 3) Cria um novo registro operacional mínimo.
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      name: profile?.full_name || email?.split("@")[0] || "Motoboy",
      phone: profile?.phone ?? null,
      email: email,
      vehicle: "moto",
      active: true,
      status: "offline",
    };
    const { data: created, error: createErr } = await supabaseAdmin
      .from("couriers")
      .insert(insertPayload)
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    return { linked: true, courierId: created.id, created: true };
  });
