// Asaas API adapter — server-only. Docs: https://docs.asaas.com/reference
// Env: ASAAS_API_KEY, ASAAS_ENV ("sandbox" | "production", default sandbox)

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PROD_URL = "https://api.asaas.com/v3";

function onlyDigits(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeBrazilianPhone(value?: string) {
  let digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return undefined;
  return digits;
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as T;
}

function getConfig() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY is not configured");
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  const baseUrl = env === "production" || env === "prod" || env === "live" ? PROD_URL : SANDBOX_URL;
  return { key, baseUrl };
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { key, baseUrl } = getConfig();
  const url = `${baseUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: key,
        "User-Agent": "querobis-lovable",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    console.error("[asaas] network failure", { url, err: (err as Error).message });
    throw new Error(`[asaas] Falha de rede ao chamar ${path}: ${(err as Error).message}`);
  }
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    console.error("[asaas] non-JSON response", { url, status: res.status, text: text.slice(0, 500) });
    throw new Error(`[asaas] Resposta inválida do Asaas (${res.status}). Verifique ASAAS_API_KEY e ASAAS_ENV.`);
  }
  if (!res.ok) {
    const firstErr = Array.isArray(body?.errors) ? body.errors[0] : null;
    const msg = firstErr?.description ?? firstErr?.code ?? body?.message ?? body?.error ?? `HTTP ${res.status}`;
    console.error("[asaas] api error", { url, status: res.status, body: JSON.stringify(body) });
    throw new Error(`[asaas ${res.status}] ${msg}`);
  }
  return body as T;
}

export type AsaasCustomer = { id: string; name: string; email?: string; cpfCnpj?: string; phone?: string };

export async function upsertAsaasCustomer(input: {
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  const phone = normalizeBrazilianPhone(input.phone);
  const cpfCnpj = onlyDigits(input.cpfCnpj) || undefined;
  // Try find by externalReference first
  if (input.externalReference) {
    const found = await asaasFetch<{ data: AsaasCustomer[] }>(
      `/customers?externalReference=${encodeURIComponent(input.externalReference)}`,
    );
    if (found.data?.[0]) return found.data[0];
  }
  return await asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(cleanPayload({
      name: input.name,
      email: input.email,
      cpfCnpj,
      phone: phone?.length === 10 ? phone : undefined,
      mobilePhone: phone?.length === 11 ? phone : undefined,
      externalReference: input.externalReference,
    })),
  });
}

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO";
  invoiceUrl?: string;
  dueDate?: string;
};

export type AsaasPixQr = {
  encodedImage: string; // base64 PNG
  payload: string; // copia-e-cola
  expirationDate: string;
};

export async function createPixCharge(input: {
  customerId: string;
  value: number;
  externalReference: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
}): Promise<{ payment: AsaasPayment; qr: AsaasPixQr }> {
  const today = new Date().toISOString().slice(0, 10);
  const payment = await asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "PIX",
      value: Number(input.value.toFixed(2)),
      dueDate: input.dueDate ?? today,
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
  const qr = await asaasFetch<AsaasPixQr>(`/payments/${payment.id}/pixQrCode`);
  return { payment, qr };
}

export async function createCardCharge(input: {
  customerId: string;
  value: number;
  externalReference: string;
  description?: string;
  dueDate?: string;
  installmentCount?: number;
  creditCard?: {
    holderName: string;
    number: string; // digits only
    expiryMonth: string; // "MM"
    expiryYear: string; // "YYYY"
    ccv: string;
  };
  creditCardToken?: string;
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
    mobilePhone?: string;
  };
  remoteIp: string;
}): Promise<AsaasPayment & { creditCard?: { creditCardBrand?: string; creditCardNumber?: string; creditCardToken?: string } }> {
  const today = new Date().toISOString().slice(0, 10);
  // Asaas antifraud recomenda mandar phone e mobilePhone. Se apenas um foi passado, usar em ambos.
  const holder = cleanPayload({
    ...input.creditCardHolderInfo,
    cpfCnpj: onlyDigits(input.creditCardHolderInfo.cpfCnpj),
    postalCode: onlyDigits(input.creditCardHolderInfo.postalCode),
    phone: normalizeBrazilianPhone(input.creditCardHolderInfo.phone),
    mobilePhone: normalizeBrazilianPhone(input.creditCardHolderInfo.mobilePhone),
  });
  if (!holder.mobilePhone && holder.phone) holder.mobilePhone = holder.phone;
  if (!holder.phone && holder.mobilePhone) holder.phone = holder.mobilePhone;

  const body: Record<string, unknown> = {
    customer: input.customerId,
    billingType: "CREDIT_CARD",
    value: Number(input.value.toFixed(2)),
    dueDate: input.dueDate ?? today,
    description: input.description,
    externalReference: input.externalReference,
    creditCardHolderInfo: holder,
    remoteIp: input.remoteIp,
  };
  // Prefer token (1-click); fallback to raw card
  if (input.creditCardToken) {
    body.creditCardToken = input.creditCardToken;
  } else {
    body.creditCard = input.creditCard;
  }
  if (input.installmentCount && input.installmentCount > 1) {
    body.installmentCount = input.installmentCount;
    body.totalValue = Number(input.value.toFixed(2));
  }
  return await asaasFetch("/payments", { method: "POST", body: JSON.stringify(body) });
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return await asaasFetch<AsaasPayment>(`/payments/${paymentId}`);
}

export type AsaasCheckoutSession = {
  id: string;
  link: string;
  status?: string;
  expirationDate?: string;
};

export async function createCheckoutSession(input: {
  value: number;
  externalReference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
  minutesToExpire?: number;
  customerId?: string;
  customer?: { name?: string; email?: string; cpfCnpj?: string; phone?: string };
  billingTypes?: Array<"CREDIT_CARD" | "PIX">;
}): Promise<AsaasCheckoutSession> {
  const body: Record<string, unknown> = {
    billingTypes: input.billingTypes ?? ["CREDIT_CARD", "PIX"],
    chargeTypes: ["DETACHED"],
    minutesToExpire: input.minutesToExpire ?? 60,
    externalReference: input.externalReference,
    callback: {
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      expiredUrl: input.expiredUrl,
    },
    items: [
      {
        name: input.description,
        value: Number(input.value.toFixed(2)),
        quantity: 1,
      },
    ],
  };
  if (input.customerId) {
    body.customer = input.customerId;
  }
  if (input.customer) {
    body.customerData = {
      name: input.customer.name,
      email: input.customer.email,
      cpfCnpj: input.customer.cpfCnpj,
      phone: input.customer.phone,
    };
  }
  return await asaasFetch<AsaasCheckoutSession>("/checkouts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}


// Map Asaas status → local order status
export function mapAsaasStatusToOrder(status: string): { paid: boolean; canceled: boolean } {
  const s = status.toUpperCase();
  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID"].includes(s);
  const canceled = ["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED", "EXPIRED", "CANCELED"].includes(s);
  return { paid, canceled };
}
