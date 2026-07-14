import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { brl } from "@/lib/cart-context";
import { createAsaasPixForOrder, createAsaasCardForOrder, getAsaasPaymentStatus } from "@/lib/asaas.functions";
import { useServerFn } from "@tanstack/react-start";
import { formatCpf, cpfDigits, isValidCpf } from "@/lib/cpf";
import { toast } from "sonner";
import { Loader2, QrCode, CreditCard, Copy, Check, ShieldCheck, ArrowLeft, PartyPopper, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  m: z.enum(["pix", "cartao"]).catch("pix"),
});

export const Route = createFileRoute("/pagamento/$orderId")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Pagamento — Quero Bis" },
      { name: "description", content: "Finalize o pagamento do seu pedido." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PagamentoPage,
});

type Order = {
  id: string;
  status: string;
  total: number;
  customer_name: string | null;
  phone: string | null;
  payment_method: string | null;
  asaas_status: string | null;
  pix_qr_code_base64: string | null;
  pix_copy_paste: string | null;
  pix_expires_at: string | null;
  invoice_url: string | null;
  card_last4: string | null;
  card_brand: string | null;
  paid_at: string | null;
};

function PagamentoPage() {
  const { orderId } = Route.useParams();
  const { m } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Load order + subscribe realtime
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, status, total, customer_name, phone, payment_method, asaas_status, pix_qr_code_base64, pix_copy_paste, pix_expires_at, invoice_url, card_last4, card_brand, paid_at",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      setOrder(data as Order | null);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`order-payment-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev) => ({ ...(prev as Order), ...(payload.new as Partial<Order>) } as Order));
        },
      )
      .subscribe();

    // Fallback polling every 10s
    const iv = setInterval(async () => {
      if (cancelled) return;
      setOrder((prev) => {
        if (prev?.status === "pago") return prev;
        void (async () => {
          const { data } = await supabase
            .from("orders")
            .select(
              "id, status, total, customer_name, phone, payment_method, asaas_status, pix_qr_code_base64, pix_copy_paste, pix_expires_at, invoice_url, card_last4, card_brand, paid_at",
            )
            .eq("id", orderId)
            .maybeSingle();
          if (!cancelled && data) setOrder(data as Order);
        })();
        return prev;
      });
    }, 10000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(iv);
    };
  }, [orderId]);

  const paid = order?.status === "pago" || ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes((order?.asaas_status || "").toUpperCase());

  return (
    <div className="min-h-dvh bg-[oklch(0.14_0.09_305)] text-white">
      <div className="mx-auto max-w-xl px-4 py-6">
        <button
          onClick={() => navigate({ to: "/" })}
          className="mb-4 flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao cardápio
        </button>

        <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">Pedido</div>
          <div className="mt-0.5 font-mono text-sm text-white/80">#{orderId.slice(0, 8)}</div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-white/70">Total</span>
            <span className="font-display text-3xl font-extrabold text-neon-yellow">
              {order ? brl(Number(order.total)) : "..."}
            </span>
          </div>
        </div>

        {loading || authLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : !order ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            Pedido não encontrado.
          </div>
        ) : paid ? (
          <PaidCard order={order} />
        ) : m === "pix" ? (
          <PixSection order={order} setOrder={setOrder} />
        ) : (
          <CardSection order={order} setOrder={setOrder} user={user} />
        )}
      </div>
    </div>
  );
}

function PaidCard({ order }: { order: Order }) {
  return (
    <div className="rounded-3xl border border-neon-cyan/40 bg-neon-cyan/10 p-6 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-neon-cyan/30">
        <PartyPopper className="h-7 w-7 text-neon-cyan" />
      </div>
      <div className="font-display text-2xl font-extrabold text-white">Pagamento confirmado!</div>
      <div className="mt-1 text-sm text-white/70">
        Recebemos {brl(Number(order.total))}. Já estamos preparando o seu pedido 🍧
      </div>
      <Link
        to="/meus-pedidos"
        className="mt-5 inline-flex rounded-2xl bg-neon-cyan px-5 py-3 text-sm font-extrabold text-[oklch(0.18_0.11_305)]"
      >
        Ver meus pedidos
      </Link>
    </div>
  );
}

