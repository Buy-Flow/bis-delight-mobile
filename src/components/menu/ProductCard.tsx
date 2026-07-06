import { Plus, Flame } from "lucide-react";
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
      className="group relative flex h-full w-full flex-col overflow-visible rounded-[22px] text-left transition active:scale-[.98]"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.22 0.15 305) 0%, oklch(0.12 0.08 300) 100%)",
        boxShadow:
          "0 20px 38px -18px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* Full-bleed product image top */}
      <div className="relative h-[150px] w-full overflow-hidden rounded-t-[22px]">
        {/* Diagonal neon streaks */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.45 0.28 340) 0%, oklch(0.28 0.22 305) 45%, oklch(0.14 0.10 300) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0px, transparent 14px, rgba(255,255,255,0.06) 14px, rgba(255,255,255,0.06) 15px)",
          }}
        />
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-neon-cyan/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-neon-pink/40 blur-2xl" />

        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-110 object-contain p-3 drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)] transition duration-500 group-hover:scale-125 group-hover:rotate-3"
        />

        {/* Badge sticker tilted */}
        {product.badge && (
          <div
            className={cn(
              "absolute left-2 top-2 z-20 flex -rotate-6 items-center gap-1 rounded-md px-2 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] shadow-lg",
              badgeStyles[product.badge],
            )}
            style={{
              boxShadow:
                "0 6px 12px -3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Flame className="h-[10px] w-[10px] fill-current" strokeWidth={2.5} />
            {product.badge}
          </div>
        )}

        {/* Wavy divider on bottom */}
        <svg
          className="absolute -bottom-px left-0 h-4 w-full"
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 6 Q 12.5 0, 25 6 T 50 6 T 75 6 T 100 6 V 12 H 0 Z"
            fill="oklch(0.16 0.11 305)"
          />
        </svg>
      </div>

      {/* Price tag sticker — diagonal, sits on the wave */}
      <div
        className="absolute right-3 top-[122px] z-30 rotate-[6deg] rounded-lg px-2.5 py-1.5 leading-none"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.94 0.19 100) 0%, oklch(0.82 0.22 90) 100%)",
          boxShadow:
            "0 10px 20px -6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.55), 0 0 0 2px oklch(0.16 0.11 305)",
        }}
      >
        <span
          className="block text-[7px] font-bold uppercase tracking-[0.2em] text-[oklch(0.22_0.14_305)]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          desde
        </span>
        <span
          className="mt-[2px] block whitespace-nowrap text-[15px] font-black text-[oklch(0.16_0.11_305)]"
          style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
        >
          {brl(product.basePrice)}
        </span>
      </div>


      {/* Content */}
      <div className="relative flex flex-1 flex-col px-3 pb-3 pt-8">
        <h3
          className="pr-1 text-[13.5px] font-black uppercase leading-tight text-white"
          style={{
            fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
            letterSpacing: "0.03em",
          }}
        >
          {product.name}
        </h3>


        {/* Ingredients — full list, wrapped */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
          {product.ingredients.map((c, i) => (
            <span
              key={c}
              className="text-[9.5px] font-medium leading-snug text-white/70"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {c}
              {i < product.ingredients.length - 1 && (
                <span className="mx-1 text-neon-pink">•</span>
              )}
            </span>
          ))}
        </div>


        {/* Chunky floating CTA — full width */}
        <div className="mt-auto pt-3">
          <div
            className="flex items-center justify-between gap-2 rounded-full pl-3.5 pr-1 py-1"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.28 0.18 305) 0%, oklch(0.20 0.14 305) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/85"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Personalizar
            </span>
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-white transition group-hover:rotate-90"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.78 0.26 350) 0%, oklch(0.60 0.28 350) 100%)",
                boxShadow:
                  "0 6px 14px -3px oklch(0.60 0.28 350 / 0.7), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={3.2} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
