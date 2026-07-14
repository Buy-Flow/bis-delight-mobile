// Server functions for Asaas checkout (called from the client checkout UI).
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

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
    const { createPixCharge } = await import("@/lib/asaas.server");
    const { resolveOrCreateAsaasCustomer } = await import("@/lib/asaas-customer.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

    const customer = await resolveOrCreateAsaasCustomer({
      userId: order.user_id ?? null,
      name: data.customer.name || order.customer_name || "Cliente",
      email: data.customer.email,
      cpfCnpj: data.customer.cpfCnpj,
      phone: data.customer.phone ?? order.phone ?? undefined,
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
  }).optional(),
  useSavedCard: z.boolean().optional(),
  installmentCount: z.number().int().min(1).max(12).optional(),
  saveCard: z.boolean().optional(),
});

export const createAsaasCardForOrder = createServerFn({ method: "POST" })
  .inputValidator((raw) => cardInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCardCharge } = await import("@/lib/asaas.server");
    const { resolveOrCreateAsaasCustomer } = await import("@/lib/asaas-customer.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

    const customer = await resolveOrCreateAsaasCustomer({
      userId: order.user_id ?? null,
      name: data.customer.name,
      email: data.customer.email,
      cpfCnpj: data.customer.cpfCnpj,
      phone: data.customer.phone ?? order.phone ?? undefined,
    });

    // Load saved token if the user opted in
    let savedToken: string | null = null;
    if (data.useSavedCard && order.user_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("asaas_card_token")
        .eq("id", order.user_id)
        .maybeSingle();
      savedToken = p?.asaas_card_token ?? null;
    }
    if (data.useSavedCard && !savedToken) {
      throw new Error("Nenhum cartão salvo encontrado");
    }
    if (!savedToken && !data.card) {
      throw new Error("Dados do cartão são obrigatórios");
    }

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
      creditCardToken: savedToken ?? undefined,
      creditCard: data.card
        ? {
            holderName: data.card.holderName,
            number: data.card.number.replace(/\D/g, ""),
            expiryMonth: data.card.expiryMonth,
            expiryYear: data.card.expiryYear,
            ccv: data.card.ccv,
          }
        : undefined,
      creditCardHolderInfo: {
        name: data.customer.name,
        email: data.customer.email,
        cpfCnpj: data.customer.cpfCnpj.replace(/\D/g, ""),
        postalCode: data.customer.postalCode.replace(/\D/g, ""),
        addressNumber: data.customer.addressNumber,
        phone: data.customer.phone,
        mobilePhone: data.customer.phone,
      },
      remoteIp: ip,
    });

    const last4 = data.card?.number.replace(/\D/g, "").slice(-4) ?? null;
    const returnedToken = charge.creditCard?.creditCardToken ?? null;
    const brand = charge.creditCard?.creditCardBrand ?? null;

    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "credit_card",
        asaas_payment_id: charge.id,
        asaas_status: charge.status,
        card_last4: last4,
        card_brand: brand,
        invoice_url: charge.invoiceUrl,
        ...(charge.status.toUpperCase() === "CONFIRMED" || charge.status.toUpperCase() === "RECEIVED"
          ? { status: "pago", paid_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", order.id);

    // Save card token to profile for 1-click checkout next time
    if (data.saveCard && order.user_id && returnedToken) {
      await supabaseAdmin
        .from("profiles")
        .update({
          asaas_card_token: returnedToken,
          asaas_card_last4: last4,
          asaas_card_brand: brand,
        })
        .eq("id", order.user_id);
    }

    return {
      paymentId: charge.id,
      status: charge.status,
      last4,
      brand,
      invoiceUrl: charge.invoiceUrl,
      tokenSaved: Boolean(data.saveCard && returnedToken),
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

const checkoutInput = z.object({
  orderId: z.string().uuid(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    cpfCnpj: z.string().min(11).max(18).optional(),
    phone: z.string().optional(),
  }),
  origin: z.string().url(),
});

export const createAsaasCheckoutForOrder = createServerFn({ method: "POST" })
  .inputValidator((raw) => checkoutInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutSession } = await import("@/lib/asaas.server");
    const { resolveOrCreateAsaasCustomer } = await import("@/lib/asaas-customer.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

    const shortId = order.id.slice(0, 8);
    const origin = data.origin.replace(/\/+$/, "");
    const successUrl = `${origin}/pagamento/${order.id}?checkout=success`;
    const cancelUrl = `${origin}/pagamento/${order.id}?checkout=cancel`;
    const expiredUrl = `${origin}/pagamento/${order.id}?checkout=expired`;

    const customer = await resolveOrCreateAsaasCustomer({
      userId: order.user_id ?? null,
      name: data.customer.name || order.customer_name || "Cliente",
      email: data.customer.email,
      cpfCnpj: data.customer.cpfCnpj,
      phone: data.customer.phone ?? order.phone ?? undefined,
    });

    const session = await createCheckoutSession({
      value: Number(order.total),
      externalReference: order.id,
      description: `Pedido ${shortId}`,
      successUrl,
      cancelUrl,
      expiredUrl,
      minutesToExpire: 60,
      billingTypes: ["CREDIT_CARD", "PIX"],
      customerId: customer.id,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "asaas_checkout",
        asaas_status: session.status ?? "CHECKOUT_CREATED",
        invoice_url: session.link,
      })
      .eq("id", order.id);

    return { checkoutId: session.id, url: session.link };
  });
