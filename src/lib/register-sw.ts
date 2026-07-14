// Guarded service-worker registration wrapper.
// Registers /sw.js only in the published production app, never in Lovable
// previews, dev, iframes, or when ?sw=off is present.
//
// Honors the admin-controlled pwa_settings singleton:
//   - kill_switch=true     -> unregister the SW everywhere (offline turns off)
//   - enabled=false        -> unregister the SW (temporary pause)
//   - cache_version bumps  -> triggers reg.update() so clients pull the newest SW/assets

import { fetchPwaSettings, loadCachedPwaSettings } from "./pwa-settings";

const SW_URL = "/sw.js";
const CV_KEY = "pwa_cache_version_seen";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const swOff = new URLSearchParams(window.location.search).get("sw") === "off";
  const isProd = import.meta.env.PROD;
  const isPreview = isPreviewHost(window.location.hostname);

  if (!isProd || inIframe || isPreview || swOff) {
    void unregisterMatching();
    return;
  }

  // Cached admin settings drive the initial decision without waiting on the network.
  const cached = loadCachedPwaSettings();
  if (cached.kill_switch || !cached.enabled) {
    void unregisterMatching();
  } else {
    const register = () => {
      navigator.serviceWorker
        .register(SW_URL, { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* noop */
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }

  // Refresh with the authoritative row and react to changes.
  void fetchPwaSettings().then(async (settings) => {
    if (settings.kill_switch || !settings.enabled) {
      await unregisterMatching();
      return;
    }
    try {
      const seenRaw = window.localStorage.getItem(CV_KEY);
      const seen = seenRaw ? Number(seenRaw) : 0;
      if (settings.cache_version > seen) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.update()));
        window.localStorage.setItem(CV_KEY, String(settings.cache_version));
      }
    } catch {
      /* noop */
    }
  });
}
