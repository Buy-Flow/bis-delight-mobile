import { Plus, Flame, Pencil } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";
import { useIsAdmin } from "@/lib/menu-data";


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
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  return (

    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(product);
        }
      }}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-visible rounded-[22px] text-left select-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "transition-transform duration-150 ease-out will-change-transform",
        "active:scale-[.97] active:duration-75",
        "[@media(hover:hover)]:hover:-translate-y-0.5",
      )}
      style={{
        background:
          "linear-gradient(180deg, oklch(0.22 0.15 305) 0%, oklch(0.12 0.08 300) 100%)",
        boxShadow:
          "0 20px 38px -18px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* Full-bleed product image top */}
      <div className="relative h-[175px] w-full overflow-hidden rounded-t-[22px]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 30% 20%, oklch(0.42 0.24 340) 0%, oklch(0.26 0.18 315) 45%, oklch(0.14 0.09 300) 100%)",
          }}
        />
        {/* Static soft glows (lighter blur for mobile perf) */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-neon-cyan/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-neon-pink/15 blur-2xl" />

        {/* Image — subtle continuous float (GPU-only transform, safe for scroll) */}
        <div
          className={cn(
            "absolute inset-0 will-change-transform animate-product-float",
            "transition-transform duration-300 ease-out",
            "[@media(hover:hover)]:group-hover:rotate-2 [@media(hover:hover)]:group-hover:scale-[1.05]",
            "group-active:scale-[.98] group-active:duration-100",
          )}
        >
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-3 drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)]"
            style={{
              transform: `translate3d(${product.imagePosX ?? 0}%, ${product.imagePosY ?? 0}%, 0) scale(${product.imageScale ?? 1.75})`,
              transformOrigin: "center",
            }}
          />
        </div>




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
        {/* Favorite heart top-right */}
        <div className="absolute right-2 top-2 z-20">
          <FavoriteButton productId={product.id} />
        </div>


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

      {/* Content — abaixo do "papel" ondulado */}
      <div className="relative flex flex-1 flex-col px-3 pb-3 pt-3">
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

        {/* Price + compact add button */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex flex-col leading-none">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/60"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              A partir de
            </span>
            <span
              className="mt-1 text-[22px] font-black text-neon-yellow drop-shadow-[0_2px_8px_rgba(255,215,60,0.35)]"
              style={{
                fontFamily: "'Barlow Condensed', 'Poppins', sans-serif",
                letterSpacing: "0.01em",
                lineHeight: 1,
              }}
            >
              {brl(product.basePrice)}
            </span>
          </div>

          <div
            aria-label="Adicionar"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full",
              "transition-transform duration-150 ease-out will-change-transform",
              "group-active:scale-90",
            )}
            style={{
              background:
                "linear-gradient(180deg, oklch(0.78 0.26 350) 0%, oklch(0.60 0.28 350) 100%)",
              boxShadow:
                "0 8px 18px -6px oklch(0.60 0.28 350 / 0.75), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Plus className="h-5 w-5 text-white" strokeWidth={3.4} />
          </div>
        </div>

      </div>
    </div>
  );
}
