// Server functions for Asaas checkout (called from the client checkout UI).
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function resolveOrCreateAsaasCustomer(opts: {
  userId?: string | null;
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
}): Promise<{ id: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { upsertAsaasCustomer } = await import("@/lib/asaas.server");

  // Reuse cached customer id from profile
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

const pixInput = z.object({
  orderId: z.string().uuid(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    cpfCnpj: z.string().min(11).max(18).optional(),
    phone: z.string().optional(),
    externalReference: z.string().optional(),
  }),
  description: z.string().optional(),
});

export const createAsaasPixForOrder = createServerFn({ method: "POST" })
  .inputValidator((raw) => pixInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertAsaasCustomer, createPixCharge } = await import("@/lib/asaas.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

    const customer = await upsertAsaasCustomer({
      name: data.customer.name || order.customer_name || "Cliente",
      email: data.customer.email,
      cpfCnpj: data.customer.cpfCnpj,
      phone: data.customer.phone ?? order.phone ?? undefined,
      externalReference: data.customer.externalReference,
    });

    const { payment, qr } = await createPixCharge({
      customerId: customer.id,
      value: Number(order.total),
      externalReference: order.id,
      description: data.description ?? `Pedido ${order.id.slice(0, 8)}`,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "pix",
        asaas_payment_id: payment.id,
        asaas_status: payment.status,
        pix_qr_code_base64: qr.encodedImage,
        pix_copy_paste: qr.payload,
        pix_expires_at: qr.expirationDate,
        invoice_url: payment.invoiceUrl,
      })
      .eq("id", order.id);

    return {
      paymentId: payment.id,
      status: payment.status,
      qrBase64: qr.encodedImage,
      copyPaste: qr.payload,
      expiresAt: qr.expirationDate,
      invoiceUrl: payment.invoiceUrl,
    };
  });

const cardInput = z.object({
  orderId: z.string().uuid(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    cpfCnpj: z.string().min(11).max(18),
    phone: z.string().optional(),
    postalCode: z.string().min(8),
    addressNumber: z.string().min(1),
  }),
  card: z.object({
    holderName: z.string().min(2),
    number: z.string().min(12),
    expiryMonth: z.string().length(2),
    expiryYear: z.string().length(4),
    ccv: z.string().min(3).max(4),
  }),
  installmentCount: z.number().int().min(1).max(12).optional(),
});

export const createAsaasCardForOrder = createServerFn({ method: "POST" })
  .inputValidator((raw) => cardInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertAsaasCustomer, createCardCharge } = await import("@/lib/asaas.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

    const customer = await upsertAsaasCustomer({
      name: data.customer.name,
      email: data.customer.email,
      cpfCnpj: data.customer.cpfCnpj,
      phone: data.customer.phone ?? order.phone ?? undefined,
    });

    const ip = (() => {
      try {
        return getRequestIP({ xForwardedFor: true }) ?? "127.0.0.1";
      } catch {
        return "127.0.0.1";
      }
    })();

    const charge = await createCardCharge({
      customerId: customer.id,
      value: Number(order.total),
      externalReference: order.id,
      description: `Pedido ${order.id.slice(0, 8)}`,
      installmentCount: data.installmentCount,
      creditCard: {
        holderName: data.card.holderName,
        number: data.card.number.replace(/\D/g, ""),
        expiryMonth: data.card.expiryMonth,
        expiryYear: data.card.expiryYear,
        ccv: data.card.ccv,
      },
      creditCardHolderInfo: {
        name: data.customer.name,
        email: data.customer.email,
        cpfCnpj: data.customer.cpfCnpj.replace(/\D/g, ""),
        postalCode: data.customer.postalCode.replace(/\D/g, ""),
        addressNumber: data.customer.addressNumber,
        phone: data.customer.phone,
      },
      remoteIp: ip,
    });

    const last4 = data.card.number.replace(/\D/g, "").slice(-4);
    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "credit_card",
        asaas_payment_id: charge.id,
        asaas_status: charge.status,
        card_last4: last4,
        card_brand: charge.creditCard?.creditCardBrand ?? null,
        invoice_url: charge.invoiceUrl,
        ...(charge.status.toUpperCase() === "CONFIRMED" || charge.status.toUpperCase() === "RECEIVED"
          ? { status: "pago", paid_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", order.id);

    return {
      paymentId: charge.id,
      status: charge.status,
      last4,
      brand: charge.creditCard?.creditCardBrand ?? null,
      invoiceUrl: charge.invoiceUrl,
    };
  });

export const getAsaasPaymentStatus = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ orderId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, asaas_status, asaas_payment_id, payment_method, paid_at")
      .eq("id", data.orderId)
      .maybeSingle();
    return order ?? null;
  });
