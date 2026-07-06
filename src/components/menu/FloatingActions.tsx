import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";

export function FloatingActions() {
  const { count, openCart, subtotal } = useCart();

  const wa = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent("Olá! Vim pelo cardápio digital 🍦")}`;

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 flex flex-row-reverse items-center gap-3">
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-2xl active:scale-95 animate-pulse-glow"
      >
        <MessageCircle className="h-6 w-6" />
      </a>

      {count > 0 && (
        <button
          onClick={openCart}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl bg-neon-pink px-4 py-3 text-white glow-pink active:scale-[.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                {count} {count === 1 ? "item" : "itens"}
              </div>
              <div className="truncate text-sm font-extrabold">Ver carrinho</div>
            </div>
          </div>
          <div className="font-display text-lg font-extrabold text-neon-yellow glow-yellow-text shrink-0">
            {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </button>
      )}
    </div>
  );
}

