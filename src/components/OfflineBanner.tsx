// Offline / online status banner driven by admin pwa_settings.
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { usePwaSettings } from "@/lib/pwa-settings";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { settings } = usePwaSettings();
  const [online, setOnline] = useState(true);
  const [justRestored, setJustRestored] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Verify real connectivity — navigator.onLine can be a false negative
    // (especially in iframes/previews). Only mark offline after a real fetch fails.
    let cancelled = false;
    const verify = async () => {
      try {
        await fetch("/favicon.ico?_ping=" + Date.now(), { cache: "no-store", method: "HEAD" });
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled && !navigator.onLine) setOnline(false);
      }
    };

    setOnline(navigator.onLine);
    if (!navigator.onLine) void verify();

    const onOnline = () => {
      setOnline(true);
      setJustRestored(true);
      window.setTimeout(() => setJustRestored(false), 2600);
    };
    const onOffline = () => {
      // Double-check before showing the banner
      void verify();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);


  if (!settings.offline_banner_enabled) return null;
  if (online && !justRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white shadow-lg transition-transform",
        online ? "bg-emerald-600" : "bg-amber-600",
      )}
    >
      {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span>{online ? settings.online_restored_text : settings.offline_banner_text}</span>
    </div>
  );
}
