import { useEffect, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

const BADGE_STYLES = [
  { bg: "bg-neon-cyan", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.55_0.20_200)]", rotate: "-rotate-[5deg]", label: "Novo" },
  { bg: "bg-neon-yellow", text: "text-[oklch(0.18_0.11_305)]", shadow: "shadow-[0_4px_0_0_oklch(0.65_0.18_90)]", rotate: "rotate-[4deg]", label: "Top" },
  { bg: "bg-neon-pink", text: "text-white", shadow: "shadow-[0_4px_0_0_oklch(0.45_0.24_355)]", rotate: "-rotate-[3deg]", label: "Hit" },
];

const EYEBROWS = ["Edição Limitada", "Artesanal", "Recém-chegado", "Sabor do mês"];

export function NewsCarousel({
  items,
  onOpen,
  title = "Novidades",
}: {
  items: Product[];
  onOpen: (p: Product) => void;
  title?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.getBoundingClientRect().width + 20;
      const idx = Math.round(el.scrollLeft / step);
      setActiveIdx(Math.min(items.length - 1, Math.max(0, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  return (
    <section className="relative isolate overflow-visible py-8">
      {/* Full-bleed background band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.14 0.11 305 / 0) 0%, oklch(0.18 0.14 305 / 0.85) 12%, oklch(0.20 0.16 320 / 0.9) 50%, oklch(0.18 0.14 305 / 0.85) 88%, oklch(0.14 0.11 305 / 0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, oklch(0.72 0.26 350 / 0.55), transparent 45%), radial-gradient(circle at 85% 80%, oklch(0.85 0.18 200 / 0.45), transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.72 0.26 350 / 0.7), oklch(0.85 0.18 200 / 0.7), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.85 0.18 200 / 0.6), oklch(0.72 0.26 350 / 0.6), transparent)",
        }}
      />

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
        <span
          className="-rotate-[6deg] whitespace-nowrap text-lg text-neon-cyan drop-shadow-[0_0_6px_rgba(90,220,255,0.6)]"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          acabou de sair!
        </span>
      </div>

      {/* Ticker bar */}
      <div className="relative mb-4 overflow-hidden py-2">
        <div className="relative flex items-center gap-2 overflow-hidden">
          <div className="flex shrink-0 animate-[news-marquee_22s_linear_infinite] gap-6 whitespace-nowrap pl-5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
            {Array.from({ length: 2 }).map((_, r) => (
              <span key={r} className="flex items-center gap-6">
                <Sparkles className="h-3 w-3 text-neon-yellow" />
                Lançamento fresquinho
                <span className="h-1 w-1 rounded-full bg-neon-pink" />
                Edição limitada
                <span className="h-1 w-1 rounded-full bg-neon-cyan" />
                Só na Quero Bis
                <span className="h-1 w-1 rounded-full bg-neon-yellow" />
                Novidade da semana
                <span className="h-1 w-1 rounded-full bg-neon-pink" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Card scroller — edge-to-edge, cards ocupam quase toda a tela */}
      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-5 px-5 py-6"
      >
        {items.map((p, i) => (
          <NewsPosterCard
            key={p.id}
            product={p}
            onOpen={onOpen}
            badge={BADGE_STYLES[i % BADGE_STYLES.length]}
            eyebrow={EYEBROWS[i % EYEBROWS.length]}
            index={i}
          />
        ))}
      </div>

      {/* Progress rail */}
      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2 px-4">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-[3px] rounded-full transition-all",
                i === activeIdx ? "w-10 bg-neon-pink shadow-[0_0_10px_rgba(255,45,149,0.9)]" : "w-2 bg-white/25",
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

function NewsPosterCard({
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
  const heroPosX = product.heroImage ? (product.heroImagePosX ?? 0) : 0;
  const heroPosY = product.heroImage ? (product.heroImagePosY ?? -8) : -8;
  const heroScale = product.heroImage ? (product.heroImageScale ?? 1.2) : 1.2;
  const issueNo = String(index + 1).padStart(2, "0");
  const now = new Date();
  const monthLabel = now
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "")
    .toUpperCase();
  // Split product name so we can stack it dramatically across two lines
  const words = product.name.trim().split(/\s+/);
  const topLine = words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
  const bottomLine = words.slice(Math.ceil(words.length / 2)).join(" ");

  return (
    <article className="group relative w-[85vw] max-w-[380px] shrink-0 snap-center">
      <button
        onClick={() => onOpen(product)}
        className="relative flex aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-[oklch(0.12_0.10_305)] text-left transition-transform duration-300 group-hover:-translate-y-1"
        style={{
          boxShadow:
            "0 0 0 1px oklch(0.72 0.26 350 / 0.35), 0 0 22px -4px oklch(0.72 0.26 350 / 0.55), 0 0 60px -18px oklch(0.85 0.18 200 / 0.55), 0 24px 40px -20px rgba(0,0,0,0.8)",
        }}
      >
        {/* Full-bleed hero */}
        <img
          src={heroSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          style={{
            transform: `translate(${heroPosX}%, ${heroPosY}%) scale(${heroScale})`,
            transformOrigin: "center",
          }}
        />

        {/* Editorial gradient wash — dark at top and bottom for legibility */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.08 0.10 305 / 0.85) 0%, oklch(0.08 0.10 305 / 0.15) 28%, oklch(0.08 0.10 305 / 0.15) 45%, oklch(0.08 0.10 305 / 0.85) 88%, oklch(0.08 0.10 305 / 0.95) 100%)",
          }}
        />

        {/* Halftone dot texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.55) 1px, transparent 1.5px)",
            backgroundSize: "8px 8px",
          }}
        />

        {/* Neon rim inside so it never clips */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[26px]"
          style={{
            boxShadow:
              "inset 0 0 0 1px oklch(0.72 0.26 350 / 0.45), inset 0 0 30px oklch(0.72 0.26 350 / 0.28), inset 0 0 60px oklch(0.85 0.18 200 / 0.12)",
          }}
        />

        {/* Diagonal ribbon */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 top-8 z-20 rotate-45"
        >
          <div
            className={cn(
              "px-16 py-1.5 text-[10px] font-black uppercase tracking-[0.35em]",
              badge.bg,
              badge.text,
            )}
            style={{
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
            }}
          >
            {badge.label}
          </div>
        </div>

        {/* Masthead */}
        <div className="relative z-10 flex w-full flex-col justify-between p-5">
          <header className="flex items-start justify-between gap-3">
            <div className="flex flex-col leading-none">
              <span
                className="text-[10px] font-black uppercase tracking-[0.3em] text-white/90"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Quero Bis
              </span>
              <span
                className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-neon-cyan"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {monthLabel} · {eyebrow}
              </span>
            </div>
          </header>


          {/* Cover title — massive stacked type at the bottom */}
          <div className="mt-auto">
            <h3
              className="text-white"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                fontWeight: 900,
                fontStyle: "italic",
                lineHeight: 0.82,
                letterSpacing: "-0.02em",
                textShadow: "0 4px 24px rgba(0,0,0,0.6)",
              }}
            >
              <span className="block text-[46px] uppercase">{topLine}</span>
              {bottomLine && (
                <span
                  className="mt-0.5 block text-[46px] uppercase text-neon-pink"
                  style={{ textShadow: "0 0 18px rgba(255,45,149,0.7)" }}
                >
                  {bottomLine}
                </span>
              )}
            </h3>

            {/* Barcode-esque divider */}
            <div className="mt-3 flex h-4 items-end gap-[2px] opacity-80">
              {Array.from({ length: 28 }).map((_, k) => (
                <span
                  key={k}
                  className="block bg-white/80"
                  style={{
                    width: k % 5 === 0 ? 2 : 1,
                    height: `${40 + ((k * 37) % 60)}%`,
                  }}
                />
              ))}
            </div>

            {/* Price + CTA */}
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="flex flex-col leading-none">
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/70"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Capa · a partir de
                </span>
                <span
                  className="mt-1 text-[30px] font-black italic leading-none text-white"
                  style={{
                    fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                    textShadow: "0 2px 14px rgba(255,45,149,0.6)",
                  }}
                >
                  {brl(product.basePrice)}
                </span>
              </div>

              <span
                className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-transform group-hover:scale-105 group-active:scale-95"
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  boxShadow:
                    "0 0 18px rgba(255,45,149,0.65), inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
                aria-hidden
              >
                Ler capa
                <Plus className="h-3.5 w-3.5" strokeWidth={3.2} />
              </span>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}
