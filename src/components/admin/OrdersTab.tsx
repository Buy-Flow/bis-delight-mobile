import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  ChefHat,
  
  Package,
  MapPin,
  Phone,
  ShoppingBag,
  Undo2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/cart-context";

type OrderStatus = "pendente" | "pago" | "preparando" | "entregue" | "cancelado";

type OrderItem = {
  id: string;
  name: string;
  size: string | null;
  flavor: string | null;
  extras: { label: string; price: number }[] | null;
  removed: string[] | null;
  note: string | null;
  quantity: number;
  unit_price: number;
};

type Order = {
  id: string;
  user_id: string;
  mode: string;
  customer_name: string;
  phone: string;
  address: string | null;
  reference: string | null;
  note: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
};

type StatusTheme = {
  label: string;
  icon: typeof Clock;
  badge: string; // solid pill
  border: string; // card border
  accent: string; // text/glow accent
  ringGlow: string; // shadow
};

const STATUS_THEME: Record<OrderStatus, StatusTheme> = {
  pendente: {
    label: "Pendente",
    icon: Clock,
    badge: "bg-neon-yellow text-[oklch(0.13_0.08_305)]",
    border: "border-neon-yellow/30",
    accent: "text-neon-yellow",
    ringGlow: "shadow-[0_0_25px_-8px_var(--neon-yellow)]",
  },
  pago: {
    label: "Pago",
    icon: CheckCircle2,
    badge: "bg-emerald-400 text-emerald-950",
    border: "border-emerald-400/30",
    accent: "text-emerald-300",
    ringGlow: "shadow-[0_0_25px_-8px_theme(colors.emerald.400)]",
  },
  preparando: {
    label: "Preparando",
    icon: ChefHat,
    badge: "bg-neon-cyan text-[oklch(0.13_0.08_305)]",
    border: "border-neon-cyan/30",
    accent: "text-neon-cyan",
    ringGlow: "shadow-[0_0_25px_-8px_var(--neon-cyan)]",
  },
  entregue: {
    label: "Entregue",
    icon: Truck,
    badge: "bg-white/90 text-[oklch(0.13_0.08_305)]",
    border: "border-white/20",
    accent: "text-white/80",
    ringGlow: "",
  },
  cancelado: {
    label: "Cancelado",
    icon: XCircle,
    badge: "bg-red-500 text-white",
    border: "border-red-500/30",
    accent: "text-red-300",
    ringGlow: "",
  },
};

type FilterId = OrderStatus | "todos";

const FILTERS: { id: FilterId; label: string; color: string }[] = [
  { id: "todos", label: "Todos", color: "border-white/20 text-white/80" },
  { id: "pendente", label: "Pendentes", color: "border-neon-yellow/50 text-neon-yellow" },
  { id: "pago", label: "Pagos", color: "border-emerald-400/50 text-emerald-300" },
  { id: "preparando", label: "Preparando", color: "border-neon-cyan/50 text-neon-cyan" },
  { id: "entregue", label: "Entregues", color: "border-white/20 text-white/70" },
  { id: "cancelado", label: "Cancelados", color: "border-red-500/50 text-red-300" },
];

