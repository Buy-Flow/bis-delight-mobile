import { useEffect, useRef, useState } from "react";
import type { LatLng, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Loader2, MapPin, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { reverseGeocode } from "@/lib/delivery-zone";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

export type InlinePickedLocation = { lat: number; lng: number; address: string };

export function AddressMapInline({
  value,
  storeOrigin,
  onChange,
}: {
  value?: { lat: number | null; lng: number | null } | null;
  storeOrigin?: { lat: number | null; lng: number | null } | null;
  onChange: (loc: InlinePickedLocation) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [reversing, setReversing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : null,
  );

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    void import("leaflet").then((L) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const startLat = coords?.lat ?? storeOrigin?.lat ?? -8.7619;
      const startLng = coords?.lng ?? storeOrigin?.lng ?? -63.9039;
      const zoom = coords ? 17 : 15;
      const defaultIcon = L.icon({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([startLat, startLng], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const marker = L.marker([startLat, startLng], {
        draggable: true,
        icon: defaultIcon,
      }).addTo(map);

      const applyMove = async (latlng: LatLng) => {
        setCoords({ lat: latlng.lat, lng: latlng.lng });
        setReversing(true);
        try {
          const text = await reverseGeocode(latlng.lat, latlng.lng);
          onChange({
            lat: Number(latlng.lat.toFixed(6)),
            lng: Number(latlng.lng.toFixed(6)),
            address: text ?? "",
          });
        } finally {
          setReversing(false);
        }
      };

      marker.on("dragend", () => applyMove(marker.getLatLng()));
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        void applyMove(e.latlng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 60);
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (value?.lat == null || value?.lng == null) return;
    const m = markerRef.current;
    const map = mapRef.current;
    if (!m || !map) return;
    const cur = m.getLatLng();
    if (Math.abs(cur.lat - value.lat) < 1e-6 && Math.abs(cur.lng - value.lng) < 1e-6) return;
    m.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], 17);
    setCoords({ lat: value.lat, lng: value.lng });
  }, [value?.lat, value?.lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta localização");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const m = markerRef.current;
        const map = mapRef.current;
        if (m && map) {
          m.setLatLng([latitude, longitude]);
          map.setView([latitude, longitude], 18);
        }
        setCoords({ lat: latitude, lng: longitude });
        setReversing(true);
        try {
          const text = await reverseGeocode(latitude, longitude);
          onChange({
            lat: Number(latitude.toFixed(6)),
            lng: Number(longitude.toFixed(6)),
            address: text ?? "",
          });
        } finally {
          setReversing(false);
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada."
            : "Não foi possível obter sua localização.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
          <RouteIcon className="h-3.5 w-3.5" />
          Ajuste o pin no mapa
          {reversing && <Loader2 className="h-3 w-3 animate-spin text-white/50" />}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white/15 disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
          Minha localização
        </button>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[220px] w-full [&_.leaflet-container]:bg-[#1a1424]"
        />
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
          Arraste o pin até a porta
        </div>
      </div>
      {coords && (
        <div className="flex items-center gap-1.5 border-t border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-mono text-white/50">
          <MapPin className="h-3 w-3" />
          {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
