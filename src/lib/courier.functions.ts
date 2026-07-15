import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

function randomPassword(len = 10) {
  // Sem caracteres ambíguos (0/O/1/l/I) para facilitar ditar por voz
  const alpha = "abcdefghjkmnpqrstuvwxyz";
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const nums = "23456789";
  const pool = alpha + ALPHA + nums;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += pool[bytes[i] % pool.length];
  // garante ao menos 1 número e 1 maiúscula
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + nums[bytes[0] % nums.length];
  if (!/[A-Z]/.test(out)) out = ALPHA[bytes[1] % ALPHA.length] + out.slice(1);
  return out;
}

/**
 * Cria uma conta de acesso direta para o motoboy — SEM enviar email/convite.
 * O admin gera um login+senha na hora e entrega pessoalmente ao motoboy.
 *  1. Confirma que quem chama é admin.
 *  2. Gera email sintético (motoboy+<handle>@querobis.local) e senha aleatória.
 *  3. Cria usuário via admin API com email já confirmado.
 *  4. Concede papel `delivery` e vincula ao registro em `couriers`.
 *  5. Retorna { email, password } uma única vez para o admin repassar.
 */
export const createCourierLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        courierId: z.string().uuid(),
        handle: z.string().min(2).max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: courier, error: cErr } = await supabaseAdmin
      .from("couriers")
      .select("id, name, phone, user_id")
      .eq("id", data.courierId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!courier) throw new Error("Motoboy não encontrado");
    if (courier.user_id) throw new Error("Este motoboy já tem acesso vinculado");

    const base = slugify(data.handle || courier.name || "motoboy") || "motoboy";
    // Sufixo curto para evitar colisão sem parecer email real
    const suffix = Math.random().toString(36).slice(2, 6);
    const email = `motoboy.${base}.${suffix}@querobis.local`;
    const password = randomPassword(10);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: courier.name,
        phone: courier.phone,
        courier_id: courier.id,
      },
    });
    if (createErr || !created?.user?.id) {
      throw new Error(createErr?.message || "Falha ao criar conta");
    }
    const newUserId = created.user.id;

    // Garante perfil mínimo
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: courier.name, phone: courier.phone });

    // Concede papel delivery (idempotente)
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "delivery" });
    if (roleErr && !/(duplicate|unique)/i.test(roleErr.message)) {
      throw new Error(roleErr.message);
    }

    // Vincula user_id ao registro do motoboy
    const { error: linkErr } = await supabaseAdmin
      .from("couriers")
      .update({ user_id: newUserId })
      .eq("id", courier.id);
    if (linkErr) throw new Error(linkErr.message);

    await supabaseAdmin.from("user_role_audit").insert({
      actor_id: context.userId,
      target_user_id: newUserId,
      action: "grant",
      role: "delivery",
      note: `Acesso motoboy criado para ${courier.name}`,
    });

    return { email, password, userId: newUserId };
  });

/**
 * Revoga o acesso do motoboy: remove vínculo user_id do courier e apaga
 * a conta de auth (somente se for uma conta sintética @querobis.local,
 * para não excluir contas reais que foram vinculadas manualmente).
 */
export const revokeCourierLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ courierId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("id, user_id")
      .eq("id", data.courierId)
      .maybeSingle();
    if (!courier?.user_id) return { ok: true, deleted: false };

    const userId = courier.user_id;
    await supabaseAdmin.from("couriers").update({ user_id: null }).eq("id", courier.id);

    // Descobre se é conta sintética antes de decidir apagar
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email ?? "";
    const synthetic = email.endsWith("@querobis.local");
    if (synthetic) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    await supabaseAdmin.from("user_role_audit").insert({
      actor_id: context.userId,
      target_user_id: userId,
      action: "revoke",
      role: "delivery",
      note: synthetic ? "Acesso motoboy revogado e conta removida" : "Vínculo removido (conta preservada)",
    });
    return { ok: true, deleted: synthetic };
  });

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