function PixSection({ order, setOrder }: { order: Order; setOrder: (o: Order) => void }) {
  const genPix = useServerFn(createAsaasPixForOrder);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (order.pix_qr_code_base64 || generating) return;
    setGenerating(true);
    (async () => {
      try {
        const saved = safeLoadCustomer();
        await genPix({
          data: {
            orderId: order.id,
            customer: {
              name: order.customer_name || saved.name || "Cliente",
              email: saved.email || undefined,
              cpfCnpj: saved.cpf || undefined,
              phone: order.phone || saved.phone || undefined,
              externalReference: order.id,
            },
          },
        });
        // realtime will hydrate; fallback fetch:
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("id", order.id)
          .maybeSingle();
        if (data) setOrder(data as Order);
      } catch (e: any) {
        toast.error("Não foi possível gerar o PIX", { description: e?.message || "Tente novamente." });
      } finally {
        setGenerating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const expires = useMemo(() => {
    if (!order.pix_expires_at) return null;
    const d = new Date(order.pix_expires_at);
    return isNaN(d.getTime()) ? null : d;
  }, [order.pix_expires_at]);

  const copy = async () => {
    if (!order.pix_copy_paste) return;
    try {
      await navigator.clipboard.writeText(order.pix_copy_paste);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não deu para copiar. Selecione manualmente.");
    }
  };

  if (generating && !order.pix_qr_code_base64) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-neon-yellow" />
        <div className="mt-3 text-sm text-white/70">Gerando QR Code PIX…</div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-neon-yellow/15 text-neon-yellow">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-extrabold text-white">Pague com PIX</div>
          <div className="text-[11px] text-white/60">
            Aponte a câmera do banco para o QR Code ou copie o código.
          </div>
        </div>
      </div>

      {order.pix_qr_code_base64 ? (
        <div className="rounded-2xl bg-white p-3">
          <img
            src={`data:image/png;base64,${order.pix_qr_code_base64}`}
            alt="QR Code PIX"
            className="mx-auto h-56 w-56"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/60">
          QR Code indisponível.
        </div>
      )}

      {order.pix_copy_paste && (
        <>
          <div className="mt-3 break-all rounded-2xl border border-white/10 bg-white/[0.04] p-3 font-mono text-[11px] text-white/80">
            {order.pix_copy_paste}
          </div>
          <button
            onClick={copy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-yellow px-4 py-3 text-sm font-extrabold text-[oklch(0.18_0.11_305)] active:scale-95"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
        </>
      )}

      {expires && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-white/60">
          <Clock className="h-3.5 w-3.5" />
          Válido até {expires.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] p-3 text-[11.5px] text-white/70">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-neon-cyan" />
        Aguardando pagamento — assim que o PIX cair, seu pedido é confirmado automaticamente.
      </div>
    </div>
  );
}

function CardSection({
  order,
  setOrder,
  user,
}: {
  order: Order;
  setOrder: (o: Order) => void;
  user: { email?: string | null; id?: string } | null;
}) {
  const genCard = useServerFn(createAsaasCardForOrder);
  const [processing, setProcessing] = useState(false);
  const saved = safeLoadCustomer();
  const [holderName, setHolderName] = useState(order.customer_name || saved.name || "");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [email, setEmail] = useState(user?.email || saved.email || "");
  const [cpf, setCpf] = useState(saved.cpf || "");
  const [cep, setCep] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [installments, setInstallments] = useState(1);

  const maxInst = useMemo(() => {
    const t = Number(order.total);
    // Asaas requires min ~R$5 por parcela
    return Math.min(12, Math.max(1, Math.floor(t / 5)));
  }, [order.total]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCpf(cpf)) return toast.error("CPF inválido.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("E-mail inválido.");
    if (number.replace(/\D/g, "").length < 12) return toast.error("Número do cartão incompleto.");
    if (!/^\d{2}\/\d{2,4}$/.test(expiry.trim())) return toast.error("Validade no formato MM/AA.");
    if (ccv.length < 3) return toast.error("CVV inválido.");
    if (cep.replace(/\D/g, "").length !== 8) return toast.error("CEP inválido.");
    if (!addrNumber.trim()) return toast.error("Informe o número do endereço.");

    const [mm, yyRaw] = expiry.split("/");
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;

    setProcessing(true);
    try {
      const res = await genCard({
        data: {
          orderId: order.id,
          customer: {
            name: holderName.trim(),
            email: email.trim(),
            cpfCnpj: cpfDigits(cpf),
            phone: order.phone || undefined,
            postalCode: cep.replace(/\D/g, ""),
            addressNumber: addrNumber.trim(),
          },
          card: {
            holderName: holderName.trim().toUpperCase(),
            number: number.replace(/\D/g, ""),
            expiryMonth: mm.padStart(2, "0"),
            expiryYear: yy,
            ccv,
          },
          installmentCount: installments,
        },
      });
      const st = (res.status || "").toUpperCase();
      if (st === "CONFIRMED" || st === "RECEIVED") {
        toast.success("Pagamento aprovado! 🎉");
      } else if (st === "PENDING") {
        toast.info("Cartão em análise. Assim que confirmar, atualizamos aqui.");
      } else {
        toast.info(`Status: ${st}`);
      }
      const { data } = await supabase.from("orders").select("*").eq("id", order.id).maybeSingle();
      if (data) setOrder(data as Order);
    } catch (err: any) {
      toast.error("Pagamento recusado", { description: err?.message || "Verifique os dados e tente outro cartão.", duration: 8000 });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-neon-pink/15 text-neon-pink">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-extrabold text-white">Pagamento com cartão</div>
            <div className="text-[11px] text-white/60 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Dados criptografados via Asaas
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <Field label="Nome como está no cartão" value={holderName} onChange={setHolderName} placeholder="Ex: MARIA S SILVA" />
          <Field
            label="Número do cartão"
            value={formatCardNumber(number)}
            onChange={(v) => setNumber(v.replace(/\D/g, "").slice(0, 19))}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Validade (MM/AA)"
              value={expiry}
              onChange={(v) => setExpiry(formatExpiry(v))}
              placeholder="12/29"
              inputMode="numeric"
            />
            <Field
              label="CVV"
              value={ccv}
              onChange={(v) => setCcv(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              inputMode="numeric"
              type="password"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF do titular" value={formatCpf(cpf)} onChange={setCpf} placeholder="000.000.000-00" inputMode="numeric" />
            <Field label="E-mail" value={email} onChange={setEmail} placeholder="voce@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CEP" value={formatCep(cep)} onChange={setCep} placeholder="00000-000" inputMode="numeric" />
            <Field label="Número" value={addrNumber} onChange={setAddrNumber} placeholder="123" inputMode="numeric" />
          </div>

          {maxInst > 1 && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Parcelamento</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-neon-pink/60"
              >
                {Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-[oklch(0.18_0.11_305)]">
                    {n}x de {brl(Number(order.total) / n)} {n === 1 ? "(à vista)" : "sem juros"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={processing}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-4 text-sm font-extrabold text-white active:scale-[.98] disabled:opacity-60",
        )}
      >
        {processing && <Loader2 className="h-4 w-4 animate-spin" />}
        {processing ? "Processando pagamento…" : `Pagar ${brl(Number(order.total))}`}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email";
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink/60"
      />
    </div>
  );
}

function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
function formatCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function safeLoadCustomer(): { name?: string; phone?: string; email?: string; cpf?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem("querobis:pending_payment_cpf");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
