import { X, Download, Smartphone } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function InstallAppPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center [-webkit-tap-highlight-color:transparent]">
      <div className="absolute inset-0 bg-black/70 animate-in fade-in duration-150" onClick={onClose} />
      <div className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl card-acai p-6 animate-in slide-in-from-bottom duration-200">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-[0_0_30px_-8px_rgba(192,38,211,0.7)]">
            <Smartphone className="h-7 w-7 text-white" />
          </div>
          <h3 className="font-display text-2xl font-extrabold text-white">
            Peça pelo <span className="text-neon-pink">aplicativo</span>
          </h3>
          <p className="text-sm text-white/70 max-w-xs">
            Baixe o Quero Bis no seu celular: mais rápido, com notificações de promoções e acumula selos do Bis Recompensa.
          </p>

          <div className="mt-4 flex flex-col gap-2 w-full">
            <Link
              to="/baixar-app"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3.5 text-base font-extrabold text-white glow-pink active:scale-[.98]"
            >
              <Download className="h-5 w-5" />
              Baixar aplicativo
            </Link>
            <button
              onClick={onClose}
              className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              Continuar no navegador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function isStandalonePWA() {
  if (typeof window === "undefined") return true;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  // @ts-expect-error iOS Safari
  const ios = window.navigator.standalone === true;
  return Boolean(mm || ios);
}
