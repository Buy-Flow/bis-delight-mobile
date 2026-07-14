// Client-side PWA settings loader + control helpers.
// Reads the singleton public.pwa_settings row, exposes a React hook,
// and wires kill-switch / cache-version behavior into the browser.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PwaSettings = {
  enabled: boolean;
  kill_switch: boolean;
  cache_version: number;
  offline_banner_enabled: boolean;
  offline_banner_text: string;
  online_restored_text: string;
  offline_fallback_title: string;
  offline_fallback_message: string;
  offline_fallback_cta: string;
  prefetch_menu_on_load: boolean;
  prefetch_images: boolean;
  max_image_cache_entries: number;
  auto_update: boolean;
  show_install_prompt: boolean;
  updated_at: string;
};

export const DEFAULT_PWA_SETTINGS: PwaSettings = {
  enabled: true,
  kill_switch: false,
  cache_version: 1,
  offline_banner_enabled: true,
  offline_banner_text: "Você está offline — mostrando o cardápio salvo.",
  online_restored_text: "Conexão restaurada.",
  offline_fallback_title: "Sem conexão",
  offline_fallback_message:
    "Não conseguimos carregar essa página agora, mas o cardápio salvo continua disponível.",
  offline_fallback_cta: "Ver cardápio salvo",
  prefetch_menu_on_load: true,
  prefetch_images: true,
  max_image_cache_entries: 200,
  auto_update: true,
  show_install_prompt: true,
  updated_at: new Date(0).toISOString(),
};

const LS_KEY = "pwa_settings_cache_v1";

export function loadCachedPwaSettings(): PwaSettings {
  if (typeof window === "undefined") return DEFAULT_PWA_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PWA_SETTINGS;
    return { ...DEFAULT_PWA_SETTINGS, ...(JSON.parse(raw) as Partial<PwaSettings>) };
  } catch {
    return DEFAULT_PWA_SETTINGS;
  }
}

export async function fetchPwaSettings(): Promise<PwaSettings> {
  const { data } = await supabase
    .from("pwa_settings" as never)
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const merged = { ...DEFAULT_PWA_SETTINGS, ...(data ?? {}) } as PwaSettings;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch {
      /* noop */
    }
  }
  return merged;
}

export function usePwaSettings(): { settings: PwaSettings; loading: boolean; refresh: () => Promise<void> } {
  const [settings, setSettings] = useState<PwaSettings>(() => loadCachedPwaSettings());
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const next = await fetchPwaSettings();
      setSettings(next);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel("pwa_settings_stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pwa_settings" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { settings, loading, refresh };
}

// ---------- Service worker control ----------

const SW_URL = "/sw.js";

async function getAppRegistrations() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return [];
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.filter((r) => {
    const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
    return url.endsWith(SW_URL);
  });
}

export async function unregisterAppServiceWorkers(): Promise<number> {
  const regs = await getAppRegistrations();
  const results = await Promise.allSettled(regs.map((r) => r.unregister()));
  return results.filter((r) => r.status === "fulfilled").length;
}

export async function forceServiceWorkerUpdate(): Promise<void> {
  const regs = await getAppRegistrations();
  await Promise.allSettled(regs.map((r) => r.update()));
  for (const reg of regs) {
    reg.waiting?.postMessage({ type: "SKIP_WAITING" });
  }
}

export async function clearAppCaches(): Promise<{ deleted: string[] }> {
  if (typeof caches === "undefined") return { deleted: [] };
  const names = await caches.keys();
  const deleted: string[] = [];
  await Promise.all(
    names.map(async (name) => {
      if (
        name.includes("workbox") ||
        name.startsWith("menu-") ||
        name.startsWith("html-") ||
        name.startsWith("google-fonts") ||
        name.startsWith("precache") ||
        name.startsWith("runtime")
      ) {
        const ok = await caches.delete(name);
        if (ok) deleted.push(name);
      }
    }),
  );
  return { deleted };
}

export async function readCacheStats(): Promise<{
  caches: { name: string; count: number }[];
  totalEntries: number;
  storageUsageMb: number | null;
  storageQuotaMb: number | null;
}> {
  const result = { caches: [] as { name: string; count: number }[], totalEntries: 0, storageUsageMb: null as number | null, storageQuotaMb: null as number | null };
  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    for (const name of names) {
      const c = await caches.open(name);
      const keys = await c.keys();
      result.caches.push({ name, count: keys.length });
      result.totalEntries += keys.length;
    }
  }
  if (typeof navigator !== "undefined" && "storage" in navigator && "estimate" in navigator.storage) {
    const est = await navigator.storage.estimate();
    if (typeof est.usage === "number") result.storageUsageMb = +(est.usage / 1024 / 1024).toFixed(2);
    if (typeof est.quota === "number") result.storageQuotaMb = +(est.quota / 1024 / 1024).toFixed(2);
  }
  return result;
}

// Prefetch menu into the SW caches so first-offline works.
export async function prefetchMenuForOffline(urls: string[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { credentials: "omit" });
        if (res.ok || res.status === 0) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }),
  );
  return { ok, failed };
}
