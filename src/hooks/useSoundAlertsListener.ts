// Global realtime listener that plays differentiated sound alerts based on
// order events. Mounted once inside AdminShell so any admin page hears them.

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAlerts,
  fetchGlobal,
  playAlert,
  primeSoundContext,
  type SoundAlert,
  type SoundEventKey,
  type SoundGlobalSettings,
} from "@/lib/sound-alerts";

type OrderRow = {
  id: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
};

export function useSoundAlertsListener() {
  const alertsRef = useRef<Record<string, SoundAlert>>({});
  const globalRef = useRef<SoundGlobalSettings | null>(null);
  const firedLateRef = useRef<Set<string>>(new Set());
  const initialFillRef = useRef(false);
  const channelSuffixRef = useRef(`sound-${shortUid(12)}`);

  useEffect(() => {
    let cancelled = false;

    const reload = async () => {
      const [g, list] = await Promise.all([fetchGlobal(), fetchAlerts()]);
      if (cancelled) return;
      globalRef.current = g;
      const map: Record<string, SoundAlert> = {};
      for (const a of list) map[a.event_key] = a;
      alertsRef.current = map;
    };

    void reload();

    const fire = async (key: SoundEventKey) => {
      const a = alertsRef.current[key];
      const g = globalRef.current;
      if (!a || !g) return;
      try {
        await primeSoundContext();
        await playAlert(a, g);
      } catch {
        /* noop */
      }
    };

    // Realtime subscription to orders
    const suffix = channelSuffixRef.current;
    const orderChannel = supabase
      .channel(`sound-alerts-orders-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          void fire("new_order");
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const oldRow = payload.old as Partial<OrderRow>;
          const newRow = payload.new as OrderRow;
          if (!newRow) return;
          if (oldRow?.status !== newRow.status) {
            if (newRow.status === "cancelado") void fire("cancelled_order");
            else if (newRow.status === "saiu_para_entrega") void fire("dispatched_order");
            else if (newRow.status === "entregue") void fire("delivered_order");
          }
          if (!oldRow?.paid_at && newRow.paid_at) void fire("paid_order");
        },
      )
      .subscribe();

    // Reviews
    const reviewsChannel = supabase
      .channel(`sound-alerts-reviews-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        () => {
          void fire("new_review");
        },
      )
      .subscribe();

    // Reload config when it changes in another tab
    const cfgChannel = supabase
      .channel(`sound-alerts-cfg-${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sound_alerts" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sound_alert_settings" },
        () => void reload(),
      )
      .subscribe();

    // Late-orders scanner (every 60s)
    const scanLate = async () => {
      const g = globalRef.current;
      if (!g) return;
      const cutoff = new Date(Date.now() - g.late_after_minutes * 60_000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id,status,created_at")
        .in("status", ["novo", "pago", "confirmado", "preparando", "em_preparo", "aceito"])
        .lt("created_at", cutoff)
        .limit(50);
      if (!data) return;
      // On first pass, seed the set silently so we don't spam alerts for pre-existing orders.
      if (!initialFillRef.current) {
        for (const o of data) firedLateRef.current.add(o.id);
        initialFillRef.current = true;
        return;
      }
      for (const o of data) {
        if (firedLateRef.current.has(o.id)) continue;
        firedLateRef.current.add(o.id);
        void fire("late_order");
      }
    };
    const lateTimer = window.setInterval(() => void scanLate(), 60_000);
    void scanLate();

    // Low stock scanner (every 5 min)
    const scanLowStock = async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id,stock,low_stock_threshold,active")
        .eq("active", true)
        .limit(500);
      if (!data) return;
      const low = data.some(
        (r) =>
          typeof r.stock === "number" &&
          typeof r.low_stock_threshold === "number" &&
          r.low_stock_threshold > 0 &&
          r.stock <= r.low_stock_threshold,
      );
      if (low) void fire("low_stock");
    };
    const stockTimer = window.setInterval(() => void scanLowStock(), 5 * 60_000);

    // Prime AudioContext on first user gesture anywhere
    const unlock = () => void primeSoundContext();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      cancelled = true;
      window.clearInterval(lateTimer);
      window.clearInterval(stockTimer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(cfgChannel);
    };
  }, []);
}
