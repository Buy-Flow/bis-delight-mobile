import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Garante que o usuário logado tenha um registro em `couriers` vinculado ao
 * seu `user_id`. Fluxo:
 *  1. Se já existe courier com `user_id` = auth.uid → retorna.
 *  2. Se o usuário tem papel `delivery` e existe um courier órfão
 *     (user_id NULL) com o mesmo telefone do perfil → vincula.
 *  3. Se o usuário tem papel `delivery` e nenhum courier existente casa
 *     → cria um courier básico e vincula.
 *  4. Se o usuário NÃO tem papel `delivery` → retorna { linked: false }.
 */
export const ensureCourierLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: existing } = await supabase
      .from("couriers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.id) return { linked: true, courierId: existing.id, created: false };

    const { data: hasDelivery } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "delivery",
    });
    if (!hasDelivery) return { linked: false, reason: "no_delivery_role" as const };

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2) Tenta casar por telefone em couriers órfãos (user_id null).
    if (profile?.phone) {
      const { data: byPhone } = await supabaseAdmin
        .from("couriers")
        .select("id, user_id")
        .eq("phone", profile.phone)
        .is("user_id", null)
        .limit(1)
        .maybeSingle();
      if (byPhone?.id) {
        const { error: linkErr } = await supabaseAdmin
          .from("couriers")
          .update({ user_id: userId })
          .eq("id", byPhone.id);
        if (linkErr) throw new Error(linkErr.message);
        return { linked: true, courierId: byPhone.id, created: false };
      }
    }

    // 3) Cria um novo registro operacional mínimo.
    const emailClaim = (context.claims?.email as string | undefined) ?? null;
    const { data: created, error: createErr } = await supabaseAdmin
      .from("couriers")
      .insert({
        user_id: userId,
        name: profile?.full_name || emailClaim?.split("@")[0] || "Motoboy",
        phone: profile?.phone ?? null,
        vehicle: "moto",
        active: true,
        status: "offline",
      })
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    return { linked: true, courierId: created.id, created: true };
  });
