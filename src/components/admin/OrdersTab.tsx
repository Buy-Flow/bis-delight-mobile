import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock, XCircle, Truck, ChefHat, RefreshCw, Package } from "lucide-react";
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

const STATUS_META: Record<OrderStatus, { label: string; icon: typeof Clock; cls: string }> = {
  pendente: { label: "Pendente", icon: Clock, cls: "bg-neon-yellow/15 text-neon-yellow border-neon-yellow/40" },
  pago: { label: "Pago", icon: CheckCircle2, cls: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40" },
  preparando: { label: "Preparando", icon: ChefHat, cls: "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40" },
  entregue: { label: "Entregue", icon: Truck, cls: "bg-white/10 text-white/80 border-white/20" },
  cancelado: { label: "Cancelado", icon: XCircle, cls: "bg-red-500/15 text-red-300 border-red-500/40" },
};

const FILTERS: { id: OrderStatus | "todos"; label: string }[] = [
  { id: "pendente", label: "Pendentes" },
  { id: "pago", label: "Pagos" },
  { id: "preparando", label: "Preparando" },
  { id: "entregue", label: "Entregues" },
  { id: "cancelado", label: "Cancelados" },
  { id: "todos", label: "Todos" },
];

export function OrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "todos">("pendente");
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
    return () => {
      supabase.removeChannel(channel);
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

  const setStatus = async (order: Order, status: OrderStatus) => {
    setBusy(order.id);
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setBusy(null);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(`Pedido atualizado para ${STATUS_META[status].label.toLowerCase()}.`);
    setOrders((prev) => (prev ? prev.map((o) => (o.id === order.id ? { ...o, status } : o)) : prev));
  };

  if (orders === null) {
    return (
      <div className="flex items-center justify-center py-16 text-white/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Pedidos</h2>
          <p className="text-xs text-white/60">
            Marque como <span className="text-emerald-300 font-semibold">Pago</span> só depois de confirmar o pagamento pelo WhatsApp.
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.id === "todos" ? orders.length : counts[f.id] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-neon-pink bg-neon-pink/15 text-white glow-pink"
                  : "border-white/10 text-white/70 hover:text-white",
              )}
            >
              {f.label}
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-white/80">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-60" />
          Nenhum pedido nesta categoria.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.pendente;
            const Icon = meta.icon;
            const created = new Date(o.created_at);
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-white">{o.customer_name}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", meta.cls)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/60">
                      #{o.id.slice(0, 8)} · {created.toLocaleString("pt-BR")} · {o.mode === "entrega" ? "Entrega" : "Retirada"}
                    </div>
                    <div className="mt-1 text-[12px] text-white/70">
                      📱 <a href={`https://wa.me/55${o.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="underline decoration-white/30 hover:text-white">{o.phone}</a>
                      {o.address && <> · 📍 {o.address}{o.reference ? ` (${o.reference})` : ""}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-neon-yellow">{brl(Number(o.total))}</div>
                    {Number(o.delivery_fee) > 0 && (
                      <div className="text-[10px] text-white/50">+ {brl(Number(o.delivery_fee))} entrega</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-black/25 p-3">
                  <ul className="space-y-1.5 text-[12px] text-white/85">
                    {o.order_items.map((it) => (
                      <li key={it.id} className="flex justify-between gap-3">
                        <span className="min-w-0">
                          <span className="font-semibold">{it.quantity}×</span> {it.name}
                          {it.size && <span className="text-white/60"> · {it.size}</span>}
                          {it.flavor && <span className="text-white/60"> · {it.flavor}</span>}
                          {it.extras && it.extras.length > 0 && (
                            <div className="pl-4 text-[11px] text-white/55">+ {it.extras.map((e) => e.label).join(", ")}</div>
                          )}
                          {it.removed && it.removed.length > 0 && (
                            <div className="pl-4 text-[11px] text-red-300/70">sem {it.removed.join(", ")}</div>
                          )}
                          {it.note && <div className="pl-4 text-[11px] italic text-white/50">"{it.note}"</div>}
                        </span>
                        <span className="shrink-0 tabular-nums text-white/70">{brl(Number(it.unit_price) * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  {o.note && (
                    <div className="mt-2 rounded-lg bg-white/[0.04] p-2 text-[11px] text-white/70">
                      <span className="font-semibold text-white/80">Obs:</span> {o.note}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status === "pendente" && (
                    <button
                      onClick={() => setStatus(o, "pago")}
                      disabled={busy === o.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-emerald-950 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar pagamento
                    </button>
                  )}
                  {o.status === "pago" && (
                    <button
                      onClick={() => setStatus(o, "preparando")}
                      disabled={busy === o.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neon-cyan px-4 py-2 text-xs font-black text-[oklch(0.18_0.11_305)] disabled:opacity-50"
                    >
                      <ChefHat className="h-3.5 w-3.5" /> Iniciar preparo
                    </button>
                  )}
                  {o.status === "preparando" && (
                    <button
                      onClick={() => setStatus(o, "entregue")}
                      disabled={busy === o.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      <Truck className="h-3.5 w-3.5" /> Marcar como entregue
                    </button>
                  )}
                  {o.status !== "cancelado" && o.status !== "entregue" && (
                    <button
                      onClick={() => setStatus(o, "cancelado")}
                      disabled={busy === o.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  )}
                  {(o.status === "cancelado" || o.status === "entregue") && (
                    <button
                      onClick={() => setStatus(o, "pendente")}
                      disabled={busy === o.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Voltar para pendente
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
