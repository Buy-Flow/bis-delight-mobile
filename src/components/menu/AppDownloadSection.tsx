import { useEffect, useState } from "react";
import { Download, Share, Zap, Bell, Heart, Sparkles } from "lucide-react";
import heroBgAsset from "@/assets/app-download-hero.jpg.asset.json";
const heroBg = heroBgAsset.url;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

const perks = [
  { icon: Zap, title: "Abre instantâneo", text: "Direto da tela inicial." },
  { icon: Bell, title: "Notificações", text: "Promoções e status em tempo real." },
  { icon: Heart, title: "Bis Recompensas", text: "Selos e açaí grátis." },
  { icon: Sparkles, title: "Funciona offline", text: "Cardápio sempre à mão." },
];

export function AppDownloadSection() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<null | "ios" | "android" | "desktop">(null);

  useEffect(() => {
    if (isStandalone()) setInstalled(true);
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      } catch {
        /* noop */
      }
      return;
    }
    if (isIOS()) setHelp("ios");
    else if (isAndroid()) setHelp("android");
    else setHelp("desktop");
  };

  return (
    <section
      id="baixar-app"
      aria-labelledby="baixar-app-title"
      className="relative isolate min-h-screen w-full overflow-hidden bg-[#1a0a2e] text-white selection:bg-fuchsia-500 selection:text-white"
    >
      {/* Full-bleed background image */}
      <img
        src={heroBg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-center"
      />

      {/* Gradient scrims for text legibility */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#1a0a2e]/85 via-[#1a0a2e]/40 to-[#1a0a2e]/95"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[#1a0a2e]/80 via-transparent to-[#1a0a2e]/70"
      />

      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-purple-600/25 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-between px-6 pt-20 pb-28 text-center sm:pt-28">
        {/* Top badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-fuchsia-200 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5" />
          App oficial
        </div>

        {/* Headline */}
        <div className="mt-10 space-y-5">
          <h1
            id="baixar-app-title"
            className="font-fredoka text-5xl font-bold leading-[0.95] drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] sm:text-6xl md:text-7xl"
          >
            Baixe o
            <br />
            <span className="bg-gradient-to-r from-fuchsia-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
              Quero Bis
            </span>
          </h1>
          <p className="mx-auto max-w-md font-fredoka text-lg text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] md:text-xl">
            Seu açaí favorito em 2 toques. Rápido, offline e com recompensas.
          </p>
        </div>

        {/* Perks — compact glass chips */}
        <ul className="mt-10 grid w-full max-w-md grid-cols-2 gap-3">
          {perks.map((p) => (
            <li
              key={p.title}
              className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-left backdrop-blur-xl"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/40 to-purple-600/40 ring-1 ring-white/15">
                <p.icon className="h-4 w-4 text-fuchsia-100" />
              </div>
              <div className="min-w-0">
                <p className="font-fredoka text-sm font-semibold leading-tight text-white">
                  {p.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/60">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-10 flex w-full flex-col items-center">
          {!installed ? (
            <>
              <button
                type="button"
                onClick={handleInstall}
                className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-purple-600 px-10 py-5 font-fredoka text-xl font-bold text-white shadow-[0_10px_50px_-10px_rgba(236,72,153,0.9)] transition-all duration-300 hover:scale-[1.03] active:scale-95"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 group-hover:translate-x-full"
                />
                <Download className="relative h-5 w-5" />
                <span className="relative">Instalar agora</span>
              </button>
              <p className="mt-4 font-caveat text-xl text-fuchsia-200 drop-shadow">
                Leve, rápido e sem ocupar memória!
              </p>
              <button
                type="button"
                onClick={() => setHelp(isIOS() ? "ios" : isAndroid() ? "android" : "desktop")}
                className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-purple-200/70 underline-offset-4 hover:text-white hover:underline"
              >
                Como instalar?
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-5 py-3 font-fredoka text-sm font-semibold text-fuchsia-100 backdrop-blur-md">
              <Sparkles className="h-4 w-4" />
              App já instalado — aproveite!
            </div>
          )}
        </div>
      </div>

      {/* Help modal */}
      {help && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setHelp(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#2a1240] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-fredoka text-base font-semibold">
              {help === "ios" ? "Adicionar à tela inicial" : "Instalar aplicativo"}
            </h3>
            {help === "ios" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li>
                  1. Toque em <Share className="mx-1 inline h-4 w-4 align-text-bottom" />{" "}
                  <b>Compartilhar</b> no Safari.
                </li>
                <li>
                  2. Escolha <b>Adicionar à Tela de Início</b>.
                </li>
                <li>
                  3. Toque em <b>Adicionar</b> 🍧
                </li>
              </ol>
            )}
            {help === "android" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li>
                  1. Toque no menu <b>⋮</b> no Chrome.
                </li>
                <li>
                  2. Escolha <b>Instalar app</b>.
                </li>
                <li>
                  3. Confirme em <b>Instalar</b> 🍧
                </li>
              </ol>
            )}
            {help === "desktop" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li>
                  1. Procure o ícone <b>⊕ Instalar</b> na barra de endereço.
                </li>
                <li>
                  2. Ou abra o menu do navegador e escolha <b>Instalar Quero Bis</b>.
                </li>
                <li>3. Confirme para adicionar 🍧</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setHelp(null)}
              className="mt-5 w-full rounded-full bg-white px-4 py-2 font-fredoka text-sm font-bold text-[#2a1240]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
