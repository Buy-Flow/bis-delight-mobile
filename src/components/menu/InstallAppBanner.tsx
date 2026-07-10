import { Link } from "@tanstack/react-router";
import { Download, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

function isStandalonePWA() {
  if (typeof window === "undefined") return true;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  // @ts-expect-error iOS Safari
  const ios = window.navigator.standalone === true;
  return Boolean(mm || ios);
}

export function InstallAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!isStandalonePWA());
  }, []);

  if (!show) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-950/80 via-fuchsia-900/40 to-purple-950/80 p-6 sm:p-8 shadow-[0_0_60px_-20px_rgba(192,38,211,0.6)]">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-purple-500/30 blur-3xl" />

        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6 sm:text-left">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-[0_0_30px_-6px_rgba(217,70,239,0.7)]">
            <Smartphone className="h-8 w-8 text-white" />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-fuchsia-200">
              <Sparkles className="h-3 w-3" /> Novo
            </div>
            <h3 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
              Baixe o <span className="text-neon-pink">app</span> do Quero Bis
            </h3>
            <p className="mt-1 text-sm text-white/70 sm:text-base">
              Peça mais rápido, receba promoções e acumule selos do Bis Recompensa.
            </p>
          </div>

          <Link
            to="/baixar-app"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-neon-pink px-6 py-3.5 text-sm font-extrabold text-white glow-pink transition active:scale-[.98] sm:text-base"
          >
            <Download className="h-5 w-5" />
            Baixar aplicativo
          </Link>
        </div>
      </div>
    </section>
  );
}
