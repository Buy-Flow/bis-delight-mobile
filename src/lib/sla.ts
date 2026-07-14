import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SlaMode = "fixed" | "historical";
export type OrderMode = "entrega" | "retirada" | "mesa" | string;

export type SlaSettings = {
  id: number;
  enabled: boolean;
  mode: SlaMode;
  green_max_entrega: number;
  yellow_max_entrega: number;
  green_max_retirada: number;
  yellow_max_retirada: number;
  green_max_mesa: number;
  yellow_max_mesa: number;
  historical_green_factor: number;
  historical_yellow_factor: number;
  historical_lookback_days: number;
  warn_before_red_pct: number;
  auto_notify_admin: boolean;
  auto_notify_on: "yellow" | "red";
};

export type SlaHistoryRow = {
  mode: string;
  avg_minutes: number;
  p50_minutes: number;
  p90_minutes: number;
  sample_size: number;
};

export type SlaStatus = "green" | "yellow" | "red" | "warn" | "done";

export type SlaResult = {
  status: SlaStatus;
  elapsedMin: number;
  greenMax: number;
  yellowMax: number;
  targetMin: number;
  ratio: number; // elapsed / yellowMax
  label: string;
  color: string; // tailwind class
  ring: string;
  bg: string;
  text: string;
};

export const DEFAULT_SLA: SlaSettings = {
  id: 1,
  enabled: true,
  mode: "fixed",
  green_max_entrega: 20,
  yellow_max_entrega: 40,
  green_max_retirada: 15,
  yellow_max_retirada: 25,
  green_max_mesa: 10,
  yellow_max_mesa: 20,
  historical_green_factor: 1.0,
  historical_yellow_factor: 1.5,
  historical_lookback_days: 30,
  warn_before_red_pct: 80,
  auto_notify_admin: true,
  auto_notify_on: "red",
};

export function getFixedThresholds(s: SlaSettings, mode: OrderMode): { green: number; yellow: number } {
  if (mode === "retirada") return { green: s.green_max_retirada, yellow: s.yellow_max_retirada };
  if (mode === "mesa") return { green: s.green_max_mesa, yellow: s.yellow_max_mesa };
  return { green: s.green_max_entrega, yellow: s.yellow_max_entrega };
}

export function getHistoricalThresholds(
  s: SlaSettings,
  mode: OrderMode,
  history: Record<string, SlaHistoryRow> | null,
): { green: number; yellow: number } | null {
  const row = history?.[mode];
  if (!row || !row.avg_minutes) return null;
  const green = Math.max(1, Math.round(row.avg_minutes * Number(s.historical_green_factor)));
  const yellow = Math.max(green + 1, Math.round(row.avg_minutes * Number(s.historical_yellow_factor)));
  return { green, yellow };
}

export function resolveThresholds(
  s: SlaSettings,
  mode: OrderMode,
  history: Record<string, SlaHistoryRow> | null,
): { green: number; yellow: number } {
  if (s.mode === "historical") {
    const h = getHistoricalThresholds(s, mode, history);
    if (h) return h;
  }
  return getFixedThresholds(s, mode);
}

export function computeSla(
  order: {
    created_at: string;
    mode: OrderMode;
    status?: string | null;
    dispatched_at?: string | null;
    delivered_at?: string | null;
  },
  now: number,
  settings: SlaSettings,
  history: Record<string, SlaHistoryRow> | null,
): SlaResult {
  const t0 = new Date(order.created_at).getTime();
  const done =
    order.status === "entregue" ||
    order.status === "cancelado" ||
    !!order.dispatched_at ||
    !!order.delivered_at;
  const endTs = done
    ? new Date(order.dispatched_at || order.delivered_at || order.created_at).getTime()
    : now;
  const elapsedMin = Math.max(0, (endTs - t0) / 60000);

  const { green, yellow } = resolveThresholds(settings, order.mode, history);

  let status: SlaStatus;
  if (done) status = "done";
  else if (elapsedMin <= green) status = "green";
  else if (elapsedMin <= yellow) {
    const warnPct = Math.max(0, Math.min(100, settings.warn_before_red_pct));
    const warnThreshold = green + (yellow - green) * (warnPct / 100);
    status = elapsedMin >= warnThreshold ? "warn" : "yellow";
  } else status = "red";

  const palette: Record<SlaStatus, { color: string; ring: string; bg: string; text: string; label: string }> = {
    green: { color: "bg-emerald-500", ring: "ring-emerald-400/40", bg: "bg-emerald-500/15", text: "text-emerald-300", label: "No prazo" },
    yellow: { color: "bg-amber-400", ring: "ring-amber-300/40", bg: "bg-amber-400/15", text: "text-amber-300", label: "Atenção" },
    warn: { color: "bg-orange-500", ring: "ring-orange-400/50", bg: "bg-orange-500/15", text: "text-orange-300", label: "Quase atrasado" },
    red: { color: "bg-red-500", ring: "ring-red-400/60", bg: "bg-red-500/15", text: "text-red-300", label: "Atrasado" },
    done: { color: "bg-white/20", ring: "ring-white/10", bg: "bg-white/10", text: "text-white/60", label: "Finalizado" },
  };

  const p = palette[status];
  return {
    status,
    elapsedMin,
    greenMax: green,
    yellowMax: yellow,
    targetMin: green,
    ratio: yellow > 0 ? elapsedMin / yellow : 0,
    ...p,
  };
}

export function useSlaSettings() {
  const [settings, setSettings] = useState<SlaSettings>(DEFAULT_SLA);
  const [history, setHistory] = useState<Record<string, SlaHistoryRow> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("sla_settings").select("*").eq("id", 1).maybeSingle();
      if (alive && data) setSettings({ ...DEFAULT_SLA, ...(data as any) });
      const { data: h } = await supabase.rpc("get_sla_history", {
        lookback_days: (data as any)?.historical_lookback_days ?? 30,
      });
      if (alive && Array.isArray(h)) {
        const map: Record<string, SlaHistoryRow> = {};
        for (const r of h as SlaHistoryRow[]) map[r.mode] = r;
        setHistory(map);
      }
      if (alive) setLoading(false);
    };
    load();
    const ch = supabase
      .channel("sla-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "sla_settings" }, () => load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  return { settings, history, loading };
}
