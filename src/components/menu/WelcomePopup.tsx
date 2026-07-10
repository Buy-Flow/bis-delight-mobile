import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useSiteSettings } from "@/lib/menu-data";


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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/pedidos") ||
    pathname.startsWith("/clientes") ||
    pathname.startsWith("/financeiro") ||
    pathname.startsWith("/conta");

  useEffect(() => {
    if (isAdminRoute) return;
    if (!popup?.active) return;
    if (!popup.title && !popup.body && !popup.imageUrl) return;
    if (!shouldShow(popup.frequency)) return;
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [popup?.active, popup?.title, popup?.body, popup?.imageUrl, popup?.frequency, isAdminRoute]);

  if (isAdminRoute) return null;
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
      <button
        onClick={close}
        className="fixed right-4 top-4 z-[130] grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/80"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] max-w-[92vw] flex-col items-center gap-4 animate-in zoom-in-95 duration-300"
      >
        {popup.imageUrl && (
          <img
            src={popup.imageUrl}
            alt={popup.title || "Novidade"}
            draggable={false}
            className="max-h-[85dvh] max-w-[92vw] select-none object-contain"
            style={{
              transform: `translate(${popup.imagePosX}%, ${popup.imagePosY}%) scale(${popup.imageScale})`,
              transformOrigin: "center center",
            }}
          />
        )}

        {(popup.title || popup.body || ((internalTo || isExternal) && popup.cta)) && (
          <div className="w-full max-w-md space-y-3 text-center">
            {popup.title && (
              <h3 className="font-display text-2xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                {popup.title}
              </h3>
            )}
            {popup.body && (
              <p className="whitespace-pre-line text-sm text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                {popup.body}
              </p>
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
        )}
      </div>
    </div>
  );
}

