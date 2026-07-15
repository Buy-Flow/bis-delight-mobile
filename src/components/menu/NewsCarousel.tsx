import { useEffect, useState } from "react";
import { Plus, Sparkles, Flame } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { AdminEditButton } from "./AdminEditButton";


export const BADGE_STYLES = [
  { bg: "bg-neon-cyan", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.55_0.20_200)]", rotate: "-rotate-[5deg]", label: "Novo" },
  { bg: "bg-neon-yellow", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.65_0.18_90)]", rotate: "rotate-[4deg]", label: "Top" },
  { bg: "bg-neon-pink", text: "text-white", shadow: "shadow-[0_4px_0_0_oklch(0.45_0.24_355)]", rotate: "-rotate-[3deg]", label: "Hit" },
];

export const EYEBROWS = ["Edição Limitada", "Artesanal", "Recém-chegado", "Sabor do mês"];

const AUTOPLAY_MS = 4200;

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

  // Autoplay: troca 1 card em ritmo editorial. Sem duplicação.
  useEffect(() => {
    if (items.length < 2 || paused) return;
    const id = window.setInterval(() => {
      setCurrent((c) => (c + 1) % items.length);
    }, AUTOPLAY_MS);
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
        setCurrent((c) => (c - 1 + items.length) % items.length);
      } else {
        setCurrent((c) => (c + 1) % items.length);
      }
    }
    setTouchStartX(null);
    setPaused(false);
  };

  const issueNum = String(current + 1).padStart(2, "0");
  const totalNum = String(items.length).padStart(2, "0");

  return (
    <section className="relative isolate overflow-visible py-10">
      <AdminEditButton tab="news" label="Editar novidades no painel" className="absolute right-4 top-4 z-30" />

      {/* Aurora ambiente — brilhos coloridos no fundo */}
      <div aria-hidden className="pointer-events-none absolute -inset-x-40 -inset-y-28 -z-10 overflow-visible">
        <div
          className="absolute top-16 left-10 h-80 w-80 rounded-full opacity-30 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.26 350 / 0.35), transparent 76%)" }}
        />
        <div
          className="absolute top-24 right-6 h-80 w-80 rounded-full opacity-25 blur-3xl animate-float-med"
          style={{ background: "radial-gradient(circle, oklch(0.86 0.18 200 / 0.30), transparent 76%)" }}
        />
        <div
          className="absolute bottom-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-22 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.19 90 / 0.24), transparent 78%)", animationDelay: "1.5s" }}
        />
      </div>

      {/* Header editorial — tipografia em revista */}
      <div className="relative mb-4 px-5">
        {/* Meta linha: ISSUE + separador + data-ish */}
        <div className="mb-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-neon-pink/40 bg-neon-pink/10 px-2.5 py-1 backdrop-blur">
            <Flame className="h-3 w-3 text-neon-pink" strokeWidth={2.6} />
            <span
              className="text-[9px] font-black uppercase tracking-[0.28em] text-neon-pink"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              New Drop
            </span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-neon-pink/40 via-white/15 to-transparent" />
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/50 tabular-nums"
          >
            Nº {issueNum} / {totalNum}
          </span>
        </div>

        {/* Título dramático */}
        <div className="relative flex items-baseline gap-3">
          <h2
            className="font-display text-[42px] font-black uppercase italic leading-[0.85] text-white sm:text-[52px]"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "-0.02em" }}
          >
            Nossas{" "}
            <span
              className="relative inline-block bg-gradient-to-b from-neon-pink via-neon-pink to-[oklch(0.55_0.24_355)] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(255,45,149,0.55)]"
            >
              {title}
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[3px] w-full origin-left"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(0.72 0.26 350 / 0.9), transparent)",
                  filter: "blur(0.5px)",
                }}
              />
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
      </div>

      {/* Ticker pills — mais vivo, com dots coloridos e sparkle inline */}
      {(() => {
        const tickerItems = ticker
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tickerItems.length === 0) return null;
        const dotColors = ["bg-neon-pink", "bg-neon-cyan", "bg-neon-yellow"];
        return (
          <div className="relative mb-5 overflow-hidden">
            {/* fade lateral */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[oklch(0.10_0.09_305)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[oklch(0.10_0.09_305)] to-transparent" />
            <div className="relative flex items-center gap-2 overflow-hidden py-1">
              <div className="flex shrink-0 animate-[news-marquee_28s_linear_infinite] items-center gap-3 whitespace-nowrap pl-5">
                {Array.from({ length: 2 }).map((_, r) => (
                  <span key={r} className="flex items-center gap-3">
                    {tickerItems.map((t, i) => (
                      <span
                        key={`${r}-${i}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 backdrop-blur"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        <Sparkles className="h-3 w-3 text-neon-yellow" />
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

      {/* Card único com crossfade — moldura aurora envolvendo */}
      <div className="relative mx-auto w-[85vw] max-w-[380px]">
        {/* Moldura aurora animada */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[6px] -z-10 rounded-[28px] opacity-70 blur-md"
          style={{
            background:
              "conic-gradient(from 90deg at 50% 50%, oklch(0.72 0.26 350 / 0.55), oklch(0.86 0.18 200 / 0.55), oklch(0.82 0.19 90 / 0.55), oklch(0.72 0.26 350 / 0.55))",
            animation: "news-aurora 9s linear infinite",
          }}
        />

        <div
          className="relative touch-pan-y py-1"
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
              className="absolute inset-0 transition-all duration-700 ease-out"
              style={{
                opacity: i === current ? 1 : 0,
                transform: i === current ? "scale(1)" : "scale(0.97)",
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
      </div>

      {/* Progresso + indicadores compactos */}
      {items.length > 1 && (
        <div className="mx-auto mt-4 flex w-[85vw] max-w-[380px] items-center gap-3">
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para novidade ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === current ? "w-6 bg-neon-pink" : "w-1.5 bg-white/25 hover:bg-white/50",
                )}
              />
            ))}
          </div>
          {/* barra de autoplay */}
          <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              key={`${current}-${paused ? "p" : "r"}`}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan"
              style={{
                animation: paused
                  ? "none"
                  : `news-progress ${AUTOPLAY_MS}ms linear forwards`,
                width: paused ? "0%" : undefined,
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes news-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes news-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes news-aurora {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes news-shine {
          0% { transform: translateX(-120%) skewX(-18deg); }
          60% { transform: translateX(220%) skewX(-18deg); }
          100% { transform: translateX(220%) skewX(-18deg); }
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
  const heroPosX = product.heroImagePosX ?? 0;
  const heroPosY = product.heroImagePosY ?? 0;
  const heroScale = product.heroImageScale ?? 1.2;

  // Split product name so we can stack it dramatically across two lines
  const words = product.name.trim().split(/\s+/);
  const topLine = words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
  const bottomLine = words.slice(Math.ceil(words.length / 2)).join(" ");

  // Fundo do card: gradiente vertical roxo profundo
  const cardBg =
    "linear-gradient(180deg, oklch(0.36 0.17 305) 0%, oklch(0.22 0.14 305) 45%, oklch(0.11 0.10 305) 100%)";

  const issue = String(index + 1).padStart(2, "0");

  return (
    <article className="group relative w-[85vw] max-w-[380px] shrink-0 snap-center">
      <button
        onClick={() => onOpen(product)}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-3xl text-left transition-transform duration-500 group-hover:-translate-y-1"
        style={{
          background: cardBg,
          boxShadow:
            "0 0 0 1px oklch(0.60 0.20 305 / 0.45), 0 0 26px -4px oklch(0.60 0.20 305 / 0.55), 0 30px 50px -22px rgba(0,0,0,0.85)",
        }}
      >
        {/* Halo suave topo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 45% at 50% 0%, oklch(0.78 0.20 305 / 0.42), transparent 70%)",
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

        {/* Marca d'água enorme do número do drop */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-3 -top-3 z-0 select-none leading-none text-white/[0.06]"
          style={{
            fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: "180px",
            letterSpacing: "-0.05em",
          }}
        >
          {issue}
        </div>

        {/* Foto ocupa tudo */}
        <img
          src={heroSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.04]"
          style={{
            transform: `translate(${heroPosX}%, ${heroPosY}%) scale(${heroScale})`,
            transformOrigin: "center",
            filter: "drop-shadow(0 22px 30px rgba(0,0,0,0.55))",
          }}
        />

        {/* Shine sweep — brilho diagonal que corre pela foto */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-y-[-20%] w-[45%]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
              animation: "news-shine 5.5s ease-in-out infinite",
              animationDelay: `${(index % 3) * 0.9}s`,
              mixBlendMode: "screen",
            }}
          />
        </div>

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
            className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-neon-cyan backdrop-blur"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {eyebrow}
          </span>
        </div>

        {/* Faixa inferior com wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.08 0.10 305 / 0) 0%, oklch(0.08 0.10 305 / 0.75) 55%, oklch(0.06 0.08 305 / 0.95) 100%)",
          }}
        />

        {/* Conteúdo rodapé */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-white"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: "24px",
                lineHeight: 1,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {topLine}
              {bottomLine ? ` ${bottomLine}` : ""}
            </h3>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/60"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                a partir de
              </span>
              <span
                className="text-[20px] font-black italic leading-none text-white"
                style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
              >
                {brl(product.basePrice)}
              </span>
            </div>
          </div>

          <span
            className="relative inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-full bg-neon-pink px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-transform group-hover:scale-105 group-active:scale-95"
            style={{
              fontFamily: "'Poppins', sans-serif",
              boxShadow:
                "0 0 22px rgba(255,45,149,0.65), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
            aria-hidden
          >
            {/* micro-shine no botão */}
            <span
              className="pointer-events-none absolute inset-y-0 w-6"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                animation: "news-shine 3.2s ease-in-out infinite",
                animationDelay: `${(index % 3) * 0.4}s`,
              }}
            />
            <span className="relative">Ver</span>
            <Plus className="relative h-3 w-3" strokeWidth={3.2} />
          </span>
        </div>
      </button>
    </article>
  );
}
