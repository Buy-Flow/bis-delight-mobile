// Web Push subscription helpers.
// The VAPID public key is safe to expose (that's the whole point).

import { supabase } from "@/integrations/supabase/client";

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

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.ready;
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
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
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
  const { data: userRes } = await supabase.auth.getUser();
  const payload = {
    user_id: userRes.user?.id ?? null,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    user_agent: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });
  if (error) return { ok: false, reason: error.message };

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
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return true;
}
