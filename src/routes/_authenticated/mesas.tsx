import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { confirmDialog } from "@/lib/confirm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Grid3x3,
  Users,
  Clock,
  DollarSign,
  Plus,
  Search,
  RefreshCcw,
  Utensils,
  CheckCircle2,
  Timer,
  ArrowRightLeft,
  Sparkles,
  X,
  Trash2,
  Pencil,
  MapPin,
  UserCheck,
  Receipt,
  Coffee,
  LayoutGrid,
  Bell,
  Split,
  Move,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TablesPage,
});

type TableStatus = "livre" | "ocupada" | "reservada" | "aguardando_pagamento" | "limpeza";

type RestaurantTable = {
  id: string;
  number: number;
  label: string | null;
  zone: string | null;
  seats: number;
  status: TableStatus;
  current_order_id: string | null;
  opened_at: string | null;
  waiter_id: string | null;
  people_count: number | null;
  notes: string | null;
  pos_x: number | null;
  pos_y: number | null;
  created_at: string;
};

type Waiter = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type OrderLite = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  service_fee: number | null;
  customer_name: string | null;
  people_count: number | null;
  created_at: string;
  table_id: string | null;
  waiter_id: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  note: string | null;
};


type Tab = "salao" | "planta" | "lista" | "config";

const BRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusLabel: Record<TableStatus, string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  reservada: "Reservada",
  aguardando_pagamento: "Fechando",
  limpeza: "Limpeza",
};

const statusTone: Record<TableStatus, string> = {
  livre: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-300",
  ocupada: "from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/40 text-fuchsia-200",
  reservada: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30 text-cyan-300",
  aguardando_pagamento: "from-yellow-500/15 to-amber-500/10 border-yellow-500/40 text-yellow-300",
  limpeza: "from-white/10 to-white/5 border-white/20 text-white/60",
};

