export async function resolveOrCreateAsaasCustomer(opts: {
  userId?: string | null;
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
}): Promise<{ id: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { upsertAsaasCustomer, getAsaasCustomer, updateAsaasCustomer } = await import("@/lib/asaas.server");

  const cpfDigits = (opts.cpfCnpj ?? "").replace(/\D/g, "") || undefined;

  if (opts.userId) {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("asaas_customer_id")
      .eq("id", opts.userId)
      .maybeSingle();
    if (p?.asaas_customer_id) {
      // Ensure remote customer has cpfCnpj (Asaas Checkout requires it).
      if (cpfDigits) {
        const remote = await getAsaasCustomer(p.asaas_customer_id);
        const remoteCpf = (remote?.cpfCnpj ?? "").replace(/\D/g, "");
        if (!remoteCpf) {
          await updateAsaasCustomer(p.asaas_customer_id, {
            cpfCnpj: cpfDigits,
            phone: opts.phone,
            email: opts.email,
          });
        }
      }
      return { id: p.asaas_customer_id };
    }
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
