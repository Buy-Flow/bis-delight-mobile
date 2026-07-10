// Web Push subscription helpers.
// The VAPID public key is safe to expose (that's the whole point).

import { supabase } from "@/integrations/supabase/client";
import { deletePushSubscription, savePushSubscription } from "@/lib/push.functions";

export const VAPID_PUBLIC_KEY =
  "BMtivcZcLmG17_XC1y1tjUVSG-CjnRH8dSJW9ZnquiCmHsu5usB2YjmqoarKZzVDVzJfYTbeFqvXARWdcx5aXJg";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia?.("(display-mode: standalone)").matches ?? false) ||
    // @ts-expect-error legacy iOS
    window.navigator.standalone === true
  );
}

export function iosStandaloneRequired(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  return isIOS && !isStandaloneApp();
}

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

function canRegisterAppServiceWorker() {
  if (typeof window === "undefined") return false;
  return (
    import.meta.env.PROD &&
    window.self === window.top &&
    !isPreviewHost(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("sw") !== "off"
  );
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    let existing = await navigator.serviceWorker.getRegistration("/");
    if (!existing && canRegisterAppServiceWorker()) {
      existing = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 6000)),
    ]);

    if (ready) return ready;
    existing = existing ?? (await navigator.serviceWorker.getRegistration("/"));
    return existing?.active ? existing : null;
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await getReadyRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function ensurePushSubscriptionSaved(options: { forceNew?: boolean } = {}): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (iosStandaloneRequired()) return { ok: false, reason: "ios-install-required" };
  if (Notification.permission !== "granted") return { ok: false, reason: "permission-required" };

  return subscribeToPush(options);
}

export async function subscribeToPush(options: { forceNew?: boolean } = {}): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (iosStandaloneRequired()) return { ok: false, reason: "ios-install-required" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const reg = await getReadyRegistration();
  if (!reg) return { ok: false, reason: "no-registration" };

  let sub = await reg.pushManager.getSubscription();
  if (options.forceNew && sub) {
    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
      await deletePushSubscription({ data: { endpoint } });
    } catch {
      /* keep going and try to create a fresh app subscription */
    }
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  try {
    await savePushSubscription({
      data: {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      },
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "save-failed" };
  }

  // Hand the SW the Supabase config so it can ping mark_push_opened on click.
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (url && anon && reg.active) {
      reg.active.postMessage({ type: "SUPABASE_CONFIG", url, anon });
    }
  } catch {
    /* noop */
  }

  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* noop */
  }
  try {
    await deletePushSubscription({ data: { endpoint } });
  } catch {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  return true;
}
