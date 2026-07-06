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
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6a11 11 0 0 0 5.3 1.4h.1a11 11 0 0 0 8.2-18.3zM12.3 19.9a9 9 0 0 1-4.6-1.3l-.3-.2-2.9.9.9-2.8-.2-.3a9 9 0 1 1 16.8-4.5 9 9 0 0 1-9.7 8.2zm5.2-6.7c-.3-.1-1.7-.8-1.9-.9s-.4-.1-.6.2-.7.9-.8 1-.3.2-.6 0a7.4 7.4 0 0 1-3.7-3.2c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2c0 1.3 1 2.6 1.1 2.8s2 3.1 4.8 4.3a15.8 15.8 0 0 0 1.6.6c.7.2 1.3.2 1.8.1s1.7-.7 2-1.4a1.7 1.7 0 0 0 .1-1.4c-.1-.2-.3-.2-.6-.3z" />
        </svg>

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

