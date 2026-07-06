import { SlidersHorizontal } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

const badgeStyles: Record<NonNullable<Product["badge"]>, string> = {
  Premium: "bg-neon-yellow text-[oklch(0.18_0.11_305)]",
  Novidade: "bg-neon-cyan text-[oklch(0.18_0.11_305)]",
  Favorito: "bg-neon-pink text-white",
};

export function HighlightCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  return (
    <div className="card-acai relative flex h-full overflow-hidden rounded-3xl ring-1 ring-white/10">
      {product.badge && (
        <div
          className={cn(
            "absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow",
            badgeStyles[product.badge],
          )}
        >
          {product.badge}
        </div>
      )}

      {/* Left image */}
      <div className="relative w-[52%] shrink-0 overflow-hidden">
        <div className="absolute inset-0 noise-purple opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_55%,oklch(0.86_0.18_200_/_0.20),transparent_65%)]" />
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-110 object-contain p-1 drop-shadow-[0_18px_18px_rgba(0,0,0,0.5)]"
        />
      </div>


      {/* Right content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-[20px] font-extrabold leading-tight text-neon-yellow glow-yellow-text line-clamp-2">
          {product.name}
        </h3>
        <p className="text-[12px] leading-snug text-white/75 line-clamp-3">
          {product.ingredients.join(", ")}.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {product.sizes.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-white/80"
            >
              {s.label}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-white/50">
              A partir de
            </div>
            <div className="font-display text-xl font-extrabold leading-none text-neon-yellow glow-yellow-text">
              {brl(product.basePrice)}
            </div>
          </div>
          <button
            onClick={() => onOpen(product)}
            className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-2 text-[11px] font-bold text-white glow-pink active:scale-95"
          >
            Personalizar
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
