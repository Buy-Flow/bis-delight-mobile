import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Bike, Power, MapPin, Navigation, Check, X, Package, Clock, DollarSign,
  Phone, LogOut, Star, TrendingUp, Wifi, Target, Award, Flame, Timer,
  Loader2, Home, User, Calendar, XCircle, CheckCircle2, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/motoboy")({
  head: () => ({
    meta: [
      { title: "Motoboy — Quero Bis" },
      { name: "description", content: "Portal do entregador: aceite corridas, siga a rota e receba ao vivo." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { next: location.pathname } });
  },
  component: MotoboyPortal,
});

type Courier = {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string;
  plate: string | null;
  avatar_url: string | null;
  status: string;
  active: boolean;
  total_deliveries: number;
  total_earnings: number;
  rating: number | null;
  current_lat: number | null;
  current_lng: number | null;
  user_id: string | null;
};

type Order = {
  id: string;
  status: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  reference: string | null;
  total: number;
  subtotal: number;
  delivery_fee: number;
  delivery_lat: number | null;
  delivery_lng: number | null;
  distance_km: number | null;
  eta_minutes: number | null;
  created_at: string;
  dispatched_at: string | null;
  picked_up_at: string | null;
  payment_method?: string | null;
  note: string | null;
  order_items?: Array<{ name: string; quantity: number; size: string | null; flavor: string | null; unit_price: number }>;
};

type Offer = {
  id: string;
  order_id: string;
  status: string;
  fee: number | null;
  distance_km: number | null;
  expires_at: string;
  offered_at: string;
  responded_at: string | null;
  order?: Order;
};

