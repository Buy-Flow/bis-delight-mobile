import { Link } from "@tanstack/react-router";
import { Download, Sparkles, Bell, Gift, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import heroImg from "@/assets/app-download-hero.jpg";

function isStandalonePWA() {
  if (typeof window === "undefined") return true;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  // @ts-expect-error iOS Safari
  const ios = window.navigator.standalone === true;
  return Boolean(mm || ios);
}

const perks = [
  { icon: Zap, label: "Pedidos mais rápidos" },
  { icon: Bell, label: "Notificações de promoções" },
  { icon: Gift, label: "Selos do Bis Recompensa" },
];

export function InstallAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!isStandalonePWA());
  }, []);

  if (!show) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 shadow-[0_30px_80px_-30px_rgba(217,70,239,0.55)]">
        {/* Background image */}
        <img
          src={heroImg}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        {/* Overlays for legibility (lighter to show more of the image) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a0324]/85 via-[#1a0324]/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a0324]/75 via-transparent to-transparent md:hidden" />

        {/* Ambient glows */}
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-24 right-1/3 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative grid min-h-[320px] items-center gap-5 p-5 sm:p-8 md:grid-cols-2 md:min-h-[360px]">
          <div className="max-w-lg md:pr-4">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-fuchsia-100 backdrop-blur">
              <Sparkles className="h-2.5 w-2.5" /> Aplicativo Quero Bis
            </div>

            <h2 className="font-display text-2xl font-extrabold leading-[1.05] text-white sm:text-3xl md:text-4xl">
              O seu açaí,
              <br />
              <span className="bg-gradient-to-r from-fuchsia-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                a um toque de distância
              </span>
            </h2>

            <p className="mt-2 max-w-md text-xs text-white/70 sm:text-sm">
              Instale o app na tela inicial e peça em segundos, sem abrir o navegador.
            </p>

            <ul className="mt-4 space-y-2">
              {perks.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-white/90">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-neon-pink ring-1 ring-white/10 backdrop-blur">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-medium sm:text-sm">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/baixar-app"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-2.5 text-xs font-extrabold text-white shadow-[0_10px_30px_-10px_rgba(236,72,153,0.9)] transition hover:scale-[1.02] active:scale-95 sm:text-sm"
              >
                <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                Baixar aplicativo
              </Link>
              <span className="font-caveat text-lg text-fuchsia-200/80">
                é grátis e leve!
              </span>
            </div>
          </div>

          {/* Right column spacer – image already provides the visual */}
          <div className="hidden md:block" />
        </div>
      </div>
    </section>
  );
}
