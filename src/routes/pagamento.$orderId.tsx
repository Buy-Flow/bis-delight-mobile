import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { brl } from "@/lib/cart-context";
import { createAsaasPixForOrder, createAsaasCardForOrder, getAsaasPaymentStatus } from "@/lib/asaas.functions";
import { useServerFn } from "@tanstack/react-start";
import { formatCpf, cpfDigits, isValidCpf } from "@/lib/cpf";
import { toast } from "sonner";
import { Loader2, QrCode, CreditCard, Copy, Check, ShieldCheck, ArrowLeft, PartyPopper, Clock, RefreshCw, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSP } from "@/lib/tz";
import { detectCardBrand } from "@/lib/card-brand";

const searchSchema = z.object({
  m: z.enum(["pix", "cartao", "asaas"]).catch("pix"),
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

    // Fallback polling: consulta o Asaas ao vivo a cada 8s. Isso reconcilia
    // o status mesmo se o webhook estiver falhando (token divergente etc.).
    const syncFn = getAsaasPaymentStatus;
    const iv = setInterval(async () => {
      if (cancelled) return;
      try {
        const fresh = await syncFn({ data: { orderId } });
        if (!cancelled && fresh) {
          setOrder((prev) => ({ ...(prev as Order), ...(fresh as Partial<Order>) } as Order));
        }
      } catch {
        // silencioso — a próxima tentativa cobre falhas de rede pontuais
      }
    }, 8000);

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">Pedido</div>
              <div className="mt-0.5 font-mono text-sm text-white/80">#{orderId.slice(0, 8)}</div>
            </div>
            {order && !paid && (
              <span className="rounded-full bg-neon-yellow/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neon-yellow ring-1 ring-neon-yellow/40">
                Aguardando pagamento
              </span>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-white/70">Total</span>
            <span className="font-display text-3xl font-extrabold text-neon-yellow">
              {order ? brl(Number(order.total)) : "..."}
            </span>
          </div>
        </div>

        {order && !paid && !loading && order.payment_method !== "asaas_checkout" && m !== "asaas" && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
            <MethodTab
              active={m === "pix"}
              onClick={() => navigate({ to: "/pagamento/$orderId", params: { orderId }, search: { m: "pix" } })}
              icon={QrCode}
              label="PIX"
              hint="QR na hora"
            />
            <MethodTab
              active={m === "cartao"}
              onClick={() => navigate({ to: "/pagamento/$orderId", params: { orderId }, search: { m: "cartao" } })}
              icon={CreditCard}
              label="Cartão"
              hint={`Até 12x`}
            />
          </div>
        )}


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
        ) : m === "asaas" || order.payment_method === "asaas_checkout" ? (
          <AsaasCheckoutSection order={order} />
        ) : m === "pix" ? (
          <PixSection order={order} setOrder={setOrder} />
        ) : (
          <CardSection order={order} setOrder={setOrder} user={user} />
        )}


        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/50">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          Pagamento criptografado · Processado por Asaas
        </div>
      </div>
    </div>
  );
}

function MethodTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition active:scale-[.98]",
        active ? "bg-white/10 ring-1 ring-white/25" : "text-white/70 hover:bg-white/[0.04]",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-neon-yellow" : "text-white/50")} />
      <div className="text-left leading-tight">
        <div className="text-[13px] font-extrabold text-white">{label}</div>
        <div className="text-[9.5px] text-white/50">{hint}</div>
      </div>
    </button>
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
        to="/conta"
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
  const [pixError, setPixError] = useState<string | null>(null);
  const attemptRef = useRef(0);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setPixError(null);
    attemptRef.current += 1;
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
      const { data } = await supabase.from("orders").select("*").eq("id", order.id).maybeSingle();
      if (data) setOrder(data as Order);
    } catch (e: any) {
      const message = e?.message || "Tente novamente em alguns instantes.";
      setPixError(message);
      toast.error("Não foi possível gerar o PIX", { description: message, duration: 8000 });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (order.pix_qr_code_base64 || generating || attemptRef.current > 0) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const expiresAt = useMemo(() => {
    if (!order.pix_expires_at) return null;
    const d = new Date(order.pix_expires_at);
    return isNaN(d.getTime()) ? null : d;
  }, [order.pix_expires_at]);

  // Live countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const msLeft = expiresAt ? expiresAt.getTime() - now : 0;
  const expired = expiresAt !== null && msLeft <= 0;
  const urgent = expiresAt !== null && msLeft > 0 && msLeft < 5 * 60_000;
  const countdown = expiresAt
    ? (() => {
        const total = Math.max(0, Math.floor(msLeft / 1000));
        const hh = Math.floor(total / 3600);
        const mm = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
        const ss = (total % 60).toString().padStart(2, "0");
        return hh > 0 ? `${hh.toString().padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
      })()
    : null;



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
        <div className="mt-1 text-[11px] text-white/50">Isso costuma levar 2–3 segundos.</div>
      </div>
    );
  }

  if (pixError && !order.pix_qr_code_base64) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div className="flex-1">
            <div className="font-extrabold text-white">Não conseguimos gerar o PIX</div>
            <div className="mt-1 text-[13px] text-red-100/90">{pixError}</div>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-yellow px-4 py-3 text-sm font-extrabold text-[oklch(0.18_0.11_305)] disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-neon-yellow/15 text-neon-yellow">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-extrabold text-white">Pague com PIX</div>
            <div className="text-[11px] text-white/60">Aponte a câmera do banco ou copie o código.</div>
          </div>
        </div>
        {countdown && !expired && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums ring-1",
              urgent
                ? "animate-pulse bg-red-500/20 text-red-100 ring-red-400/40"
                : "bg-emerald-500/15 text-emerald-100 ring-emerald-400/30",
            )}
            aria-live="polite"
          >
            <Clock className="h-3 w-3" />
            {countdown}
          </div>
        )}
      </div>

      {expired ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center">
          <div className="font-extrabold text-amber-100">Este PIX expirou</div>
          <div className="mt-1 text-[12px] text-amber-100/80">
            Gere um novo código para concluir o pagamento — o pedido continua ativo.
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-neon-yellow px-4 py-2.5 text-sm font-extrabold text-[oklch(0.18_0.11_305)] disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Gerar novo PIX
          </button>
        </div>
      ) : order.pix_qr_code_base64 ? (
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

      {order.pix_copy_paste && !expired && (
        <>
          <button
            type="button"
            onClick={copy}
            title="Toque para copiar"
            className="mt-3 block w-full break-all rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left font-mono text-[11px] text-white/80 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-yellow/60"
          >
            {order.pix_copy_paste}
          </button>
          <button
            onClick={copy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-yellow px-4 py-3 text-sm font-extrabold text-[oklch(0.18_0.11_305)] active:scale-95"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
        </>
      )}

      {!expired && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] p-3 text-[11.5px] text-white/70">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-neon-cyan" />
          Aguardando pagamento — assim que o PIX cair, seu pedido é confirmado automaticamente.
        </div>
      )}
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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const brand = detectCardBrand(number);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!holderName.trim() || holderName.trim().length < 3) errs.holderName = "Informe o nome como está no cartão.";
    if (number.replace(/\D/g, "").length < 12) errs.number = "Número incompleto.";
    if (!/^\d{2}\/\d{2,4}$/.test(expiry.trim())) errs.expiry = "Formato MM/AA.";
    else {
      const [mm, yyRaw] = expiry.split("/");
      const yy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
      const monthNum = Number(mm);
      if (monthNum < 1 || monthNum > 12) errs.expiry = "Mês inválido.";
      else {
        const end = new Date(yy, monthNum, 0, 23, 59, 59);
        if (end.getTime() < Date.now()) errs.expiry = "Cartão vencido.";
      }
    }
    if (ccv.length < 3) errs.ccv = "CVV inválido.";
    if (!isValidCpf(cpf)) errs.cpf = "CPF inválido.";
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "E-mail inválido.";
    if (cep.replace(/\D/g, "").length !== 8) errs.cep = "CEP com 8 dígitos.";
    if (!addrNumber.trim()) errs.addrNumber = "Obrigatório.";
    return errs;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Confira os campos destacados.");
      return;
    }

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
      const message = err?.message || "Verifique os dados e tente outro cartão.";
      setSubmitError(message);
      toast.error("Pagamento recusado", { description: message, duration: 8000 });
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
          <Field label="Nome como está no cartão" value={holderName} onChange={setHolderName} placeholder="Ex: MARIA S SILVA" error={fieldErrors.holderName} />
          <div className="relative">
            <Field
              label="Número do cartão"
              value={formatCardNumber(number)}
              onChange={(v) => setNumber(v.replace(/\D/g, "").slice(0, 19))}
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              error={fieldErrors.number}
            />
            {brand && (
              <span className="pointer-events-none absolute right-3 top-8 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ring-1 ring-white/20">
                {brand}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Validade (MM/AA)"
              value={expiry}
              onChange={(v) => setExpiry(formatExpiry(v))}
              placeholder="12/29"
              inputMode="numeric"
              error={fieldErrors.expiry}
            />
            <Field
              label="CVV"
              value={ccv}
              onChange={(v) => setCcv(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              inputMode="numeric"
              type="password"
              error={fieldErrors.ccv}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF do titular" value={formatCpf(cpf)} onChange={setCpf} placeholder="000.000.000-00" inputMode="numeric" error={fieldErrors.cpf} />
            <Field label="E-mail" value={email} onChange={setEmail} placeholder="voce@email.com" error={fieldErrors.email} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CEP" value={formatCep(cep)} onChange={setCep} placeholder="00000-000" inputMode="numeric" error={fieldErrors.cep} />
            <Field label="Número" value={addrNumber} onChange={setAddrNumber} placeholder="123" inputMode="numeric" error={fieldErrors.addrNumber} />
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

      {submitError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <div>
            <div className="font-extrabold">Pagamento recusado</div>
            <div className="mt-0.5 text-red-100/90">{submitError}</div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={processing}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-4 text-sm font-extrabold text-white active:scale-[.98] disabled:opacity-60",
        )}
      >
        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
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
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email";
  type?: string;
  error?: string;
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
        aria-invalid={!!error}
        className={cn(
          "w-full rounded-2xl border bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none",
          error ? "border-red-400/60 focus:border-red-400" : "border-white/10 focus:border-neon-pink/60",
        )}
      />
      {error && <div className="mt-1 text-[11px] font-semibold text-red-300">{error}</div>}
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

function AsaasCheckoutSection({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  const url = useMemo(() => {
    if (order.invoice_url) return order.invoice_url;
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(`querobis:asaas_url:${order.id}`);
    } catch {
      return null;
    }
  }, [order.invoice_url, order.id]);

  useEffect(() => {
    if (!openedAt) return;
    const t = setTimeout(() => setShowHelp(true), 8000);
    return () => clearTimeout(t);
  }, [openedAt]);

  const open = () => {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      setOpenedAt(Date.now());
    } catch {
      toast.error("Não deu para abrir. Copie o link e cole em outro navegador.");
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link do pagamento copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não deu para copiar. Selecione manualmente.");
    }
  };

  if (!url) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <div className="font-extrabold text-white">Link de pagamento indisponível</div>
            <div className="mt-1 text-[13px] text-red-100/90">
              Volte ao carrinho e escolha PIX ou Cartão para gerar um novo pagamento.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-neon-yellow/15 text-neon-yellow">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-extrabold text-white">Checkout seguro Asaas</div>
          <div className="text-[11px] text-white/60">Escolha PIX, cartão ou boleto na próxima página.</div>
        </div>
      </div>

      <button
        onClick={open}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-yellow px-4 py-3 text-sm font-extrabold text-[oklch(0.18_0.11_305)] active:scale-95"
      >
        <ExternalLink className="h-4 w-4" />
        Abrir checkout Asaas
      </button>

      <button
        onClick={copy}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-extrabold text-white hover:bg-white/[0.06]"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        {copied ? "Link copiado!" : "Copiar link do pagamento"}
      </button>

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11.5px] text-white/60 hover:text-white/80"
      >
        <Info className="h-3.5 w-3.5" />
        A página do Asaas não abriu?
      </button>

      {showHelp && (
        <div className="mt-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-[12.5px] text-amber-100/95">
          <div className="font-extrabold text-amber-100">Se o navegador recusou a conexão com asaas.com:</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Toque em <strong>Copiar link</strong> e abra em <strong>outro navegador</strong> (Chrome, Firefox ou Safari).</li>
            <li>Desative <strong>bloqueadores de anúncio, antivírus ou VPN</strong> — eles podem barrar o Asaas.</li>
            <li>Se estiver em <strong>Wi-Fi corporativo</strong>, tente pelos <strong>dados móveis</strong>.</li>
            <li>Alternativa: troque o DNS do aparelho para <strong>1.1.1.1</strong> ou <strong>8.8.8.8</strong>.</li>
          </ol>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] p-3 text-[11.5px] text-white/70">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-neon-cyan" />
        Aguardando confirmação — esta página atualiza sozinha quando o pagamento cair.
      </div>
    </div>
  );
}
