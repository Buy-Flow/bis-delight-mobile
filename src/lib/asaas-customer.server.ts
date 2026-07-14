export async function resolveOrCreateAsaasCustomer(opts: {
  userId?: string | null;
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
}): Promise<{ id: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { upsertAsaasCustomer } = await import("@/lib/asaas.server");

  if (opts.userId) {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("asaas_customer_id")
      .eq("id", opts.userId)
      .maybeSingle();
    if (p?.asaas_customer_id) return { id: p.asaas_customer_id };
  }

  const c = await upsertAsaasCustomer({
    name: opts.name,
    email: opts.email,
    cpfCnpj: opts.cpfCnpj,
    phone: opts.phone,
    externalReference: opts.userId ?? undefined,
  });

  if (opts.userId) {
    await supabaseAdmin.from("profiles").update({ asaas_customer_id: c.id }).eq("id", opts.userId);
  }

  return { id: c.id };
}