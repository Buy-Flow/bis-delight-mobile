// Server functions for Asaas checkout (called from the client checkout UI).
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Verify the authenticated user owns the order (or is admin/manager/cashier staff).
async function assertOrderAccess(
  supabase: SupabaseClient,
  orderUserId: string | null | undefined,
  callerId: string,
) {
  if (orderUserId && orderUserId === callerId) return;
  const roles = ["admin", "manager", "cashier"] as const;
  for (const r of roles) {
    const { data } = await supabase.rpc("has_role", { _user_id: callerId, _role: r });
    if (data) return;
  }
  throw new Error("Sem permissão para acessar este pedido");
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
  .middleware([requireSupabaseAuth])
  .validator((raw) => pixInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPixCharge } = await import("@/lib/asaas.server");
    const { resolveOrCreateAsaasCustomer } = await import("@/lib/asaas-customer.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");
    await assertOrderAccess(context.supabase, order.user_id, context.userId);


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

    // Asaas retorna expirationDate default de ~1 ano; limitamos a 30 min (padrão PIX).
    const PIX_TTL_MS = 30 * 60 * 1000;
    const asaasExpMs = qr.expirationDate ? new Date(qr.expirationDate).getTime() : NaN;
    const capMs = Date.now() + PIX_TTL_MS;
    const effectiveExpMs = Number.isFinite(asaasExpMs) ? Math.min(asaasExpMs, capMs) : capMs;
    const effectiveExpISO = new Date(effectiveExpMs).toISOString();

    await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "pix",
        asaas_payment_id: payment.id,
        asaas_status: payment.status,
        pix_qr_code_base64: qr.encodedImage,
        pix_copy_paste: qr.payload,
        pix_expires_at: effectiveExpISO,
        invoice_url: payment.invoiceUrl,
      })
      .eq("id", order.id);

    return {
      paymentId: payment.id,
      status: payment.status,
      qrBase64: qr.encodedImage,
      copyPaste: qr.payload,
      expiresAt: effectiveExpISO,
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
    postalCode: z.string().optional(),
    addressNumber: z.string().optional(),
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
  .middleware([requireSupabaseAuth])
  .validator((raw) => cardInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCardCharge } = await import("@/lib/asaas.server");
    const { resolveOrCreateAsaasCustomer } = await import("@/lib/asaas-customer.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");
    await assertOrderAccess(context.supabase, order.user_id, context.userId);

    const customer = await resolveOrCreateAsaasCustomer({
      userId: order.user_id ?? null,
      name: data.customer.name,
      email: data.customer.email,
      cpfCnpj: data.customer.cpfCnpj,
      phone: data.customer.phone ?? order.phone ?? undefined,
    });

    // Load saved token if the user opted in — only allowed when caller IS the
    // order's owner (never let staff charge a customer's stored card).
    let savedToken: string | null = null;
    if (data.useSavedCard) {
      if (!order.user_id || order.user_id !== context.userId) {
        throw new Error("Cartão salvo só pode ser usado pelo próprio titular");
      }
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
        postalCode: (data.customer.postalCode ?? "").replace(/\D/g, "") || "00000000",
        addressNumber: data.customer.addressNumber || "S/N",
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
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ orderId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, asaas_status, asaas_payment_id, payment_method, paid_at, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return null;
    await assertOrderAccess(context.supabase, order.user_id, context.userId);

    // Live sync com o Asaas: se temos payment id e o pedido ainda não foi pago,
    // consultamos direto na API e reconciliamos o status. Assim a confirmação
    // funciona mesmo se o webhook estiver quebrado / com token divergente.
    let synced = order;
    if (order.asaas_payment_id && order.status !== "pago" && order.status !== "cancelado") {
      try {
        const { getPayment, mapAsaasStatusToOrder } = await import("@/lib/asaas.server");
        const live = await getPayment(order.asaas_payment_id);
        const { paid, canceled } = mapAsaasStatusToOrder(live.status);
        const patch: { asaas_status: string; status?: string; paid_at?: string } = { asaas_status: live.status };
        if (paid && order.status !== "pago") {
          patch.status = "pago";
          patch.paid_at = new Date().toISOString();
        } else if (canceled && order.status !== "cancelado") {
          patch.status = "cancelado";
        }
        const { data: updated } = await supabaseAdmin
          .from("orders")
          .update(patch)
          .eq("id", order.id)
          .select("id, status, asaas_status, asaas_payment_id, payment_method, paid_at, user_id")
          .maybeSingle();
        if (updated) synced = updated;
      } catch (err) {
        console.error("[getAsaasPaymentStatus] live sync failed", err);
      }
    }

    const { user_id: _uid, ...rest } = synced;
    return rest;
  });


