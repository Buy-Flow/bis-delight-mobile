import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

export const BADGE_STYLES = [
  { bg: "bg-neon-cyan", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.55_0.20_200)]", rotate: "-rotate-[5deg]", label: "Novo" },
  { bg: "bg-neon-yellow", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.65_0.18_90)]", rotate: "rotate-[4deg]", label: "Top" },
  { bg: "bg-neon-pink", text: "text-white", shadow: "shadow-[0_4px_0_0_oklch(0.45_0.24_355)]", rotate: "-rotate-[3deg]", label: "Hit" },
];

export const EYEBROWS = ["Edição Limitada", "Artesanal", "Recém-chegado", "Sabor do mês"];

export function NewsCarousel({
  items,
  onOpen,
  title = "Novidades",
  subtitle = "acabou de sair!",
  ticker = "Lançamento fresquinho, Edição limitada, Só na Quero Bis, Novidade da semana",
}: {
  items: Product[];
  onOpen: (p: Product) => void;
  title?: string;
  subtitle?: string;
  ticker?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Autoplay: troca 1 card a cada 3s. Sem duplicação — mostra exatamente os itens configurados.
  useEffect(() => {
    if (items.length < 2 || paused) return;
    const id = window.setInterval(() => {
      setCurrent((c) => (c + 1) % items.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [items.length, paused]);

  // Garante índice válido se a lista mudar
  useEffect(() => {
    if (current >= items.length) setCurrent(0);
  }, [items.length, current]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setPaused(true);
    setTouchStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40 && items.length > 1) {
      if (dx > 0) {
        // arrastou para direita → volta
        setCurrent((c) => (c - 1 + items.length) % items.length);
      } else {
        setCurrent((c) => (c + 1) % items.length);
      }
    }
    setTouchStartX(null);
    setPaused(false);
  };





  return (
    <section className="relative isolate overflow-visible py-8">
      {/* Brilhos coloridos no fundo — destaque das novidades */}
      <div aria-hidden className="pointer-events-none absolute -inset-x-40 -inset-y-28 -z-10 overflow-visible">
        <div
          className="absolute top-16 left-10 h-80 w-80 rounded-full opacity-24 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.26 350 / 0.30), transparent 76%)" }}
        />
        <div
          className="absolute top-24 right-6 h-80 w-80 rounded-full opacity-22 blur-3xl animate-float-med"
          style={{ background: "radial-gradient(circle, oklch(0.86 0.18 200 / 0.28), transparent 76%)" }}
        />
        <div
          className="absolute bottom-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-18 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.19 90 / 0.20), transparent 78%)", animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/3 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-16 blur-3xl animate-pulse-glow"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.20 305 / 0.22), transparent 80%)" }}
        />
      </div>

      {/* Separador acima do header */}
      <div className="mx-5 mb-5 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />


      {/* Header — magazine style */}
      <div className="relative mb-3 flex items-baseline gap-3 px-5">
        <h2
          className="font-display text-[36px] font-black uppercase italic leading-none text-white"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "-0.01em" }}
        >
          Nossas{" "}
          <span className="text-neon-pink drop-shadow-[0_0_12px_rgba(255,45,149,0.85)]">
            {title}
          </span>
        </h2>
        {subtitle && (
          <span
            className="-rotate-[6deg] whitespace-nowrap text-lg text-neon-cyan drop-shadow-[0_0_6px_rgba(90,220,255,0.6)]"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Ticker bar */}
      {(() => {
        const tickerItems = ticker
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tickerItems.length === 0) return null;
        const dotColors = ["bg-neon-pink", "bg-neon-cyan", "bg-neon-yellow"];
        return (
          <div className="relative mb-4 overflow-hidden py-2">
            <div className="relative flex items-center gap-2 overflow-hidden">
              <div className="flex shrink-0 animate-[news-marquee_22s_linear_infinite] gap-6 whitespace-nowrap pl-5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                {Array.from({ length: 2 }).map((_, r) => (
                  <span key={r} className="flex items-center gap-6">
                    <Sparkles className="h-3 w-3 text-neon-yellow" />
                    {tickerItems.map((t, i) => (
                      <span key={`${r}-${i}`} className="flex items-center gap-6">
                        {t}
                        <span className={cn("h-1 w-1 rounded-full", dotColors[i % dotColors.length])} />
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}


      {/* Card único com crossfade — troca a cada 4s */}
      <div
        className="relative mx-auto w-[85vw] max-w-[380px] py-6 touch-pan-y"
        style={{ aspectRatio: "3 / 4" }}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {items.map((p, i) => (
          <div
            key={p.id}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              opacity: i === current ? 1 : 0,
              pointerEvents: i === current ? "auto" : "none",
            }}
            aria-hidden={i !== current}
          >
            <NewsPosterCard
              product={p}
              onOpen={onOpen}
              badge={BADGE_STYLES[i % BADGE_STYLES.length]}
              eyebrow={EYEBROWS[i % EYEBROWS.length]}
              index={i}
            />
          </div>
        ))}
      </div>

      {/* Indicadores (pontinhos) */}
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para novidade ${i + 1}`}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current ? "w-6 bg-neon-pink" : "w-1.5 bg-white/30",
              )}
            />
          ))}
        </div>
      )}





      <style>{`
        @keyframes news-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

export function NewsPosterCard({
  product,
  onOpen,
  badge,
  eyebrow,
  index,
}: {
  product: Product;
  onOpen: (p: Product) => void;
  badge: (typeof BADGE_STYLES)[number];
  eyebrow: string;
  index: number;
}) {
  const heroSrc = product.heroImage || product.image;
  // Sempre aplica pos/scale — assim o admin ajusta mesmo quando não há heroImage próprio.
  const heroPosX = product.heroImagePosX ?? 0;
  const heroPosY = product.heroImagePosY ?? 0;
  const heroScale = product.heroImageScale ?? 1.2;

  // (issue label removed — cleaner card)


  // Split product name so we can stack it dramatically across two lines
  const words = product.name.trim().split(/\s+/);
  const topLine = words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
  const bottomLine = words.slice(Math.ceil(words.length / 2)).join(" ");

  // Fundo do card: roxo com degradê (mais claro em cima, escuro embaixo),
  // brilho suave no topo e "estrelinhas" espalhadas.
  const cardBg =
    "linear-gradient(180deg, oklch(0.34 0.16 305) 0%, oklch(0.22 0.14 305) 45%, oklch(0.12 0.10 305) 100%)";

  return (
    <article className="group relative w-[85vw] max-w-[380px] shrink-0 snap-center">
      <button
        onClick={() => onOpen(product)}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-[26px] text-left transition-transform duration-300 group-hover:-translate-y-1"
        style={{
          background: cardBg,
          boxShadow:
            "0 0 0 1px oklch(0.55 0.18 305 / 0.35), 0 0 22px -4px oklch(0.55 0.18 305 / 0.45), 0 24px 40px -20px rgba(0,0,0,0.8)",
        }}
      >
        {/* Brilho suave (halo) no topo do card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 45% at 50% 0%, oklch(0.75 0.18 305 / 0.35), transparent 70%)",
          }}
        />

        {/* Estrelinhas / partículas sutis */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: [
              "radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.9), transparent 60%)",
              "radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,0.8), transparent 60%)",
              "radial-gradient(1.5px 1.5px at 34% 32%, rgba(255,255,255,0.7), transparent 60%)",
              "radial-gradient(1px 1px at 62% 42%, rgba(255,255,255,0.75), transparent 60%)",
              "radial-gradient(2px 2px at 88% 28%, rgba(255,255,255,0.85), transparent 60%)",
              "radial-gradient(1px 1px at 22% 58%, rgba(255,255,255,0.65), transparent 60%)",
              "radial-gradient(1.5px 1.5px at 48% 8%, rgba(255,255,255,0.85), transparent 60%)",
              "radial-gradient(1px 1px at 8% 42%, rgba(255,255,255,0.6), transparent 60%)",
              "radial-gradient(1.5px 1.5px at 72% 62%, rgba(255,255,255,0.7), transparent 60%)",
              "radial-gradient(1px 1px at 94% 52%, rgba(255,255,255,0.55), transparent 60%)",
              "radial-gradient(1px 1px at 40% 72%, rgba(255,255,255,0.5), transparent 60%)",
            ].join(","),
          }}
        />


        {/* Foto ocupa tudo — object-contain preserva a taça sem cortar */}
        <img
          src={heroSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.03]"
          style={{
            transform: `translate(${heroPosX}%, ${heroPosY}%) scale(${heroScale})`,
            transformOrigin: "center",
          }}
        />





        {/* Badge canto superior direito */}
        <div className="absolute right-3 top-3 z-20">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.28em]",
              badge.bg,
              badge.text,
            )}
            style={{
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Eyebrow discreto no topo esquerdo */}
        <div className="absolute left-3 top-3 z-20">
          <span
            className="rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-neon-cyan backdrop-blur"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {eyebrow}
          </span>
        </div>

        {/* Faixa inferior com wash — só o rodapé cobre a imagem */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%]"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.08 0.10 305 / 0) 0%, oklch(0.08 0.10 305 / 0.70) 55%, oklch(0.08 0.10 305 / 0.92) 100%)",
          }}
        />

        {/* Conteúdo compacto só no rodapé */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-white"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: "22px",
                lineHeight: 1,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {topLine}
              {bottomLine ? ` ${bottomLine}` : ""}
            </h3>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/60"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                a partir de
              </span>
              <span
                className="text-[18px] font-black italic leading-none text-white"
                style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
              >
                {brl(product.basePrice)}
              </span>
            </div>
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neon-pink px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-transform group-hover:scale-105 group-active:scale-95"
            style={{
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 0 18px rgba(255,45,149,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
            aria-hidden
          >
            Ver
            <Plus className="h-3 w-3" strokeWidth={3.2} />
          </span>
        </div>
      </button>
    </article>
  );
}


