import { Plus, Star } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

const badgeStyles: Record<NonNullable<Product["badge"]>, string> = {
  Premium: "bg-neon-yellow text-[oklch(0.18_0.11_305)]",
  Novidade: "bg-neon-cyan text-[oklch(0.18_0.11_305)]",
  Favorito: "bg-neon-pink text-white",
};

export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  return (
    <button
      onClick={() => onOpen(product)}
      className="group relative flex h-full flex-col overflow-visible rounded-[26px] text-left transition active:scale-[.98]"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.26 0.17 305) 0%, oklch(0.16 0.11 305) 55%, oklch(0.10 0.06 300) 100%)",
        boxShadow:
          "0 22px 40px -18px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Corner glow accents */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-neon-pink/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-neon-cyan/20 blur-2xl" />

      {/* Badge ribbon */}
      {product.badge && (
        <div
          className={cn(
            "absolute -top-2 left-3 z-20 flex items-center gap-1 rounded-full px-2.5 py-[4px] text-[9px] font-black uppercase tracking-[0.14em] shadow-lg",
            badgeStyles[product.badge],
          )}
          style={{
            boxShadow:
              "0 6px 12px -3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          <Star className="h-[9px] w-[9px] fill-current" strokeWidth={2.5} />
          {product.badge}
        </div>
      )}

      {/* Circular photo medallion */}
      <div className="relative flex justify-center pt-5">
        <div
          className="relative h-[110px] w-[110px] overflow-hidden rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, oklch(0.42 0.24 320 / 0.9) 0%, oklch(0.18 0.13 305 / 0.6) 60%, oklch(0.12 0.08 300) 100%)",
          }}
        >
          {/* Gradient ring */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-80"
            style={{
              background:
                "conic-gradient(from 120deg, oklch(0.72 0.26 350), oklch(0.86 0.18 200), oklch(0.92 0.20 100), oklch(0.72 0.26 350))",
              WebkitMask:
                "radial-gradient(circle, transparent 46px, #000 47px, #000 53px, transparent 54px)",
              mask: "radial-gradient(circle, transparent 46px, #000 47px, #000 53px, transparent 54px)",
            }}
          />
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-[1.15] object-contain p-2 drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)] transition duration-500 group-hover:scale-125"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 flex-col px-3.5 pt-3 pb-3.5">
        <h3
          className="text-center text-[14px] font-black leading-tight text-white line-clamp-2"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif", letterSpacing: "0.02em" }}
        >
          {product.name}
        </h3>

        {/* Ingredients as micro chips */}
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {product.ingredients.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-[1px] text-[8.5px] font-medium text-white/75"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Dashed ticket divider with notches */}
        <div className="relative my-3">
          <div
            className="absolute -left-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
            style={{ background: "oklch(0.10 0.06 300)" }}
          />
          <div
            className="absolute -right-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
            style={{ background: "oklch(0.10 0.06 300)" }}
          />
          <div
            className="h-px w-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.25) 50%, transparent 50%)",
              backgroundSize: "6px 1px",
              backgroundRepeat: "repeat-x",
            }}
          />
        </div>

        {/* Price + CTA */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col leading-none">
            <span
              className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/50"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              A partir de
            </span>
            <span
              className="mt-1 text-[19px] font-black leading-none text-neon-yellow"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                textShadow: "0 2px 10px rgba(255,215,60,0.35)",
              }}
            >
              {brl(product.basePrice)}
            </span>
          </div>

          <span
            className="grid h-9 w-9 place-items-center rounded-full text-white active:scale-95"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.78 0.26 350) 0%, oklch(0.62 0.28 350) 100%)",
              boxShadow:
                "0 8px 18px -4px oklch(0.62 0.28 350 / 0.65), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={3.2} />
          </span>
        </div>
      </div>
    </button>
  );
}
