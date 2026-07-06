import type { Product } from "@/data/menu";

export function HighlightCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  return (
    <button
      onClick={() => onOpen(product)}
      aria-label={`Ver ${product.name}`}
      className="group relative block h-[300px] w-full overflow-hidden rounded-[32px] bg-[oklch(0.19_0.13_300)] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition active:scale-[0.98]"
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-neon-pink/15 blur-3xl" />

      {/* Image — top 60% */}
      <div className="relative h-[60%] w-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,oklch(0.72_0.26_350/0.20),transparent_70%)]" />
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Fade into base */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[oklch(0.19_0.13_300)]" />
      </div>

      {/* Floating badge — açaí bowl icon */}
      <div className="absolute left-1/2 top-[60%] z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.30_0.16_305)] ring-[3px] ring-white/70 shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-white"
            aria-hidden="true"
          >
            {/* Bowl */}
            <path d="M3.5 11h17l-1.4 6.2a3 3 0 0 1-2.93 2.3H7.83a3 3 0 0 1-2.93-2.3L3.5 11Z" />
            {/* Bowl rim */}
            <path d="M3 11h18" />
            {/* Toppings */}
            <circle cx="9" cy="8" r="1.1" />
            <circle cx="12.5" cy="6.2" r="1.1" />
            <circle cx="15.5" cy="8.2" r="1.1" />
            {/* Leaf */}
            <path d="M12 4.8c1-1.2 2.4-1.4 3.2-.6-.2 1.2-1.2 2-2.4 2" />
          </svg>
        </div>
      </div>

      {/* Bottom — name */}
      <div className="absolute inset-x-0 bottom-0 flex h-[40%] items-end justify-center px-3 pb-5">
        <h3 className="text-center font-display text-[18px] font-black uppercase leading-tight tracking-wide text-white line-clamp-2">
          {product.name}
        </h3>
      </div>
    </button>
  );
}
