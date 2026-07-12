import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Truck,
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  Search,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  X,
  Bike,
  Car,
  Download,
  Users,
  DollarSign,
  Navigation,
  CheckCircle2,
  Timer,
  Route as RouteIcon,
  Package,
  MessageCircle,
  RefreshCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/lib/menu-data";
import { haversineKm } from "@/lib/delivery-zone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveriesPage,
});

// ---------- Types ----------
type Courier = {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string;
  plate: string | null;
  avatar_url: string | null;
  fee_per_delivery: number;
  active: boolean;
  note: string | null;
  created_at: string;
};

type DeliveryOrder = {
  id: string;
  customer_name: string;
  phone: string;
  address: string | null;
  reference: string | null;
  status: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  distance_km: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  mode: string;
  courier_id: string | null;
  created_at: string;
  paid_at: string | null;
  preparing_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  delivery_started_at: string | null;
  note: string | null;
};

type Tab = "live" | "map" | "couriers" | "history";

const BRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const timeAgo = (d: string | null) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 ? ` ${m % 60}min` : ""}`;
};

const statusLabel: Record<string, string> = {
  pending: "Aguardando",
  paid: "Pago",
  preparing: "Preparando",
  ready: "Pronto",
  saiu_para_entrega: "Em rota",
  delivered: "Entregue",
  canceled: "Cancelado",
};

const statusTone: Record<string, string> = {
  pending: "bg-white/10 text-white/70",
  paid: "bg-neon-cyan/15 text-neon-cyan",
  preparing: "bg-amber-500/15 text-amber-300",
  ready: "bg-yellow-500/15 text-yellow-300",
  saiu_para_entrega: "bg-fuchsia-500/15 text-fuchsia-300",
  delivered: "bg-emerald-500/15 text-emerald-300",
  canceled: "bg-rose-500/15 text-rose-300",
};

const VEHICLE_ICON: Record<string, typeof Bike> = { moto: Bike, carro: Car, bike: Bike };

// ---------- Page ----------
function DeliveriesPage() {
  const { data: settings } = useSiteSettings();
  const storeLat = settings?.storeLat ?? null;
  const storeLng = settings?.storeLng ?? null;

  const [tab, setTab] = useState<Tab>("live");
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [ordersRes, couriersRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,customer_name,phone,address,reference,status,total,subtotal,delivery_fee,distance_km,delivery_lat,delivery_lng,mode,courier_id,created_at,paid_at,preparing_at,dispatched_at,delivered_at,delivery_started_at,note",
        )
        .eq("mode", "delivery")
        .order("created_at", { ascending: false })
        .limit(400),
      supabase.from("couriers").select("*").order("active", { ascending: false }).order("name"),
    ]);
    setOrders(((ordersRes.data ?? []) as unknown) as DeliveryOrder[]);
    setCouriers(((couriersRes.data ?? []) as unknown) as Courier[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("entregas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "couriers" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  // KPIs (hoje)
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t0 = today.getTime();
    const todays = orders.filter((o) => new Date(o.created_at).getTime() >= t0);

    const enRoute = orders.filter((o) => o.status === "saiu_para_entrega");
    const deliveredToday = todays.filter((o) => o.status === "delivered");
    const waiting = orders.filter(
      (o) => !["delivered", "canceled"].includes(o.status) && !o.courier_id,
    );

    // Tempo médio: dispatched -> delivered
    const durations = deliveredToday
      .map((o) => {
        const a = o.dispatched_at ? new Date(o.dispatched_at).getTime() : null;
        const b = o.delivered_at ? new Date(o.delivered_at).getTime() : null;
        return a && b ? (b - a) / 60000 : null;
      })
      .filter((n): n is number => n != null && n > 0);
    const avgMin = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const totalKm = deliveredToday.reduce((s, o) => s + (o.distance_km ?? 0), 0);
    const feeToday = deliveredToday.reduce((s, o) => s + (o.delivery_fee ?? 0), 0);
    const activeCouriers = couriers.filter((c) => c.active).length;
    const revToday = deliveredToday.reduce((s, o) => s + (o.total ?? 0), 0);

    return {
      enRoute: enRoute.length,
      deliveredToday: deliveredToday.length,
      waiting: waiting.length,
      avgMin,
      totalKm,
      feeToday,
      activeCouriers,
      revToday,
    };
  }, [orders, couriers]);

  // Filter orders that are "open" (need action) for live board
  const openOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (["delivered", "canceled"].includes(o.status)) return false;
      if (!q) return true;
      return (
        o.customer_name.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (o.address ?? "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [orders, query]);

  const historyOrders = useMemo(
    () => orders.filter((o) => o.status === "delivered" || o.status === "canceled"),
    [orders],
  );

  const assignCourier = async (orderId: string, courierId: string | null) => {
    const patch: Record<string, unknown> = { courier_id: courierId };
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) toast.error("Falha ao atribuir motoboy");
    else toast.success(courierId ? "Motoboy atribuído" : "Motoboy removido");
  };

  const setOrderStatus = async (orderId: string, next: string) => {
    const patch: Record<string, unknown> = { status: next };
    const now = new Date().toISOString();
    if (next === "preparing") patch.preparing_at = now;
    if (next === "saiu_para_entrega") {
      patch.dispatched_at = now;
      patch.delivery_started_at = now;
    }
    if (next === "delivered") patch.delivered_at = now;
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) toast.error("Falha ao atualizar status");
  };

  return (
    <div className="min-h-screen bg-transparent pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0322]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-lg">
                <Truck className="h-4 w-4" />
              </span>
              <div>
                <h1 className="text-base font-black text-white">Entregas</h1>
                <p className="text-[11px] text-white/50">Painel ao vivo · motoboys · mapa</p>
              </div>
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

        {/* Tabs */}
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 pb-2">
          {(
            [
              { id: "live", label: "Ao vivo", icon: Timer, badge: openOrders.length },
              { id: "map", label: "Mapa", icon: MapPin },
              { id: "couriers", label: "Motoboys", icon: Users, badge: kpis.activeCouriers },
              { id: "history", label: "Histórico", icon: Package, badge: historyOrders.length },
            ] as { id: Tab; label: string; icon: typeof Truck; badge?: number }[]
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
        {/* KPI grid */}
        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard icon={Navigation} label="Em rota" value={String(kpis.enRoute)} tone="fuchsia" />
          <KpiCard
            icon={CheckCircle2}
            label="Entregues hoje"
            value={String(kpis.deliveredToday)}
            tone="emerald"
          />
          <KpiCard icon={Timer} label="Aguardando" value={String(kpis.waiting)} tone="amber" />
          <KpiCard
            icon={Clock}
            label="Tempo médio"
            value={`${kpis.avgMin} min`}
            tone="cyan"
          />
          <KpiCard
            icon={RouteIcon}
            label="Km percorridos"
            value={`${kpis.totalKm.toFixed(1)} km`}
            tone="cyan"
          />
          <KpiCard
            icon={DollarSign}
            label="Receita frete"
            value={BRL(kpis.feeToday)}
            tone="yellow"
          />
          <KpiCard
            icon={DollarSign}
            label="Faturamento (hoje)"
            value={BRL(kpis.revToday)}
            tone="emerald"
          />
          <KpiCard
            icon={Users}
            label="Motoboys ativos"
            value={String(kpis.activeCouriers)}
            tone="pink"
          />
        </section>

        {tab === "live" && (
          <LiveBoard
            orders={openOrders}
            couriers={couriers.filter((c) => c.active)}
            query={query}
            setQuery={setQuery}
            onAssign={assignCourier}
            onStatus={setOrderStatus}
            storeLat={storeLat}
            storeLng={storeLng}
          />
        )}

        {tab === "map" && (
          <MapView
            orders={orders.filter(
              (o) => !["canceled"].includes(o.status) && o.delivery_lat != null,
            )}
            couriers={couriers}
            storeLat={storeLat}
            storeLng={storeLng}
          />
        )}

        {tab === "couriers" && (
          <CouriersTab couriers={couriers} orders={orders} reload={load} />
        )}

        {tab === "history" && <HistoryTab orders={historyOrders} couriers={couriers} />}
      </main>
    </div>
  );
}

// ---------- KPI Card ----------
function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
  tone: "fuchsia" | "emerald" | "amber" | "cyan" | "yellow" | "pink";
}) {
  const tones: Record<string, string> = {
    fuchsia: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-300",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-300",
    cyan: "from-cyan-500/15 to-cyan-500/5 text-cyan-300",
    yellow: "from-yellow-500/15 to-yellow-500/5 text-yellow-300",
    pink: "from-pink-500/15 to-pink-500/5 text-pink-300",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-br p-3",
        tones[tone],
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}

// ---------- Live Board ----------
function LiveBoard({
  orders,
  couriers,
  query,
  setQuery,
  onAssign,
  onStatus,
  storeLat,
  storeLng,
}: {
  orders: DeliveryOrder[];
  couriers: Courier[];
  query: string;
  setQuery: (v: string) => void;
  onAssign: (orderId: string, courierId: string | null) => void;
  onStatus: (orderId: string, status: string) => void;
  storeLat: number | null;
  storeLng: number | null;
}) {
  const columns: { id: string; label: string; match: (o: DeliveryOrder) => boolean }[] = [
    {
      id: "new",
      label: "Novos",
      match: (o) => ["pending", "paid"].includes(o.status),
    },
    { id: "prep", label: "Preparando", match: (o) => o.status === "preparing" },
    {
      id: "ready",
      label: "Pronto p/ retirada",
      match: (o) => o.status === "ready",
    },
    {
      id: "route",
      label: "Em rota",
      match: (o) => o.status === "saiu_para_entrega",
    },
  ];

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, telefone, endereço..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-neon-pink/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {columns.map((col) => {
          const items = orders.filter(col.match);
          return (
            <div
              key={col.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2"
            >
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-white/70">
                  {col.label}
                </h3>
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/80">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/40">
                    vazio
                  </div>
                )}
                {items.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    couriers={couriers}
                    onAssign={onAssign}
                    onStatus={onStatus}
                    storeLat={storeLat}
                    storeLng={storeLng}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function OrderCard({
  order: o,
  couriers,
  onAssign,
  onStatus,
  storeLat,
  storeLng,
}: {
  order: DeliveryOrder;
  couriers: Courier[];
  onAssign: (id: string, courierId: string | null) => void;
  onStatus: (id: string, next: string) => void;
  storeLat: number | null;
  storeLng: number | null;
}) {
  const courier = couriers.find((c) => c.id === o.courier_id);
  const km =
    o.distance_km ??
    (o.delivery_lat != null && o.delivery_lng != null && storeLat != null && storeLng != null
      ? haversineKm({ lat: storeLat, lng: storeLng }, { lat: o.delivery_lat, lng: o.delivery_lng })
      : null);

  const next = (() => {
    if (o.status === "pending" || o.status === "paid") return { s: "preparing", label: "Preparar" };
    if (o.status === "preparing") return { s: "ready", label: "Marcar pronto" };
    if (o.status === "ready") return { s: "saiu_para_entrega", label: "Despachar" };
    if (o.status === "saiu_para_entrega") return { s: "delivered", label: "Entregue" };
    return null;
  })();

  const canDispatch = o.status === "ready" || o.status === "saiu_para_entrega";
  const needsCourier = canDispatch && !o.courier_id;

  const wa = () => {
    if (!o.phone) return;
    const digits = o.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${o.customer_name.split(" ")[0]}, seu pedido saiu para entrega! 🛵`,
    );
    window.open(`https://wa.me/55${digits}?text=${msg}`, "_blank");
  };

  const openMaps = () => {
    if (o.delivery_lat != null && o.delivery_lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}`, "_blank");
    } else if (o.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`, "_blank");
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#170428] p-2.5 text-white shadow-sm",
        needsCourier ? "border-amber-400/40" : "border-white/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold">{o.customer_name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/50">
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                statusTone[o.status] ?? "bg-white/10 text-white/60",
              )}
            >
              {statusLabel[o.status] ?? o.status}
            </span>
            <Clock className="h-3 w-3" />
            {timeAgo(o.created_at)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-black text-neon-yellow">{BRL(o.total)}</div>
          <div className="text-[10px] text-white/40">#{o.id.slice(0, 6)}</div>
        </div>
      </div>

      {o.address && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-white/70">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-neon-cyan" />
          <span className="line-clamp-2">{o.address}</span>
        </div>
      )}
      {o.reference && (
        <div className="mt-0.5 pl-4 text-[10px] italic text-white/40">Ref: {o.reference}</div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
        {km != null && (
          <span className="rounded-full bg-white/5 px-1.5 py-0.5">
            <RouteIcon className="mr-0.5 inline h-2.5 w-2.5" />
            {km.toFixed(1)}km
          </span>
        )}
        <span className="rounded-full bg-white/5 px-1.5 py-0.5">frete {BRL(o.delivery_fee)}</span>
        {o.note && (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-300">nota</span>
        )}
      </div>

      {/* Courier */}
      <div className="mt-2">
        <select
          value={o.courier_id ?? ""}
          onChange={(e) => onAssign(o.id, e.target.value || null)}
          className={cn(
            "w-full rounded-lg border bg-[#0d0322] px-2 py-1.5 text-[11px] text-white focus:outline-none",
            needsCourier
              ? "border-amber-400/50 ring-1 ring-amber-400/30"
              : "border-white/10",
          )}
        >
          <option value="">— sem motoboy —</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              🛵 {c.name}
              {c.plate ? ` · ${c.plate}` : ""}
            </option>
          ))}
        </select>
        {courier && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
            {courier.phone && (
              <a
                href={`tel:${courier.phone}`}
                className="inline-flex items-center gap-0.5 rounded-full bg-white/5 px-1.5 py-0.5 hover:text-white"
              >
                <Phone className="h-2.5 w-2.5" /> {courier.phone}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {next && (
          <button
            onClick={() => onStatus(o.id, next.s)}
            disabled={next.s === "saiu_para_entrega" && !o.courier_id}
            className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-2 py-1.5 text-[11px] font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {next.label}
          </button>
        )}
        <button
          onClick={openMaps}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:text-white"
          title="Abrir no mapa"
        >
          <Navigation className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={wa}
          className="rounded-lg border border-white/10 bg-emerald-500/10 p-1.5 text-emerald-300 hover:bg-emerald-500/20"
          title="WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------- Map View ----------
function MapView({
  orders,
  couriers,
  storeLat,
  storeLng,
}: {
  orders: DeliveryOrder[];
  couriers: Courier[];
  storeLat: number | null;
  storeLng: number | null;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const center: [number, number] =
      storeLat != null && storeLng != null ? [storeLat, storeLng] : [-8.7619, -63.9039];
    const map = L.map(mapEl.current, { center, zoom: 13, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layer.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [storeLat, storeLng]);

  // Update pins
  useEffect(() => {
    const map = mapRef.current;
    const lg = layer.current;
    if (!map || !lg) return;
    lg.clearLayers();

    if (storeLat != null && storeLng != null) {
      L.marker([storeLat, storeLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:linear-gradient(135deg,#f472b6,#ec4899);color:white;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;box-shadow:0 6px 16px -4px rgba(236,72,153,.7);border:2px solid #0d0322">🏪</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      })
        .addTo(lg)
        .bindPopup("<b>Loja</b>");
    }

    const bounds: [number, number][] = [];
    if (storeLat != null && storeLng != null) bounds.push([storeLat, storeLng]);

    for (const o of orders) {
      if (o.delivery_lat == null || o.delivery_lng == null) continue;
      bounds.push([o.delivery_lat, o.delivery_lng]);
      const color =
        o.status === "delivered"
          ? "#10b981"
          : o.status === "saiu_para_entrega"
            ? "#f59e0b"
            : o.status === "preparing" || o.status === "ready"
              ? "#22d3ee"
              : "#a3a3a3";
      const courier = couriers.find((c) => c.id === o.courier_id);
      L.marker([o.delivery_lat, o.delivery_lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#0d0322;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:11px;box-shadow:0 4px 10px rgba(0,0,0,.4);border:2px solid #0d0322">${(statusLabel[o.status] ?? o.status).slice(0, 1)}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .addTo(lg)
        .bindPopup(
          `<div style="font-family:inherit;font-size:12px;color:#111">
            <b>${o.customer_name}</b><br/>
            ${statusLabel[o.status] ?? o.status} · ${BRL(o.total)}<br/>
            ${o.address ?? ""}<br/>
            ${courier ? `🛵 ${courier.name}` : "<i>sem motoboy</i>"}
          </div>`,
        );
    }
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [orders, couriers, storeLat, storeLng]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-fuchsia-500" /> Loja
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-cyan-400" /> Preparando/Pronto
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-400" /> Em rota
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> Entregue
        </span>
      </div>
      <div
        ref={mapEl}
        className="h-[520px] w-full overflow-hidden rounded-xl border border-white/10 [&_.leaflet-container]:bg-[#0d0322]"
      />
      {(storeLat == null || storeLng == null) && (
        <p className="mt-2 text-[11px] text-amber-300">
          Defina a localização da loja em Configurações › Loja para melhor visualização.
        </p>
      )}
    </div>
  );
}

// ---------- Couriers Tab ----------
function CouriersTab({
  couriers,
  orders,
  reload,
}: {
  couriers: Courier[];
  orders: DeliveryOrder[];
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Courier | null>(null);
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t0 = today.getTime();
    const map = new Map<string, { count: number; km: number; fee: number; revenue: number }>();
    for (const o of orders) {
      if (!o.courier_id) continue;
      if (o.status !== "delivered") continue;
      if (new Date(o.created_at).getTime() < t0) continue;
      const cur = map.get(o.courier_id) ?? { count: 0, km: 0, fee: 0, revenue: 0 };
      cur.count += 1;
      cur.km += o.distance_km ?? 0;
      cur.fee += o.delivery_fee ?? 0;
      cur.revenue += o.total ?? 0;
      map.set(o.courier_id, cur);
    }
    return map;
  }, [orders]);

  const toggleActive = async (c: Courier) => {
    const { error } = await supabase
      .from("couriers")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (error) toast.error("Falha ao atualizar");
    else {
      toast.success(c.active ? "Motoboy desativado" : "Motoboy ativado");
      await reload();
    }
  };

  const remove = async (c: Courier) => {
    if (!confirm(`Remover motoboy "${c.name}"?`)) return;
    const { error } = await supabase.from("couriers").delete().eq("id", c.id);
    if (error) toast.error("Falha ao remover");
    else {
      toast.success("Motoboy removido");
      await reload();
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Motoboys cadastrados</h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-md hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" /> Novo motoboy
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {couriers.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-white/50">
            Nenhum motoboy cadastrado ainda. Clique em "Novo motoboy" para começar.
          </div>
        )}
        {couriers.map((c) => {
          const s = stats.get(c.id);
          const VIcon = VEHICLE_ICON[c.vehicle] ?? Bike;
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-2xl border p-3 text-white",
                c.active
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-white/5 bg-white/[0.02] opacity-70",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-pink-500/30 text-lg font-black">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.name}
                      className="h-full w-full rounded-2xl object-cover"
                    />
                  ) : (
                    c.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[14px] font-black">{c.name}</div>
                    {!c.active && (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                        pausado
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/60">
                    <span className="inline-flex items-center gap-1">
                      <VIcon className="h-3 w-3" />
                      {c.vehicle}
                    </span>
                    {c.plate && <span className="font-mono">{c.plate}</span>}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg bg-white/5 p-1.5">
                  <div className="text-[10px] text-white/50">Entregas hoje</div>
                  <div className="text-[13px] font-black">{s?.count ?? 0}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-1.5">
                  <div className="text-[10px] text-white/50">Km rodados</div>
                  <div className="text-[13px] font-black">{(s?.km ?? 0).toFixed(1)}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-1.5">
                  <div className="text-[10px] text-white/50">A pagar</div>
                  <div className="text-[13px] font-black text-neon-yellow">
                    {BRL((s?.count ?? 0) * c.fee_per_delivery)}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-white/50">
                Comissão fixa: <b className="text-white/80">{BRL(c.fee_per_delivery)}</b>/entrega
              </div>

              <div className="mt-3 flex gap-1.5">
                <button
                  onClick={() => setEditing(c)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-semibold hover:bg-white/10"
                >
                  <Pencil className="mr-1 inline h-3 w-3" /> Editar
                </button>
                <button
                  onClick={() => void toggleActive(c)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11px] font-semibold",
                    c.active
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
                  )}
                >
                  {c.active ? (
                    <>
                      <PowerOff className="mr-1 inline h-3 w-3" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Power className="mr-1 inline h-3 w-3" />
                      Ativar
                    </>
                  )}
                </button>
                <button
                  onClick={() => void remove(c)}
                  className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                  title="Excluir"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <CourierDialog
          courier={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={async () => {
            setEditing(null);
            setCreating(false);
            await reload();
          }}
        />
      )}
    </>
  );
}

function CourierDialog({
  courier,
  onClose,
  onSaved,
}: {
  courier: Courier | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: courier?.name ?? "",
    phone: courier?.phone ?? "",
    vehicle: courier?.vehicle ?? "moto",
    plate: courier?.plate ?? "",
    fee_per_delivery: courier?.fee_per_delivery ?? 5,
    active: courier?.active ?? true,
    note: courier?.note ?? "",
    avatar_url: courier?.avatar_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      vehicle: form.vehicle,
      plate: form.plate.trim() || null,
      fee_per_delivery: Number(form.fee_per_delivery) || 0,
      active: form.active,
      note: form.note.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
    };
    const q = courier
      ? supabase.from("couriers").update(payload).eq("id", courier.id)
      : supabase.from("couriers").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    toast.success(courier ? "Motoboy atualizado" : "Motoboy cadastrado");
    await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#170428] p-5 text-white shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-black">
            {courier ? "Editar motoboy" : "Novo motoboy"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-white/60 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <Field label="Nome *">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-neon-pink/50 focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Telefone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(69) 99999-9999"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-neon-pink/50 focus:outline-none"
              />
            </Field>
            <Field label="Placa">
              <input
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
                placeholder="ABC-1234"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono focus:border-neon-pink/50 focus:outline-none"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Veículo">
              <select
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-neon-pink/50 focus:outline-none"
              >
                <option value="moto">Moto</option>
                <option value="carro">Carro</option>
                <option value="bike">Bike</option>
              </select>
            </Field>
            <Field label="R$/entrega">
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.fee_per_delivery}
                onChange={(e) =>
                  setForm({ ...form, fee_per_delivery: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-neon-pink/50 focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Foto (URL, opcional)">
            <input
              value={form.avatar_url}
              onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-neon-pink/50 focus:outline-none"
            />
          </Field>
          <Field label="Observações">
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-neon-pink/50 focus:outline-none"
            />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-white/80">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-neon-pink"
            />
            Ativo (disponível para receber entregas)
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------- History Tab ----------
function HistoryTab({
  orders,
  couriers,
}: {
  orders: DeliveryOrder[];
  couriers: Courier[];
}) {
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes" | "tudo">("semana");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    let cutoff = 0;
    if (period === "hoje") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoff = d.getTime();
    } else if (period === "semana") {
      cutoff = now.getTime() - 7 * 86400000;
    } else if (period === "mes") {
      cutoff = now.getTime() - 30 * 86400000;
    }
    const query = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
      if (!query) return true;
      return (
        o.customer_name.toLowerCase().includes(query) ||
        o.phone.toLowerCase().includes(query) ||
        (o.address ?? "").toLowerCase().includes(query)
      );
    });
  }, [orders, period, q]);

  const totals = useMemo(() => {
    const delivered = filtered.filter((o) => o.status === "delivered");
    return {
      count: delivered.length,
      revenue: delivered.reduce((s, o) => s + o.total, 0),
      fees: delivered.reduce((s, o) => s + (o.delivery_fee ?? 0), 0),
      km: delivered.reduce((s, o) => s + (o.distance_km ?? 0), 0),
      canceled: filtered.filter((o) => o.status === "canceled").length,
    };
  }, [filtered]);

  const exportCSV = () => {
    const header = [
      "id",
      "data",
      "cliente",
      "telefone",
      "endereco",
      "status",
      "total",
      "frete",
      "km",
      "motoboy",
      "duracao_min",
    ];
    const rows = filtered.map((o) => {
      const c = couriers.find((x) => x.id === o.courier_id);
      const dur =
        o.dispatched_at && o.delivered_at
          ? Math.round(
              (new Date(o.delivered_at).getTime() - new Date(o.dispatched_at).getTime()) / 60000,
            )
          : "";
      return [
        o.id,
        new Date(o.created_at).toLocaleString("pt-BR"),
        o.customer_name,
        o.phone,
        o.address ?? "",
        statusLabel[o.status] ?? o.status,
        o.total.toFixed(2),
        (o.delivery_fee ?? 0).toFixed(2),
        (o.distance_km ?? 0).toFixed(2),
        c?.name ?? "",
        String(dur),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entregas-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["hoje", "semana", "mes", "tudo"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition",
              period === p
                ? "border-neon-pink/50 bg-neon-pink/20 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
            )}
          >
            {p === "hoje"
              ? "Hoje"
              : p === "semana"
                ? "7 dias"
                : p === "mes"
                  ? "30 dias"
                  : "Tudo"}
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-neon-pink/50 focus:outline-none"
          />
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <KpiCard icon={CheckCircle2} label="Entregues" value={String(totals.count)} tone="emerald" />
        <KpiCard icon={DollarSign} label="Receita" value={BRL(totals.revenue)} tone="yellow" />
        <KpiCard icon={Truck} label="Frete total" value={BRL(totals.fees)} tone="cyan" />
        <KpiCard icon={RouteIcon} label="Km" value={`${totals.km.toFixed(1)}`} tone="pink" />
        <KpiCard icon={X} label="Cancelados" value={String(totals.canceled)} tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-white/10 bg-white/5 text-left text-[10px] uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Endereço</th>
                <th className="px-3 py-2">Motoboy</th>
                <th className="px-3 py-2 text-right">Km</th>
                <th className="px-3 py-2 text-right">Frete</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Duração</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                    Nenhum registro no período.
                  </td>
                </tr>
              )}
              {filtered.map((o) => {
                const c = couriers.find((x) => x.id === o.courier_id);
                const dur =
                  o.dispatched_at && o.delivered_at
                    ? Math.round(
                        (new Date(o.delivered_at).getTime() -
                          new Date(o.dispatched_at).getTime()) /
                          60000,
                      )
                    : null;
                return (
                  <tr key={o.id} className="text-white/85 hover:bg-white/5">
                    <td className="px-3 py-2 font-mono text-[10px] text-white/50">
                      #{o.id.slice(0, 6)}
                      <div className="text-white/40">
                        {new Date(o.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-bold">{o.customer_name}</div>
                      <div className="text-[10px] text-white/40">{o.phone}</div>
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-[11px] text-white/70">
                      <div className="line-clamp-2">{o.address ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {c ? (
                        <span className="rounded-full bg-white/5 px-2 py-0.5">🛵 {c.name}</span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {o.distance_km != null ? o.distance_km.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{BRL(o.delivery_fee ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-bold text-neon-yellow">
                      {BRL(o.total)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {dur != null ? `${dur}min` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          statusTone[o.status] ?? "bg-white/10 text-white/60",
                        )}
                      >
                        {statusLabel[o.status] ?? o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
