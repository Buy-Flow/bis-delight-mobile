import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import {
  getInstallPrompt,
  isAppInstalled,
  onInstallPromptChange,
  triggerInstallPrompt,
} from "@/lib/pwa-install";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_MS = 1000 * 60 * 60 * 24; // 1 dia (antes 7)

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isAndroid() {
  if (typeof window === "undefined") return false;
  return /Android/i.test(window.navigator.userAgent);
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPWAButton() {
  const [, setTick] = useState(0);
  const [showHelp, setShowHelp] = useState<null | "ios" | "android" | "desktop">(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [adminAllowed, setAdminAllowed] = useState(true);

  useEffect(() => {
    // Respect admin toggle from pwa_settings.show_install_prompt (cached fast path).
    try {
      const raw = localStorage.getItem("pwa_settings_cache_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.show_install_prompt === false) setAdminAllowed(false);
      }
    } catch {
      /* noop */
    }
    if (isStandalone() || isAppInstalled()) {
      setInstalled(true);
      return;
    }
    // Não exibe em desktop — só mobile
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (window.matchMedia?.("(pointer: coarse)").matches &&
        window.matchMedia?.("(max-width: 900px)").matches);
    if (!isMobile) return;

    const unsub = onInstallPromptChange(() => {
      setTick((t) => t + 1);
      if (getInstallPrompt()) setVisible(true);
      if (isAppInstalled()) {
        setInstalled(true);
        setVisible(false);
      }
    });
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    // Se o BIP já foi capturado antes desse componente montar, exibe já.
    if (getInstallPrompt()) setVisible(true);

    // Mostra o banner mesmo sem BIP (iOS, ou navegadores que já dispararam antes).
    // Só respeita o "dismiss recente" para não incomodar.
    if (!recentlyDismissed()) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(t);
        unsub();
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowHelp(null);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  const handleInstall = async () => {
    if (getInstallPrompt()) {
      const outcome = await triggerInstallPrompt();
      if (outcome === "dismissed") dismiss();
      else if (outcome === "accepted") setVisible(false);
      return;
    }
    if (isIOS()) setShowHelp("ios");
    else if (isAndroid()) setShowHelp("android");
    else setShowHelp("desktop");
  };


  if (installed || !visible || !adminAllowed) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#2a1240]/95 p-3 pl-4 shadow-2xl backdrop-blur">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-purple-500">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Instalar Quero Bis</p>
            <p className="truncate text-xs text-white/70">
              Abra direto da tela inicial, mais rápido.
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2a1240] transition hover:bg-white/90"
          >
            Instalar
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setShowHelp(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#2a1240] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {showHelp === "ios" ? "Adicionar à tela inicial" : "Instalar aplicativo"}
              </h3>
              <button
                type="button"
                onClick={() => setShowHelp(null)}
                aria-label="Fechar"
                className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {showHelp === "ios" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">1</span>
                  <span>
                    Toque em <Share className="mx-1 inline h-4 w-4 align-text-bottom" /> <b>Compartilhar</b> na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">2</span>
                  <span>Escolha <b>Adicionar à Tela de Início</b>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">3</span>
                  <span>Toque em <b>Adicionar</b> — pronto, o Quero Bis fica na sua tela inicial 🍧</span>
                </li>
              </ol>
            )}

            {showHelp === "android" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">1</span>
                  <span>Toque no menu <b>⋮</b> no canto superior direito do Chrome.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">2</span>
                  <span>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">3</span>
                  <span>Confirme em <b>Instalar</b> 🍧</span>
                </li>
              </ol>
            )}

            {showHelp === "desktop" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">1</span>
                  <span>Procure o ícone <b>⊕ Instalar</b> na barra de endereço do navegador.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">2</span>
                  <span>Ou abra o menu do navegador e escolha <b>Instalar Quero Bis</b>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">3</span>
                  <span>Confirme para adicionar o app ao seu computador 🍧</span>
                </li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
