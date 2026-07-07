import { Plus, Star } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";

export function HighlightCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const chips = product.ingredients.slice(0, 3);
  const heroSrc = product.heroImage || product.image;
  const heroPosX = product.heroImage ? (product.heroImagePosX ?? 0) : 0;
  const heroPosY = product.heroImage ? (product.heroImagePosY ?? 0) : 0;
  const heroScale = product.heroImage ? (product.heroImageScale ?? 1.4) : 1.4;

  return (
    <div
      className="relative flex h-full overflow-hidden rounded-[26px]"
      style={{
        background:
          "linear-gradient(155deg, oklch(0.24 0.17 305) 0%, oklch(0.14 0.10 305) 55%, oklch(0.10 0.06 300) 100%)",
        boxShadow:
          "0 22px 44px -18px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* Neon border tint */}
      <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-inset ring-neon-pink/20" />
      {/* Corner glows */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-neon-pink/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-neon-cyan/20 blur-2xl" />
      {/* Sparkle dots */}
      <div className="pointer-events-none absolute right-3 top-3 h-1 w-1 rounded-full bg-white/70" />
      <div className="pointer-events-none absolute right-8 top-6 h-[3px] w-[3px] rounded-full bg-neon-yellow/80" />
      <div className="pointer-events-none absolute left-[38%] top-4 h-1 w-1 rounded-full bg-neon-cyan/70" />

      {/* Left image with spotlight halo */}
      <div className="relative w-[44%] shrink-0 overflow-hidden">
        {/* Halo */}
        <div
          className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, oklch(0.72 0.26 350 / 0.35) 0%, transparent 60%)",
          }}
        />
        {/* Floor shine */}
        <div className="absolute inset-x-4 bottom-3 h-2 rounded-full bg-white/10 blur-md" />
        <img
          src={heroSrc}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,0.55)]"
          style={{
            transform: `translate(${heroPosX}%, ${heroPosY}%) scale(${heroScale})`,
            transformOrigin: "center",
          }}
        />


        {/* TOP badge */}
        <div
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-[3px]"
          style={{
            background: "linear-gradient(180deg, #FFF089 0%, #FFDA3D 100%)",
            boxShadow:
              "0 4px 10px -2px rgba(255,180,0,0.55), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          <Star className="h-[10px] w-[10px] fill-black text-black" strokeWidth={2.5} />
          <span
            className="text-[9px] font-black uppercase tracking-wider text-black"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Top
          </span>
        </div>
      </div>

      {/* Right content */}
      <div className="relative flex min-w-0 flex-1 flex-col p-3.5">
        <h3
          className="text-[19px] font-black leading-[1.02] text-white line-clamp-2"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "0.01em" }}
        >
          {product.name}
        </h3>

        {/* Ingredient chips */}
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-[2px] text-[9.5px] font-medium text-white/80"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="flex flex-col leading-none">
            <span
              className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-white/50"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              A partir de
            </span>
            <span
              className="mt-1 text-[22px] font-black leading-none text-neon-yellow"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                textShadow: "0 2px 10px rgba(255,215,60,0.35)",
              }}
            >
              {brl(product.basePrice)}
            </span>
          </div>

          <button
            onClick={() => onOpen(product)}
            aria-label={`Personalizar ${product.name}`}
            className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white active:scale-95 transition"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.78 0.26 350) 0%, oklch(0.62 0.28 350) 100%)",
              boxShadow:
                "0 10px 22px -6px oklch(0.62 0.28 350 / 0.65), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Plus className="h-5 w-5" strokeWidth={3.4} />
          </button>
        </div>
      </div>
    </div>
  );
}
