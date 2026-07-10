import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSiteSettings } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "querobis:welcome-popup-dismissed";

function shouldShow(freq: string): boolean {
  if (freq === "always") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    if (freq === "session") return sessionStorage.getItem(STORAGE_KEY) !== "1";
    if (freq === "daily") {
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return true;
      return Date.now() - ts > 24 * 60 * 60 * 1000;
    }
  } catch {
    return true;
  }
  return true;
}

function markDismissed(freq: string) {
  try {
    if (freq === "session") sessionStorage.setItem(STORAGE_KEY, "1");
    else localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function WelcomePopup() {
  const { data } = useSiteSettings();
  const popup = data?.popup;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!popup?.active) return;
    if (!popup.title && !popup.body && !popup.imageUrl) return;
    if (!shouldShow(popup.frequency)) return;
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [popup?.active, popup?.title, popup?.body, popup?.imageUrl, popup?.frequency]);

  if (!open || !popup) return null;

  const close = () => {
    markDismissed(popup.frequency);
    setOpen(false);
  };

  const linkRaw = popup.link.trim();
  const isExternal = /^https?:\/\//i.test(linkRaw);
  const internalTo = linkRaw && !isExternal ? (linkRaw.startsWith("/") ? linkRaw : `/${linkRaw}`) : "";

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15",
          "bg-gradient-to-b from-[oklch(0.22_0.14_305)] to-[oklch(0.14_0.10_305)]",
          "shadow-2xl animate-in zoom-in-95 duration-300"
        )}
      >
        <button
          onClick={close}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur hover:bg-black/70 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.imageUrl && (
          <div className="relative aspect-square w-full overflow-hidden bg-black/30">
            <img
              src={popup.imageUrl}
              alt={popup.title || "Novidade"}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover select-none"
              style={{
                transform: `translate(${popup.imagePosX}%, ${popup.imagePosY}%) scale(${popup.imageScale})`,
                transformOrigin: "center center",
              }}
            />
          </div>
        )}

        <div className="space-y-3 p-5 text-center">
          {popup.title && (
            <h3 className="font-display text-2xl font-black leading-tight text-white">
              {popup.title}
            </h3>
          )}
          {popup.body && (
            <p className="whitespace-pre-line text-sm text-white/80">{popup.body}</p>
          )}

          {(internalTo || isExternal) && popup.cta && (
            isExternal ? (
              <a
                href={linkRaw}
                target="_blank"
                rel="noreferrer"
                onClick={() => markDismissed(popup.frequency)}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-neon-yellow px-5 py-3 text-sm font-black text-[oklch(0.15_0.10_305)] shadow-lg transition hover:brightness-110"
              >
                {popup.cta}
              </a>
            ) : (
              <Link
                to={internalTo}
                onClick={close}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-neon-yellow px-5 py-3 text-sm font-black text-[oklch(0.15_0.10_305)] shadow-lg transition hover:brightness-110"
              >
                {popup.cta}
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