function MotoboyPortal() {
  const [loading, setLoading] = useState(true);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [missedOffers, setMissedOffers] = useState<Offer[]>([]);
  const [tab, setTab] = useState<"home" | "map" | "history" | "profile">("home");
  const [historyTab, setHistoryTab] = useState<"delivered" | "missed">("delivered");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsCoord, setGpsCoord] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);
  const gpsWatch = useRef<number | null>(null);
  const heartbeatTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    let { data: c } = await supabase
      .from("couriers")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!c) {
      // Auto-vincula/cria registro operacional se o usuário tem papel delivery.
      try {
        const { ensureCourierLink } = await import("@/lib/courier.functions");
        const res = await ensureCourierLink();
        if (res?.linked) {
          const { data: refreshed } = await supabase
            .from("couriers")
            .select("*")
            .eq("user_id", u.user.id)
            .maybeSingle();
          c = refreshed;
          if (res.created) toast.success("Cadastro de motoboy criado automaticamente.");
        }
      } catch (err) {
        console.warn("ensureCourierLink falhou", err);
      }
    }
    if (!c) {
      setCourier(null);
      setLoading(false);
      return;
    }
    setCourier(c as Courier);
    setIsOnline(c.status === "online" || c.status === "busy");

    const { data: o } = await supabase
      .from("orders")
      .select("*, order_items(name, quantity, size, flavor, unit_price)")
      .eq("courier_id", c.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders((o ?? []) as Order[]);

    const { data: of } = await supabase
      .from("delivery_offers")
      .select("*")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());
    if (of && of.length) {
      const orderIds = of.map((x) => x.order_id);
      const { data: os } = await supabase
        .from("orders")
        .select("*, order_items(name, quantity, size, flavor, unit_price)")
        .in("id", orderIds);
      const map = new Map((os ?? []).map((x) => [x.id, x]));
      setOffers(of.map((x) => ({ ...x, order: map.get(x.order_id) as Order | undefined })));
    } else {
      setOffers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime channels
  useEffect(() => {
    if (!courier) return;
    const chOffers = supabase
      .channel(`motoboy-offers-${courier.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_offers" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `courier_id=eq.${courier.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(chOffers); };
  }, [courier?.id, load]);

  // GPS heartbeat while online
  const sendHeartbeat = useCallback(async (coord: { lat: number; lng: number; heading?: number; speed?: number; acc?: number }) => {
    try {
      await supabase.rpc("courier_heartbeat", {
        _lat: coord.lat,
        _lng: coord.lng,
        _heading: coord.heading ?? undefined,
        _speed: coord.speed ?? undefined,
        _accuracy: coord.acc ?? undefined,
        _battery: undefined,
      });
    } catch (e) {
      console.warn("heartbeat failed", e);
    }
  }, []);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não disponível neste dispositivo");
      return;
    }
    setGpsError(null);
    gpsWatch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coord = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          acc: pos.coords.accuracy,
        };
        setGpsCoord(coord);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    // Send heartbeat every 10s
    heartbeatTimer.current = window.setInterval(() => {
      if (gpsCoord) sendHeartbeat(gpsCoord);
    }, 10000);
  }, [gpsCoord, sendHeartbeat]);

  const stopGps = useCallback(() => {
    if (gpsWatch.current != null) navigator.geolocation.clearWatch(gpsWatch.current);
    if (heartbeatTimer.current != null) window.clearInterval(heartbeatTimer.current);
    gpsWatch.current = null;
    heartbeatTimer.current = null;
  }, []);

  useEffect(() => () => stopGps(), [stopGps]);
  useEffect(() => {
    if (gpsCoord && isOnline) sendHeartbeat(gpsCoord);
  }, [gpsCoord?.lat, gpsCoord?.lng, isOnline, sendHeartbeat]);

  const toggleOnline = async () => {
    if (!courier) return;
    const newStatus = isOnline ? "offline" : "online";
    const { error } = await supabase.rpc("set_courier_status", { _status: newStatus });
    if (error) { toast.error("Falha ao alterar status"); return; }
    setIsOnline(!isOnline);
    if (!isOnline) {
      startGps();
      toast.success("Você está online — pronto para receber corridas");
    } else {
      stopGps();
      toast("Você está offline", { icon: "🌙" });
    }
    await load();
  };

  const acceptOffer = async (offerId: string) => {
    const { data, error } = await supabase.rpc("accept_delivery_offer", { _offer_id: offerId });
    if (error) { toast.error("Falha ao aceitar"); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res.ok) {
      if (res.error === "offer_taken") toast.error("Corrida já aceita por outro motoboy");
      else if (res.error === "already_assigned") toast.error("Pedido já atribuído");
      else toast.error("Falha ao aceitar corrida");
    } else {
      toast.success("Corrida aceita! Boa entrega 🏍️");
    }
    await load();
  };

  const rejectOffer = async (offerId: string) => {
    await supabase.rpc("reject_delivery_offer", { _offer_id: offerId });
    await load();
  };

  const markPickup = async (orderId: string) => {
    const { data } = await supabase.rpc("pickup_delivery", { _order_id: orderId });
    if ((data as { ok: boolean })?.ok) toast.success("Retirada confirmada");
    await load();
  };

  const markDelivered = async (orderId: string) => {
    if (!confirm("Confirmar entrega deste pedido?")) return;
    const { data } = await supabase.rpc("complete_delivery", { _order_id: orderId });
    if ((data as { ok: boolean })?.ok) toast.success("Entrega concluída! 🎉");
    await load();
  };

  const signOut = async () => {
    stopGps();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const activeOrders = orders.filter((o) => ["pago", "preparando", "saiu_para_entrega"].includes(o.status));
  const historyOrders = orders.filter((o) => o.status === "entregue" || o.status === "cancelado");
  const todayDelivered = historyOrders.filter((o) => {
    const d = new Date(o.created_at); const t = new Date(); t.setHours(0,0,0,0);
    return d >= t;
  });
  const todayEarnings = todayDelivered.reduce((s, o) => s + (o.delivery_fee || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0a0118] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  if (!courier) {
    return (
      <div className="min-h-screen bg-[#0a0118] text-white grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Bike className="mx-auto h-12 w-12 text-fuchsia-400" />
          <h1 className="text-2xl font-black">Portal do Motoboy</h1>
          <p className="text-white/70">
            Sua conta ainda não está vinculada como motoboy. Peça ao administrador para vincular seu email ao cadastro de entregador.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">Voltar ao início</Link>
            <button onClick={signOut} className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold">Sair</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0118] via-[#0c031f] to-[#0a0118] text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0118]/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white font-black">
            {courier.avatar_url ? (
              <img src={courier.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              courier.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-bold">{courier.name}</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-emerald-400 animate-pulse" : "bg-white/40")} />
                {isOnline ? (courier.status === "busy" ? "Em rota" : "Online") : "Offline"}
              </span>
            </div>
            <div className="text-[11px] text-white/50 flex items-center gap-2">
              <Bike className="h-3 w-3" /> {courier.vehicle} {courier.plate && `• ${courier.plate}`}
              {gpsError && <span className="text-red-400">• GPS: {gpsError}</span>}
              {gpsCoord && isOnline && <span className="text-emerald-400 flex items-center gap-1"><Wifi className="h-3 w-3"/> GPS ativo</span>}
            </div>
          </div>
          <button
            onClick={toggleOnline}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-black shadow-lg transition",
              isOnline
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:brightness-110"
            )}
          >
            <Power className="mr-1 inline h-3.5 w-3.5" />
            {isOnline ? "Ficar offline" : "Iniciar dia"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <KpiCard icon={Package} label="Hoje" value={String(todayDelivered.length)} />
          <KpiCard icon={DollarSign} label="Ganhos hoje" value={`R$ ${todayEarnings.toFixed(2)}`} />
          <KpiCard icon={Star} label="Avaliação" value={courier.rating ? courier.rating.toFixed(1) : "—"} />
        </div>

        {tab === "home" && (
          <>
            {/* Available offers (broadcast) */}
            {isOnline && offers.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-black text-fuchsia-300 uppercase tracking-wide flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-fuchsia-400 opacity-75" />
                    <span className="relative rounded-full h-2 w-2 bg-fuchsia-500" />
                  </span>
                  Novas corridas ({offers.length})
                </h2>
                {offers.map((o) => (
                  <OfferCard key={o.id} offer={o} onAccept={() => acceptOffer(o.id)} onReject={() => rejectOffer(o.id)} />
                ))}
              </section>
            )}

            {/* Active orders */}
            <section className="space-y-2">
              <h2 className="text-sm font-black text-white/80 uppercase tracking-wide">
                Suas entregas ({activeOrders.length})
              </h2>
              {activeOrders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
                  {isOnline
                    ? "Aguardando corridas… fique de olho aqui."
                    : "Ative o modo online para receber corridas."}
                </div>
              )}
              {activeOrders.map((o) => (
                <ActiveOrderCard
                  key={o.id}
                  order={o}
                  courierCoord={gpsCoord}
                  onPickup={() => markPickup(o.id)}
                  onDelivered={() => markDelivered(o.id)}
                />
              ))}
            </section>
          </>
        )}

        {tab === "map" && <LiveMap orders={activeOrders} coord={gpsCoord} />}

        {tab === "history" && (
          <section className="space-y-2">
            <h2 className="text-sm font-black text-white/80 uppercase">Histórico</h2>
            {historyOrders.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
                Você ainda não tem entregas concluídas.
              </div>
            )}
            {historyOrders.slice(0, 30).map((o) => (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">#{o.id.slice(0, 6)} — {o.customer_name ?? "Cliente"}</span>
                  <span className={cn("text-[11px] font-bold", o.status === "entregue" ? "text-emerald-400" : "text-red-400")}>
                    {o.status === "entregue" ? "Entregue" : "Cancelado"}
                  </span>
                </div>
                <div className="text-[11px] text-white/50 mt-1">
                  {new Date(o.created_at).toLocaleString("pt-BR")} • Ganho: R$ {(o.delivery_fee || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "profile" && (
          <section className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-white/60">Entregas totais</span><span className="font-bold">{courier.total_deliveries}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Ganhos acumulados</span><span className="font-bold text-emerald-400">R$ {courier.total_earnings.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Avaliação</span><span className="font-bold">{courier.rating ? `⭐ ${courier.rating.toFixed(1)}` : "Sem avaliações"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Veículo</span><span className="font-bold">{courier.vehicle} {courier.plate}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Telefone</span><span className="font-bold">{courier.phone ?? "—"}</span></div>
            </div>
            <button onClick={signOut} className="w-full rounded-2xl bg-red-500/20 border border-red-500/30 py-3 text-red-300 font-bold flex items-center justify-center gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </section>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0118]/95 backdrop-blur">
        <div className="mx-auto max-w-2xl grid grid-cols-4">
          <NavBtn active={tab === "home"} onClick={() => setTab("home")} icon={Home} label="Corridas" />
          <NavBtn active={tab === "map"} onClick={() => setTab("map")} icon={MapPin} label="Mapa" />
          <NavBtn active={tab === "history"} onClick={() => setTab("history")} icon={Clock} label="Histórico" />
          <NavBtn active={tab === "profile"} onClick={() => setTab("profile")} icon={User} label="Perfil" />
        </div>
      </nav>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <Icon className="h-4 w-4 text-fuchsia-400" />
      <div className="mt-1 text-[10px] uppercase text-white/50">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick} className={cn("py-3 flex flex-col items-center gap-1 text-[10px] font-bold", active ? "text-fuchsia-300" : "text-white/50")}>
      <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(232,121,249,0.6)]")} />
      {label}
    </button>
  );
}

function OfferCard({ offer, onAccept, onReject }: { offer: Offer; onAccept: () => void; onReject: () => void }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      const ms = new Date(offer.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [offer.expires_at]);
  const order = offer.order;
  const pct = Math.max(0, Math.min(100, (remaining / 90) * 100));
  return (
    <div className="rounded-2xl border-2 border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-500/10 to-pink-500/5 p-4 shadow-lg shadow-fuchsia-500/20 animate-in fade-in slide-in-from-top-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] text-fuchsia-300 font-bold uppercase">Nova corrida</div>
          <div className="text-lg font-black">R$ {(offer.fee ?? order?.delivery_fee ?? 0).toFixed(2)}</div>
          <div className="text-xs text-white/60">
            {offer.distance_km ? `${offer.distance_km.toFixed(1)} km` : ""} {order?.eta_minutes ? `• ~${order.eta_minutes} min` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">Expira em</div>
          <div className="text-xl font-black font-mono text-amber-400">{remaining}s</div>
        </div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {order && (
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-center gap-2 text-white/80"><MapPin className="h-3.5 w-3.5 text-fuchsia-400"/> {order.address ?? "Endereço não informado"}</div>
          {order.reference && <div className="text-[11px] text-white/50 pl-5">Ref: {order.reference}</div>}
          <div className="text-[11px] text-white/60 pl-5">Pedido de {order.customer_name ?? "cliente"} • R$ {order.total.toFixed(2)}</div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onReject} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white/70 hover:bg-white/15">
          <X className="mr-1 inline h-4 w-4"/> Recusar
        </button>
        <button onClick={onAccept} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-2.5 text-sm font-black text-white shadow-lg hover:brightness-110">
          <Check className="mr-1 inline h-4 w-4"/> Aceitar
        </button>
      </div>
    </div>
  );
}

function ActiveOrderCard({ order, courierCoord, onPickup, onDelivered }: {
  order: Order;
  courierCoord: { lat: number; lng: number } | null;
  onPickup: () => void;
  onDelivered: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPickedUp = !!order.picked_up_at;
  const kmToClient = useMemo(() => {
    if (!courierCoord || !order.delivery_lat || !order.delivery_lng) return null;
    return haversine(courierCoord.lat, courierCoord.lng, order.delivery_lat, order.delivery_lng);
  }, [courierCoord?.lat, courierCoord?.lng, order.delivery_lat, order.delivery_lng]);

  const navigateUrl = order.delivery_lat && order.delivery_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}&travelmode=driving`
    : order.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`
    : null;

  return (
    <div className={cn(
      "rounded-2xl border p-3 space-y-3",
      isPickedUp ? "border-amber-500/40 bg-amber-500/5" : "border-cyan-500/40 bg-cyan-500/5"
    )}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold uppercase text-white/50">Pedido #{order.id.slice(0, 6)}</div>
          <div className="font-bold">{order.customer_name ?? "Cliente"}</div>
          <div className="text-xs text-white/60">R$ {order.total.toFixed(2)} • {order.payment_method ?? "—"}</div>
        </div>
        <div className="text-right">
          <div className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
            isPickedUp ? "bg-amber-500/20 text-amber-300" : "bg-cyan-500/20 text-cyan-300")}>
            {isPickedUp ? "Em rota" : "Aguardando retirada"}
          </div>
          {kmToClient != null && (
            <div className="text-[11px] mt-1 text-white/60">{kmToClient.toFixed(1)} km do cliente</div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-fuchsia-400 mt-0.5"/>
        <div className="flex-1">
          <div className="text-white/90">{order.address ?? "Endereço não informado"}</div>
          {order.reference && <div className="text-[11px] text-white/50">Ref: {order.reference}</div>}
        </div>
      </div>

      {expanded && order.order_items && (
        <div className="rounded-xl bg-white/[0.03] p-2 text-[12px] space-y-1">
          {order.order_items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span>{it.quantity}× {it.name}{it.flavor ? ` (${it.flavor})` : ""}</span>
              <span className="text-white/60">R$ {(it.unit_price * it.quantity).toFixed(2)}</span>
            </div>
          ))}
          {order.note && <div className="mt-1 text-[11px] text-amber-300">📝 {order.note}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setExpanded(!expanded)} className="rounded-xl bg-white/5 py-2 text-xs font-semibold text-white/70">
          {expanded ? "Ocultar itens" : "Ver itens"}
        </button>
        {order.phone && (
          <a href={`tel:${order.phone}`} className="rounded-xl bg-white/5 py-2 text-xs font-semibold text-white/70 text-center flex items-center justify-center gap-1">
            <Phone className="h-3.5 w-3.5"/> Ligar
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {navigateUrl && (
          <a href={navigateUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-500/20 border border-blue-500/40 py-2.5 text-xs font-bold text-blue-300 text-center flex items-center justify-center gap-1">
            <Navigation className="h-3.5 w-3.5"/> Rotas
          </a>
        )}
        {!isPickedUp ? (
          <button onClick={onPickup} className="col-span-2 rounded-xl bg-amber-500 py-2.5 text-xs font-black text-white">
            <Package className="mr-1 inline h-4 w-4"/> Confirmar retirada
          </button>
        ) : (
          <button onClick={onDelivered} className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-2.5 text-xs font-black text-white shadow-lg">
            <Check className="mr-1 inline h-4 w-4"/> Confirmar entrega
          </button>
        )}
      </div>
    </div>
  );
}

function LiveMap({ orders, coord }: { orders: Order[]; coord: { lat: number; lng: number } | null }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const meMarker = useRef<L.Marker | null>(null);
  const markers = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const center: [number, number] = coord ? [coord.lat, coord.lng] : [-23.55, -46.63];
    const map = L.map(mapEl.current, { center, zoom: 14 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (coord) {
      if (!meMarker.current) {
        meMarker.current = L.marker([coord.lat, coord.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:#22c55e;border:3px solid white;border-radius:9999px;width:20px;height:20px;box-shadow:0 0 12px #22c55e"></div>`,
          }),
        }).addTo(map).bindPopup("Você");
      } else {
        meMarker.current.setLatLng([coord.lat, coord.lng]);
      }
    }
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    orders.forEach((o) => {
      if (o.delivery_lat && o.delivery_lng) {
        const m = L.marker([o.delivery_lat, o.delivery_lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:#ec4899;border:2px solid white;border-radius:9999px;width:16px;height:16px"></div>`,
          }),
        }).addTo(map).bindPopup(`${o.customer_name ?? "Cliente"}<br/>${o.address ?? ""}`);
        markers.current.push(m);
      }
    });
    if (coord && orders.length > 0) {
      const pts: L.LatLngExpression[] = [[coord.lat, coord.lng]];
      orders.forEach((o) => { if (o.delivery_lat && o.delivery_lng) pts.push([o.delivery_lat, o.delivery_lng]); });
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
    } else if (coord) {
      map.setView([coord.lat, coord.lng], 15);
    }
  }, [orders, coord?.lat, coord?.lng]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      <div ref={mapEl} className="h-[520px] w-full overflow-hidden rounded-xl [&_.leaflet-container]:bg-[#0d0322]" />
      {!coord && (
        <p className="mt-2 text-center text-xs text-amber-300">Ative o modo online para transmitir sua localização.</p>
      )}
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
