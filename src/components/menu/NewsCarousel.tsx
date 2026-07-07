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
      const cardW = 260 + 20; // width + gap
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
      <div className="relative mb-5 flex items-baseline gap-3 px-4">
        <h2
          className="font-display text-[36px] font-black uppercase italic leading-none text-white"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "-0.01em" }}
        >
          Nossas{" "}
          <span className="text-neon-pink drop-shadow-[0_0_10px_rgba(255,45,149,0.75)]">
            {title}
          </span>
        </h2>
        <span
          className="-rotate-[6deg] whitespace-nowrap text-xl text-neon-cyan drop-shadow-[0_0_6px_rgba(90,220,255,0.6)]"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          acabou de sair!
        </span>
      </div>

      {/* Ticker bar */}
      <div className="relative mb-4 flex items-center gap-2 overflow-hidden border-y border-white/10 bg-white/[0.03] py-1.5">
        <div className="flex shrink-0 animate-[news-marquee_22s_linear_infinite] gap-6 whitespace-nowrap pl-4 text-[10px] font-bold uppercase tracking-[0.28em] text-white/50">
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

      {/* Poster scroller */}
      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-4"
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
    <article className="group relative w-[260px] shrink-0 snap-center">
      {/* Neon glow halo */}
      <div
        aria-hidden
        className="absolute -inset-1 rounded-[30px] opacity-40 blur-xl transition-opacity group-hover:opacity-70"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.70 0.28 355 / 0.6), oklch(0.85 0.18 200 / 0.5))",
        }}
      />

      <button
        onClick={() => onOpen(product)}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-[28px] border-2 border-neon-pink/30 bg-[oklch(0.16_0.10_305)] text-left transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-neon-pink"
        style={{
          boxShadow:
            "0 26px 46px -20px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Full-bleed product image */}
        <img
          src={heroSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{
            transform: `translate(${heroPosX}%, ${heroPosY}%) scale(${heroScale})`,
            transformOrigin: "center",
          }}
        />

        {/* Grain / sparkle dots overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "24px 24px, 32px 32px",
          }}
        />

        {/* Bottom gradient scrim */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[oklch(0.10_0.08_300)] via-[oklch(0.10_0.08_300)]/40 to-transparent"
        />

        {/* Rotated badge */}
        <div className="absolute left-4 top-4 z-20">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-tight",
              badge.bg,
              badge.text,
              badge.shadow,
              badge.rotate,
            )}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <Sparkles className="h-3 w-3" strokeWidth={3} />
            {badge.label}
          </div>
        </div>

        {/* Content overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-4">
          <span
            className="text-[9.5px] font-extrabold uppercase tracking-[0.24em] text-neon-cyan drop-shadow-[0_0_6px_rgba(90,220,255,0.7)]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {eyebrow}
          </span>
          <h3
            className="text-[26px] font-black uppercase leading-[0.9] text-white line-clamp-2"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
          >
            {product.name}
          </h3>

          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/15 bg-white/10 px-2 py-[2px] text-[9px] font-semibold uppercase tracking-wide text-white/85 backdrop-blur-md"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="flex flex-col leading-none">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                A partir de
              </span>
              <span
                className="mt-1 text-[22px] font-black italic leading-none text-white"
                style={{
                  fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                  textShadow: "0 2px 12px rgba(255,45,149,0.55)",
                }}
              >
                {brl(product.basePrice)}
              </span>
            </div>

            <span
              className="grid h-11 w-11 place-items-center rounded-2xl bg-neon-pink text-white transition-transform group-hover:rotate-90 group-active:scale-95"
              style={{
                boxShadow: "0 0 18px rgba(255,45,149,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
              aria-hidden
            >
              <Plus className="h-5 w-5" strokeWidth={3.2} />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
