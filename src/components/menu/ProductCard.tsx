import { Plus } from "lucide-react";
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
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl card-acai text-left transition active:scale-[.98]"
    >
      {product.badge && (
        <div
          className={cn(
            "absolute left-2 top-2 z-10 rounded-full px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-wider shadow",
            badgeStyles[product.badge],
          )}
        >
          {product.badge}
        </div>
      )}

      <div className="relative h-[150px] overflow-hidden">
        <div className="absolute inset-0 noise-purple opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_65%,oklch(0.86_0.18_200_/_0.18),transparent_60%)]" />
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 mx-auto h-full w-full object-contain p-3 drop-shadow-[0_18px_18px_rgba(0,0,0,0.45)] transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="font-display text-[15px] font-extrabold leading-tight text-white line-clamp-2">
          {product.name}
        </div>
        <div className="text-[11px] text-white/60 line-clamp-2">
          {product.ingredients.slice(0, 3).join(" · ")}
        </div>

        <div className="mt-auto flex items-end justify-between pt-1">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/50">
              A partir de
            </div>
            <div className="font-display text-lg font-extrabold text-neon-yellow glow-yellow-text leading-none">
              {brl(product.basePrice)}
            </div>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-neon-pink text-white glow-pink">
            <Plus className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  );
}
