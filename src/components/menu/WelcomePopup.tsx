import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  loadAudienceContext,
  markPopupDismissed,
  pickPopupToShow,
  type SitePopup,
} from "@/lib/popups";

export function WelcomePopup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [popup, setPopup] = useState<SitePopup | null>(null);
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
    if (authLoading) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("site_popups")
        .select("*")
        .eq("active", true);
      if (cancel) return;
      const popups = (data ?? []) as unknown as SitePopup[];
      if (!popups.length) return;
      const ctx = await loadAudienceContext(user);
      if (cancel) return;
      const winner = pickPopupToShow(popups, ctx);
      if (!winner) return;
      setPopup(winner);
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    })();
    return () => {
      cancel = true;
    };
  }, [isAdminRoute, authLoading, user?.id]);

  if (isAdminRoute) return null;
  if (!open || !popup) return null;

  const close = () => {
    markPopupDismissed(popup);
    setOpen(false);
  };

  const linkRaw = (popup.link ?? "").trim();
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
        {popup.image_url && (
          <img
            src={popup.image_url}
            alt={popup.title || "Novidade"}
            draggable={false}
            className="max-h-[85dvh] max-w-[92vw] select-none object-contain"
            style={{
              transform: `translate(${popup.image_pos_x}%, ${popup.image_pos_y}%) scale(${popup.image_scale})`,
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
                  onClick={() => markPopupDismissed(popup)}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-neon-yellow px-5 py-3 text-sm font-black text-[oklch(0.15_0.10_305)] shadow-lg transition hover:brightness-110"
                >
                  {popup.cta}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    markPopupDismissed(popup);
                    setOpen(false);
                    navigate({ to: internalTo });
                  }}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-neon-yellow px-5 py-3 text-sm font-black text-[oklch(0.15_0.10_305)] shadow-lg transition hover:brightness-110"
                >
                  {popup.cta}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
