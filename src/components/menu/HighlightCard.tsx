import { Plus } from "lucide-react";
import type { Product } from "@/data/menu";
import { brl } from "@/lib/cart-context";

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

      {/* Left image — narrower container, larger image */}
      <div className="relative w-[42%] shrink-0 bg-gradient-to-br from-[oklch(0.22_0.14_305)]/60 to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,oklch(0.72_0.26_350_/_0.18),transparent_70%)]" />
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-[1.75] object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.6)]"
        />
      </div>


      {/* Right content */}
      <div className="relative flex min-w-0 flex-1 flex-col p-3.5">
        <h3 className="font-display text-[20px] font-extrabold leading-[1.05] text-white line-clamp-2">
          {product.name}
        </h3>

        <p className="mt-1.5 text-[11.5px] leading-snug text-white/70 line-clamp-3">
          {product.ingredients.join(", ")}.
        </p>

        {/* Footer: cloud price + plus button */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {/* Cloud/splash price tag */}
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 140 90"
              className="h-[68px] w-[104px] drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="cloudGrad" cx="50%" cy="40%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="70%" stopColor="#f2f2f5" />
                  <stop offset="100%" stopColor="#cfcfd6" />
                </radialGradient>
              </defs>
              <path
                fill="url(#cloudGrad)"
                d="M22 44c-8-2-14-8-12-16 2-9 12-12 20-9 3-8 12-13 22-11 6 1 11 5 14 10 6-4 14-4 20 1 7 5 8 14 3 20 6 2 10 8 8 15-2 8-11 12-19 10-3 6-10 10-18 10-6 0-12-2-16-6-5 5-13 7-20 4-9-4-13-14-9-22-5-1-9-4-11-9-2-6 1-12 6-13z"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[8.5px] font-semibold uppercase tracking-wide text-[#3a1a6a]">
                A partir de
              </div>
              <div className="font-display text-[16px] font-black leading-none text-[#1a0838]">
                {brl(product.basePrice)}
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpen(product)}
            aria-label={`Personalizar ${product.name}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neon-pink text-white shadow-[0_8px_20px_-4px_oklch(0.72_0.26_350/0.6)] transition active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={3.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
