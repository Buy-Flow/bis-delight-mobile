// Guarded service-worker registration wrapper.
// Registers /sw.js only in the published production app, never in Lovable
// previews, dev, iframes, or when ?sw=off is present.

const SW_URL = "/sw.js";

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

  const register = () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
      /* noop */
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
