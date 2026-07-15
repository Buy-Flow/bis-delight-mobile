import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";
import type * as LeafletNS from "leaflet";
import {
  Bike,
  Store,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Loader2,
  Share2,
  Copy,
  Check,
  Home,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSP } from "@/lib/tz";
import { toast } from "sonner";

export const Route = createFileRoute("/rastrear/$token")({
  head: () => ({
    meta: [
      { title: "Acompanhar pedido" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackingPage,
});

type Tracking = {
  id: string;
  status: string;
  mode: string;
  customer_name: string;
  total: number;
  eta_minutes: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  origin_lat: number | null;
  origin_lng: number | null;
  distance_km: number | null;
  created_at: string;
  paid_at: string | null;
  preparing_at: string | null;
  dispatched_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  address: string | null;
  reference: string | null;
  courier_id: string | null;
  courier_name: string | null;
  courier_phone: string | null;
  courier_vehicle: string | null;
  courier_avatar: string | null;
  courier_rating: number | null;
  courier_lat: number | null;
  courier_lng: number | null;
  courier_heading: number | null;
  courier_location_at: string | null;
};

const STEPS: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "created", label: "Recebido", icon: CheckCircle2 },
  { key: "preparing", label: "Preparando", icon: Store },
  { key: "dispatched", label: "A caminho", icon: Bike },
  { key: "delivered", label: "Entregue", icon: CheckCircle2 },
];

function currentStep(t: Tracking): number {
  if (t.delivered_at || t.status === "entregue") return 3;
  if (t.dispatched_at || t.picked_up_at || ["saiu_para_entrega", "a_caminho"].includes(t.status)) return 2;
  if (t.preparing_at || t.status === "preparando") return 1;
  return 0;
}

function TrackingPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const timerRef = useRef<number | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const markersRef = useRef<{
    courier?: LeafletNS.Marker;
    delivery?: LeafletNS.Marker;
    store?: LeafletNS.Marker;
  }>({});

  // Tick clock every second for live ETA countdown
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Data loader + realtime + polling fallback
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: r, error } = await supabase.rpc("get_tracking_by_token", { _token: token });
      if (!alive) return;
      if (error || !r) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setData(r as unknown as Tracking);
      setLoading(false);
    };
    load();
    timerRef.current = window.setInterval(load, 15_000);

    return () => {
      alive = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [token]);

  // Once we have order id, subscribe to realtime for faster updates
  useEffect(() => {
    if (!data?.id) return;
    const channel = supabase
      .channel(`track:${data.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${data.id}` }, async () => {
        const { data: r } = await supabase.rpc("get_tracking_by_token", { _token: token });
        if (r) setData(r as unknown as Tracking);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "courier_locations", filter: `courier_id=eq.${data.courier_id || "-"}` }, async () => {
        const { data: r } = await supabase.rpc("get_tracking_by_token", { _token: token });
        if (r) setData(r as unknown as Tracking);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.id, data?.courier_id, token]);

  const step = data ? currentStep(data) : 0;

  const mapCenter = useMemo<[number, number] | null>(() => {
    if (!data) return null;
    if (data.courier_lat && data.courier_lng) return [data.courier_lat, data.courier_lng];
    if (data.delivery_lat && data.delivery_lng) return [data.delivery_lat, data.delivery_lng];
    if (data.origin_lat && data.origin_lng) return [data.origin_lat, data.origin_lng];
    return null;
  }, [data]);

  // Lazy-load Leaflet (client only, avoids SSR crash on public route)
  useEffect(() => {
    if (!mapEl.current || !mapCenter || !data || data.mode === "retirada") return;
    let cancelled = false;

    (async () => {
      const L = LRef.current ?? (await import("leaflet")).default ?? (await import("leaflet"));
      if (cancelled || !mapEl.current) return;
      LRef.current = L as typeof LeafletNS;
      const Lx = LRef.current;

      const bikeIcon = Lx.divIcon({
        className: "",
        html: `<div style="background:oklch(0.75 0.20 320);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px oklch(0.75 0.20 320 / .25),0 4px 12px rgba(0,0,0,.4);color:white;font-size:20px">🛵</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const homeIcon = Lx.divIcon({
        className: "",
        html: `<div style="background:#22c55e;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 4px 12px rgba(0,0,0,.4)">🏠</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const storeIcon = Lx.divIcon({
        className: "",
        html: `<div style="background:#f59e0b;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 4px 12px rgba(0,0,0,.4)">🏪</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      if (!mapRef.current) {
        mapRef.current = Lx.map(mapEl.current, {
          center: mapCenter,
          zoom: 15,
          scrollWheelZoom: false,
          attributionControl: false,
        });
        Lx.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }).addTo(mapRef.current);
      }
      const map = mapRef.current!;

      if (data.origin_lat && data.origin_lng) {
        const p: [number, number] = [data.origin_lat, data.origin_lng];
        if (markersRef.current.store) markersRef.current.store.setLatLng(p);
        else markersRef.current.store = Lx.marker(p, { icon: storeIcon }).addTo(map).bindPopup("Loja");
      }
      if (data.delivery_lat && data.delivery_lng) {
        const p: [number, number] = [data.delivery_lat, data.delivery_lng];
        if (markersRef.current.delivery) markersRef.current.delivery.setLatLng(p);
        else markersRef.current.delivery = Lx.marker(p, { icon: homeIcon }).addTo(map).bindPopup("Você");
      }
      if (data.courier_lat && data.courier_lng) {
        const p: [number, number] = [data.courier_lat, data.courier_lng];
        if (markersRef.current.courier) markersRef.current.courier.setLatLng(p);
        else markersRef.current.courier = Lx.marker(p, { icon: bikeIcon }).addTo(map).bindPopup(data.courier_name ?? "Entregador");
        map.panTo(p, { animate: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, mapCenter]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Live ETA countdown — based on paid_at (or created_at) + eta_minutes
  const liveEta = useMemo(() => {
    if (!data || data.delivered_at) return null;
    if (!data.eta_minutes) return null;
    const startIso = data.dispatched_at || data.picked_up_at || data.preparing_at || data.paid_at || data.created_at;
    if (!startIso) return null;
    const start = new Date(startIso).getTime();
    if (isNaN(start)) return null;
    const target = start + data.eta_minutes * 60_000;
    const diffMs = target - now;
    return Math.round(diffMs / 60_000);
  }, [data, now]);

  const shareLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu pedido", text: "Acompanhe meu pedido em tempo real", url });
        return;
      } catch {
        // fallthrough to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não deu para copiar. Copie o link da barra do navegador.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <div className="min-h-dvh bg-background text-white flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-5xl mb-4">🔎</div>
          <h1 className="text-xl font-bold">Pedido não encontrado</h1>
          <p className="text-white/70 text-sm mt-2">Verifique o link ou peça um novo à loja.</p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"
          >
            <Home className="h-4 w-4" /> Ir para o cardápio
          </a>
        </div>
      </div>
    );
  }

  const delivered = step === 3;
  const timeline = [
    { label: "Pedido recebido", at: data.created_at, done: true },
    { label: "Pagamento confirmado", at: data.paid_at, done: !!data.paid_at },
    { label: "Loja começou a preparar", at: data.preparing_at, done: !!data.preparing_at },
    { label: data.mode === "retirada" ? "Pronto para retirada" : "Saiu para entrega", at: data.dispatched_at || data.picked_up_at, done: !!(data.dispatched_at || data.picked_up_at) },
    { label: data.mode === "retirada" ? "Retirado" : "Entregue", at: data.delivered_at, done: !!data.delivered_at },
  ];

  const etaLabel = (() => {
    if (delivered) return "Entregue! 🎉";
    if (liveEta !== null) {
      if (liveEta <= 0) return "Chegando agora";
      if (liveEta === 1) return "Chega em ~1 min";
      return `Chega em ~${liveEta} min`;
    }
    if (data.eta_minutes) return `Chega em ~${data.eta_minutes} min`;
    return "Preparando seu pedido";
  })();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-background text-white pb-24">
      <header className="flex items-start justify-between gap-3 px-5 pt-[max(20px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-white/60">Pedido #{data.id.slice(0, 8)}</p>
          <h1 className="mt-1 font-display text-2xl font-black leading-tight">{etaLabel}</h1>
          <p className="mt-1 text-sm text-white/70">Olá, {data.customer_name.split(" ")[0]}!</p>
        </div>
        <button
          onClick={shareLink}
          aria-label="Compartilhar link do pedido"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Share2 className="h-5 w-5" />}
        </button>
      </header>

      {/* Stepper */}
      <div className="px-5 mt-5">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-4 right-4 top-5 h-1 bg-white/10 rounded-full">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i <= step;
              const active = i === step && !delivered;
              return (
                <div key={s.key} className="relative z-10 flex flex-col items-center gap-1 w-16">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                      done
                        ? "bg-gradient-to-br from-purple-500 to-pink-500 border-transparent"
                        : "bg-background border-white/20 text-white/60",
                      active && "ring-4 ring-pink-500/25 animate-pulse",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("text-[10px] text-center leading-tight", done ? "text-white" : "text-white/60")}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map */}
      {mapCenter && data.mode !== "retirada" && (
        <div className="mt-5 mx-5 rounded-2xl overflow-hidden border border-white/10 h-72">
          <div ref={mapEl} className="h-full w-full" />
        </div>
      )}

      {/* Courier card */}
      {data.courier_name && !delivered && (
        <div className="mt-5 mx-5 rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold overflow-hidden">
            {data.courier_avatar ? (
              <img src={data.courier_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              data.courier_name.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/60">Seu entregador</p>
            <p className="font-semibold truncate">{data.courier_name}</p>
            <p className="text-xs text-white/70">
              {data.courier_vehicle}
              {data.courier_rating ? ` · ⭐ ${data.courier_rating.toFixed(1)}` : ""}
              {data.courier_location_at && (
                <span className="ml-1 text-white/50">· visto {relativeSecs(now - new Date(data.courier_location_at).getTime())}</span>
              )}
            </p>
          </div>
          {data.courier_phone && (
            <a
              href={`tel:${data.courier_phone}`}
              className="h-11 w-11 rounded-full bg-green-500 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
              aria-label={`Ligar para ${data.courier_name}`}
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="mt-5 mx-5 rounded-2xl bg-white/5 border border-white/10 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/60">Linha do tempo</h2>
        <ol className="mt-3 space-y-3">
          {timeline.map((e, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-0.5">
                {e.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 text-white/25" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm", e.done ? "text-white" : "text-white/50")}>{e.label}</div>
                {e.at && (
                  <div className="text-[11px] text-white/50 tabular-nums">{formatSP(new Date(e.at))}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Details */}
      <div className="mt-5 mx-5 rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3 text-sm">
        {data.address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-white/60 mt-0.5" />
            <div>
              <p className="text-white/60 text-xs">Endereço</p>
              <p>{data.address}</p>
              {data.reference && <p className="text-white/60 text-xs">Ref: {data.reference}</p>}
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-white/60 mt-0.5" />
          <div>
            <p className="text-white/60 text-xs">Pedido</p>
            <p>{formatSP(new Date(data.created_at))}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-white/70">Total</span>
          <span className="font-bold text-lg">
            {data.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3 px-5">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/15"
        >
          <Home className="h-4 w-4" /> Cardápio
        </a>
        <button
          onClick={shareLink}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/15"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      </div>

      <p className="text-center text-xs text-white/50 mt-6">Atualiza automaticamente em tempo real</p>
    </div>
  );
}

function relativeSecs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 30) return "agora";
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return `há ${h} h`;
}
