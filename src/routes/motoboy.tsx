import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Bike, Power, MapPin, Navigation, Check, X, Package, Clock, DollarSign,
  Phone, LogOut, Star, TrendingUp, Wifi, Target, Award, Flame, Timer,
  Loader2, Home, User, Calendar, XCircle, CheckCircle2, BarChart3,
  Sparkles, Route as RouteIcon, ArrowRight, PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizeRoute, type OptimizeResult } from "@/lib/route-optimization.functions";
import { DeliveryProofDialog } from "@/components/courier/DeliveryProofDialog";

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
  order_number?: number | string | null;
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
  broadcast: boolean | null;
  courier_id: string | null;
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
  const latestCoordRef = useRef<{ lat: number; lng: number; heading?: number; speed?: number; acc?: number } | null>(null);
  const lastSentAtRef = useRef<number>(0);

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

    // Missed offers — this courier saw them but rejected / expired / taken by others
    const { data: missed } = await supabase
      .from("delivery_offers")
      .select("*")
      .or(`courier_id.eq.${c.id},broadcast.eq.true`)
      .in("status", ["rejected", "expired", "taken"])
      .order("offered_at", { ascending: false })
      .limit(50);
    if (missed && missed.length) {
      const mIds = missed.map((x) => x.order_id);
      const { data: mos } = await supabase
        .from("orders")
        .select("id, customer_name, address, total, delivery_fee, distance_km, created_at, courier_id")
        .in("id", mIds);
      const mmap = new Map((mos ?? []).map((x) => [x.id, x]));
      // Exclude ones that this courier ended up doing anyway
      const filtered = missed.filter((x) => {
        const o = mmap.get(x.order_id);
        return !o || o.courier_id !== c.id;
      });
      setMissedOffers(filtered.map((x) => ({ ...x, order: mmap.get(x.order_id) as Order | undefined })));
    } else {
      setMissedOffers([]);
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
    // Clear any pre-existing watch/timer to avoid duplicates on re-invocation
    if (gpsWatch.current != null) navigator.geolocation.clearWatch(gpsWatch.current);
    if (heartbeatTimer.current != null) window.clearInterval(heartbeatTimer.current);
    lastSentAtRef.current = 0;

    gpsWatch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coord = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          acc: pos.coords.accuracy,
        };
        latestCoordRef.current = coord;
        setGpsCoord(coord);
        // Send immediately on first fix, then throttle to at most every 10s
        const now = Date.now();
        if (now - lastSentAtRef.current >= 10000) {
          lastSentAtRef.current = now;
          sendHeartbeat(coord);
        }
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    // Fallback heartbeat every 10s using the LATEST coord from ref (never stale)
    heartbeatTimer.current = window.setInterval(() => {
      const c = latestCoordRef.current;
      if (!c) return;
      lastSentAtRef.current = Date.now();
      sendHeartbeat(c);
    }, 10000);
  }, [sendHeartbeat]);

  const stopGps = useCallback(() => {
    if (gpsWatch.current != null) navigator.geolocation.clearWatch(gpsWatch.current);
    if (heartbeatTimer.current != null) window.clearInterval(heartbeatTimer.current);
    gpsWatch.current = null;
    heartbeatTimer.current = null;
    latestCoordRef.current = null;
    lastSentAtRef.current = 0;
  }, []);

  useEffect(() => () => stopGps(), [stopGps]);

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

  const [proofOrder, setProofOrder] = useState<Order | null>(null);

  // Fail-closed cache for Proof-of-Delivery settings. Default assumes photo is required
  // so that a network failure (common on the street) NEVER bypasses the proof requirement.
  type PodSettings = { enabled: boolean; require_photo: boolean; block_completion_without_proof: boolean };
  const POD_CACHE_KEY = "qb.pod.settings.v1";
  const readCachedPod = (): PodSettings | null => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(POD_CACHE_KEY) : null;
      return raw ? (JSON.parse(raw) as PodSettings) : null;
    } catch { return null; }
  };
  const writeCachedPod = (s: PodSettings) => {
    try { window.localStorage.setItem(POD_CACHE_KEY, JSON.stringify(s)); } catch {}
  };
  const podSettingsRef = useRef<PodSettings | null>(null);
  useEffect(() => {
    podSettingsRef.current = readCachedPod();
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("proof_of_delivery_settings")
        .select("enabled, require_photo, block_completion_without_proof")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        const s = data as PodSettings;
        podSettingsRef.current = s;
        writeCachedPod(s);
      }
    })();
    // Refresh on config changes
    const ch = supabase
      .channel("motoboy-pod-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "proof_of_delivery_settings" }, async () => {
        const { data } = await supabase
          .from("proof_of_delivery_settings")
          .select("enabled, require_photo, block_completion_without_proof")
          .eq("id", 1)
          .maybeSingle();
        if (data) {
          const s = data as PodSettings;
          podSettingsRef.current = s;
          writeCachedPod(s);
        }
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  const markDelivered = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Try a fresh fetch with a short timeout; fall back to cache; if still unknown,
    // FAIL-CLOSED and require the proof photo. This prevents "no recebi" disputes
    // from network failures on the street.
    let pod: PodSettings | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const { data, error } = await supabase
        .from("proof_of_delivery_settings")
        .select("enabled, require_photo, block_completion_without_proof")
        .eq("id", 1)
        .abortSignal(controller.signal)
        .maybeSingle();
      clearTimeout(timeout);
      if (!error && data) {
        pod = data as PodSettings;
        podSettingsRef.current = pod;
        writeCachedPod(pod);
      }
    } catch {
      // network / abort — fall through to cache/default
    }
    if (!pod) pod = podSettingsRef.current ?? readCachedPod();
    // Fail-closed default: if we don't know, assume photo is required.
    const requirePhoto = pod ? (pod.enabled && pod.require_photo) : true;

    if (requirePhoto) {
      if (!pod) {
        toast.warning("Sem conexão com o servidor — foto de entrega será exigida por segurança.");
      }
      setProofOrder(order);
      return;
    }
    if (!(await confirmDialog({ message: "Confirmar entrega deste pedido?" }))) return;
    const { data } = await supabase.rpc("complete_delivery", { _order_id: orderId } as any);
    if ((data as { ok: boolean })?.ok) toast.success("Entrega concluída! 🎉");
    await load();
  };


  const submitProof = async (payload: {
    photo_url: string | null;
    lat: number | null;
    lng: number | null;
    notes: string | null;
    skipped_reason: string | null;
    contact_type: string | null;
  }) => {
    if (!proofOrder) return;
    const { data, error } = await supabase.rpc("complete_delivery", {
      _order_id: proofOrder.id,
      _photo_url: payload.photo_url,
      _lat: payload.lat,
      _lng: payload.lng,
      _notes: payload.notes,
      _skipped_reason: payload.skipped_reason,
      _contact_type: payload.contact_type,
    } as any);
    if (error) throw error;
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) {
      const msg =
        res?.error === "photo_required" ? "Foto é obrigatória" :
        res?.error === "skip_reason_required" ? "Informe um motivo válido" :
        res?.error ?? "Falha ao concluir";
      throw new Error(msg);
    }
    toast.success(payload.photo_url ? "Entrega registrada com foto! 📸" : "Entrega concluída");
    await load();
  };

  const signOut = async () => {
    stopGps();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const activeOrders = orders.filter((o) => ["pago", "preparando", "saiu_para_entrega"].includes(o.status));
  const historyOrders = orders.filter((o) => o.status === "entregue" || o.status === "cancelado");

  const stats = useMemo(() => {
    const now = new Date();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(now); startWeek.setDate(now.getDate() - 6); startWeek.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const inRange = (d: string, start: Date) => new Date(d) >= start;
    const delivered = historyOrders.filter((o) => o.status === "entregue");
    const today = delivered.filter((o) => inRange(o.created_at, startToday));
    const week = delivered.filter((o) => inRange(o.created_at, startWeek));
    const month = delivered.filter((o) => inRange(o.created_at, startMonth));
    const sumFee = (arr: Order[]) => arr.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    const sumKm = (arr: Order[]) => arr.reduce((s, o) => s + (o.distance_km || 0), 0);
    const avgTime = (() => {
      const times = delivered.filter((o) => o.dispatched_at && o.picked_up_at).map((o) => {
        const start = new Date(o.picked_up_at!).getTime();
        const end = new Date(o.dispatched_at!).getTime();
        return Math.max(0, (end - start) / 60000);
      });
      if (!times.length) return null;
      return times.reduce((a, b) => a + b, 0) / times.length;
    })();
    // ============================================================
    // Taxa de aceitação — regra rigorosa para não distorcer com broadcast:
    //
    // Só conta no denominador ofertas em que ESTE motoboy teve a chance
    // real de aceitar/recusar:
    //   • Direcionadas a ele (courier_id = c.id, broadcast=false) que
    //     ele aceitou, recusou ou deixou expirar.
    //   • Broadcasts que ele efetivamente aceitou (numerador) — pois
    //     broadcast recusado/expirado/tomado por outro NÃO é "perdida"
    //     dele: ele pode nunca ter visto, estar offline, ou outro
    //     motoboy foi mais rápido. Contar isso puniria injustamente.
    //
    // Numerador: ofertas aceitas hoje por ele (qualquer origem).
    // Denominador: aceitas + recusadas por ele + expiradas direcionadas
    // a ele (não broadcast).
    // ============================================================
    const isMine = (m: Offer) => m.courier_id === courier?.id;
    const todayMissedMine = missedOffers.filter(
      (m) => inRange(m.offered_at, startToday) && isMine(m),
    );
    const rejectedByMe = todayMissedMine.filter((m) => m.status === "rejected").length;
    const directExpired = todayMissedMine.filter(
      (m) => m.status === "expired" && m.broadcast !== true,
    ).length;
    // Numerador: usa entregas de hoje como proxy conservador (todo pedido
    // entregue passou por aceitação). Se um dia expusermos accepted_at no
    // delivery_offers, trocar por contagem direta.
    const acceptedToday = today.length;
    const denom = acceptedToday + rejectedByMe + directExpired;
    const acceptRate = denom > 0 ? (acceptedToday / denom) * 100 : null;
    // "Perdidas hoje" no card = apenas as que realmente pesam contra ele.
    const totalMissed = rejectedByMe + directExpired;
    return {
      today: { count: today.length, earnings: sumFee(today), km: sumKm(today) },
      week: { count: week.length, earnings: sumFee(week), km: sumKm(week) },
      month: { count: month.length, earnings: sumFee(month), km: sumKm(month) },
      avgTime,
      acceptRate,
      missedToday: totalMissed,
    };
  }, [historyOrders, missedOffers, courier?.id]);

  // Battery indicator
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; addEventListener: (e: string, cb: () => void) => void; removeEventListener: (e: string, cb: () => void) => void }> };
    if (!nav.getBattery) return;
    let cleanup: (() => void) | undefined;
    nav.getBattery().then((bat) => {
      const update = () => setBattery(Math.round(bat.level * 100));
      update();
      bat.addEventListener("levelchange", update);
      cleanup = () => bat.removeEventListener("levelchange", update);
    }).catch(() => {});
    return () => { cleanup?.(); };
  }, []);

  const filteredHistory = useMemo(() => {
    const startOf = (p: typeof period): Date | null => {
      const now = new Date();
      if (p === "today") { const d = new Date(); d.setHours(0,0,0,0); return d; }
      if (p === "week") { const d = new Date(now); d.setDate(now.getDate() - 6); d.setHours(0,0,0,0); return d; }
      if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
      return null;
    };
    const s = startOf(period);
    return historyOrders.filter((o) => !s || new Date(o.created_at) >= s);
  }, [historyOrders, period]);

  const filteredMissed = useMemo(() => {
    const startOf = (p: typeof period): Date | null => {
      const now = new Date();
      if (p === "today") { const d = new Date(); d.setHours(0,0,0,0); return d; }
      if (p === "week") { const d = new Date(now); d.setDate(now.getDate() - 6); d.setHours(0,0,0,0); return d; }
      if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
      return null;
    };
    const s = startOf(period);
    return missedOffers.filter((m) => !s || new Date(m.offered_at) >= s);
  }, [missedOffers, period]);

  // Motivational goal — R$ 100 per day
  const dailyGoal = 100;
  const goalPct = Math.min(100, (stats.today.earnings / dailyGoal) * 100);

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
            <div className="text-[11px] text-white/50 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><Bike className="h-3 w-3" /> {courier.vehicle} {courier.plate && `• ${courier.plate}`}</span>
              {gpsError && <span className="text-red-400">• GPS: {gpsError}</span>}
              {gpsCoord && isOnline && <span className="text-emerald-400 flex items-center gap-1"><Wifi className="h-3 w-3"/> GPS</span>}
              {battery !== null && (
                <span className={cn("flex items-center gap-1", battery < 20 ? "text-red-400" : "text-white/50")}>
                  🔋 {battery}%
                </span>
              )}
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
        {/* Daily earnings hero + goal */}
        <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/20 via-purple-700/10 to-transparent p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-fuchsia-300/80 font-bold">Ganhos hoje</div>
              <div className="text-3xl font-black text-white mt-1">R$ {stats.today.earnings.toFixed(2)}</div>
              <div className="text-[11px] text-white/60 mt-0.5">
                {stats.today.count} {stats.today.count === 1 ? "entrega" : "entregas"} • {stats.today.km.toFixed(1)} km
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50 uppercase font-bold">Meta R$ {dailyGoal}</div>
              <div className="text-lg font-black text-emerald-400">{goalPct.toFixed(0)}%</div>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <KpiCard icon={Package} label="Semana" value={String(stats.week.count)} sub={`R$ ${stats.week.earnings.toFixed(0)}`} />
          <KpiCard icon={DollarSign} label="Mês" value={`R$ ${stats.month.earnings.toFixed(0)}`} sub={`${stats.month.count} entregas`} />
          <KpiCard icon={Star} label="Avaliação" value={courier.rating ? courier.rating.toFixed(1) : "—"} sub={`${courier.total_deliveries} totais`} />
        </div>

        {(stats.acceptRate !== null || stats.avgTime !== null || stats.missedToday > 0) && (
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Aceitação" value={stats.acceptRate !== null ? `${stats.acceptRate.toFixed(0)}%` : "—"} tone="emerald" />
            <MiniStat label="Tempo médio" value={stats.avgTime !== null ? `${stats.avgTime.toFixed(0)} min` : "—"} tone="cyan" />
            <MiniStat label="Perdidas hoje" value={String(stats.missedToday)} tone={stats.missedToday > 0 ? "red" : "white"} />
          </div>
        )}

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

              {activeOrders.length >= 2 && (
                <OptimizeRouteWidget
                  courierId={courier.id}
                  gpsCoord={gpsCoord}
                  count={activeOrders.length}
                />
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
          <section className="space-y-3">
            {/* Sub-tabs: entregues x perdidas */}
            <div className="flex gap-2">
              <button
                onClick={() => setHistoryTab("delivered")}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition",
                  historyTab === "delivered"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-white/5 text-white/60 border border-white/10"
                )}
              >
                Aceitas
              </button>
              <button
                onClick={() => setHistoryTab("missed")}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition",
                  historyTab === "missed"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-white/5 text-white/60 border border-white/10"
                )}
              >
                Perdidas
              </button>
            </div>

            {/* Period filter */}
            <div className="flex gap-1 overflow-x-auto">
              {(["today", "week", "month", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap transition",
                    period === p ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60"
                  )}
                >
                  {p === "today" ? "Hoje" : p === "week" ? "7 dias" : p === "month" ? "Mês" : "Tudo"}
                </button>
              ))}
            </div>

            {historyTab === "delivered" ? (
              <>
                {filteredHistory.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
                    Nenhuma entrega no período.
                  </div>
                )}
                {filteredHistory.slice(0, 60).map((o) => (
                  <div key={o.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">#{o.id.slice(0, 6)} — {o.customer_name ?? "Cliente"}</span>
                      <span className={cn("text-[11px] font-bold", o.status === "entregue" ? "text-emerald-400" : "text-red-400")}>
                        {o.status === "entregue" ? "Entregue" : "Cancelado"}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-1 flex flex-wrap gap-x-2">
                      <span>{new Date(o.created_at).toLocaleString("pt-BR")}</span>
                      <span>• R$ {(o.delivery_fee || 0).toFixed(2)}</span>
                      {o.distance_km ? <span>• {o.distance_km.toFixed(1)} km</span> : null}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {filteredMissed.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
                    Nenhuma corrida perdida no período. Ótimo trabalho! 🎉
                  </div>
                )}
                {filteredMissed.slice(0, 60).map((m) => (
                  <div key={m.id} className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-white/80">Corrida perdida</span>
                      <span className="text-[11px] font-bold text-red-300 uppercase">
                        {m.status === "expired" ? "Expirou" : m.status === "rejected" ? "Recusada" : m.status === "taken" ? "Outro pegou" : m.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-1 flex flex-wrap gap-x-2">
                      <span>{new Date(m.offered_at).toLocaleString("pt-BR")}</span>
                      {m.fee ? <span>• R$ {m.fee.toFixed(2)}</span> : null}
                      {m.distance_km ? <span>• {m.distance_km.toFixed(1)} km</span> : null}
                    </div>
                  </div>
                ))}
              </>
            )}
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

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-fuchsia-300 mb-2">Desempenho</div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Aceitação (hoje)</span><span className="font-bold">{stats.acceptRate !== null ? `${stats.acceptRate.toFixed(0)}%` : "—"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Tempo médio de entrega</span><span className="font-bold">{stats.avgTime !== null ? `${stats.avgTime.toFixed(0)} min` : "—"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Km percorridos (semana)</span><span className="font-bold">{stats.week.km.toFixed(1)} km</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/60">Corridas perdidas (hoje)</span><span className={cn("font-bold", stats.missedToday > 0 ? "text-red-400" : "text-white")}>{stats.missedToday}</span></div>
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

      {proofOrder && (
        <DeliveryProofDialog
          open={!!proofOrder}
          onClose={() => setProofOrder(null)}
          onConfirm={submitProof}
          orderId={proofOrder.id}
          orderNumber={proofOrder.order_number ?? proofOrder.id.slice(0, 6)}
          courierName={courier.name}
        />
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <Icon className="h-4 w-4 text-fuchsia-400" />
      <div className="mt-1 text-[10px] uppercase text-white/50">{label}</div>
      <div className="text-lg font-black leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "cyan" | "red" | "white" }) {
  const toneCls = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    red: "text-red-400",
    white: "text-white",
  }[tone];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase text-white/50">{label}</div>
      <div className={cn("text-sm font-black", toneCls)}>{value}</div>
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

function OptimizeRouteWidget({
  courierId,
  gpsCoord,
  count,
}: {
  courierId: string;
  gpsCoord: { lat: number; lng: number } | null;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [minStops, setMinStops] = useState(2);
  const optimize = useServerFn(optimizeRoute);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("route_optimization_settings")
        .select("enabled, min_stops")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setEnabled(!!data.enabled);
        setMinStops(data.min_stops ?? 2);
      }
    })();
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const res = await optimize({
        data: {
          courier_id: courierId,
          save: true,
          origin: gpsCoord ?? undefined,
        },
      });
      setResult(res);
      setOpen(true);
      if (res.saved_km > 0.1) {
        toast.success(`Economia de ${res.saved_km.toFixed(1)} km 🎯`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao otimizar rota");
    } finally {
      setLoading(false);
    }
  };

  if (!enabled || count < minStops) return null;

  const navUrl = useMemo(() => {
    if (!result || result.stops.length === 0) return null;
    const origin = `${result.origin.lat},${result.origin.lng}`;
    const dest = result.stops[result.stops.length - 1];
    const waypoints = result.stops
      .slice(0, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest.lat},${dest.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
  }, [result]);

  return (
    <div className="rounded-2xl border-2 border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-500/15 via-purple-800/10 to-transparent p-4 shadow-lg shadow-fuchsia-500/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
            Rota inteligente
          </div>
          <div className="font-black text-white flex items-center gap-2 mt-0.5">
            <RouteIcon className="h-4 w-4" /> {count} paradas — otimize a ordem
          </div>
          <div className="text-[11px] text-white/60">
            Menos km rodado, entregas mais rápidas e clientes satisfeitos.
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-2 text-xs font-black text-white shadow disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 inline h-3.5 w-3.5" />}
          {result ? "Recalcular" : "Otimizar"}
        </button>
      </div>

      {result && open && (
        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Total" value={`${result.total_distance_km.toFixed(1)} km`} tone="cyan" />
            <MiniStat label="ETA" value={`${result.total_duration_min.toFixed(0)} min`} tone="emerald" />
            <MiniStat label="Economia" value={`−${result.saved_km.toFixed(1)} km`} tone={result.saved_km > 0.5 ? "emerald" : "white"} />
          </div>

          <div className="space-y-2">
            {result.stops.map((s, i) => (
              <div key={s.order_id} className="flex items-start gap-2 rounded-xl bg-white/5 p-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fuchsia-500 text-white text-xs font-black">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-white truncate">{s.customer_name ?? "Cliente"}</div>
                    <div className="text-[10px] text-white/50 shrink-0">
                      ETA {s.eta_at ? new Date(s.eta_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                  <div className="text-[11px] text-white/60 flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-fuchsia-400" />
                    <span className="truncate">{s.address ?? "—"}</span>
                  </div>
                  <div className="flex gap-2 mt-1 text-[10px]">
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-white/60">{s.distance_from_prev_km?.toFixed(1)} km</span>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-white/60">{s.duration_from_prev_min?.toFixed(0)} min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-3 text-center text-sm font-black text-white shadow-lg"
            >
              <PlayCircle className="mr-1 inline h-4 w-4" /> Iniciar navegação no Google Maps
            </a>
          )}

          <div className="text-[10px] text-white/40 text-center">
            {result.provider_used === "google_directions" ? "Rota via Google Directions" : "Rota via vizinho mais próximo"}
            {result.return_to_store && " • retorno à loja incluído"}
          </div>
        </div>
      )}
    </div>
  );
}

