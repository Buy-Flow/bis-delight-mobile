import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { optimizeRoute, type OptimizeResult } from "@/lib/route-optimization.functions";
import {
  Save, Loader2, Route as RouteIcon, Zap, Bike, MapPin, Navigation,
  Truck, Clock, TrendingDown, RefreshCw, PlayCircle,
  Info, Sparkles, Target, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/_authenticated/rotas")({
  head: () => ({
    meta: [
      { title: "Rotas otimizadas — Painel" },
      { name: "description", content: "Otimize o roteiro dos motoboys com Google Directions API, veja economia de km e ETA por parada." },
    ],
  }),
  component: RotasPage,
});

type Settings = {
  id: number;
  enabled: boolean;
  min_stops: number;
  max_stops: number;
  provider: "google_directions" | "nearest_neighbor";
  travel_mode: "DRIVE" | "TWO_WHEELER" | "BICYCLE";
  traffic_mode: "TRAFFIC_AWARE" | "TRAFFIC_AWARE_OPTIMAL" | "TRAFFIC_UNAWARE";
  avoid_tolls: boolean;
  avoid_highways: boolean;
  avoid_ferries: boolean;
  return_to_store: boolean;
  auto_optimize: boolean;
  notify_courier: boolean;
  units: string;
  extra_time_per_stop_min: number;
};

type CourierRow = {
  id: string;
  name: string;
  status: string;
  vehicle: string;
  current_lat: number | null;
  current_lng: number | null;
  active_count: number;
};

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  enabled: true,
  min_stops: 2,
  max_stops: 8,
  provider: "google_directions",
  travel_mode: "TWO_WHEELER",
  traffic_mode: "TRAFFIC_AWARE",
  avoid_tolls: false,
  avoid_highways: false,
  avoid_ferries: true,
  return_to_store: true,
  auto_optimize: true,
  notify_courier: true,
  units: "METRIC",
  extra_time_per_stop_min: 3,
};

function RotasPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [computing, setComputing] = useState(false);
  const optimize = useServerFn(optimizeRoute);

  const reload = async () => {
    const { data: s } = await supabase
      .from("route_optimization_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (s) setSettings({ ...DEFAULT_SETTINGS, ...(s as any) });

    // Couriers with count of active orders
    const { data: c } = await supabase
      .from("couriers")
      .select("id, name, status, vehicle, current_lat, current_lng")
      .eq("active", true)
      .order("name");
    const list = (c ?? []) as any[];
    // Aggregate active order counts
    const { data: os } = await supabase
      .from("orders")
      .select("courier_id, status")
      .in("status", ["pago", "preparando", "saiu_para_entrega"])
      .not("courier_id", "is", null);
    const counts = new Map<string, number>();
    (os ?? []).forEach((o: any) => {
      counts.set(o.courier_id, (counts.get(o.courier_id) ?? 0) + 1);
    });
    setCouriers(
      list.map((x) => ({ ...x, active_count: counts.get(x.id) ?? 0 })),
    );

    const { data: h } = await supabase
      .from("route_optimizations")
      .select("*, courier:couriers(name)")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((h ?? []) as any[]);

    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel("rotas-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "couriers" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("route_optimization_settings")
      .update({
        enabled: settings.enabled,
        min_stops: settings.min_stops,
        max_stops: settings.max_stops,
        provider: settings.provider,
        travel_mode: settings.travel_mode,
        traffic_mode: settings.traffic_mode,
        avoid_tolls: settings.avoid_tolls,
        avoid_highways: settings.avoid_highways,
        avoid_ferries: settings.avoid_ferries,
        return_to_store: settings.return_to_store,
        auto_optimize: settings.auto_optimize,
        notify_courier: settings.notify_courier,
        extra_time_per_stop_min: settings.extra_time_per_stop_min,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Configurações salvas");
  };

  const runOptimize = async (courierId: string, provider?: Settings["provider"]) => {
    setComputing(true);
    setSelected(courierId);
    setResult(null);
    try {
      const res = await optimize({
        data: { courier_id: courierId, save: true, force_provider: provider },
      });
      setResult(res);
      toast.success(
        res.saved_km > 0.1
          ? `Rota otimizada — economia de ${res.saved_km.toFixed(1)} km`
          : "Rota calculada",
      );
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao otimizar rota");
    } finally {
      setComputing(false);
    }
  };

  const eligibleCouriers = couriers.filter((c) => c.active_count >= settings.min_stops);

  if (loading) {
    return (
      <AdminShell>
        <div className="grid place-items-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-400" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <RouteIcon className="h-6 w-6 text-fuchsia-400" />
              <h1 className="text-2xl font-black text-white">Rotas otimizadas</h1>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                settings.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
              )}>{settings.enabled ? "ativo" : "desativado"}</span>
            </div>
            <p className="mt-1 text-sm text-white/60">
              Google Directions calcula a ordem ideal quando o motoboy tem várias entregas simultâneas.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-2.5 text-sm font-black text-white shadow-lg hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <Save className="mr-1 inline h-4 w-4" />}
            Salvar configurações
          </button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={Truck} label="Motoboys ativos" value={String(couriers.filter((c) => c.status === "online" || c.status === "busy").length)} tone="emerald" />
          <Kpi icon={Bike} label="Elegíveis p/ otimização" value={String(eligibleCouriers.length)} sub={`≥ ${settings.min_stops} paradas`} tone="fuchsia" />
          <Kpi icon={TrendingDown} label="Km economizados (30d)" value={history.reduce((s, h) => s + Number(h.saved_km ?? 0), 0).toFixed(1)} tone="cyan" />
          <Kpi icon={Clock} label="Tempo médio salvo" value={history.length ? (history.reduce((s, h) => s + Number(h.saved_min ?? 0), 0) / history.length).toFixed(1) + " min" : "—"} tone="amber" />
        </div>

        {/* Live couriers */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Zap className="h-5 w-5 text-amber-400" /> Motoboys no turno
            </h2>
            <button
              onClick={reload}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15"
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Atualizar
            </button>
          </div>
          {couriers.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">Nenhum motoboy cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="py-2 pr-4 text-left">Motoboy</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Entregas ativas</th>
                    <th className="py-2 pr-4 text-left">Localização</th>
                    <th className="py-2 pr-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c) => (
                    <tr key={c.id} className="border-t border-white/5">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-fuchsia-500/20 text-xs font-black text-fuchsia-300">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{c.name}</div>
                            <div className="text-[11px] text-white/50">{c.vehicle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          c.status === "online" ? "bg-emerald-500/20 text-emerald-300" :
                          c.status === "busy" ? "bg-amber-500/20 text-amber-300" :
                          "bg-white/10 text-white/50",
                        )}>{c.status}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={cn(
                          "font-black",
                          c.active_count >= settings.min_stops ? "text-fuchsia-300" : "text-white/60",
                        )}>{c.active_count}</span>
                        {c.active_count >= settings.min_stops && (
                          <span className="ml-1 text-[10px] text-emerald-400">otimizável</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-white/60">
                        {c.current_lat && c.current_lng
                          ? `${Number(c.current_lat).toFixed(4)}, ${Number(c.current_lng).toFixed(4)}`
                          : <span className="text-white/30">— sem GPS —</span>}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <button
                          disabled={c.active_count < 1 || (computing && selected === c.id)}
                          onClick={() => runOptimize(c.id)}
                          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-1.5 text-xs font-black text-white shadow disabled:opacity-40"
                        >
                          {computing && selected === c.id ? (
                            <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin"/> Calculando…</>
                          ) : (
                            <><Sparkles className="mr-1 inline h-3.5 w-3.5"/> Otimizar</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Result */}
        {result && (
          <OptimizeResultPanel
            result={result}
            provider={settings.provider}
            onCompare={(prov) => selected && runOptimize(selected, prov)}
          />
        )}

        {/* Settings */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-400" /> Comportamento
            </h2>
            <Toggle
              label="Sistema habilitado"
              checked={settings.enabled}
              onChange={(v: boolean) => setSettings({ ...settings, enabled: v })}
              hint="Quando desligado, o motoboy não vê o botão 'Otimizar rota'."
            />
            <Toggle
              label="Otimização automática"
              checked={settings.auto_optimize}
              onChange={(v: boolean) => setSettings({ ...settings, auto_optimize: v })}
              hint="Ao aceitar a 2ª corrida, sugere a rota sem clique."
            />
            <Toggle
              label="Voltar à loja no final"
              checked={settings.return_to_store}
              onChange={(v: boolean) => setSettings({ ...settings, return_to_store: v })}
              hint="Considera o retorno à loja no cálculo do total."
            />
            <Toggle
              label="Notificar o motoboy quando otimizar"
              checked={settings.notify_courier}
              onChange={(v: boolean) => setSettings({ ...settings, notify_courier: v })}
            />

            <NumberField label="Mín. paradas para otimizar" value={settings.min_stops} min={2} max={10} onChange={(v: boolean) => setSettings({ ...settings, min_stops: v })} />
            <NumberField label="Máx. paradas por rota" value={settings.max_stops} min={2} max={20} onChange={(v: boolean) => setSettings({ ...settings, max_stops: v })} />
            <NumberField label="Tempo extra por parada (min)" value={settings.extra_time_per_stop_min} min={0} max={30} onChange={(v: boolean) => setSettings({ ...settings, extra_time_per_stop_min: v })} hint="Retirada, entrega física ao cliente etc." />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Navigation className="h-5 w-5 text-fuchsia-400" /> Roteamento
            </h2>

            <Select
              label="Provedor de rotas"
              value={settings.provider}
              onChange={(v: boolean) => setSettings({ ...settings, provider: v as Settings["provider"] })}
              options={[
                { value: "google_directions", label: "Google Directions API (recomendado)" },
                { value: "nearest_neighbor", label: "Vizinho mais próximo (offline)" },
              ]}
            />

            <Select
              label="Modo de viagem"
              value={settings.travel_mode}
              onChange={(v: boolean) => setSettings({ ...settings, travel_mode: v as Settings["travel_mode"] })}
              options={[
                { value: "TWO_WHEELER", label: "Moto (2 rodas)" },
                { value: "DRIVE", label: "Carro" },
                { value: "BICYCLE", label: "Bicicleta" },
              ]}
            />

            {settings.travel_mode === "DRIVE" && (
              <Select
                label="Trânsito"
                value={settings.traffic_mode}
                onChange={(v: boolean) => setSettings({ ...settings, traffic_mode: v as Settings["traffic_mode"] })}
                options={[
                  { value: "TRAFFIC_AWARE", label: "Ciente do trânsito (padrão)" },
                  { value: "TRAFFIC_AWARE_OPTIMAL", label: "Otimizado com trânsito (mais lento)" },
                  { value: "TRAFFIC_UNAWARE", label: "Ignorar trânsito (mais rápido)" },
                ]}
                hint="Não se aplica ao modo moto/bicicleta."
              />
            )}

            <Toggle label="Evitar pedágios" checked={settings.avoid_tolls} onChange={(v: boolean) => setSettings({ ...settings, avoid_tolls: v })} />
            <Toggle label="Evitar rodovias" checked={settings.avoid_highways} onChange={(v: boolean) => setSettings({ ...settings, avoid_highways: v })} />
            <Toggle label="Evitar balsas" checked={settings.avoid_ferries} onChange={(v: boolean) => setSettings({ ...settings, avoid_ferries: v })} />

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] text-cyan-200 flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>O Directions custa por chamada. Cada otimização usa 1 crédito. O sistema faz fallback automático para o vizinho mais próximo se a API falhar.</span>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-lg font-black text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-white/70" /> Histórico recente
          </h2>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/50">Nenhuma rota otimizada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="py-2 pr-4 text-left">Quando</th>
                    <th className="py-2 pr-4 text-left">Motoboy</th>
                    <th className="py-2 pr-4 text-left">Paradas</th>
                    <th className="py-2 pr-4 text-left">Distância</th>
                    <th className="py-2 pr-4 text-left">Duração</th>
                    <th className="py-2 pr-4 text-left">Economia</th>
                    <th className="py-2 pr-4 text-left">Provedor</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id} className="border-t border-white/5 text-white/80">
                      <td className="py-2 pr-4 text-[11px]">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                      <td className="py-2 pr-4">{h.courier?.name ?? "—"}</td>
                      <td className="py-2 pr-4">{h.sequence?.length ?? 0}</td>
                      <td className="py-2 pr-4">{Number(h.total_distance_km ?? 0).toFixed(1)} km</td>
                      <td className="py-2 pr-4">{Number(h.total_duration_min ?? 0).toFixed(0)} min</td>
                      <td className="py-2 pr-4 text-emerald-300 font-bold">−{Number(h.saved_km ?? 0).toFixed(1)} km</td>
                      <td className="py-2 pr-4 text-[11px]">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 font-bold",
                          h.provider_used === "google_directions" ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-white/10 text-white/60",
                        )}>
                          {h.provider_used === "google_directions" ? "Google" : "Vizinho"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function OptimizeResultPanel({
  result,
  provider,
  onCompare,
}: {
  result: OptimizeResult;
  provider: "google_directions" | "nearest_neighbor";
  onCompare: (prov: "google_directions" | "nearest_neighbor") => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
    const map = L.map(mapRef.current, { center: [result.origin.lat, result.origin.lng], zoom: 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    // Origin
    L.marker([result.origin.lat, result.origin.lng], {
      icon: L.divIcon({ className: "", html: `<div style="background:#22c55e;border:3px solid white;border-radius:9999px;width:22px;height:22px;box-shadow:0 0 12px #22c55e;"></div>` }),
    }).addTo(map).bindPopup("Origem");
    // Stops
    const pts: L.LatLngExpression[] = [[result.origin.lat, result.origin.lng]];
    result.stops.forEach((s, i) => {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#e879f9;border:2px solid white;color:white;font-weight:900;font-size:11px;text-align:center;line-height:22px;border-radius:9999px;width:24px;height:24px;box-shadow:0 0 8px rgba(232,121,249,0.6);">${i + 1}</div>`,
        }),
      }).addTo(map).bindPopup(`${i + 1}. ${s.customer_name ?? "Cliente"}<br/>${s.address ?? ""}`);
      pts.push([s.lat, s.lng]);
    });
    // Polyline
    if (result.encoded_polyline) {
      const decoded = decodePolyline(result.encoded_polyline);
      L.polyline(decoded, { color: "#e879f9", weight: 4, opacity: 0.8 }).addTo(map);
    } else if (pts.length > 1) {
      L.polyline(pts, { color: "#e879f9", weight: 3, dashArray: "6 6", opacity: 0.7 }).addTo(map);
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, [result]);

  const navUrl = useMemo(() => {
    if (result.stops.length === 0) return null;
    const origin = `${result.origin.lat},${result.origin.lng}`;
    const dest = result.stops[result.stops.length - 1];
    const destStr = `${dest.lat},${dest.lng}`;
    const waypoints = result.stops
      .slice(0, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destStr}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
  }, [result]);

  return (
    <section className="rounded-2xl border-2 border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-500/10 via-purple-900/10 to-transparent p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-fuchsia-400" /> Rota calculada
          </h2>
          <p className="text-[11px] text-white/60">
            Provedor: <b className={result.provider_used === "google_directions" ? "text-fuchsia-300" : "text-white/70"}>
              {result.provider_used === "google_directions" ? "Google Directions" : "Vizinho mais próximo"}
            </b>
            {result.provider_used !== provider && (
              <span className="ml-2 text-amber-300">(fallback ativado)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onCompare(result.provider_used === "google_directions" ? "nearest_neighbor" : "google_directions")}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/15"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Comparar provedor
          </button>
          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-xs font-black text-white shadow"
            >
              <PlayCircle className="mr-1 inline h-3.5 w-3.5" /> Abrir no Google Maps
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Total km" value={`${result.total_distance_km.toFixed(1)}`} sub="otimizado" tone="fuchsia" icon={RouteIcon} />
        <Kpi label="Duração" value={`${result.total_duration_min.toFixed(0)} min`} sub={`+ ${(result.stops.length * 3).toFixed(0)}min de paradas`} tone="cyan" icon={Clock} />
        <Kpi label="Naive (sem otimizar)" value={`${result.naive_distance_km.toFixed(1)} km`} tone="white" icon={TrendingDown} />
        <Kpi label="Economia" value={`−${result.saved_km.toFixed(1)} km`} sub={`~${result.saved_min.toFixed(0)} min`} tone="emerald" icon={Zap} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div ref={mapRef} className="h-[380px] rounded-xl overflow-hidden border border-white/10 [&_.leaflet-container]:bg-[#0d0322]" />

        <div className="space-y-2">
          {result.stops.map((s, i) => (
            <div key={s.order_id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fuchsia-500 text-white font-black">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-white truncate">{s.customer_name ?? "Cliente"}</div>
                  <div className="text-[11px] text-white/50">
                    ETA {s.eta_at ? new Date(s.eta_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                </div>
                <div className="text-[11px] text-white/60 flex items-start gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-fuchsia-400" />
                  {s.address ?? "—"}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/70">
                    {s.distance_from_prev_km?.toFixed(1)} km <ArrowRight className="inline h-2.5 w-2.5"/>
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/70">
                    {s.duration_from_prev_min?.toFixed(0)} min
                  </span>
                  <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-fuchsia-300">
                    acumulado {s.cumulative_km.toFixed(1)} km
                  </span>
                </div>
              </div>
            </div>
          ))}
          {result.return_to_store && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white font-black">
                <Truck className="h-4 w-4" />
              </div>
              <div className="text-sm text-emerald-200">Retorno à loja</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = "fuchsia" }: any) {
  const toneCls =
    tone === "emerald" ? "text-emerald-300" :
    tone === "cyan" ? "text-cyan-300" :
    tone === "amber" ? "text-amber-300" :
    tone === "white" ? "text-white" :
    "text-fuchsia-300";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn("h-4 w-4", toneCls)} />}
        <div className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</div>
      </div>
      <div className={cn("mt-1 text-xl font-black", toneCls)}>{value}</div>
      {sub && <div className="text-[10px] text-white/40">{sub}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-fuchsia-500" : "bg-white/15",
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )} />
      </button>
    </label>
  );
}

function NumberField({ label, value, onChange, min, max, hint }: any) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-white">{label}</div>
      {hint && <div className="text-[11px] text-white/50 mb-1">{hint}</div>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none"
      />
    </label>
  );
}

function Select({ label, value, onChange, options, hint }: any) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-white">{label}</div>
      {hint && <div className="text-[11px] text-white/50 mb-1">{hint}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value} className="bg-[#0c031f]">{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// Google Encoded Polyline decoder — https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b = 0, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}
