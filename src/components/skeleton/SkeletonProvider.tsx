import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SkeletonSettings {
  id: string;
  enabled: boolean;
  variant: "shimmer" | "pulse" | "wave" | "static";
  speed_ms: number;
  radius_px: number;
  tone: "auto" | "light" | "dark" | "brand";
  intensity: number;
  tint: "neutral" | "brand" | "warm" | "cool";
  stagger_ms: number;
  on_menu: boolean;
  on_orders: boolean;
  on_admin: boolean;
  on_lists: boolean;
  on_forms: boolean;
  reduce_motion_respect: boolean;
}

const DEFAULTS: SkeletonSettings = {
  id: "default",
  enabled: true,
  variant: "shimmer",
  speed_ms: 1600,
  radius_px: 14,
  tone: "auto",
  intensity: 0.08,
  tint: "neutral",
  stagger_ms: 60,
  on_menu: true,
  on_orders: true,
  on_admin: true,
  on_lists: true,
  on_forms: true,
  reduce_motion_respect: true,
};

const TINT_TO_BASE: Record<SkeletonSettings["tint"], string> = {
  neutral: "300",
  brand: "305",
  warm: "60",
  cool: "240",
};

export function applySkeletonSettings(s: SkeletonSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const hue = TINT_TO_BASE[s.tint] ?? "300";
  const intensity = Math.max(0.02, Math.min(0.4, Number(s.intensity) || 0.08));
  const dark =
    s.tone === "dark" ||
    (s.tone === "auto" && root.classList.contains("dark"));

  const base = dark
    ? `oklch(0.24 0.04 ${hue} / ${0.4 + intensity})`
    : `oklch(0.94 0.008 ${hue} / ${0.7 + intensity})`;
  const shine = dark
    ? `rgba(255, 255, 255, ${Math.max(0.05, intensity)})`
    : `rgba(255, 255, 255, ${Math.min(0.9, 0.35 + intensity * 2)})`;
  const highlight = dark
    ? `oklch(0.36 0.06 ${hue} / 0.9)`
    : `oklch(1 0 0 / 0.85)`;

  root.style.setProperty("--sk-radius", `${s.radius_px}px`);
  root.style.setProperty("--sk-speed", `${s.speed_ms}ms`);
  root.style.setProperty("--sk-base", base);
  root.style.setProperty("--sk-shine", shine);
  root.style.setProperty("--sk-highlight", highlight);
  root.style.setProperty("--sk-stagger", `${s.stagger_ms}ms`);

  root.setAttribute("data-sk-enabled", s.enabled ? "1" : "0");
  root.setAttribute("data-sk-variant", s.variant);
  root.setAttribute("data-sk-tone", s.tone);
  root.setAttribute("data-sk-tint", s.tint);
  root.setAttribute("data-sk-respect-motion", s.reduce_motion_respect ? "1" : "0");
  root.setAttribute("data-sk-on-menu", s.on_menu ? "1" : "0");
  root.setAttribute("data-sk-on-orders", s.on_orders ? "1" : "0");
  root.setAttribute("data-sk-on-admin", s.on_admin ? "1" : "0");
  root.setAttribute("data-sk-on-lists", s.on_lists ? "1" : "0");
  root.setAttribute("data-sk-on-forms", s.on_forms ? "1" : "0");
}

/**
 * Fetches skeleton settings once on mount and applies to :root as CSS vars.
 * Subscribes to realtime changes so admin updates propagate instantly.
 * Renders nothing.
 */
export function SkeletonProvider() {
  useEffect(() => {
    applySkeletonSettings(DEFAULTS);
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from("skeleton_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle();
        if (!cancelled && data) applySkeletonSettings(data as SkeletonSettings);
      } catch {
        /* keep defaults */
      }
    })();

    const channel = supabase
      .channel("skeleton_settings_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "skeleton_settings" },
        (payload) => {
          const row = payload.new as SkeletonSettings | null;
          if (row) applySkeletonSettings(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

export { DEFAULTS as DEFAULT_SKELETON_SETTINGS };
