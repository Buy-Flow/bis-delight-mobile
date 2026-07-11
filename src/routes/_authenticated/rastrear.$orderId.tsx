import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bike,
  Check,
  ChefHat,
  Clock,
  CreditCard,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TrackingPageSkeleton } from "@/components/ui/skeletons";
import { ReviewSubmitDialog } from "@/components/reviews/ReviewSubmitDialog";

export const Route = createFileRoute("/_authenticated/rastrear/$orderId")({
  head: () => ({
    meta: [
      { title: "Rastrear pedido — Quero Bis" },
      { name: "description", content: "Acompanhe seu pedido em tempo real: recebido, preparando, saiu para entrega e entregue." },
    ],
  }),
  component: RastrearPage,
});

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  mode: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  reference: string | null;
  note: string | null;
  coupon_code: string | null;
  created_at: string;
  paid_at: string | null;
  preparing_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  order_items: Array<{
    name: string;
    quantity: number;
    size: string | null;
    flavor: string | null;
    unit_price: number;
  }>;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

function RastrearPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, user_id, status, mode, total, subtotal, delivery_fee, customer_name, phone, address, reference, note, coupon_code, created_at, paid_at, preparing_at, dispatched_at, delivered_at, canceled_at, order_items(name, quantity, size, flavor, unit_price)",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        setOrder(null);
      } else {
        setOrder(data as unknown as OrderRow);
      }
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel(`track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        load,
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const isDelivery = order?.mode === "entrega";
  const isCanceled = order?.status === "cancelado";

  type Step = {
    key: string;
    label: string;
    sub: string;
    icon: typeof CreditCard;
    at: string | null;
    reached: boolean;
    active: boolean;
  };

  const steps = useMemo<Step[]>(() => {
    if (!order) return [];
    const s = order.status;
    const reached = (target: string[]) => target.includes(s);
    const list: Array<Omit<Step, "reached" | "active">> = [
      {
        key: "recebido",
        label: "Pedido recebido",
        sub: "Recebemos seu pedido!",
        icon: ShoppingBag,
        at: order.created_at,
      },
      {
        key: "confirmado",
        label: "Pagamento confirmado",
        sub: "Vamos começar a preparar",
        icon: CreditCard,
        at: order.paid_at,
      },
      {
        key: "preparando",
        label: "Preparando",
        sub: "Nossa equipe está montando seu açaí",
        icon: ChefHat,
        at: order.preparing_at,
      },
      isDelivery
        ? {
            key: "saiu",
            label: "Saiu para entrega",
            sub: "O entregador está a caminho",
            icon: Bike,
            at: order.dispatched_at,
          }
        : {
            key: "pronto",
            label: "Pronto para retirada",
            sub: "Pode vir buscar!",
            icon: Store,
            at: order.dispatched_at,
          },
      {
        key: "entregue",
        label: isDelivery ? "Entregue" : "Retirado",
        sub: "Obrigado pela preferência 💜",
        icon: PackageCheck,
        at: order.delivered_at,
      },
    ];
    const statusRank: Record<string, number> = {
      pendente: 0,
      novo: 0,
      pago: 1,
      preparando: 2,
      saiu_para_entrega: 3,
      entregue: 4,
      cancelado: -1,
    };
    const currentIdx = statusRank[s] ?? 0;
    return list.map((step, i) => ({
      ...step,
      reached: i < currentIdx,
      active: i === currentIdx,
    })) as Step[];
  }, [order, isDelivery]);

  const eta = useMemo(() => {
    if (!order) return null;
    void tick;
    const baseTs = new Date(order.paid_at ?? order.created_at).getTime();
    const durationMin = isDelivery ? 45 : 25;
    const etaTs = baseTs + durationMin * 60_000;
    const diffMs = etaTs - Date.now();
    const mins = Math.round(diffMs / 60_000);
    return { etaTs, mins };
  }, [order, isDelivery, tick]);

  if (loading) {
    return <TrackingPageSkeleton />;
  }

  if (!order) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#1a0b2e] px-6 text-center text-white">
        <div>
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-white/5">
            <X className="h-7 w-7 text-white/50" />
          </div>
          <h1 className="text-lg font-black">Pedido não encontrado</h1>
          <p className="mt-1 text-sm text-white/60">Talvez o link esteja incorreto ou o pedido não seja seu.</p>
          <Link
            to="/conta"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-neon-cyan px-5 py-2.5 text-sm font-bold text-[#0a1a24]"
          >
            Meus pedidos
          </Link>
        </div>
      </main>
    );
  }

  const bigLabel = isCanceled
    ? "Pedido cancelado"
    : order.status === "entregue"
      ? isDelivery
        ? "Pedido entregue 🎉"
        : "Pedido concluído 🎉"
      : order.status === "saiu_para_entrega"
        ? isDelivery
          ? "Saiu para entrega"
          : "Pronto para retirada"
        : order.status === "preparando"
          ? "Preparando com carinho"
          : order.status === "pago"
            ? "Pagamento confirmado"
            : "Aguardando confirmação";

  const bigSub = isCanceled
    ? "Este pedido foi cancelado."
    : order.status === "entregue"
      ? "Volte sempre!"
      : eta && eta.mins > 0
        ? isDelivery
          ? `Chegada estimada em ~${eta.mins} min`
          : `Fica pronto em ~${eta.mins} min`
        : eta && eta.mins <= 0 && order.status !== "entregue"
          ? "Quase lá…"
          : "";

  const HeroIcon =
    order.status === "saiu_para_entrega"
      ? Bike
      : order.status === "preparando"
        ? ChefHat
        : order.status === "entregue"
          ? PackageCheck
          : CreditCard;

  const phoneDigits = "5527996820404";
  const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
    `Olá! Sobre meu pedido #${order.id.slice(0, 8).toUpperCase()}`,
  )}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1a0b2e] pb-24 text-white">
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-neon-cyan/20 blur-[120px]" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-neon-pink/25 blur-[100px]" />
        <div className="absolute top-32 -left-24 h-72 w-72 rounded-full bg-neon-yellow/15 blur-[100px]" />
      </div>

      {/* Top nav */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a0b2e] via-[#1a0b2e]/85 to-transparent pb-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate({ to: "/conta" })}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan/90">Pedido</div>
            <div className="truncate font-mono text-[13px] font-bold text-white">
              #{order.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          {!isCanceled && order.status !== "entregue" && (
            <div className="flex items-center gap-1 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neon-cyan">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-cyan opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-cyan" />
              </span>
              Ao vivo
            </div>
          )}
        </div>
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pt-3">
        {/* Hero card */}
        <section
          className={cn(
            "relative overflow-hidden rounded-[32px] border p-6 shadow-[0_30px_80px_-40px_rgba(34,211,238,0.55)]",
            isCanceled
              ? "border-red-500/40 bg-gradient-to-br from-[#3a1216] via-[#2a0b0f] to-[#1a0708]"
              : "border-white/10 bg-gradient-to-br from-[#123047] via-[#1a1740] to-[#2a1240]",
          )}
        >
          {!isCanceled && (
            <>
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-cyan/30 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-neon-pink/20 blur-3xl" />
            </>
          )}

          <div className="relative flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <div
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-full blur-xl",
                  isCanceled ? "bg-red-500/30" : "bg-gradient-to-br from-neon-cyan/50 to-neon-pink/40 opacity-70",
                )}
              />
              <div
                className={cn(
                  "relative grid h-20 w-20 place-items-center rounded-full",
                  isCanceled
                    ? "bg-red-500/20 ring-2 ring-red-500/40"
                    : "bg-white/5 ring-2 ring-neon-cyan/40",
                )}
              >
                {isCanceled ? (
                  <X className="h-9 w-9 text-red-300" strokeWidth={2.5} />
                ) : (
                  <HeroIcon
                    className={cn(
                      "h-9 w-9 text-neon-cyan drop-shadow-[0_0_14px_rgba(34,211,238,0.9)]",
                      order.status === "saiu_para_entrega" && "animate-[bike-move_1.6s_ease-in-out_infinite]",
                      order.status === "preparando" && "animate-[chef-shake_1.2s_ease-in-out_infinite]",
                    )}
                  />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                {isDelivery ? "Modo: Entrega" : "Modo: Retirada"}
              </div>
              <h1 className={cn("text-2xl font-black leading-tight", isCanceled ? "text-red-200" : "text-white")}>
                {bigLabel}
              </h1>
              {bigSub && <div className="mt-1 text-sm text-white/70">{bigSub}</div>}
            </div>
          </div>

          {!isCanceled && order.status !== "entregue" && eta && (
            <div className="relative mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-neon-yellow" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-white/60">Previsão</div>
                  <div className="text-sm font-bold text-white">
                    {new Date(eta.etaTs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/60">Faltam</div>
                <div className="text-lg font-black text-neon-yellow tabular-nums">
                  {eta.mins > 0 ? `${eta.mins} min` : "…"}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Timeline */}
        {!isCanceled && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neon-yellow" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white/80">Linha do tempo</h2>
            </div>
            <ol className="relative space-y-5">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isLast = i === steps.length - 1;
                return (
                  <li key={step.key} className="relative flex items-start gap-4">
                    {!isLast && (
                      <div
                        aria-hidden
                        className={cn(
                          "absolute left-[19px] top-10 h-[calc(100%_+_4px)] w-0.5 rounded-full",
                          step.reached
                            ? "bg-gradient-to-b from-neon-cyan to-neon-pink"
                            : step.active
                              ? "bg-gradient-to-b from-neon-yellow via-neon-yellow/40 to-white/10"
                              : "bg-white/10",
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-all",
                        step.reached &&
                          "border-neon-cyan bg-neon-cyan text-[#0a1a24] shadow-[0_0_18px_rgba(34,211,238,0.55)]",
                        step.active &&
                          "border-neon-yellow bg-neon-yellow/15 text-neon-yellow shadow-[0_0_22px_rgba(255,214,10,0.55)] animate-pulse",
                        !step.reached && !step.active && "border-white/15 bg-black/40 text-white/40",
                      )}
                    >
                      {step.reached ? (
                        <Check className="h-5 w-5" strokeWidth={3} />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={cn(
                            "text-sm font-black leading-tight",
                            step.reached
                              ? "text-white"
                              : step.active
                                ? "text-neon-yellow"
                                : "text-white/50",
                          )}
                        >
                          {step.label}
                        </div>
                        <div
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums",
                            step.reached
                              ? "bg-white/10 text-white/80"
                              : step.active
                                ? "bg-neon-yellow/20 text-neon-yellow"
                                : "bg-transparent text-white/30",
                          )}
                        >
                          {step.reached || step.active ? fmtTime(step.at) : "—"}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 text-[12px]",
                          step.active ? "text-white/85" : step.reached ? "text-white/60" : "text-white/35",
                        )}
                      >
                        {step.sub}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {isCanceled && (
          <section className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/5 p-5 text-center">
            <p className="text-sm text-red-200/90">
              Se você não solicitou o cancelamento, entre em contato conosco pelo WhatsApp.
            </p>
          </section>
        )}

        {/* Address / Pickup */}
        {isDelivery && order.address && (
          <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon-pink/20 text-neon-pink">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/50">Entregar em</div>
                <div className="text-sm font-bold text-white">{order.address}</div>
                {order.reference && (
                  <div className="text-[12px] text-white/60">Ref.: {order.reference}</div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Items */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-neon-cyan" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Itens</h3>
          </div>
          <ul className="divide-y divide-white/5">
            {order.order_items?.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">
                    {it.quantity}× {it.name}
                  </div>
                  {(it.size || it.flavor) && (
                    <div className="truncate text-[11px] text-white/50">
                      {[it.size, it.flavor].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="shrink-0 font-mono text-[12px] text-white/70">
                  {brl(Number(it.unit_price) * it.quantity)}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-white/5 pt-3 text-[13px] text-white/70">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{brl(Number(order.subtotal))}</span>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between">
                <span>Entrega</span>
                <span>{brl(Number(order.delivery_fee))}</span>
              </div>
            )}
            {order.coupon_code && (
              <div className="flex justify-between text-neon-yellow">
                <span>Cupom {order.coupon_code}</span>
                <span>−{brl(Number(order.subtotal) + Number(order.delivery_fee) - Number(order.total))}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-black text-white">
              <span>Total</span>
              <span>{brl(Number(order.total))}</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="mt-5 grid grid-cols-2 gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-500"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(order.id);
              toast.success("Número do pedido copiado!");
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <Phone className="h-4 w-4" />
            Copiar Nº
          </button>
        </section>
      </div>
    </main>
  );
}
