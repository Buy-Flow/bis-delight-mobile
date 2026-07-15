import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  MapPin,
  CreditCard,
  ChefHat,
  Bike,
  PackageCheck,
  Check,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Copy,
  Wallet,
  Store,
  Truck,
  Receipt,
  TrendingUp,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useCart, brl } from "@/lib/cart-context";
import { useProducts } from "@/lib/menu-data";
import { cn } from "@/lib/utils";
import { OrdersListSkeleton } from "@/components/skeleton";
import { confirmDialog } from "@/components/ui/confirm-dialog";

/* ================= Types ================= */

type OrderItem = {
  name: string;
  quantity: number;
  size: string | null;
  flavor: string | null;
  extras: unknown;
  unit_price: number;
  product_id: string | null;
  note?: string | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  paid_at: string | null;
  total: number;
  subtotal: number | null;
  delivery_fee: number | null;
  discount: number | null;
  mode: string;
  status: string;
  payment_method: string | null;
  asaas_status: string | null;
  asaas_payment_id: string | null;
  address: string | null;
  coupon_code: string | null;
  items: OrderItem[];
};

type AbandonedRow = {
  user_id: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; size?: string; flavor?: string; productId: string }>;
  subtotal: number;
  item_count: number;
  updated_at: string;
};

type StatusFilter =
  | "todos"
  | "carrinho"
  | "aguardando_pagamento"
  | "novo"
  | "pendente"
  | "pago"
  | "preparando"
  | "saiu_para_entrega"
  | "entregue"
  | "cancelado";

type ModeFilter = "todos" | "entrega" | "retirada" | "mesa";
type PaymentFilter = "todos" | "pix" | "credit_card" | "asaas_checkout" | "cash" | "on_delivery";
type Period = "7d" | "30d" | "90d" | "365d" | "all";
type SortBy = "recent" | "oldest" | "high" | "low";

const STATUS_META: Record<string, { label: string; cls: string; icon?: typeof CreditCard }> = {
  carrinho: { label: "Carrinho", cls: "bg-neon-cyan/20 text-neon-cyan", icon: ShoppingCart },
  aguardando_pagamento: { label: "Aguardando pagamento", cls: "bg-neon-yellow/20 text-neon-yellow", icon: Clock },
  novo: { label: "Novo", cls: "bg-neon-cyan/20 text-neon-cyan" },
  pendente: { label: "Pendente", cls: "bg-neon-yellow/20 text-neon-yellow" },
  pago: { label: "Pago", cls: "bg-emerald-500/20 text-emerald-300" },
  preparando: { label: "Preparando", cls: "bg-neon-yellow/20 text-neon-yellow" },
  saiu_para_entrega: { label: "Saiu para entrega", cls: "bg-neon-pink/20 text-neon-pink" },
  entregue: { label: "Entregue", cls: "bg-green-500/20 text-green-400" },
  cancelado: { label: "Cancelado", cls: "bg-red-500/20 text-red-400" },
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão",
  asaas_checkout: "Link Asaas",
  cash: "Dinheiro",
  on_delivery: "Na entrega",
};

function paymentLabel(m: string | null | undefined) {
  if (!m) return "—";
  return PAYMENT_LABELS[m] ?? m;
}

function isPendingPayment(o: OrderRow) {
  if (o.status === "pago" || o.status === "entregue" || o.status === "cancelado") return false;
  if (!o.payment_method) return false;
  const online = o.payment_method === "pix" || o.payment_method === "credit_card" || o.payment_method === "asaas_checkout";
  if (!online) return false;
  return !o.paid_at;
}

function effectiveStatus(o: OrderRow): StatusFilter {
  if (isPendingPayment(o)) return "aguardando_pagamento";
  return (o.status as StatusFilter) ?? "novo";
}

function periodStart(p: Period): number {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (p === "7d") return now - 7 * day;
  if (p === "30d") return now - 30 * day;
  if (p === "90d") return now - 90 * day;
  if (p === "365d") return now - 365 * day;
  return 0;
}

/* ================= Panel ================= */

