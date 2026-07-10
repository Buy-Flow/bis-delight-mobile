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
        {/* Overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a0324] via-[#1a0324]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a0324]/90 via-transparent to-transparent md:hidden" />

        {/* Ambient glows */}
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -top-24 right-1/3 h-64 w-64 rounded-full bg-purple-500/25 blur-3xl" />

        <div className="relative grid min-h-[380px] items-center gap-6 p-6 sm:p-10 md:grid-cols-2 md:min-h-[420px]">
          <div className="max-w-lg md:pr-4">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-100 backdrop-blur">
              <Sparkles className="h-3 w-3" /> Aplicativo Quero Bis
            </div>

            <h2 className="font-display text-3xl font-extrabold leading-[1.05] text-white sm:text-4xl md:text-5xl">
              O seu açaí,
              <br />
              <span className="bg-gradient-to-r from-fuchsia-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                a um toque de distância
              </span>
            </h2>

            <p className="mt-3 max-w-md text-sm text-white/70 sm:text-base">
              Instale o app na tela inicial e peça em segundos, sem abrir o navegador.
            </p>

            <ul className="mt-6 space-y-2.5">
              {perks.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-white/90">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-neon-pink ring-1 ring-white/10 backdrop-blur">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium sm:text-[15px]">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                to="/baixar-app"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_30px_-10px_rgba(236,72,153,0.9)] transition hover:scale-[1.02] active:scale-95 sm:text-base"
              >
                <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                Baixar aplicativo
              </Link>
              <span className="font-caveat text-xl text-fuchsia-200/80">
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
