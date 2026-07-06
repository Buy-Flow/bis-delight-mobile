import { ShoppingBag, Menu, MapPin } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";

export function TopBar({ onOpenCategories }: { onOpenCategories: () => void }) {
  const { count, openCart } = useCart();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.14_0.09_305)]/95 to-[oklch(0.14_0.09_305)]/70 border-b border-white/5" />
      <div className="relative flex items-center justify-between px-4 py-3">
        <button
          onClick={onOpenCategories}
          aria-label="Categorias"
          className="grid h-11 w-11 place-items-center rounded-2xl card-acai active:scale-95 transition"
        >
          <Menu className="h-5 w-5 text-neon-cyan" />
        </button>

        <div className="flex items-center gap-2">
          <div className="font-display text-2xl font-bold leading-none text-neon-yellow glow-yellow-text">
            Quero<span className="text-neon-pink">Bis</span>
          </div>
          <span className="hidden text-[10px] uppercase tracking-widest text-white/60 sm:inline">
            Sorveteria & Açaí
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#localizacao"
            aria-label="Delivery"
            className="hidden sm:grid h-11 w-11 place-items-center rounded-2xl card-acai active:scale-95 transition"
          >
            <MapPin className="h-5 w-5 text-neon-cyan" />
          </a>
          <button
            onClick={openCart}
            aria-label="Abrir carrinho"
            className="relative grid h-11 w-11 place-items-center rounded-2xl bg-neon-pink text-white glow-pink active:scale-95 transition"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-neon-yellow px-1 text-[11px] font-bold text-[oklch(0.18_0.11_305)]">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