const timeAgo = (d: string | null) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 ? ` ${m % 60}min` : ""}`;
};

// Aging tone based on how long the table has been open (min)
const agingRing = (openedAt: string | null): string => {
  if (!openedAt) return "";
  const min = (Date.now() - new Date(openedAt).getTime()) / 60000;
  if (min < 30) return "ring-2 ring-emerald-400/40";
  if (min < 60) return "ring-2 ring-amber-400/60 animate-[pulse_3s_ease-in-out_infinite]";
  return "ring-2 ring-rose-400/70 animate-[pulse_1.6s_ease-in-out_infinite]";
};

const ASSIST_PREFIX = "[!ASSIST]";
const isAssistRequested = (notes: string | null) => !!notes && notes.startsWith(ASSIST_PREFIX);

function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("salao");
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("todas");
  const [waiterFilter, setWaiterFilter] = useState<string>("todos");
  // Re-render timer for aging halos + labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
  const [selected, setSelected] = useState<RestaurantTable | null>(null);
  const [editing, setEditing] = useState<RestaurantTable | "new" | null>(null);
  const [managingZones, setManagingZones] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, wRes, oRes] = await Promise.all([
      supabase.from("restaurant_tables").select("*").order("number", { ascending: true }),
      supabase.from("waiters").select("id,name,code,active").eq("active", true).order("name"),
      supabase
        .from("orders")
        .select("id,status,total,subtotal,service_fee,customer_name,people_count,created_at,table_id,waiter_id")
        .eq("mode", "mesa")
        .not("status", "in", "(pago,cancelado,entregue)")
        .order("created_at", { ascending: false }),
    ]);
    if (tRes.data) setTables(tRes.data as unknown as RestaurantTable[]);
    if (wRes.data) setWaiters(wRes.data as Waiter[]);
    if (oRes.data) setOrders(oRes.data as OrderLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("mesas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "mode=eq.mesa" }, () =>
        void load(),
      )
      .subscribe();
    const iv = setInterval(() => void load(), 45_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [load]);

  const orderByTable = useMemo(() => {
    const map = new Map<string, OrderLite>();
    for (const o of orders) if (o.table_id) map.set(o.table_id, o);
    return map;
  }, [orders]);

  const waiterById = useMemo(() => {
    const map = new Map<string, Waiter>();
    for (const w of waiters) map.set(w.id, w);
    return map;
  }, [waiters]);

  const zones = useMemo(() => {
    const s = new Set<string>();
    for (const t of tables) if (t.zone) s.add(t.zone);
    return Array.from(s).sort();
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables
      .filter((t) => zoneFilter === "todas" || t.zone === zoneFilter)
      .filter((t) => waiterFilter === "todos" || t.waiter_id === waiterFilter)
      .filter((t) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          String(t.number).includes(q) ||
          (t.label || "").toLowerCase().includes(q) ||
          (t.zone || "").toLowerCase().includes(q)
        );
      });
  }, [tables, query, zoneFilter, waiterFilter]);

  const kpis = useMemo(() => {
    const active = tables;
    const occ = active.filter((t) => t.status === "ocupada").length;
    const free = active.filter((t) => t.status === "livre").length;
    const closing = active.filter((t) => t.status === "aguardando_pagamento").length;
    const cleaning = active.filter((t) => t.status === "limpeza").length;
    const people = active.reduce((s, t) => s + (t.status === "ocupada" ? t.people_count || 0 : 0), 0);
    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalSeats = active.reduce((s, t) => s + t.seats, 0);
    const occRate = totalSeats > 0 ? Math.round((people / totalSeats) * 100) : 0;
    return { total: active.length, occ, free, closing, cleaning, people, revenue, occRate };
  }, [tables, orders]);

  async function openTable(tableId: string, people?: number, waiterId?: string | null) {
    const { error } = await supabase.rpc("open_table", {
      _table_id: tableId,
      _people: people ?? undefined,
      _waiter_id: waiterId ?? undefined,
    });

    if (error) {
      toast.error("Erro ao abrir mesa: " + error.message);
      return;
    }
    toast.success("Mesa aberta");
    void load();
  }

  async function clearTable(tableId: string) {
    const { error } = await supabase.rpc("clear_table", { _table_id: tableId });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Mesa liberada");
    void load();
  }

  async function reserveTable(tableId: string, note: string) {
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ status: "reservada", notes: note })
      .eq("id", tableId);
    if (error) toast.error(error.message);
    else {
      toast.success("Mesa reservada");
      void load();
    }
  }

  async function transferTable(from: string, to: string) {
    const { error } = await supabase.rpc("transfer_table", { _from: from, _to: to });
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Comanda transferida");
      void load();
    }
  }

  async function assignWaiter(tableId: string, waiterId: string | null) {
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ waiter_id: waiterId })
      .eq("id", tableId);
    if (error) toast.error(error.message);
    else void load();
  }

  return (
    <div className="min-h-screen bg-transparent pb-16">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0322]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-lg">
              <Grid3x3 className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-base font-black text-white">Mesas & Salão</h1>
              <p className="text-[11px] text-white/50">
                {kpis.occ}/{kpis.total} ocupadas · {kpis.people} pessoas
              </p>
            </div>
          </div>
          <button
            onClick={() => void load()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
            title="Recarregar"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 pb-2">
          {(
            [
              { id: "salao", label: "Salão", icon: Grid3x3 },
              { id: "planta", label: "Planta", icon: LayoutGrid },
              { id: "lista", label: "Lista", icon: Utensils, badge: kpis.occ },
              { id: "config", label: "Gerenciar", icon: Pencil },
            ] as { id: Tab; label: string; icon: typeof Grid3x3; badge?: number }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                  active
                    ? "border-neon-pink/50 bg-neon-pink/20 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className="ml-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-black">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* KPIs */}
        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi icon={Users} label="Ocupadas" value={`${kpis.occ}/${kpis.total}`} tone="fuchsia" />
          <Kpi icon={CheckCircle2} label="Livres" value={String(kpis.free)} tone="emerald" />
          <Kpi icon={Receipt} label="Fechando" value={String(kpis.closing)} tone="amber" />
          <Kpi icon={DollarSign} label="Em aberto" value={BRL(kpis.revenue)} tone="yellow" />
        </section>

        {/* Filters */}
        {(tab === "salao" || tab === "lista" || tab === "planta") && (
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar mesa, zona..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-neon-pink/50 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
                {["todas", ...zones].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoneFilter(z)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition capitalize",
                      zoneFilter === z
                        ? "border-neon-pink/50 bg-neon-pink/20 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                    )}
                  >
                    {z}
                  </button>
                ))}
                <button
                  onClick={() => setManagingZones(true)}
                  title="Gerenciar zonas"
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/10"
                >
                  Zonas
                </button>
              </div>
            </div>
            {waiters.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
                <span className="shrink-0 pl-1 pr-1 text-[10px] font-black uppercase tracking-widest text-white/40">
                  Garçom
                </span>
                {[{ id: "todos", name: "Todos" }, ...waiters].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWaiterFilter(w.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                      waiterFilter === w.id
                        ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                    )}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "salao" && (
          <SalonView
            tables={filteredTables}
            orders={orders}
            orderByTable={orderByTable}
            waiterById={waiterById}
            onOpen={(t) => setSelected(t)}
          />
        )}

        {tab === "planta" && (
          <FloorPlanView
            tables={filteredTables}
            orderByTable={orderByTable}
            onOpen={(t) => setSelected(t)}
            onReload={() => void load()}
          />
        )}

        {tab === "lista" && (
          <ListView
            tables={filteredTables}
            orderByTable={orderByTable}
            waiterById={waiterById}
            onOpen={(t) => setSelected(t)}
          />
        )}

        {tab === "config" && (
          <ManageView
            tables={tables}
            onEdit={(t) => setEditing(t)}
            onNew={() => setEditing("new")}
            onReload={() => void load()}
          />
        )}
      </main>

      {selected && (
        <TableDialog
          table={selected}
          order={selected.current_order_id ? orderByTable.get(selected.id) || null : null}
          waiters={waiters}
          tables={tables}
          onClose={() => setSelected(null)}
          onOpen={openTable}
          onClear={clearTable}
          onReserve={reserveTable}
          onTransfer={transferTable}
          onAssignWaiter={assignWaiter}
          onReload={() => void load()}
        />
      )}

      {editing && (
        <EditTableDialog
          table={editing === "new" ? null : editing}
          zones={zones}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {managingZones && (
        <ManageZonesDialog
          zones={zones}
          tables={tables}
          onClose={() => setManagingZones(false)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

// ---------- Salon Grid ----------
function SalonView({
  tables,
  orders,
  orderByTable,
  waiterById,
  onOpen,
}: {
  tables: RestaurantTable[];
  orders: OrderLite[];
  orderByTable: Map<string, OrderLite>;
  waiterById: Map<string, Waiter>;
  onOpen: (t: RestaurantTable) => void;
}) {
  if (tables.length === 0)
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
        <Grid3x3 className="mx-auto mb-3 h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">Nenhuma mesa encontrada com os filtros atuais.</p>
      </div>
    );

  const byZone = new Map<string, RestaurantTable[]>();
  for (const t of tables) {
    const z = t.zone || "Sem zona";
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(t);
  }

  const revenueByTable = new Map<string, number>();
  for (const o of orders) if (o.table_id) revenueByTable.set(o.table_id, (revenueByTable.get(o.table_id) || 0) + (o.total || 0));

  return (
    <div className="space-y-6">
      {Array.from(byZone.entries()).map(([zone, list]) => {
        const occ = list.filter((t) => t.status === "ocupada").length;
        const revenue = list.reduce((s, t) => s + (revenueByTable.get(t.id) || 0), 0);
        return (
        <section key={zone}>
          <h2 className="mb-2 flex flex-wrap items-center gap-2 text-[13px] font-black uppercase tracking-wider text-white/70">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {zone}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
              {occ}/{list.length}
            </span>
            {revenue > 0 && (
              <span className="ml-auto rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-black text-fuchsia-200">
                {BRL(revenue)}
              </span>
            )}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {list.map((t) => {
              const order = orderByTable.get(t.id) || null;
              const waiter = t.waiter_id ? waiterById.get(t.waiter_id) : null;
              const assist = isAssistRequested(t.notes);
              return (
                <button
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className={cn(
                    "relative min-h-[132px] overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left transition hover:scale-[1.02] active:scale-95",
                    statusTone[t.status],
                    t.status === "ocupada" && agingRing(t.opened_at),
                  )}
                >
                  {assist && (
                    <span className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow-lg animate-bounce">
                      <Bell className="h-3 w-3" />
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                        Mesa
                      </div>
                      <div className="text-3xl font-black text-white leading-none">{t.number}</div>
                      {t.label && (
                        <div className="mt-0.5 text-[11px] font-semibold opacity-80">{t.label}</div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                        t.status === "ocupada" && "bg-fuchsia-500/30",
                        t.status === "livre" && "bg-emerald-500/30",
                        t.status === "reservada" && "bg-cyan-500/30",
                        t.status === "aguardando_pagamento" && "bg-yellow-500/30",
                        t.status === "limpeza" && "bg-white/20",
                      )}
                    >
                      {statusLabel[t.status]}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-[11px] text-white/70">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      {t.people_count || 0}/{t.seats}
                    </div>
                    {t.opened_at && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {timeAgo(t.opened_at)}
                      </div>
                    )}
                    {waiter && (
                      <div className="flex items-center gap-1.5 truncate">
                        <UserCheck className="h-3 w-3 shrink-0" />
                        <span className="truncate">{waiter.name}</span>
                      </div>
                    )}
                    {order && (
                      <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-black/30 px-1.5 py-1 font-black text-white">
                        <DollarSign className="h-3 w-3" />
                        {BRL(order.total)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}

// ---------- Floor Plan (drag & drop) ----------
// Real-time drag with zero-lag: writes transform directly to the DOM during
// pointermove (no React re-render per frame). State is only committed on drop.
const TILE_SIZE = 96;
const GRID = 8;

function FloorPlanView({
  tables,
  orderByTable,
  onOpen,
  onReload,
}: {
  tables: RestaurantTable[];
  orderByTable: Map<string, OrderLite>;
  onOpen: (t: RestaurantTable) => void;
  onReload: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null); // only for visual highlight, set on drop start/end
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const posRef = useRef<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean; raf: number | null } | null>(null);

  const setNodeRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    nodeRefs.current[id] = el;
    const p = posRef.current[id];
    if (el && p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }, []);

  const applyLayout = useCallback(
    (opts: { animate?: boolean; force?: boolean } = {}) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = canvas.clientWidth;
      const pad = 16;
      const gap = 12;
      const cols = Math.max(1, Math.floor((width - pad * 2 + gap) / (TILE_SIZE + gap)));
      tables.forEach((t, i) => {
        let x: number, y: number;
        if (!opts.force && posRef.current[t.id]) {
          x = posRef.current[t.id].x;
          y = posRef.current[t.id].y;
        } else if (!opts.force && t.pos_x != null && t.pos_y != null) {
          x = t.pos_x;
          y = t.pos_y;
        } else {
          const col = i % cols;
          const row = Math.floor(i / cols);
          x = pad + col * (TILE_SIZE + gap);
          y = pad + row * (TILE_SIZE + gap);
        }
        posRef.current[t.id] = { x, y };
        const el = nodeRefs.current[t.id];
        if (el) {
          if (opts.animate) {
            el.style.transition = "transform 260ms cubic-bezier(.2,.8,.2,1)";
            window.setTimeout(() => {
              if (el) el.style.transition = "";
            }, 300);
          }
          el.style.transform = `translate(${x}px, ${y}px)`;
        }
      });
    },
    [tables],
  );

  useEffect(() => {
    // reset positions when tables list changes identity/length
    posRef.current = {};
    applyLayout();
  }, [tables, applyLayout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      // re-clamp positions inside the new canvas rect
      const rect = canvas.getBoundingClientRect();
      Object.entries(posRef.current).forEach(([id, p]) => {
        const x = Math.max(0, Math.min(rect.width - TILE_SIZE, p.x));
        const y = Math.max(0, Math.min(rect.height - TILE_SIZE, p.y));
        posRef.current[id] = { x, y };
        const el = nodeRefs.current[id];
        if (el) el.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editMode) return;
    e.preventDefault();
    const el = nodeRefs.current[id];
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const p = posRef.current[id] || { x: 0, y: 0 };
    dragRef.current = { id, dx: e.clientX - p.x, dy: e.clientY - p.y, moved: false, raf: null };
    el.style.transition = "none";
    el.style.zIndex = "40";
    el.style.willChange = "transform";
    el.style.boxShadow = "0 20px 40px -10px rgba(0,0,0,.6), 0 0 0 2px rgba(255,46,147,.5)";
    setActiveId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (d.raf != null) return; // coalesce to next frame → ultra-smooth, no queue
    d.raf = requestAnimationFrame(() => {
      d.raf = null;
      const rect = canvas.getBoundingClientRect();
      let x = clientX - d.dx;
      let y = clientY - d.dy;
      x = Math.max(0, Math.min(rect.width - TILE_SIZE, x));
      y = Math.max(0, Math.min(rect.height - TILE_SIZE, y));
      if (snap) {
        x = Math.round(x / GRID) * GRID;
        y = Math.round(y / GRID) * GRID;
      }
      posRef.current[d.id] = { x, y };
      const el = nodeRefs.current[d.id];
      if (el) el.style.transform = `translate(${x}px, ${y}px)`;
      d.moved = true;
    });
  };

  const onPointerUp = async (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.raf != null) cancelAnimationFrame(d.raf);
    dragRef.current = null;
    const el = nodeRefs.current[d.id];
    if (el) {
      el.style.transition = "";
      el.style.zIndex = "";
      el.style.willChange = "";
      el.style.boxShadow = "";
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setActiveId(null);
    if (!d.moved) return;
    const p = posRef.current[d.id];
    if (!p) return;
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ pos_x: Math.round(p.x), pos_y: Math.round(p.y) })
      .eq("id", d.id);
    if (error) toast.error("Falha ao salvar posição");
  };

  const autoOrganize = async () => {
    applyLayout({ animate: true, force: true });
    const updates = Object.entries(posRef.current).map(([id, p]) =>
      supabase.from("restaurant_tables").update({ pos_x: Math.round(p.x), pos_y: Math.round(p.y) }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const failed = results.filter((r) => r.error).length;
    if (failed) toast.error(`Falha em ${failed} mesa(s)`);
    else toast.success("Planta reorganizada em grade");
    onReload();
  };

  if (tables.length === 0)
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
        <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">Nenhuma mesa para exibir na planta.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-2 text-white/70">
          <Move className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {editMode ? "Arraste para posicionar · toque duplo para abrir" : "Toque em uma mesa para gerenciar"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {editMode && (
            <>
              <button
                onClick={() => setSnap((v) => !v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition",
                  snap
                    ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-200"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                )}
                title="Encaixar em grade de 8px"
              >
                Snap
              </button>
              <button
                onClick={() => setShowGrid((v) => !v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition",
                  showGrid
                    ? "border-sky-400/50 bg-sky-400/20 text-sky-200"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                )}
              >
                Grade
              </button>
              <button
                onClick={autoOrganize}
                className="rounded-full border border-amber-400/50 bg-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100 hover:bg-amber-400/30"
              >
                Auto-organizar
              </button>
            </>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 font-black uppercase tracking-wider transition",
              editMode
                ? "border-neon-pink/60 bg-neon-pink/25 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
            )}
          >
            {editMode ? "Concluir" : "Editar planta"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "relative h-[70vh] min-h-[520px] w-full touch-none select-none overflow-hidden rounded-3xl border transition",
          editMode
            ? "border-neon-pink/40 bg-[#0d0322]/70 shadow-[inset_0_0_60px_rgba(255,46,147,.08)]"
            : "border-white/10 bg-[#0d0322]/60",
          showGrid &&
            "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:24px_24px]",
        )}
      >
        {tables.map((t) => {
          const order = orderByTable.get(t.id) || null;
          const assist = isAssistRequested(t.notes);
          return (
            <div
              key={t.id}
              ref={setNodeRef(t.id)}
              onPointerDown={(e) => onPointerDown(e, t.id)}
              onClick={() => !editMode && !dragRef.current && onOpen(t)}
              className={cn(
                "absolute left-0 top-0 h-24 w-24 select-none rounded-2xl border bg-gradient-to-br p-2",
                statusTone[t.status],
                t.status === "ocupada" && agingRing(t.opened_at),
                editMode
                  ? "cursor-grab touch-none active:cursor-grabbing"
                  : "cursor-pointer transition hover:scale-[1.03] active:scale-95",
                activeId === t.id && "ring-2 ring-neon-pink/70",
              )}
            >
              {assist && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white shadow-lg animate-bounce">
                  <Bell className="h-2.5 w-2.5" />
                </span>
              )}
              <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">Mesa</div>
              <div className="text-2xl font-black leading-none text-white">{t.number}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] opacity-80">
                <Users className="h-2.5 w-2.5" />
                {t.people_count || 0}/{t.seats}
              </div>
              {order && (
                <div className="mt-0.5 truncate text-[9px] font-black text-white">{BRL(order.total)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-white/60">
        <span className="font-black uppercase tracking-widest text-white/50">Legenda</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> livre / recente</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> 30-60 min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> +60 min</span>
        <span className="flex items-center gap-1"><Bell className="h-3 w-3 text-rose-400" /> chamando</span>
      </div>
    </div>
  );
}

// ---------- List View ----------
function ListView({
  tables,
  orderByTable,
  waiterById,
  onOpen,
}: {
  tables: RestaurantTable[];
  orderByTable: Map<string, OrderLite>;
  waiterById: Map<string, Waiter>;
  onOpen: (t: RestaurantTable) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="grid grid-cols-[60px_1fr_100px_90px_110px_100px] gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white/60">
        <div>Mesa</div>
        <div>Zona / Label</div>
        <div>Status</div>
        <div>Pessoas</div>
        <div>Garçom</div>
        <div className="text-right">Total</div>
      </div>
      <div className="divide-y divide-white/5">
        {tables.map((t) => {
          const order = orderByTable.get(t.id);
          const waiter = t.waiter_id ? waiterById.get(t.waiter_id) : null;
          return (
            <button
              key={t.id}
              onClick={() => onOpen(t)}
              className="grid w-full grid-cols-[60px_1fr_100px_90px_110px_100px] items-center gap-2 px-3 py-3 text-left text-[13px] transition hover:bg-white/5"
            >
              <div className="text-lg font-black text-white">{t.number}</div>
              <div>
                <div className="font-semibold text-white">{t.label || `Mesa ${t.number}`}</div>
                <div className="text-[11px] text-white/50">{t.zone || "—"}</div>
              </div>
              <div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase bg-gradient-to-br",
                    statusTone[t.status],
                  )}
                >
                  {statusLabel[t.status]}
                </span>
              </div>
              <div className="text-white/80">
                {t.people_count || 0}/{t.seats}
              </div>
              <div className="truncate text-white/70">{waiter?.name || "—"}</div>
              <div className="text-right font-black text-white">{order ? BRL(order.total) : "—"}</div>
            </button>
          );
        })}
        {tables.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-white/50">Nenhuma mesa encontrada.</div>
        )}
      </div>
    </div>
  );
}

// ---------- Manage View ----------
function ManageView({
  tables,
  onEdit,
  onNew,
  onReload,
}: {
  tables: RestaurantTable[];
  onEdit: (t: RestaurantTable) => void;
  onNew: () => void;
  onReload: () => void;
}) {
  async function toggleActive(t: RestaurantTable) {
    const { error } = await supabase
      .from("restaurant_tables")
      .update({}).eq("id","never")
      .eq("id", t.id);
    if (error) toast.error(error.message);
    else onReload();
  }
  async function remove(t: RestaurantTable) {
    if (!(await confirmDialog({ message: `Remover mesa ${t.number}?` }))) return;
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removida");
      onReload();
    }
  }
  return (
    <div className="space-y-3">
      <button
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 py-4 text-sm font-black text-white/80 transition hover:bg-white/10"
      >
        <Plus className="h-4 w-4" /> Nova mesa
      </button>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {tables.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 border-b border-white/5 px-3 py-2.5 last:border-0"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 font-black text-white">
              {t.number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold text-white">
                {t.label || `Mesa ${t.number}`}
              </div>
              <div className="text-[11px] text-white/50">
                {t.zone || "—"} · {t.seats} pessoas
              </div>
            </div>

            <button
              onClick={() => onEdit(t)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => remove(t)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Table Dialog ----------
function TableDialog({
  table,
  order,
  waiters,
  tables,
  onClose,
  onOpen,
  onClear,
  onReserve,
  onTransfer,
  onAssignWaiter,
  onReload,
}: {
  table: RestaurantTable;
  order: OrderLite | null;
  waiters: Waiter[];
  tables: RestaurantTable[];
  onClose: () => void;
  onOpen: (id: string, people?: number, waiterId?: string | null) => void;
  onClear: (id: string) => void;
  onReserve: (id: string, note: string) => void;
  onTransfer: (from: string, to: string) => void;
  onAssignWaiter: (id: string, wid: string | null) => void;
  onReload: () => void;
}) {
  const [people, setPeople] = useState<number>(table.people_count || 2);
  const [waiterId, setWaiterId] = useState<string>(table.waiter_id || "");
  const [reserveNote, setReserveNote] = useState("");
  const [transferTo, setTransferTo] = useState<string>("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showReserve, setShowReserve] = useState(false);

  useEffect(() => {
    if (!order) {
      setItems([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("order_items")
        .select("id,name,quantity,unit_price,note")
        .eq("order_id", order.id);
      if (data) setItems((data || []).map((it:any)=>({...it, total_price: (it.quantity||0)*Number(it.unit_price||0)})) as OrderItem[]);
    })();
  }, [order]);

  async function closeAndPay() {
    if (!order) return;
    const { error } = await supabase.from("orders").update({ status: "aguardando_pagamento" }).eq("id", order.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Fechamento solicitado");
      onReload();
    }
  }

  async function markPaid() {
    if (!order) return;
    const { error } = await supabase.from("orders").update({ status: "pago" }).eq("id", order.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pagamento confirmado. Mesa liberada.");
      onClose();
      onReload();
    }
  }

  const total = order?.total || 0;
  const subtotal = order?.subtotal || 0;
  const serviceFee = order?.service_fee || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/10 bg-[#120833] sm:rounded-3xl">
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between border-b border-white/10 bg-gradient-to-br px-4 py-3",
            statusTone[table.status],
          )}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/40 text-2xl font-black text-white">
              {table.number}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-70">
                {table.zone || "Mesa"}
              </div>
              <h3 className="text-lg font-black text-white">{table.label || `Mesa ${table.number}`}</h3>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/70">
                <span>{statusLabel[table.status]}</span>
                {table.opened_at && <span>· aberta há {timeAgo(table.opened_at)}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-black/30 text-white hover:bg-black/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {/* LIVRE: abrir mesa */}
          {table.status === "livre" && !showReserve && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-black uppercase text-white/70">
                  <Coffee className="h-3.5 w-3.5" /> Abrir comanda
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-white/60">
                    Pessoas
                    <input
                      type="number"
                      min={1}
                      max={table.seats}
                      value={people}
                      onChange={(e) => setPeople(parseInt(e.target.value) || 1)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-bold text-white focus:border-neon-pink/50 focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-white/60">
                    Garçom
                    <select
                      value={waiterId}
                      onChange={(e) => setWaiterId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
                    >
                      <option value="">Sem atribuição</option>
                      {waiters.map((w) => (
                        <option key={w.id} value={w.id} className="bg-[#0d0322]">
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  onClick={() => onOpen(table.id, people, waiterId || null)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2.5 text-sm font-black text-white shadow-lg transition hover:brightness-110"
                >
                  <Sparkles className="h-4 w-4" /> Abrir mesa
                </button>
              </div>

              <button
                onClick={() => setShowReserve(true)}
                className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20"
              >
                Reservar mesa
              </button>
            </div>
          )}

          {table.status === "livre" && showReserve && (
            <div className="space-y-3">
              <label className="block text-[11px] text-white/60">
                Observação da reserva
                <input
                  value={reserveNote}
                  onChange={(e) => setReserveNote(e.target.value)}
                  placeholder="Ex: João - 20h - 4 pessoas"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReserve(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-bold text-white/70"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onReserve(table.id, reserveNote);
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-cyan-500 py-2 text-sm font-black text-white"
                >
                  Confirmar reserva
                </button>
              </div>
            </div>
          )}

          {/* RESERVADA */}
          {table.status === "reservada" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                <div className="text-[11px] font-bold uppercase opacity-70">Reserva</div>
                <div className="mt-1 font-semibold">{table.notes || "Sem observações"}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onClear(table.id);
                    onClose();
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-bold text-white/70"
                >
                  Cancelar reserva
                </button>
                <button
                  onClick={() => onOpen(table.id, 2, null)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-sm font-black text-white"
                >
                  Chegou — abrir
                </button>
              </div>
            </div>
          )}

          {/* OCUPADA / AGUARDANDO */}
          {(table.status === "ocupada" || table.status === "aguardando_pagamento") && order && (
            <div className="space-y-3">
              {/* Comanda summary */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-black uppercase text-white/70">Comanda</h4>
                  <Link
                    to="/rush"
                    className="text-[11px] font-bold text-neon-cyan hover:underline"
                  >
                    ver no Rush →
                  </Link>
                </div>
                <div className="mt-2 space-y-1 text-[12px]">
                  {items.length === 0 && (
                    <p className="py-2 text-center text-white/50">Nenhum item ainda.</p>
                  )}
                  {items.map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white">
                          <span className="text-white/50">{it.quantity}×</span> {it.name}
                        </div>
                        {it.note && <div className="text-[10px] text-white/50">{it.note}</div>}
                      </div>
                      <div className="font-black text-white">{BRL(it.total_price)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-[12px]">
                  <div className="flex justify-between text-white/70">
                    <span>Subtotal</span>
                    <span>{BRL(subtotal)}</span>
                  </div>
                  {serviceFee > 0 && (
                    <div className="flex justify-between text-white/70">
                      <span>Serviço (10%)</span>
                      <span>{BRL(serviceFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-white">
                    <span>Total</span>
                    <span>{BRL(total)}</span>
                  </div>
                  {/* Split by people */}
                  {total > 0 && (table.people_count || 0) > 1 && (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-1.5 text-[11px]">
                      <span className="flex items-center gap-1.5 font-black text-fuchsia-100">
                        <Split className="h-3 w-3" /> Dividir por {table.people_count}
                      </span>
                      <span className="font-black text-white">
                        {BRL(total / (table.people_count || 1))}<span className="text-white/50"> /pessoa</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assistance flag */}
              <button
                onClick={async () => {
                  const currentlyOn = isAssistRequested(table.notes);
                  const newNotes = currentlyOn
                    ? (table.notes || "").replace(ASSIST_PREFIX, "").trim() || null
                    : `${ASSIST_PREFIX} ${(table.notes || "").trim()}`.trim();
                  const { error } = await supabase
                    .from("restaurant_tables")
                    .update({ notes: newNotes })
                    .eq("id", table.id);
                  if (error) toast.error(error.message);
                  else {
                    toast.success(currentlyOn ? "Chamada atendida" : "Sinal de chamada ligado");
                    onReload();
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-sm font-black transition",
                  isAssistRequested(table.notes)
                    ? "border-rose-400/50 bg-rose-500/25 text-white hover:bg-rose-500/35"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                )}
              >
                <Bell className="h-4 w-4" />
                {isAssistRequested(table.notes) ? "Marcar como atendido" : "Cliente chamando"}
              </button>

              {/* Waiter assign */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <label className="text-[11px] font-black uppercase text-white/60">Garçom</label>
                <select
                  value={waiterId}
                  onChange={(e) => {
                    setWaiterId(e.target.value);
                    onAssignWaiter(table.id, e.target.value || null);
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
                >
                  <option value="">Sem atribuição</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#0d0322]">
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer */}
              {showTransfer ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <label className="text-[11px] font-black uppercase text-white/60">
                    Transferir comanda para
                  </label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
                  >
                    <option value="">Selecione a mesa destino</option>
                    {tables
                      .filter((t) => t.id !== table.id && t.status !== "ocupada")
                      .map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#0d0322]">
                          Mesa {t.number} {t.label ? `— ${t.label}` : ""} ({statusLabel[t.status]})
                        </option>
                      ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setShowTransfer(false);
                        setTransferTo("");
                      }}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[12px] font-bold text-white/70"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={!transferTo}
                      onClick={() => {
                        onTransfer(table.id, transferTo);
                        setShowTransfer(false);
                        onClose();
                      }}
                      className="flex-1 rounded-lg bg-neon-cyan py-1.5 text-[12px] font-black text-black disabled:opacity-40"
                    >
                      Transferir
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  <ArrowRightLeft className="h-4 w-4" /> Transferir mesa
                </button>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {table.status === "ocupada" && (
                  <button
                    onClick={closeAndPay}
                    className="flex-1 rounded-xl border border-yellow-500/40 bg-yellow-500/15 py-2.5 text-sm font-black text-yellow-200"
                  >
                    <Receipt className="mr-1 inline h-4 w-4" /> Fechar conta
                  </button>
                )}
                <button
                  onClick={markPaid}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-black text-white shadow-lg"
                >
                  <CheckCircle2 className="mr-1 inline h-4 w-4" /> Pago · liberar
                </button>
              </div>
            </div>
          )}

          {/* LIMPEZA */}
          {table.status === "limpeza" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <Timer className="mx-auto mb-2 h-8 w-8 text-white/40" />
                <p className="text-sm text-white/70">Mesa em limpeza. Libere quando estiver pronta.</p>
              </div>
              <button
                onClick={() => {
                  onClear(table.id);
                  onClose();
                }}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-black text-white"
              >
                <CheckCircle2 className="mr-1 inline h-4 w-4" /> Liberar mesa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Edit / New table dialog ----------
function EditTableDialog({
  table,
  zones,
  onClose,
  onSaved,
}: {
  table: RestaurantTable | null;
  zones: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialZone = table?.zone || zones[0] || "Salão";
  const zoneOptions = useMemo(() => {
    const set = new Set<string>(zones);
    if (initialZone) set.add(initialZone);
    if (set.size === 0) set.add("Salão");
    return Array.from(set);
  }, [zones, initialZone]);

  const [number, setNumber] = useState<number>(table?.number || 0);
  const [label, setLabel] = useState<string>(table?.label || "");
  const [zone, setZone] = useState<string>(initialZone);
  const [creatingZone, setCreatingZone] = useState(false);
  const [newZone, setNewZone] = useState("");
  const [seats, setSeats] = useState<number>(table?.seats || 4);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!number || number <= 0) {
      toast.error("Número inválido");
      return;
    }
    setSaving(true);
    const payload = {
      number,
      label: label || undefined,
      zone: zone || undefined,
      seats,
    };
    const { error } = table
      ? await supabase.from("restaurant_tables").update(payload).eq("id", table.id)
      : await supabase.from("restaurant_tables").insert({ ...payload, status: "livre" });

    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(table ? "Mesa atualizada" : "Mesa criada");
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#120833]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-base font-black text-white">
            {table ? `Editar mesa ${table.number}` : "Nova mesa"}
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-white/60">
              Número *
              <input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-bold text-white focus:border-neon-pink/50 focus:outline-none"
              />
            </label>
            <label className="text-[11px] text-white/60">
              Capacidade
              <input
                type="number"
                min={1}
                value={seats}
                onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-bold text-white focus:border-neon-pink/50 focus:outline-none"
              />
            </label>
          </div>
          <div className="block text-[11px] text-white/60">
            Zona
            {!creatingZone ? (
              <div className="mt-1 flex gap-2">
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
                >
                  {zoneOptions.map((z) => (
                    <option key={z} value={z} className="bg-[#120833]">
                      {z}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingZone(true);
                    setNewZone("");
                  }}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  + Nova
                </button>
              </div>
            ) : (
              <div className="mt-1 flex gap-2">
                <input
                  autoFocus
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  placeholder="Nome da nova zona"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newZone.trim();
                    if (!v) {
                      toast.error("Digite um nome");
                      return;
                    }
                    setZone(v);
                    setCreatingZone(false);
                  }}
                  className="shrink-0 rounded-lg bg-neon-pink/80 px-3 py-1.5 text-xs font-black text-white hover:bg-neon-pink"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingZone(false)}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <label className="block text-[11px] text-white/60">
            Etiqueta (opcional)
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Mesa da janela, VIP..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-neon-pink/50 focus:outline-none"
            />
          </label>
          <button
            disabled={saving}
            onClick={save}
            className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : table ? "Salvar alterações" : "Criar mesa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- KPI ----------
function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Grid3x3;
  label: string;
  value: string;
  tone: "fuchsia" | "emerald" | "amber" | "yellow" | "cyan";
}) {
  const tones: Record<string, string> = {
    fuchsia: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-300",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-300",
    yellow: "from-yellow-500/15 to-yellow-500/5 text-yellow-300",
    cyan: "from-cyan-500/15 to-cyan-500/5 text-cyan-300",
  };
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-gradient-to-br p-3", tones[tone])}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}

// ---------- Manage zones dialog ----------
function ManageZonesDialog({
  zones,
  tables,
  onClose,
  onChanged,
}: {
  zones: string[];
  tables: RestaurantTable[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tables) {
      const z = t.zone || "";
      if (!z) continue;
      m[z] = (m[z] || 0) + 1;
    }
    return m;
  }, [tables]);

  async function removeZone(z: string) {
    const count = counts[z] || 0;
    const msg =
      count > 0
        ? `Remover a zona "${z}"? ${count} mesa(s) ficarão sem zona.`
        : `Remover a zona "${z}"?`;
    if (!(await confirmDialog({ message: msg }))) return;
    setBusy(z);
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ zone: null as unknown as string })
      .eq("zone", z);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Zona removida");
    onChanged();
  }

  async function renameZone(z: string) {
    const nv = prompt(`Renomear zona "${z}" para:`, z);
    if (!nv || nv.trim() === "" || nv.trim() === z) return;
    setBusy(z);
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ zone: nv.trim() })
      .eq("zone", z);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Zona renomeada");
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#120833]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-black text-white">Gerenciar zonas</div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            Fechar
          </button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
          {zones.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-white/60">
              Nenhuma zona criada. Crie mesas com zonas para vê-las aqui.
            </div>
          ) : (
            zones.map((z) => (
              <div
                key={z}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white capitalize">{z}</div>
                  <div className="text-[11px] text-white/50">
                    {counts[z] || 0} mesa(s)
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    disabled={busy === z}
                    onClick={() => renameZone(z)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Renomear
                  </button>
                  <button
                    disabled={busy === z}
                    onClick={() => removeZone(z)}
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/50">
          Para criar uma nova zona, edite uma mesa e escolha "+ Nova".
        </div>
      </div>
    </div>
  );
}
