// Asaas API adapter — server-only. Docs: https://docs.asaas.com/reference
// Env: ASAAS_API_KEY, ASAAS_ENV ("sandbox" | "production", default sandbox)

const SANDBOX_URL = "https://sandbox.asaas.com/api/v3";
const PROD_URL = "https://api.asaas.com/v3";

function getConfig() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY is not configured");
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  const baseUrl = env === "production" || env === "prod" || env === "live" ? PROD_URL : SANDBOX_URL;
  return { key, baseUrl };
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { key, baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      "User-Agent": "querobis-lovable",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = body?.errors?.[0]?.description ?? body?.message ?? `Asaas ${res.status}`;
    throw new Error(`[asaas] ${res.status} ${msg}`);
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
  // Try find by externalReference first
  if (input.externalReference) {
    const found = await asaasFetch<{ data: AsaasCustomer[] }>(
      `/customers?externalReference=${encodeURIComponent(input.externalReference)}`,
    );
    if (found.data?.[0]) return found.data[0];
  }
  return await asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      phone: input.phone,
      externalReference: input.externalReference,
    }),
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
  creditCard: {
    holderName: string;
    number: string; // digits only
    expiryMonth: string; // "MM"
    expiryYear: string; // "YYYY"
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
  };
  remoteIp: string;
}): Promise<AsaasPayment & { creditCard?: { creditCardBrand?: string; creditCardNumber?: string } }> {
  const today = new Date().toISOString().slice(0, 10);
  const body: Record<string, unknown> = {
    customer: input.customerId,
    billingType: "CREDIT_CARD",
    value: Number(input.value.toFixed(2)),
    dueDate: input.dueDate ?? today,
    description: input.description,
    externalReference: input.externalReference,
    creditCard: input.creditCard,
    creditCardHolderInfo: input.creditCardHolderInfo,
    remoteIp: input.remoteIp,
  };
  if (input.installmentCount && input.installmentCount > 1) {
    body.installmentCount = input.installmentCount;
    body.totalValue = Number(input.value.toFixed(2));
  }
  return await asaasFetch("/payments", { method: "POST", body: JSON.stringify(body) });
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return await asaasFetch<AsaasPayment>(`/payments/${paymentId}`);
}

// Map Asaas status → local order status
export function mapAsaasStatusToOrder(status: string): { paid: boolean; canceled: boolean } {
  const s = status.toUpperCase();
  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s);
  const canceled = ["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED"].includes(s);
  return { paid, canceled };
}