export function OrdersPanelPro() {
  const { user } = useAuth();
  const { items: cartItems, subtotal: cartSubtotal, count: cartCount } = useCart();
  const { data: allProducts = [] } = useProducts();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [abandoned, setAbandoned] = useState<AbandonedRow | null>(null);
  const [loading, setLoading] = useState(true);

  // filters
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [mode, setMode] = useState<ModeFilter>("todos");
  const [payment, setPayment] = useState<PaymentFilter>("todos");
  const [period, setPeriod] = useState<Period>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const productImageById = useMemo(() => {
    const m = new Map<string, string>();
    (allProducts as any[]).forEach((p) => {
      if (p?.id && p?.image) m.set(p.id, p.image);
    });
    return m;
  }, [allProducts]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    const load = async () => {
      const [ordersRes, abandonRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, created_at, paid_at, total, subtotal, delivery_fee, discount, mode, status, payment_method, asaas_status, asaas_payment_id, address, coupon_code, order_items(name, quantity, size, flavor, extras, unit_price, product_id, note)",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("abandoned_carts")
          .select("user_id, items, subtotal, item_count, updated_at")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancel) return;
      setOrders(
        (ordersRes.data ?? []).map((o: any) => ({
          ...o,
          items: (o.order_items ?? []) as OrderItem[],
        })),
      );
      setAbandoned((abandonRes.data as unknown as AbandonedRow) ?? null);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`orders-pro-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  /* stats */
  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status !== "cancelado" && o.paid_at);
    const totalSpent = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    const active = orders.filter(
      (o) => ["novo", "pendente", "pago", "preparando", "saiu_para_entrega"].includes(o.status),
    ).length;
    const pendingPay = orders.filter((o) => isPendingPayment(o)).length;
    return {
      totalOrders: orders.length,
      totalSpent,
      avgTicket: paid.length ? totalSpent / paid.length : 0,
      active,
      pendingPay,
    };
  }, [orders]);

  /* filter + sort */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const since = periodStart(period);
    let list = orders.filter((o) => {
      const eff = effectiveStatus(o);
      if (status !== "todos" && status !== "carrinho" && eff !== status) return false;
      if (mode !== "todos" && o.mode !== mode) return false;
      if (payment !== "todos" && (o.payment_method ?? "") !== payment) return false;
      if (since && new Date(o.created_at).getTime() < since) return false;
      if (q) {
        const hay =
          o.id.slice(0, 8).toLowerCase() +
          " " +
          (o.address ?? "").toLowerCase() +
          " " +
          (o.coupon_code ?? "").toLowerCase() +
          " " +
          o.items.map((it) => it.name.toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = list.sort((a, b) => {
      if (sortBy === "recent") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sortBy === "oldest") return +new Date(a.created_at) - +new Date(b.created_at);
      if (sortBy === "high") return Number(b.total) - Number(a.total);
      return Number(a.total) - Number(b.total);
    });
    return list;
  }, [orders, query, status, mode, payment, period, sortBy]);

  const showCartRow = status === "todos" || status === "carrinho";

  const clearFilters = () => {
    setQuery("");
    setStatus("todos");
    setMode("todos");
    setPayment("todos");
    setPeriod("all");
    setSortBy("recent");
  };

  const hasActiveFilters =
    query || status !== "todos" || mode !== "todos" || payment !== "todos" || period !== "all" || sortBy !== "recent";

  const reorder = (items: OrderItem[]) => {
    // reorder logic delegated to cart context
    const { add } = useCartRawAdd();
    items.forEach((it) => {
      const image = (it.product_id && productImageById.get(it.product_id)) || "";
      add({
        productId: it.product_id ?? `reorder-${it.name}`,
        name: it.name,
        image,
        size: it.size ?? undefined,
        flavor: it.flavor ?? undefined,
        extras: Array.isArray(it.extras) ? (it.extras as any) : [],
        removed: [],
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
      });
    });
    toast.success("Itens adicionados ao carrinho!");
    navigate({ to: "/carrinho" });
  };

  if (loading) return <OrdersListSkeleton />;

  return (
    <div className="space-y-4">
      {/* STATS */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Pedidos"
          value={String(stats.totalOrders)}
          hint={stats.active > 0 ? `${stats.active} em andamento` : "Histórico total"}
          tone="cyan"
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total gasto"
          value={brl(stats.totalSpent)}
          hint={`Ticket ${brl(stats.avgTicket)}`}
          tone="yellow"
        />
      </div>

      {stats.pendingPay > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-neon-yellow" />
          <div className="min-w-0 flex-1 text-xs text-white/85">
            <div className="font-bold">
              {stats.pendingPay} pedido{stats.pendingPay > 1 ? "s" : ""} aguardando pagamento
            </div>
            <div className="text-white/60">Finalize para o preparo iniciar.</div>
          </div>
          <button
            onClick={() => setStatus("aguardando_pagamento")}
            className="rounded-full bg-neon-yellow px-3 py-1.5 text-[11px] font-black text-[oklch(0.18_0.11_305)]"
          >
            Ver
          </button>
        </div>
      )}

      {/* SEARCH + toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por item, id, endereço…"
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-9 text-sm text-white placeholder:text-white/40 outline-none ring-neon-pink/40 focus:ring-2"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={cn(
            "relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition",
            showFilters
              ? "border-neon-pink/50 bg-neon-pink/15 text-neon-pink"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
          )}
          aria-label="Filtros"
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-neon-yellow ring-2 ring-[oklch(0.15_0.10_305)]" />
          )}
        </button>
      </div>

      {/* FILTER PANEL */}
      {showFilters && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          <FilterGroup label="Status">
            {(
              [
                ["todos", "Todos"],
                ["carrinho", "Carrinho"],
                ["aguardando_pagamento", "Aguardando pagamento"],
                ["pago", "Pago"],
                ["preparando", "Preparando"],
                ["saiu_para_entrega", "A caminho"],
                ["entregue", "Entregue"],
                ["cancelado", "Cancelado"],
              ] as [StatusFilter, string][]
            ).map(([k, label]) => (
              <Chip key={k} active={status === k} onClick={() => setStatus(k)}>
                {label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Modo">
            {(
              [
                ["todos", "Todos", null],
                ["entrega", "Entrega", <Truck className="h-3 w-3" />],
                ["retirada", "Retirada", <Store className="h-3 w-3" />],
                ["mesa", "Mesa", null],
              ] as [ModeFilter, string, React.ReactNode][]
            ).map(([k, label, icon]) => (
              <Chip key={k} active={mode === k} onClick={() => setMode(k)}>
                {icon}
                {label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Pagamento">
            {(
              [
                ["todos", "Todos"],
                ["pix", "PIX"],
                ["credit_card", "Cartão"],
                ["asaas_checkout", "Link Asaas"],
                ["cash", "Dinheiro"],
                ["on_delivery", "Na entrega"],
              ] as [PaymentFilter, string][]
            ).map(([k, label]) => (
              <Chip key={k} active={payment === k} onClick={() => setPayment(k)}>
                {label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Período">
            {(
              [
                ["7d", "7 dias"],
                ["30d", "30 dias"],
                ["90d", "3 meses"],
                ["365d", "1 ano"],
                ["all", "Tudo"],
              ] as [Period, string][]
            ).map(([k, label]) => (
              <Chip key={k} active={period === k} onClick={() => setPeriod(k)}>
                {label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Ordenar">
            {(
              [
                ["recent", "Mais recentes"],
                ["oldest", "Mais antigos"],
                ["high", "Maior valor"],
                ["low", "Menor valor"],
              ] as [SortBy, string][]
            ).map(([k, label]) => (
              <Chip key={k} active={sortBy === k} onClick={() => setSortBy(k)}>
                <ArrowUpDown className="h-3 w-3" />
                {label}
              </Chip>
            ))}
          </FilterGroup>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] font-bold text-white/70 hover:bg-white/10"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-1 text-[11px] uppercase tracking-widest text-white/50">
        <span>
          {filtered.length} pedido{filtered.length === 1 ? "" : "s"}
          {hasActiveFilters ? " filtrado" + (filtered.length === 1 ? "" : "s") : ""}
        </span>
        {stats.avgTicket > 0 && (
          <span className="flex items-center gap-1 text-white/50">
            <TrendingUp className="h-3 w-3" /> Ticket {brl(stats.avgTicket)}
          </span>
        )}
      </div>

      {/* CART (open, unfinished) */}
      {showCartRow && cartCount > 0 && (
        <CartRow
          count={cartCount}
          subtotal={cartSubtotal}
          onCheckout={() => navigate({ to: "/carrinho" })}
        />
      )}
      {showCartRow && cartCount === 0 && abandoned && abandoned.item_count > 0 && (
        <AbandonedRow row={abandoned} navigate={navigate} />
      )}

      {/* LIST */}
      {filtered.length === 0 && cartCount === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
          {hasActiveFilters ? (
            <>
              Nenhum pedido bate com os filtros.
              <button
                onClick={clearFilters}
                className="ml-1 font-bold text-neon-cyan hover:underline"
              >
                Limpar
              </button>
            </>
          ) : (
            <>
              Você ainda não fez pedidos.
              <br />
              <Link to="/" className="mt-2 inline-block text-neon-cyan hover:underline">
                Ver o cardápio
              </Link>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            expanded={!!expanded[o.id]}
            onToggle={() => setExpanded((m) => ({ ...m, [o.id]: !m[o.id] }))}
            onReorder={reorder}
            productImageById={productImageById}
          />
        ))}
      </div>
    </div>
  );
}

/* ================= Subcomponents ================= */

// Small hook wrapper to grab add() without recreating context imports at top of module
function useCartRawAdd() {
  return useCart();
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "cyan" | "yellow" | "pink";
}) {
  const toneMap: Record<string, string> = {
    cyan: "from-neon-cyan/25 to-neon-cyan/5 text-neon-cyan",
    yellow: "from-neon-yellow/25 to-neon-yellow/5 text-neon-yellow",
    pink: "from-neon-pink/25 to-neon-pink/5 text-neon-pink",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-40", toneMap[tone])} />
      <div className="relative">
        <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest", toneMap[tone].split(" ").pop())}>
          {icon}
          {label}
        </div>
        <div className="mt-1 font-display text-xl font-black text-white">{value}</div>
        {hint && <div className="text-[10px] text-white/50">{hint}</div>}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
        active
          ? "border-neon-pink bg-neon-pink text-white shadow-[0_0_12px_rgba(236,72,153,0.45)]"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function CartRow({
  count,
  subtotal,
  onCheckout,
}: {
  count: number;
  subtotal: number;
  onCheckout: () => void;
}) {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-neon-cyan/40 bg-gradient-to-br from-neon-cyan/15 via-white/5 to-neon-pink/10 p-3">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-neon-cyan/25 text-neon-cyan">
        <ShoppingCart className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan">Seu carrinho</div>
        <div className="text-sm font-bold text-white">
          {count} {count === 1 ? "item" : "itens"} · {brl(subtotal)}
        </div>
        <div className="text-[10px] text-white/50">Ainda não finalizado</div>
      </div>
      <button
        onClick={onCheckout}
        className="rounded-full bg-neon-cyan px-3 py-2 text-[11px] font-black text-[oklch(0.18_0.11_305)] active:scale-95"
      >
        Finalizar
      </button>
    </div>
  );
}

function AbandonedRow({ row, navigate }: { row: AbandonedRow; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white/70">
        <ShoppingCart className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">Carrinho salvo</div>
        <div className="text-sm font-bold text-white">
          {row.item_count} {row.item_count === 1 ? "item" : "itens"} · {brl(Number(row.subtotal))}
        </div>
        <div className="text-[10px] text-white/40">
          Atualizado {new Date(row.updated_at).toLocaleDateString("pt-BR")}
        </div>
      </div>
      <button
        onClick={() => navigate({ to: "/" })}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-white hover:bg-white/10"
      >
        Retomar
      </button>
    </div>
  );
}

function OrderCard({
  order: o,
  expanded,
  onToggle,
  onReorder,
  productImageById,
}: {
  order: OrderRow;
  expanded: boolean;
  onToggle: () => void;
  onReorder: (items: OrderItem[]) => void;
  productImageById: Map<string, string>;
}) {
  const eff = effectiveStatus(o);
  const isCancelable = eff === "aguardando_pagamento";
  const dt = new Date(o.created_at);
  const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(o.id);
      toast.success("ID copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const cancel = async () => {
    const ok = await confirmDialog({
      title: "Cancelar pedido?",
      description: "Este pedido ainda não foi pago. Ele será cancelado e removido da fila.",
      confirmText: "Cancelar pedido",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("orders").update({ status: "cancelado" }).eq("id", o.id);
    if (error) return toast.error("Não foi possível cancelar");
    toast.success("Pedido cancelado");
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition",
        eff === "aguardando_pagamento"
          ? "border-neon-yellow/40 bg-neon-yellow/5"
          : "border-white/10 bg-white/5",
      )}
    >
      {/* header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50">
              <span>{dateStr}</span>
              <span className="text-white/25">·</span>
              <span>{timeStr}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <div className="font-display text-xl font-black text-neon-yellow">{brl(Number(o.total))}</div>
              <button
                onClick={copyId}
                className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-mono text-white/50 hover:bg-white/10 hover:text-white"
                title="Copiar ID"
              >
                #{o.id.slice(0, 8)}
                <Copy className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusPill eff={eff} />
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              {o.mode === "entrega" ? <Truck className="h-3 w-3" /> : o.mode === "mesa" ? null : <Store className="h-3 w-3" />}
              {o.mode === "entrega" ? "Entrega" : o.mode === "mesa" ? "Mesa" : "Retirada"}
            </div>
            <div className="text-[10px] text-white/40">{paymentLabel(o.payment_method)}</div>
          </div>
        </div>

        {eff !== "aguardando_pagamento" && eff !== "cancelado" && (
          <OrderTracker status={o.status} mode={o.mode} />
        )}
        {eff === "aguardando_pagamento" && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 text-[11px] text-neon-yellow">
            <Clock className="h-3.5 w-3.5" />
            <div className="flex-1 font-bold">Pagamento não confirmado</div>
            <Link
              to="/pagamento/$orderId"
              params={{ orderId: o.id }}
              className="rounded-full bg-neon-yellow px-2.5 py-1 text-[10px] font-black text-[oklch(0.18_0.11_305)]"
            >
              Pagar agora
            </Link>
          </div>
        )}
        {eff === "cancelado" && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-red-300">
            Pedido cancelado
          </div>
        )}

        <div className="mt-3 space-y-0.5 text-xs text-white/70">
          {o.items.slice(0, expanded ? o.items.length : 3).map((it, i) => (
            <ItemLine key={i} it={it} expanded={expanded} image={it.product_id ? productImageById.get(it.product_id) : undefined} />
          ))}
          {!expanded && o.items.length > 3 && (
            <div className="text-white/40">+ {o.items.length - 3} outros itens</div>
          )}
        </div>

        {expanded && (
          <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
            <SumRow label="Subtotal" value={brl(Number(o.subtotal ?? 0))} />
            {Number(o.discount ?? 0) > 0 && (
              <SumRow label={`Desconto${o.coupon_code ? ` · ${o.coupon_code}` : ""}`} value={`- ${brl(Number(o.discount))}`} tone="pink" />
            )}
            {Number(o.delivery_fee ?? 0) > 0 && <SumRow label="Entrega" value={brl(Number(o.delivery_fee))} />}
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Total</span>
              <span className="font-black text-neon-yellow">{brl(Number(o.total))}</span>
            </div>
            {o.address && (
              <div className="mt-2 flex items-start gap-1.5 border-t border-white/10 pt-2 text-white/70">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-white/50" />
                <span className="text-[11px]">{o.address}</span>
              </div>
            )}
            {o.paid_at && (
              <div className="mt-1 text-[10px] text-white/40">
                Pago em {new Date(o.paid_at).toLocaleString("pt-BR")}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={onToggle}
            className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] font-bold text-white/80 hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Recolher" : "Detalhes"}
          </button>
          {eff !== "aguardando_pagamento" && eff !== "cancelado" ? (
            <Link
              to="/rastrear/$orderId"
              params={{ orderId: o.id }}
              className="flex items-center justify-center gap-1 rounded-xl bg-neon-cyan/20 py-2 text-[11px] font-bold text-neon-cyan hover:bg-neon-cyan/30"
            >
              <MapPin className="h-3.5 w-3.5" /> Rastrear
            </Link>
          ) : isCancelable ? (
            <button
              onClick={cancel}
              className="flex items-center justify-center gap-1 rounded-xl bg-red-500/15 py-2 text-[11px] font-bold text-red-300 hover:bg-red-500/25"
            >
              <Trash2 className="h-3.5 w-3.5" /> Cancelar
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => onReorder(o.items)}
            className="flex items-center justify-center gap-1 rounded-xl bg-neon-pink/20 py-2 text-[11px] font-bold text-neon-pink hover:bg-neon-pink/30"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Repetir
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemLine({ it, expanded, image }: { it: OrderItem; expanded: boolean; image?: string }) {
  const extras = Array.isArray(it.extras) ? (it.extras as Array<{ label: string; price: number }>) : [];
  return (
    <div className={cn("flex gap-2", expanded ? "items-start" : "items-center")}>
      {expanded && image && (
        <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <span className="font-bold text-white/90">{it.quantity}×</span> {it.name}
          {it.size ? <span className="text-white/50"> · {it.size}</span> : null}
          {it.flavor ? <span className="text-white/50"> · {it.flavor}</span> : null}
        </div>
        {expanded && extras.length > 0 && (
          <div className="text-[10px] text-white/45">+ {extras.map((e) => e.label).join(", ")}</div>
        )}
        {expanded && it.note && (
          <div className="text-[10px] italic text-white/40">“{it.note}”</div>
        )}
      </div>
      {expanded && (
        <div className="shrink-0 font-mono text-[11px] text-white/60">{brl(Number(it.unit_price) * it.quantity)}</div>
      )}
    </div>
  );
}

function SumRow({ label, value, tone }: { label: string; value: string; tone?: "pink" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      <span className={cn("font-mono", tone === "pink" ? "text-neon-pink" : "text-white/80")}>{value}</span>
    </div>
  );
}

function StatusPill({ eff }: { eff: StatusFilter }) {
  const meta = STATUS_META[eff] ?? { label: eff, cls: "bg-white/10 text-white/60" };
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", meta.cls)}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {meta.label}
    </span>
  );
}

/* Tracker (mirror of conta.tsx tracker) */
function OrderTracker({ status, mode }: { status: string; mode: string }) {
  const isDelivery = mode === "entrega";
  const steps = isDelivery
    ? [
        { key: "pago", label: "Confirmado", icon: CreditCard },
        { key: "preparando", label: "Preparando", icon: ChefHat },
        { key: "saiu_para_entrega", label: "A caminho", icon: Bike },
        { key: "entregue", label: "Entregue", icon: PackageCheck },
      ]
    : [
        { key: "pago", label: "Confirmado", icon: CreditCard },
        { key: "preparando", label: "Preparando", icon: ChefHat },
        { key: "entregue", label: "Pronto", icon: PackageCheck },
      ];
  const rankMap: Record<string, number> = {
    novo: 0,
    pendente: 0,
    pago: 0,
    preparando: 1,
    saiu_para_entrega: 2,
    entregue: steps.length - 1,
  };
  const currentIdx = rankMap[status] ?? 0;
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">Acompanhe seu pedido</div>
        <div className="flex items-center gap-1 text-[10px] text-neon-cyan">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-cyan opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-cyan" />
          </span>
          Ao vivo
        </div>
      </div>
      <div className="relative flex items-start justify-between">
        <div className="absolute left-4 right-4 top-3.5 h-0.5 bg-white/10" />
        <div
          className="absolute left-4 top-3.5 h-0.5 bg-gradient-to-r from-neon-pink to-neon-yellow transition-all duration-700"
          style={{
            width: `calc(${(currentIdx / Math.max(1, steps.length - 1)) * 100}% - 0px)`,
            maxWidth: "calc(100% - 2rem)",
          }}
        />
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="relative z-10 flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition-all",
                  done && "border-neon-pink bg-neon-pink text-black",
                  active && "border-neon-yellow bg-neon-yellow/20 text-neon-yellow shadow-[0_0_12px_rgba(255,214,10,0.6)] animate-pulse",
                  !done && !active && "border-white/15 bg-black/40 text-white/40",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div
                className={cn(
                  "text-center text-[9px] font-bold uppercase leading-tight tracking-wide",
                  done || active ? "text-white" : "text-white/40",
                )}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
