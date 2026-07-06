import { SlidersHorizontal } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

export function HighlightCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  return (
    <div className="relative flex h-full overflow-hidden rounded-[28px] border border-white/10 bg-[oklch(0.16_0.10_305)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-neon-pink/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 right-4 h-20 w-20 rounded-full bg-neon-cyan/15 blur-2xl" />

      {/* Left image */}
      <div className="relative w-[46%] shrink-0 overflow-hidden bg-gradient-to-br from-[oklch(0.22_0.14_305)]/60 to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,oklch(0.72_0.26_350_/_0.18),transparent_70%)]" />
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-110 object-contain p-2 drop-shadow-[0_18px_18px_rgba(0,0,0,0.55)]"
        />
      </div>

      {/* Right content */}
      <div className="relative flex min-w-0 flex-1 flex-col p-4">
        <h3 className="font-display text-[22px] font-extrabold leading-[1.05] text-white line-clamp-2">
          {product.name}
        </h3>

        <p className="mt-2 text-[12.5px] leading-snug text-white/70 line-clamp-3">
          {product.ingredients.join(", ")}.
        </p>

        {/* Sizes */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.sizes.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className={cn(
                "rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/80",
              )}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="min-w-0">
            <div className="text-[8.5px] uppercase tracking-[0.2em] text-white/40">
              A partir de
            </div>
            <div className="font-display text-[20px] font-extrabold leading-none text-white">
              {brl(product.basePrice)}
            </div>
          </div>
          <button
            onClick={() => onOpen(product)}
            aria-label={`Personalizar ${product.name}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-neon-pink px-3 py-2.5 text-[11px] font-bold text-white shadow-[0_8px_20px_-4px_oklch(0.72_0.26_350/0.55)] transition active:scale-95"
          >
            Personalizar
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
