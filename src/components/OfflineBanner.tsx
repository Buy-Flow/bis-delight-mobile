// Offline / online status banner driven by admin pwa_settings.
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { usePwaSettings } from "@/lib/pwa-settings";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { settings } = usePwaSettings();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [justRestored, setJustRestored] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      setOnline(true);
      setJustRestored(true);
      window.setTimeout(() => setJustRestored(false), 2600);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
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
