import { useEffect, useState } from "react";
import { Download, Share, Zap, Bell, Heart, Sparkles, ArrowDown } from "lucide-react";
import logo from "@/assets/querobis-logo.png.asset.json";

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
  {
    icon: Zap,
    title: "Abre instantâneo",
    text: "Direto da tela inicial, sem navegador.",
    dot: "bg-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.9)]",
    ring: "bg-fuchsia-500/15 border-fuchsia-500/30",
  },
  {
    icon: Bell,
    title: "Notificações",
    text: "Promoções e status do pedido em tempo real.",
    dot: "bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.9)]",
    ring: "bg-purple-500/15 border-purple-500/30",
  },
  {
    icon: Heart,
    title: "Bis Recompensas",
    text: "Acompanhe seus selos e ganhe açaí grátis.",
    dot: "bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.9)]",
    ring: "bg-pink-500/15 border-pink-500/30",
  },
  {
    icon: Sparkles,
    title: "Funciona offline",
    text: "Cardápio sempre disponível, mesmo sem internet.",
    dot: "bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.9)]",
    ring: "bg-fuchsia-400/15 border-fuchsia-400/30",
  },
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
      className="relative isolate flex min-h-[calc(100vh-64px)] w-full items-center justify-center overflow-hidden bg-[#1a0b2e] px-6 py-14 selection:bg-fuchsia-500 selection:text-white sm:py-20"
    >
      {/* Animated background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] animate-pulse rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] animate-pulse rounded-full bg-purple-600/25 blur-[120px] [animation-delay:700ms]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Phone mockup */}
        <div className="relative flex items-center justify-center">
          {/* Glow behind phone */}
          <div
            aria-hidden
            className="absolute inset-0 scale-75 rounded-full bg-gradient-to-tr from-fuchsia-500/30 to-purple-500/30 blur-3xl"
          />

          <div className="relative h-[500px] w-[248px] animate-[float_6s_ease-in-out_infinite] rounded-[3rem] border-[8px] border-zinc-800 bg-zinc-900 shadow-[0_0_60px_-12px_rgba(192,38,211,0.55)] sm:h-[580px] sm:w-[288px]">
            {/* screen */}
            <div className="flex h-full w-full flex-col overflow-hidden rounded-[2.3rem] bg-[#2D033B] p-4">
              <div className="mx-auto mt-2 mb-6 h-6 w-24 rounded-full bg-zinc-800" />

              <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-purple-600 p-4 shadow-inner">
                <img
                  src={logo.url}
                  alt="Quero Bis"
                  className="h-full w-auto drop-shadow-[0_8px_20px_rgba(255,80,180,0.55)]"
                />
              </div>

              <div className="mt-4 space-y-2">
                <div className="h-3 w-3/4 rounded-full bg-white/15" />
                <div className="h-3 w-1/2 rounded-full bg-white/10" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="h-16 rounded-xl border border-white/10 bg-white/5" />
                <div className="h-16 rounded-xl border border-white/10 bg-white/5" />
                <div className="h-16 rounded-xl border border-white/10 bg-white/5" />
                <div className="h-16 rounded-xl border border-white/10 bg-white/5" />
              </div>
            </div>
          </div>

          {/* Floating handwritten labels */}
          <div className="absolute -right-4 -top-2 rotate-6 rounded-2xl border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-md sm:-right-8">
            <p className="font-caveat text-2xl text-fuchsia-300">O melhor açaí!</p>
          </div>
          <div className="absolute bottom-16 -left-4 -rotate-6 rounded-2xl border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-md sm:-left-10">
            <p className="font-caveat text-2xl text-purple-200">Peça em segundos</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col space-y-8 text-center lg:text-left">
          <div className="space-y-4">
            <h1
              id="baixar-app-title"
              className="font-fredoka text-5xl font-bold leading-[1.05] text-white md:text-6xl lg:text-7xl"
            >
              Baixe nosso
              <br />
              <span className="bg-gradient-to-r from-fuchsia-400 via-pink-300 to-purple-400 bg-clip-text text-transparent">
                aplicativo
              </span>
            </h1>
            <p className="mx-auto max-w-md font-fredoka text-lg text-purple-200/75 md:text-xl lg:mx-0">
              Tenha o Quero Bis na palma da sua mão. Peça seu açaí favorito com muito mais rapidez e facilidade.
            </p>
          </div>

          {/* Perks */}
          <ul className="space-y-4">
            {perks.map((p) => (
              <li
                key={p.title}
                className="flex items-center gap-4 lg:justify-start"
              >
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${p.ring}`}
                >
                  <span className={`block h-3 w-3 rounded-full ${p.dot}`} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-fredoka text-lg font-medium leading-tight text-white">
                    {p.title}
                  </p>
                  <p className="text-sm text-purple-200/60">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* CTA */}
          {!installed ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleInstall}
                className="group relative inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-10 py-5 font-fredoka text-xl font-bold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_-5px_rgba(192,38,211,0.7)] active:scale-95"
              >
                <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                <span>Instalar agora</span>
                <ArrowDown className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
              </button>
              <p className="mt-3 font-caveat text-xl text-fuchsia-300 lg:ml-4">
                Leve, rápido e sem ocupar memória!
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-purple-300/60 lg:justify-start">
                <button
                  type="button"
                  onClick={() => setHelp(isIOS() ? "ios" : isAndroid() ? "android" : "desktop")}
                  className="font-semibold uppercase tracking-widest underline-offset-4 transition hover:text-white hover:underline"
                >
                  Como instalar?
                </button>
                <span aria-hidden>·</span>
                <span>Funciona em iPhone, Android e computador</span>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-5 py-3 font-fredoka text-sm font-semibold text-fuchsia-100">
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
