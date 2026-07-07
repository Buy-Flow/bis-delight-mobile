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
      const cardW = 190 + 16;
      const idx = Math.round(el.scrollLeft / cardW);
      setActiveIdx(Math.min(items.length - 1, Math.max(0, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  return (
    <section className="relative overflow-hidden pb-6 pt-4">
      {/* Ambient glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-6 h-56 w-56 rounded-full opacity-60 blur-3xl"
        style={{ background: "oklch(0.70 0.28 355 / 0.35)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full opacity-50 blur-3xl"
        style={{ background: "oklch(0.85 0.18 200 / 0.30)" }}
      />

      {/* Header — magazine style */}
      <div className="relative mb-4 flex items-baseline gap-3 px-4">
        <h2
          className="font-display text-[32px] font-black uppercase italic leading-none text-white"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "-0.01em" }}
        >
          Nossas{" "}
          <span className="text-neon-pink drop-shadow-[0_0_10px_rgba(255,45,149,0.75)]">
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

      {/* Ticker bar — soft gradient edges, no hard borders */}
      <div className="relative mb-4 overflow-hidden py-2">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent, oklch(0.20 0.12 305 / 0.5) 20%, oklch(0.20 0.12 305 / 0.5) 80%, transparent)",
          }}
        />
        <div className="relative flex items-center gap-2 overflow-hidden">
          <div className="flex shrink-0 animate-[news-marquee_22s_linear_infinite] gap-6 whitespace-nowrap pl-4 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
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

      {/* Card scroller — generous vertical padding so neon halos don't clip,
          and edge mask fades left/right for smooth continuity */}
      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-6 px-6 py-6"
        style={{
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
          maskImage:
            "linear-gradient(90deg, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
        }}
      >

        {items.map((p, i) => (
          <NewsPosterCard
            key={p.id}
            product={p}
            onOpen={onOpen}
            badge={BADGE_STYLES[i % BADGE_STYLES.length]}
            eyebrow={EYEBROWS[i % EYEBROWS.length]}
          />
        ))}
      </div>

      {/* Progress rail */}
      {items.length > 1 && (
        <div className="mt-1 flex items-center justify-center gap-2 px-4">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-[3px] rounded-full transition-all",
                i === activeIdx ? "w-8 bg-neon-pink shadow-[0_0_8px_rgba(255,45,149,0.8)]" : "w-2 bg-white/20",
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
}: {
  product: Product;
  onOpen: (p: Product) => void;
  badge: (typeof BADGE_STYLES)[number];
  eyebrow: string;
}) {
  const chips = product.ingredients.slice(0, 2);
  const heroSrc = product.heroImage || product.image;
  const heroPosX = product.heroImage ? (product.heroImagePosX ?? 0) : 0;
  const heroPosY = product.heroImage ? (product.heroImagePosY ?? 0) : 0;
  const heroScale = product.heroImage ? (product.heroImageScale ?? 1.15) : 1.15;

  return (
    <article className="group relative w-[190px] shrink-0 snap-center">
      <button
        onClick={() => onOpen(product)}
        className="relative flex w-full flex-col overflow-hidden rounded-[22px] border border-neon-pink/40 bg-[oklch(0.16_0.10_305)] text-left transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-neon-pink"
        style={{
          boxShadow:
            "0 0 0 1px oklch(0.72 0.26 350 / 0.25), 0 0 24px -4px oklch(0.72 0.26 350 / 0.55), 0 0 60px -12px oklch(0.85 0.18 200 / 0.45), 0 18px 34px -18px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Inner neon rim — sits inside the card so it never clips */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[22px]"
          style={{
            boxShadow:
              "inset 0 0 20px oklch(0.72 0.26 350 / 0.35), inset 0 0 40px oklch(0.85 0.18 200 / 0.15)",
          }}
        />

        {/* Image block on top */}
        <div className="relative aspect-square w-full overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, oklch(0.72 0.26 350 / 0.35) 0%, transparent 65%)",
            }}
          />
          <img
            src={heroSrc}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            style={{
              transform: `translate(${heroPosX}%, ${heroPosY}%) scale(${heroScale})`,
              transformOrigin: "center",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "22px 22px, 30px 30px",
            }}
          />
          <div className="absolute left-2.5 top-2.5 z-20">
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[9.5px] font-black uppercase tracking-tight",
                badge.bg,
                badge.text,
                badge.shadow,
                badge.rotate,
              )}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <Sparkles className="h-2.5 w-2.5" strokeWidth={3} />
              {badge.label}
            </div>
          </div>
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[oklch(0.16_0.10_305)] to-transparent"
          />
        </div>

        {/* Text block below */}
        <div className="flex flex-1 flex-col gap-1 p-3 pt-2">
          <span
            className="text-[8.5px] font-extrabold uppercase tracking-[0.22em] text-neon-cyan drop-shadow-[0_0_6px_rgba(90,220,255,0.6)]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {eyebrow}
          </span>
          <h3
            className="text-[17px] font-black uppercase leading-[0.95] text-white line-clamp-2"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
          >
            {product.name}
          </h3>

          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-wide text-white/75"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="flex flex-col leading-none">
              <span
                className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/55"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                A partir de
              </span>
              <span
                className="mt-0.5 text-[17px] font-black italic leading-none text-white"
                style={{
                  fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                  textShadow: "0 2px 10px rgba(255,45,149,0.5)",
                }}
              >
                {brl(product.basePrice)}
              </span>
            </div>

            <span
              className="grid h-9 w-9 place-items-center rounded-xl bg-neon-pink text-white transition-transform group-hover:rotate-90 group-active:scale-95"
              style={{
                boxShadow: "0 0 14px rgba(255,45,149,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
              aria-hidden
            >
              <Plus className="h-4 w-4" strokeWidth={3.2} />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
