import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bike, Store, CheckCircle2, Clock, Phone, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { key: "dispatched", label: "Saiu para entrega", icon: Bike },
  { key: "delivered", label: "Entregue", icon: CheckCircle2 },
];

function currentStep(t: Tracking): number {
  if (t.delivered_at || t.status === "entregue") return 3;
  if (t.dispatched_at || t.picked_up_at || ["saiu_para_entrega", "a_caminho"].includes(t.status)) return 2;
  if (t.preparing_at || t.status === "preparando") return 1;
  return 0;
}

const bikeIcon = L.divIcon({
  className: "",
  html: `<div style="background:#a855f7;width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(168,85,247,.25),0 4px 12px rgba(0,0,0,.4);color:white;font-size:20px">🛵</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});
const homeIcon = L.divIcon({
  className: "",
  html: `<div style="background:#22c55e;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 4px 12px rgba(0,0,0,.4)">🏠</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});
const storeIcon = L.divIcon({
  className: "",
  html: `<div style="background:#f59e0b;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 4px 12px rgba(0,0,0,.4)">🏪</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function TrackingPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const timerRef = useRef<number | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ courier?: L.Marker; delivery?: L.Marker; store?: L.Marker }>({});

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
    timerRef.current = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [token]);

  const step = data ? currentStep(data) : 0;

  const mapCenter = useMemo<[number, number] | null>(() => {
    if (!data) return null;
    if (data.courier_lat && data.courier_lng) return [data.courier_lat, data.courier_lng];
    if (data.delivery_lat && data.delivery_lng) return [data.delivery_lat, data.delivery_lng];
    if (data.origin_lat && data.origin_lng) return [data.origin_lat, data.origin_lng];
    return null;
  }, [data]);

  useEffect(() => {
    if (!mapEl.current || !mapCenter || !data || data.mode === "retirada") return;
    if (!mapRef.current) {
      mapRef.current = L.map(mapEl.current, { center: mapCenter, zoom: 15, scrollWheelZoom: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    if (data.origin_lat && data.origin_lng) {
      const p: [number, number] = [data.origin_lat, data.origin_lng];
      if (markersRef.current.store) markersRef.current.store.setLatLng(p);
      else markersRef.current.store = L.marker(p, { icon: storeIcon }).addTo(map).bindPopup("Loja");
    }
    if (data.delivery_lat && data.delivery_lng) {
      const p: [number, number] = [data.delivery_lat, data.delivery_lng];
      if (markersRef.current.delivery) markersRef.current.delivery.setLatLng(p);
      else markersRef.current.delivery = L.marker(p, { icon: homeIcon }).addTo(map).bindPopup("Você");
    }
    if (data.courier_lat && data.courier_lng) {
      const p: [number, number] = [data.courier_lat, data.courier_lng];
      if (markersRef.current.courier) markersRef.current.courier.setLatLng(p);
      else markersRef.current.courier = L.marker(p, { icon: bikeIcon }).addTo(map).bindPopup(data.courier_name ?? "Entregador");
      map.panTo(p, { animate: true });
    }
  }, [data, mapCenter]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c031f] text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#0c031f] text-white flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-5xl mb-4">🔎</div>
          <h1 className="text-xl font-bold">Pedido não encontrado</h1>
          <p className="text-white/70 text-sm mt-2">Verifique o link ou peça um novo ao restaurante.</p>
        </div>
      </div>
    );
  }

  const eta = data.eta_minutes;
  const delivered = step === 3;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c031f] via-[#160636] to-[#0c031f] text-white pb-24">
      <header className="p-5">
        <p className="text-xs uppercase tracking-widest text-white/50">Pedido #{data.id.slice(0, 8)}</p>
        <h1 className="text-2xl font-bold mt-1">
          {delivered ? "Entregue! 🎉" : eta ? `Chega em ~${eta} min` : "Preparando seu pedido"}
        </h1>
        <p className="text-white/60 text-sm mt-1">Olá, {data.customer_name.split(" ")[0]}!</p>
      </header>

      {/* Stepper */}
      <div className="px-5">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i <= step;
              return (
                <div key={s.key} className="relative z-10 flex flex-col items-center gap-1 w-16">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                      done
                        ? "bg-gradient-to-br from-purple-500 to-pink-500 border-transparent"
                        : "bg-[#0c031f] border-white/20 text-white/40"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("text-[10px] text-center leading-tight", done ? "text-white" : "text-white/40")}>
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
          <MapContainer center={mapCenter} zoom={15} className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
            />
            {data.origin_lat && data.origin_lng && (
              <Marker position={[data.origin_lat, data.origin_lng]} icon={storeIcon}>
                <Popup>Loja</Popup>
              </Marker>
            )}
            {data.delivery_lat && data.delivery_lng && (
              <Marker position={[data.delivery_lat, data.delivery_lng]} icon={homeIcon}>
                <Popup>Você</Popup>
              </Marker>
            )}
            {data.courier_lat && data.courier_lng && (
              <Marker position={[data.courier_lat, data.courier_lng]} icon={bikeIcon}>
                <Popup>{data.courier_name}</Popup>
              </Marker>
            )}
          </MapContainer>
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
          <div className="flex-1">
            <p className="text-xs text-white/50">Seu entregador</p>
            <p className="font-semibold">{data.courier_name}</p>
            <p className="text-xs text-white/60">
              {data.courier_vehicle}
              {data.courier_rating ? ` · ⭐ ${data.courier_rating.toFixed(1)}` : ""}
            </p>
          </div>
          {data.courier_phone && (
            <a
              href={`tel:${data.courier_phone}`}
              className="h-11 w-11 rounded-full bg-green-500 flex items-center justify-center"
              aria-label="Ligar para o entregador"
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      {/* Details */}
      <div className="mt-5 mx-5 rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3 text-sm">
        {data.address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-white/50 mt-0.5" />
            <div>
              <p className="text-white/50 text-xs">Endereço</p>
              <p>{data.address}</p>
              {data.reference && <p className="text-white/60 text-xs">Ref: {data.reference}</p>}
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-white/50 mt-0.5" />
          <div>
            <p className="text-white/50 text-xs">Pedido</p>
            <p>{new Date(data.created_at).toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-white/60">Total</span>
          <span className="font-bold text-lg">
            {data.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-white/40 mt-6">Atualiza automaticamente a cada 10s</p>
    </div>
  );
}
