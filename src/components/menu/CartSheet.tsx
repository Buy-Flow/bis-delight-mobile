import { X, Plus, Minus, ShoppingBag, Pencil, Heart, Sparkles, Receipt, Bike, ArrowRight } from "lucide-react";
import { brl, useCart } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";

export function CartSheet() {
  const { isCartOpen, closeCart, items, update, subtotal, openCheckout, openEdit } = useCart();
  if (!isCartOpen) return null;

  const total = subtotal + (items.length ? BRAND.deliveryFee : 0);

  return (
    <div className="fixed inset-0 z-50 [-webkit-tap-highlight-color:transparent]">
      <div className="absolute inset-0 bg-black/70 animate-in fade-in duration-150" onClick={closeCart} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-200 ease-out will-change-transform touch-manipulation">

        {/* Header */}
        <div className="relative flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3
                className="font-display text-[30px] font-extrabold leading-none text-white"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Seu <span className="text-neon-yellow glow-yellow-text">carrinho</span>
              </h3>
              <Heart className="h-5 w-5 fill-neon-pink text-neon-pink" />
              <Sparkles className="h-4 w-4 text-neon-yellow" />
            </div>
            {/* Underline swash */}
            <svg viewBox="0 0 160 10" className="mt-1 h-2 w-[140px]" fill="none" aria-hidden="true">
              <path d="M2 6 C 40 1, 90 10, 158 3" stroke="oklch(0.72 0.26 350)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-neon-yellow/15 ring-1 ring-neon-yellow/40">
              <ShoppingBag className="h-5 w-5 text-neon-yellow" />
            </div>
            <button onClick={closeCart} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5">
                <ShoppingBag className="h-7 w-7 text-neon-cyan" />
              </div>
              <div className="font-display text-xl text-white">Nada por aqui ainda</div>
              <p className="max-w-[220px] text-sm text-white/60">
                Escolha um dos nossos sabores e monte seu pedido.
              </p>
              <button
                onClick={closeCart}
                className="mt-2 rounded-full bg-neon-pink px-5 py-2 text-sm font-bold text-white glow-pink"
              >
                Ver cardápio
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div
                  key={it.uid}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(it)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEdit(it);
                    }
                  }}
                  className="relative flex cursor-pointer gap-3 rounded-2xl border border-white/10 bg-[oklch(0.18_0.11_305)]/80 p-3 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)] transition active:scale-[0.99] hover:border-white/20"
                >
                  {/* Image */}
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[oklch(0.24_0.14_305)] ring-1 ring-white/10">
                    <img src={it.image} alt={it.name} className="h-full w-full object-contain p-1" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pr-1">
                        <div className="truncate text-[17px] font-extrabold leading-tight text-white">{it.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/60">
                          {[it.size, it.flavor, ...it.extras.map((e) => e.label)].filter(Boolean).join(", ") || "—"}
                        </div>
                        {it.removed.length > 0 && (
                          <div className="mt-0.5 text-[11px] text-neon-pink/90">Sem: {it.removed.join(", ")}</div>
                        )}
                        {it.note && <div className="mt-0.5 text-[11px] italic text-white/50">"{it.note}"</div>}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(it);
                        }}
                        aria-label="Editar item"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 active:scale-95"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <div className="font-display text-lg font-extrabold text-neon-yellow">
                        {brl(it.unitPrice * it.quantity)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            update(it.uid, { quantity: Math.max(1, it.quantity - 1) });
                          }}
                          aria-label="Diminuir"
                          className="grid h-8 w-8 place-items-center rounded-full bg-neon-pink/90 text-white glow-pink active:scale-95"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-5 text-center text-base font-extrabold text-white">{it.quantity}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            update(it.uid, { quantity: it.quantity + 1 });
                          }}
                          aria-label="Aumentar"
                          className="grid h-8 w-8 place-items-center rounded-full bg-neon-pink text-white glow-pink active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add more items */}
              <button
                onClick={closeCart}
                className="relative flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neon-pink/60 bg-neon-pink/5 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.99] hover:bg-neon-pink/10"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-neon-pink text-white">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                Adicionar mais itens
                <ArrowRight className="absolute right-4 h-4 w-4 -rotate-12 text-neon-pink/80" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <SummaryRow icon={<Receipt className="h-4 w-4 text-neon-cyan" />} label="Subtotal" value={brl(subtotal)} />
              <SummaryRow icon={<Bike className="h-4 w-4 text-neon-pink" />} label="Entrega" value={brl(BRAND.deliveryFee)} />
            </div>
            <div className="mb-3 flex items-end justify-between px-1">
              <span
                className="font-display text-2xl font-extrabold text-white"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Total
              </span>
              <div className="flex flex-col items-end">
                <span className="font-display text-3xl font-extrabold text-neon-yellow glow-yellow-text">
                  {brl(total)}
                </span>
                <svg viewBox="0 0 120 8" className="h-2 w-[110px]" fill="none" aria-hidden="true">
                  <path d="M2 5 C 30 1, 80 8, 118 3" stroke="oklch(0.72 0.26 350)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <button
              onClick={openCheckout}
              className="w-full rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98]"
            >
              Continuar para finalização
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-white/80">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/5">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