const checkoutInput = z.object({
  orderId: z.string().uuid(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    cpfCnpj: z.string().min(11).max(18).optional(),
    phone: z.string().optional(),
    postalCode: z.string().optional(),
    address: z.string().optional(),
    addressNumber: z.string().optional(),
    province: z.string().optional(),
    complement: z.string().optional(),
  }),
  origin: z.string().url(),
});


export const createAsaasCheckoutForOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => checkoutInput.parse(raw))
  .handler(async ({ data, context }) => {
    // Parse "Rua X, 123 — Bairro — Cidade — CEP 00000-000" style strings loosely.
    // Kept inside the handler because module-scope helpers are stripped by the
    // server-fn split transform (tanstack-serverfn-splitting).
    function parseAddressText(text: string | null | undefined) {
      if (!text) return {} as { postalCode?: string; address?: string; addressNumber?: string; province?: string };
      const cepMatch = text.match(/\b(\d{5})-?(\d{3})\b/);
      const postalCode = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : undefined;
      const parts = text.split(/\s+—\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
      const first = parts[0] ?? "";
      const numMatch = first.match(/^(.*?)[,\s]+(\d+[A-Za-z]?)\b/);
      const address = numMatch ? numMatch[1].trim() : first || undefined;
      const addressNumber = numMatch ? numMatch[2] : undefined;
      const province = parts[1] || undefined;
      return { postalCode, address, addressNumber, province };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutSession } = await import("@/lib/asaas.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, customer_name, phone, user_id, address, reference")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");
    await assertOrderAccess(context.supabase, order.user_id, context.userId);

    const shortId = order.id.slice(0, 8);
    const origin = data.origin.replace(/\/+$/, "");
    const successUrl = `${origin}/pagamento/${order.id}?checkout=success`;
    const cancelUrl = `${origin}/pagamento/${order.id}?checkout=cancel`;
    const expiredUrl = `${origin}/pagamento/${order.id}?checkout=expired`;

    // Merge address: client-provided → order.address → user_addresses default → store address (retirada)
    let parsed = parseAddressText(order.address);
    if (!parsed.postalCode && order.user_id) {
      const { data: def } = await supabaseAdmin
        .from("user_addresses")
        .select("address")
        .eq("user_id", order.user_id)
        .eq("is_default", true)
        .maybeSingle();
      if (def?.address) parsed = { ...parseAddressText(def.address), ...parsed };
    }
    // Retirada na loja (order.address = null): usar endereço da própria loja
    // como billing address exigido pelo Asaas.
    if (!parsed.postalCode) {
      const { data: store } = await supabaseAdmin
        .from("site_settings")
        .select("address")
        .maybeSingle();
      if (store?.address) parsed = { ...parseAddressText(store.address), ...parsed };
    }

    const merged = {
      postalCode: data.customer.postalCode || parsed.postalCode,
      address: data.customer.address || parsed.address,
      addressNumber: data.customer.addressNumber || parsed.addressNumber || "S/N",
      province: data.customer.province || parsed.province || "Centro",
      complement: data.customer.complement || order.reference || undefined,
    };

    if (!merged.postalCode || !merged.address) {
      throw new Error(
        "Endereço incompleto para pagamento. Configure o endereço da loja (com CEP) nas Configurações e tente novamente.",
      );
    }

    const session = await createCheckoutSession({
      value: Number(order.total),
      externalReference: order.id,
      description: `Pedido ${shortId}`,
      successUrl,
      cancelUrl,
      expiredUrl,
      minutesToExpire: 60,
      billingTypes: ["CREDIT_CARD", "PIX"],
      customer: {
        name: data.customer.name || order.customer_name || "Cliente",
        email: data.customer.email,
        cpfCnpj: data.customer.cpfCnpj,
        phone: data.customer.phone ?? order.phone ?? undefined,
        ...merged,
      },
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

