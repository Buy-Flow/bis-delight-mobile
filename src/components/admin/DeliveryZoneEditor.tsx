import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Search,
  Loader2,
  Crosshair,
  Plus,
  Trash2,
  Route,
  Info,
  Ruler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DELIVERY_ZONE,
  geocodeAddress,
  haversineKm,
  calcDeliveryFee,
  type DeliveryZoneConfig,
  type DeliveryTier,
} from "@/lib/delivery-zone";

type Props = {
  storeLat: number | null;
  storeLng: number | null;
  onOriginChange: (lat: number, lng: number) => void;
  zone: DeliveryZoneConfig;
  onZoneChange: (patch: Partial<DeliveryZoneConfig>) => void;
  city?: string;
  flatFallbackFee: number;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function DeliveryZoneEditor({
  storeLat,
  storeLng,
  onOriginChange,
  zone,
  onZoneChange,
  city,
  flatFallbackFee,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const originMarker = useRef<L.Marker | null>(null);
  const radiusCircle = useRef<L.Circle | null>(null);
  const testMarker = useRef<L.Marker | null>(null);
  const testLine = useRef<L.Polyline | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [testAddr, setTestAddr] = useState("");
  const [testingAddr, setTestingAddr] = useState(false);
  const [testResult, setTestResult] = useState<{
    lat: number;
    lng: number;
    km: number;
    label: string;
  } | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (storeLat != null && storeLng != null) return [storeLat, storeLng];
    return [-8.7619, -63.9039]; // Porto Velho fallback
  }, [storeLat, storeLng]);

  // Init map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center,
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onOriginChange(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Origin marker + radius circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || storeLat == null || storeLng == null) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;transform:translate(-50%,-100%);">
               <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#ff2bd1 0%,#a90dcf 70%);border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(255,43,209,.55);"></div>
               <div style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);width:10px;height:10px;background:#fff;border-radius:50%;"></div>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    if (!originMarker.current) {
      originMarker.current = L.marker([storeLat, storeLng], {
        draggable: true,
        icon,
      })
        .addTo(map)
        .bindTooltip("Sua loja (arraste ou clique no mapa)", { direction: "top" });

      originMarker.current.on("dragend", (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        onOriginChange(ll.lat, ll.lng);
      });
    } else {
      originMarker.current.setLatLng([storeLat, storeLng]);
    }

    // Radius circle
    const radiusMeters = Math.max(0, zone.maxKm) * 1000;
    if (radiusMeters > 0) {
      if (!radiusCircle.current) {
        radiusCircle.current = L.circle([storeLat, storeLng], {
          radius: radiusMeters,
          color: "#22d3ee",
          weight: 2,
          fillColor: "#22d3ee",
          fillOpacity: 0.08,
        }).addTo(map);
      } else {
        radiusCircle.current.setLatLng([storeLat, storeLng]);
        radiusCircle.current.setRadius(radiusMeters);
      }
    } else if (radiusCircle.current) {
      radiusCircle.current.remove();
      radiusCircle.current = null;
    }

    map.setView([storeLat, storeLng], map.getZoom() < 12 ? 14 : map.getZoom(), { animate: true });
  }, [storeLat, storeLng, zone.maxKm, onOriginChange]);

  // Test marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (testMarker.current) {
      testMarker.current.remove();
      testMarker.current = null;
    }
    if (testLine.current) {
      testLine.current.remove();
      testLine.current = null;
    }
    if (!testResult || storeLat == null || storeLng == null) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;transform:translate(-50%,-100%);">
               <div style="position:absolute;inset:0;background:#facc15;border:2px solid #0f0322;border-radius:50% 50% 50% 0;transform:rotate(-45deg);"></div>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    testMarker.current = L.marker([testResult.lat, testResult.lng], { icon })
      .addTo(map)
      .bindTooltip(`Cliente · ${testResult.km.toFixed(2)} km`, { direction: "top" });
    testLine.current = L.polyline(
      [
        [storeLat, storeLng],
        [testResult.lat, testResult.lng],
      ],
      { color: "#facc15", weight: 3, dashArray: "6 6", opacity: 0.85 },
    ).addTo(map);
    const bounds = L.latLngBounds([
      [storeLat, storeLng],
      [testResult.lat, testResult.lng],
    ]);
    map.fitBounds(bounds.pad(0.25), { animate: true });
  }, [testResult, storeLat, storeLng]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  const searchOrigin = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const g = await geocodeAddress(searchQ, { city });
      if (!g) return;
      onOriginChange(g.lat, g.lng);
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onOriginChange(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const testDelivery = async () => {
    if (!testAddr.trim() || storeLat == null || storeLng == null) return;
    setTestingAddr(true);
    try {
      const g = await geocodeAddress(testAddr, { city });
      if (!g) {
        setTestResult(null);
        return;
      }
      const km = haversineKm({ lat: storeLat, lng: storeLng }, { lat: g.lat, lng: g.lng });
      setTestResult({ lat: g.lat, lng: g.lng, km, label: g.label });
    } finally {
      setTestingAddr(false);
    }
  };

  const addTier = () => {
    const last = zone.tiers.at(-1);
    const nextKm = last ? Math.round((last.upToKm + 3) * 10) / 10 : 3;
    const nextFee = last ? Math.round((last.fee + 3) * 100) / 100 : 5;
    onZoneChange({ tiers: [...zone.tiers, { upToKm: nextKm, fee: nextFee }] });
  };
  const updateTier = (i: number, patch: Partial<DeliveryTier>) => {
    onZoneChange({
      tiers: zone.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    });
  };
  const removeTier = (i: number) => {
    onZoneChange({ tiers: zone.tiers.filter((_, idx) => idx !== i) });
  };

  const previewFee = testResult
    ? calcDeliveryFee(testResult.km, zone, flatFallbackFee)
    : null;
  const outside = testResult && zone.maxKm > 0 ? testResult.km > zone.maxKm + 0.05 : false;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div
        className={cn(
          "rounded-2xl border p-4 transition",
          zone.enabled
            ? "border-neon-cyan/40 bg-neon-cyan/5"
            : "border-white/10 bg-white/[0.03]",
        )}
      >
        <button
          type="button"
          onClick={() => onZoneChange({ enabled: !zone.enabled })}
          className="flex w-full items-center gap-3 text-left"
        >
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              zone.enabled ? "bg-neon-cyan/25 text-neon-cyan" : "bg-white/5 text-white/40",
            )}
          >
            <Ruler className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-white">
              Cálculo de frete por distância
            </div>
            <div className="text-[11px] text-white/60">
              {zone.enabled
                ? "Ativo · o cliente paga conforme a distância até a loja"
                : "Desativado · usa a taxa fixa de entrega acima"}
            </div>
          </div>
          <div
            className={cn(
              "h-5 w-5 shrink-0 rounded-full border-2 transition",
              zone.enabled ? "border-neon-cyan bg-neon-cyan" : "border-white/25",
            )}
          />
        </button>
      </div>

      {/* Map + origin */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <MapPin className="h-3.5 w-3.5 text-neon-pink" /> Origem (sua loja)
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <Search className="h-4 w-4 text-white/50" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchOrigin())}
              placeholder="Buscar endereço da loja…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
            />
            <button
              type="button"
              onClick={searchOrigin}
              disabled={searching || !searchQ.trim()}
              className="rounded-lg bg-neon-cyan/20 px-3 py-1 text-[11px] font-bold text-neon-cyan disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
            </button>
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/80"
          >
            <Crosshair className="h-3.5 w-3.5" /> Usar minha localização
          </button>
        </div>

        <div
          ref={mapEl}
          className="h-[320px] w-full overflow-hidden rounded-xl border border-white/10 [&_.leaflet-container]:bg-[#0d0322]"
          style={{ background: "#0d0322" }}
        />

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/60">
          <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
            Lat: <span className="font-mono text-white/85">{storeLat?.toFixed(6) ?? "—"}</span>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
            Lng: <span className="font-mono text-white/85">{storeLng?.toFixed(6) ?? "—"}</span>
          </div>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10.5px] text-white/60">
          <Info className="mt-[1px] h-3 w-3 shrink-0 text-neon-cyan" />
          <span>Clique no mapa ou arraste o marcador rosa para ajustar. O círculo ciano mostra o raio de entrega.</span>
        </div>
      </div>

      {/* Radius + pricing */}
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-black/20 p-4 transition",
          !zone.enabled && "opacity-60",
        )}
      >
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Route className="h-3.5 w-3.5 text-neon-yellow" /> Raio & preço
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField
            label="Raio máx. (km)"
            hint="0 = sem limite"
            value={zone.maxKm}
            onChange={(v) => onZoneChange({ maxKm: v })}
          />
          <NumField
            label="Taxa mínima"
            hint="Piso do frete calculado"
            value={zone.minFee}
            onChange={(v) => onZoneChange({ minFee: v })}
            money
          />
          <NumField
            label="Taxa máxima"
            hint="0 = sem teto"
            value={zone.maxFee}
            onChange={(v) => onZoneChange({ maxFee: v })}
            money
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onZoneChange({ pricingMode: "tiers" })}
            className={cn(
              "rounded-xl border px-3 py-2 text-[12px] font-bold transition",
              zone.pricingMode === "tiers"
                ? "border-neon-yellow bg-neon-yellow/15 text-neon-yellow"
                : "border-white/10 bg-white/[0.03] text-white/60",
            )}
          >
            Faixas de distância
          </button>
          <button
            type="button"
            onClick={() => onZoneChange({ pricingMode: "linear" })}
            className={cn(
              "rounded-xl border px-3 py-2 text-[12px] font-bold transition",
              zone.pricingMode === "linear"
                ? "border-neon-yellow bg-neon-yellow/15 text-neon-yellow"
                : "border-white/10 bg-white/[0.03] text-white/60",
            )}
          >
            Base + valor por km
          </button>
        </div>

        {zone.pricingMode === "linear" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumField
              label="Taxa base"
              hint="Valor fixo somado sempre"
              value={zone.baseFee}
              onChange={(v) => onZoneChange({ baseFee: v })}
              money
            />
            <NumField
              label="R$ por km"
              value={zone.perKm}
              onChange={(v) => onZoneChange({ perKm: v })}
              money
              step={0.1}
            />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {zone.tiers.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-4 text-center text-[11px] text-white/50">
                Nenhuma faixa configurada. Adicione a primeira faixa abaixo.
              </div>
            )}
            {zone.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Faixa {i + 1}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-[11px] text-white/60">até</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={t.upToKm}
                    onChange={(e) => updateTier(i, { upToKm: Number(e.target.value) || 0 })}
                    className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-[12px] font-mono text-white outline-none focus:border-neon-yellow"
                  />
                  <span className="text-[11px] text-white/60">km →</span>
                  <span className="text-[11px] text-white/60">R$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={t.fee}
                    onChange={(e) => updateTier(i, { fee: Number(e.target.value) || 0 })}
                    className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-[12px] font-mono text-white outline-none focus:border-neon-yellow"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTier}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-3 py-2 text-[12px] font-bold text-white/70 hover:bg-white/[0.05]"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar faixa
            </button>
          </div>
        )}

        <div className="mt-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Mensagem quando fora do raio
          </label>
          <input
            value={zone.outsideMessage}
            onChange={(e) => onZoneChange({ outsideMessage: e.target.value })}
            placeholder={DEFAULT_DELIVERY_ZONE.outsideMessage}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12.5px] text-white outline-none focus:border-neon-yellow"
          />
        </div>
      </div>

      {/* Test address */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Search className="h-3.5 w-3.5 text-neon-cyan" /> Testar endereço do cliente
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={testAddr}
            onChange={(e) => setTestAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), testDelivery())}
            placeholder="Ex: Rua das Palmeiras, 200, Bairro X"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
          />
          <button
            type="button"
            onClick={testDelivery}
            disabled={testingAddr || !testAddr.trim() || storeLat == null}
            className="rounded-xl bg-neon-cyan px-4 py-2 text-[12px] font-bold text-[oklch(0.18_0.11_305)] disabled:opacity-50"
          >
            {testingAddr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Simular frete"}
          </button>
        </div>

        {testResult && (
          <div
            className={cn(
              "mt-3 rounded-xl border p-3 text-[12px]",
              outside
                ? "border-red-400/40 bg-red-500/10 text-red-100"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div>
                <span className="opacity-70">Distância: </span>
                <b>{testResult.km.toFixed(2)} km</b>
              </div>
              {previewFee != null && (
                <div>
                  <span className="opacity-70">Frete: </span>
                  <b>{outside ? "—" : brl(previewFee)}</b>
                </div>
              )}
              <div>
                <span className="opacity-70">Status: </span>
                <b>{outside ? "Fora do raio" : "Dentro do raio"}</b>
              </div>
            </div>
            <div className="mt-1 truncate text-[11px] opacity-80">{testResult.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  money,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  money?: boolean;
  step?: number;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5">
        {money && <span className="text-[11px] text-white/50">R$</span>}
        <input
          type="number"
          min="0"
          step={step ?? (money ? 0.5 : 0.1)}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent text-right font-mono text-[13px] text-white outline-none"
        />
      </div>
      {hint && <div className="mt-1 text-[10px] text-white/40">{hint}</div>}
    </div>
  );
}