const isToday = (d: Date) => {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export function OrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<FilterId>("pendente");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    setRefreshing(false);
    if (error) {
      toast.error("Erro ao carregar pedidos: " + error.message);
      return;
    }
    setOrders((data ?? []) as unknown as Order[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const interval = setInterval(() => load(), 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);


  const filtered = useMemo(() => {
    if (!orders) return [];
    return filter === "todos" ? orders : orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (orders ?? []).forEach((o) => {
      c[o.status] = (c[o.status] ?? 0) + 1;
    });
    return c;
  }, [orders]);

  const kpis = useMemo(() => {
    const list = orders ?? [];
    const today = list.filter((o) => isToday(new Date(o.created_at)));
    const paidToday = today.filter((o) =>
      ["pago", "preparando", "entregue"].includes(o.status),
    );
    const revenue = paidToday.reduce((s, o) => s + Number(o.total || 0), 0);
    const avg = paidToday.length > 0 ? revenue / paidToday.length : 0;
    const pendingToday = today.filter((o) => o.status === "pendente").length;
    return {
      pendingToday,
      revenue,
      avgTicket: avg,
      total: list.length,
    };
  }, [orders]);

  const setStatus = async (order: Order, status: OrderStatus) => {
    setBusy(order.id);
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setBusy(null);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(`Pedido atualizado para ${STATUS_THEME[status].label.toLowerCase()}.`);
    setOrders((prev) => (prev ? prev.map((o) => (o.id === order.id ? { ...o, status } : o)) : prev));
  };

  if (orders === null) {
    return (
      <div className="flex items-center justify-center py-24 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-purple-900/50 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-4xl font-black uppercase tracking-tighter text-white md:text-5xl"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
          >
            Quero{" "}
            <span className="text-neon-pink drop-shadow-[0_0_10px_var(--neon-pink)]">Bis</span>
            <span className="ml-0 mt-1 block text-xl font-bold text-neon-cyan/80 md:ml-4 md:mt-0 md:inline">
              Painel de Pedidos
            </span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-white/50">
            Gerenciamento em tempo real
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-purple-500/30 bg-purple-900/30 px-4 py-2 md:self-auto">
          <span
            className={cn(
              "h-2 w-2 rounded-full bg-neon-cyan",
              refreshing ? "animate-spin" : "animate-pulse shadow-[0_0_10px_var(--neon-cyan)]",
            )}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            {refreshing ? "Atualizando" : "Ao vivo"}
          </span>
        </div>

      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Pendentes hoje" value={String(kpis.pendingToday).padStart(2, "0")} accent="text-neon-yellow" />
        <KpiCard label="Faturamento (hoje)" value={brl(kpis.revenue)} accent="text-neon-cyan" />
        <KpiCard label="Ticket médio" value={brl(kpis.avgTicket)} accent="text-neon-pink" />
        <KpiCard label="Total de pedidos" value={String(kpis.total)} accent="text-white" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.id === "todos" ? orders.length : counts[f.id] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                active
                  ? "border-transparent bg-neon-pink text-white shadow-[0_0_15px_rgba(255,46,151,0.45)] hover:scale-[1.03]"
                  : cn("bg-purple-900/40", f.color, "hover:bg-white/[0.06]"),
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active ? "bg-white/25 text-white" : "bg-white/10 text-white/70",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Warning */}
      <div className="flex items-center gap-3 rounded-lg border border-neon-yellow/30 bg-neon-yellow/[0.06] p-3">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-neon-yellow shadow-[0_0_8px_var(--neon-yellow)]" />
        <span className="text-[11px] font-bold uppercase italic tracking-wide text-neon-yellow">
          Aviso: Marque como Pago só depois de confirmar o pagamento pelo WhatsApp.
        </span>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-purple-500/20 bg-[oklch(0.15_0.09_305)] p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-white/30" />
          <p className="text-sm text-white/60">Nenhum pedido nesta categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} busy={busy === o.id} onStatus={setStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-colors hover:border-purple-500/40">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
        {label}
      </span>
      <div
        className={cn("mt-1 text-3xl font-black", accent)}
        style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
      >
        {value}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onStatus,
}: {
  order: Order;
  busy: boolean;
  onStatus: (o: Order, s: OrderStatus) => void;
}) {
  const theme = STATUS_THEME[order.status] ?? STATUS_THEME.pendente;
  const Icon = theme.icon;
  const created = new Date(order.created_at);
  const timeLabel = isToday(created)
    ? `Hoje, ${created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : created.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const phoneDigits = order.phone.replace(/\D/g, "");

  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-[oklch(0.15_0.09_305)] transition-all animate-fade-in",
        theme.border,
        theme.ringGlow,
        "hover:border-neon-cyan/50",
      )}
    >
      {/* Header (clickable to expand) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-6 pb-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                theme.badge,
              )}
            >
              <Icon className="h-3 w-3" />
              {theme.label}
            </span>
            <span className="font-mono text-[10px] uppercase text-white/40">
              #{order.id.slice(0, 8)}
            </span>
          </div>
          <h3
            className="truncate text-2xl font-black uppercase text-white"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
          >
            {order.customer_name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase">
            <span className="text-white/50">{timeLabel}</span>
            <span
              className={cn(
                order.mode === "entrega" ? "text-neon-pink" : "text-white/60",
              )}
            >
              {order.mode === "entrega" ? "Entrega" : "Retirada"}
            </span>
            <span className="text-white/40">·</span>
            <span className="text-neon-yellow">
              {order.order_items.reduce((s, it) => s + it.quantity, 0)} itens
            </span>
          </div>
          {expanded && (
            <a
              href={`https://wa.me/55${phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-neon-cyan hover:underline"
            >
              <Phone className="h-3 w-3" />
              {order.phone}
              <span className="text-white/40">(WhatsApp)</span>
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="text-xl font-black text-neon-yellow drop-shadow-[0_0_10px_rgba(253,224,71,0.25)]"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
          >
            {brl(Number(order.total))}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-white/50 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
      <>


      {/* Items */}
      <div className="space-y-3 px-6">
        <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
          <ul className="space-y-3 text-sm">
            {order.order_items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-white">
                    <span className="text-neon-pink">{it.quantity}×</span> {it.name}
                    {it.size && <span className="text-white/60"> · {it.size}</span>}
                  </p>
                  {it.flavor && (
                    <p className="text-xs text-white/60">Sabor: {it.flavor}</p>
                  )}
                  {it.extras && it.extras.length > 0 && (
                    <p className="text-xs text-white/75">
                      Extras: {it.extras.map((e) => e.label).join(", ")}
                    </p>
                  )}
                  {it.removed && it.removed.length > 0 && (
                    <p className="text-[11px] font-semibold italic text-red-400">
                      Remover: {it.removed.join(", ")}
                    </p>
                  )}
                  {it.note && (
                    <p className="text-[11px] italic text-white/55">"{it.note}"</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                  {brl(Number(it.unit_price) * it.quantity)}
                </span>
              </li>
            ))}
          </ul>
          {order.note && (
            <div className="mt-4 border-t border-white/5 pt-3">
              <p className="text-xs italic text-white/60">
                <span className="font-bold text-white/75">Obs: </span>
                {order.note}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      {order.mode === "entrega" && order.address && (
        <div className="mt-4 px-6">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
            <MapPin className="h-3 w-3" /> Endereço de Entrega
          </p>
          <p className="text-xs text-white/75">
            {order.address}
            {order.reference ? ` · ${order.reference}` : ""}
          </p>
        </div>
      )}

      {/* Totals + Actions */}
      <div className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
          <div className="space-y-0.5">
            <p className="text-[11px] text-white/50">
              Subtotal: <span className="text-white/70">{brl(Number(order.subtotal))}</span>
            </p>
            <p className="text-[11px] text-white/50">
              Taxa Entrega:{" "}
              <span className="text-white/70">
                {Number(order.delivery_fee) > 0 ? brl(Number(order.delivery_fee)) : "Grátis"}
              </span>
            </p>
            <p
              className="text-xl font-black text-neon-yellow drop-shadow-[0_0_10px_rgba(253,224,71,0.25)]"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              TOTAL: {brl(Number(order.total))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.status === "pendente" && (
              <button
                onClick={() => onStatus(order, "pago")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan bg-transparent px-5 py-3 text-xs font-black uppercase tracking-tighter text-neon-cyan shadow-[0_0_10px_rgba(0,242,255,0.2)] transition-all hover:bg-neon-cyan hover:text-[oklch(0.13_0.08_305)] disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar pagamento
              </button>
            )}
            {order.status === "pago" && (
              <button
                onClick={() => onStatus(order, "preparando")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-neon-pink px-5 py-3 text-xs font-black uppercase tracking-tighter text-[oklch(0.13_0.08_305)] shadow-[0_4px_15px_rgba(255,46,151,0.35)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <ChefHat className="h-3.5 w-3.5" /> Iniciar preparo
              </button>
            )}
            {order.status === "preparando" && (
              <button
                onClick={() => onStatus(order, "entregue")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-5 py-3 text-xs font-black uppercase tracking-tighter text-[oklch(0.13_0.08_305)] transition-all hover:bg-white disabled:opacity-50"
              >
                <Truck className="h-3.5 w-3.5" /> Marcar entregue
              </button>
            )}
            {order.status !== "cancelado" && order.status !== "entregue" && (
              <button
                onClick={() => onStatus(order, "cancelado")}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-400 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
                aria-label="Cancelar pedido"
                title="Cancelar pedido"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
            {(order.status === "cancelado" || order.status === "entregue") && (
              <button
                onClick={() => onStatus(order, "pendente")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-tighter text-white/70 transition hover:bg-white/5 disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" /> Voltar para pendente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// silence unused import warning for icons kept for future use
void ShoppingBag;
