import { useEffect, useState } from "react";
import { Download, Share, Sparkles, Bell, Zap, Heart, Smartphone } from "lucide-react";
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
  { icon: Zap, title: "Abre instantâneo", text: "Direto da tela inicial, sem navegador." },
  { icon: Bell, title: "Notificações", text: "Promoções e status do pedido em tempo real." },
  { icon: Heart, title: "Bis Recompensas", text: "Acompanhe seus selos e ganhe açaí grátis." },
  { icon: Sparkles, title: "Funciona offline", text: "Cardápio sempre disponível, mesmo sem internet." },
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
      } catch { /* noop */ }
      return;
    }
    if (isIOS()) setHelp("ios");
    else if (isAndroid()) setHelp("android");
    else setHelp("desktop");
  };

  if (installed) return null;

  return (
    <section
      id="baixar-app"
      className="relative overflow-hidden px-4 py-14 sm:py-20"
      aria-labelledby="baixar-app-title"
    >
      {/* fundo com glow rosa/roxo, no tom da marca */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-pink-400/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        {/* Mockup do celular */}
        <div className="order-2 flex justify-center md:order-1">
          <div className="relative">
            {/* halo */}
            <div aria-hidden className="absolute inset-0 -z-10 animate-pulse-slow rounded-[3rem] bg-gradient-to-br from-pink-500/40 via-fuchsia-500/30 to-purple-600/40 blur-2xl" />
            {/* phone frame */}
            <div className="relative h-[440px] w-[220px] rounded-[2.6rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl sm:h-[500px] sm:w-[250px]">
              {/* notch */}
              <div className="absolute left-1/2 top-1.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
              {/* tela */}
              <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-[#2a1240] via-[#3a1858] to-[#1a0a2e]">
                <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                  <img
                    src={logo.url}
                    alt=""
                    className="h-32 w-auto drop-shadow-[0_8px_25px_rgba(255,80,180,0.5)]"
                  />
                  <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/90 backdrop-blur">
                    Cardápio digital
                  </div>
                  <p className="font-caveat text-2xl leading-tight text-white">
                    Peça em 2 toques 🍧
                  </p>
                </div>
                {/* reflexos */}
                <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
              </div>
            </div>
            {/* badge flutuante */}
            <div className="absolute -right-4 -top-3 rotate-6 rounded-2xl bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#2a1240] shadow-lg">
              Grátis ✦
            </div>
            <div className="absolute -bottom-3 -left-4 -rotate-6 rounded-2xl bg-neon-pink px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-lg">
              Instala em 5s
            </div>
          </div>
        </div>

        {/* Texto + CTA */}
        <div className="order-1 md:order-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
            <Smartphone className="h-3.5 w-3.5 text-pink-300" />
            Aplicativo Quero Bis
          </div>
          <h2
            id="baixar-app-title"
            className="mt-3 font-fredoka text-3xl leading-tight text-white sm:text-4xl md:text-5xl"
          >
            Baixe nosso app e{" "}
            <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
              peça mais rápido
            </span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
            Instale o Quero Bis na tela inicial e tenha o cardápio a um toque.
            Sem loja de aplicativos, sem espera — só sabor.
          </p>

          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {perks.map((p) => (
              <li
                key={p.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"
              >
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-lg shadow-pink-500/30">
                  <p.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{p.title}</p>
                  <p className="text-[12px] leading-snug text-white/65">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleInstall}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[#2a1240] shadow-xl transition hover:scale-[1.02] hover:shadow-pink-500/30 active:scale-95"
            >
              <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              Instalar aplicativo
            </button>
            <button
              type="button"
              onClick={() => setHelp(isIOS() ? "ios" : isAndroid() ? "android" : "desktop")}
              className="text-xs font-semibold uppercase tracking-widest text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
              Como instalar?
            </button>
          </div>
          <p className="mt-3 text-[11px] text-white/50">
            Funciona em iPhone, Android e computador. Sem baixar nada da loja.
          </p>
        </div>
      </div>

      {help && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setHelp(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#2a1240] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold">
              {help === "ios" ? "Adicionar à tela inicial" : "Instalar aplicativo"}
            </h3>
            {help === "ios" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li>1. Toque em <Share className="mx-1 inline h-4 w-4 align-text-bottom" /> <b>Compartilhar</b> no Safari.</li>
                <li>2. Escolha <b>Adicionar à Tela de Início</b>.</li>
                <li>3. Toque em <b>Adicionar</b> 🍧</li>
              </ol>
            )}
            {help === "android" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li>1. Toque no menu <b>⋮</b> no Chrome.</li>
                <li>2. Escolha <b>Instalar app</b>.</li>
                <li>3. Confirme em <b>Instalar</b> 🍧</li>
              </ol>
            )}
            {help === "desktop" && (
              <ol className="space-y-3 text-sm text-white/85">
                <li>1. Procure o ícone <b>⊕ Instalar</b> na barra de endereço.</li>
                <li>2. Ou abra o menu do navegador e escolha <b>Instalar Quero Bis</b>.</li>
                <li>3. Confirme para adicionar 🍧</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setHelp(null)}
              className="mt-5 w-full rounded-full bg-white px-4 py-2 text-sm font-bold text-[#2a1240]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
