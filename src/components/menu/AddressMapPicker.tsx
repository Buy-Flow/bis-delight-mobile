import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2, MapPin, Search, X, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { geocodeAddress, reverseGeocode } from "@/lib/delivery-zone";
import { cn } from "@/lib/utils";

// Fix leaflet default marker icons in Vite bundle
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type PickedLocation = {
  lat: number;
  lng: number;
  address: string;
};

export function AddressMapPicker({
  open,
  onClose,
  onConfirm,
  initial,
  storeOrigin,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
  initial?: { lat?: number | null; lng?: number | null; address?: string | null } | null;
  storeOrigin?: { lat: number | null; lng: number | null } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [reversing, setReversing] = useState(false);

  // Initialize map once when opened
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;

    const startLat = coords?.lat ?? storeOrigin?.lat ?? -8.7619;
    const startLng = coords?.lng ?? storeOrigin?.lng ?? -63.9039;
    const startZoom = coords ? 17 : 15;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([startLat, startLng], startZoom);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], {
      draggable: true,
      icon: DefaultIcon,
    }).addTo(map);

    const applyMove = async (latlng: L.LatLng) => {
      setCoords({ lat: latlng.lat, lng: latlng.lng });
      setReversing(true);
      try {
        const text = await reverseGeocode(latlng.lat, latlng.lng);
        if (text) setAddress(text);
      } finally {
        setReversing(false);
      }
    };

    marker.on("dragend", () => applyMove(marker.getLatLng()));
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      void applyMove(e.latlng);
    });

    if (!coords) {
      // If we opened without initial coords, capture a first reverse-geocode of the center marker
      void applyMove(marker.getLatLng());
    }

    mapRef.current = map;
    markerRef.current = marker;

    // Give the browser a tick to size the container correctly.
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If we reopen with a different initial address/coords, refresh state
  useEffect(() => {
    if (!open) return;
    if (initial?.address && !address) setAddress(initial.address);
    if (
      initial?.lat != null &&
      initial?.lng != null &&
      (!coords || coords.lat !== initial.lat || coords.lng !== initial.lng)
    ) {
      setCoords({ lat: initial.lat, lng: initial.lng });
      const m = markerRef.current;
      const map = mapRef.current;
      if (m && map) {
        m.setLatLng([initial.lat, initial.lng]);
        map.setView([initial.lat, initial.lng], 17);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.lat, initial?.lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta localização");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        const m = markerRef.current;
        const map = mapRef.current;
        if (m && map) {
          m.setLatLng([latitude, longitude]);
          map.setView([latitude, longitude], 18);
        }
        setReversing(true);
        try {
          const text = await reverseGeocode(latitude, longitude);
          if (text) setAddress(text);
        } finally {
          setReversing(false);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Ative no navegador."
            : "Não foi possível obter sua localização.";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = search.trim();
    if (q.length < 4) {
      toast.error("Digite um endereço mais completo");
      return;
    }
    setSearching(true);
    try {
      const g = await geocodeAddress(q);
      if (!g) {
        toast.error("Endereço não encontrado — arraste o pin manualmente");
        return;
      }
      setCoords({ lat: g.lat, lng: g.lng });
      setAddress(g.label);
      const m = markerRef.current;
      const map = mapRef.current;
      if (m && map) {
        m.setLatLng([g.lat, g.lng]);
        map.setView([g.lat, g.lng], 17);
      }
    } finally {
      setSearching(false);
    }
  };

  const confirm = () => {
    if (!coords) {
      toast.error("Posicione o pin no mapa primeiro");
      return;
    }
    onConfirm({
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
      address: address.trim() || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0b0220]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/30">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-white">Ajustar pin no mapa</div>
            <div className="truncate text-[10px] text-white/50">
              Arraste até a porta da sua casa
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search + geolocate */}
      <div className="border-b border-white/10 bg-black/20 p-2.5 space-y-2">
        <form onSubmit={runSearch} className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5">
            <Search className="h-4 w-4 text-white/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar endereço (rua, número, bairro)"
              className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded-xl bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </button>
        </form>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon-cyan/15 px-3 py-2 text-xs font-bold text-neon-cyan ring-1 ring-neon-cyan/30 hover:bg-neon-cyan/25 disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          Usar minha localização atual
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0 [&_.leaflet-container]:bg-[#0d0322]" />
        {/* Overlay hint */}
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
          Arraste o pin ou toque no mapa
        </div>
      </div>

      {/* Footer with address + confirm */}
      <div className="border-t border-white/10 bg-black/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
        <div className="flex items-start gap-2 rounded-xl border border-neon-yellow/30 bg-neon-yellow/10 px-2.5 py-2 text-[11px] text-neon-yellow">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Confirme se o pin está exatamente na porta da sua casa.</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
            <MapPin className="h-3 w-3" /> Endereço detectado {reversing && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
            placeholder="Endereço textual (preenchido automaticamente)"
          />
          {coords && (
            <div className="mt-1 text-[10px] text-white/40 font-mono">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white hover:bg-white/15"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!coords}
            className={cn(
              "flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold text-white active:scale-[.98]",
              coords ? "bg-neon-pink glow-pink" : "bg-white/10 text-white/50",
            )}
          >
            <Check className="h-4 w-4" /> Confirmar localização
          </button>
        </div>
      </div>
    </div>
  );
}
