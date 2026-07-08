import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { brl, useCart } from "@/lib/cart-context";
import { BRAND } from "@/data/menu";

export function CartSheet() {
  const { isCartOpen, closeCart, items, update, remove, subtotal, openCheckout } = useCart();
  if (!isCartOpen) return null;

  const total = subtotal + (items.length ? BRAND.deliveryFee : 0);

  return (
    <div className="fixed inset-0 z-50 [-webkit-tap-highlight-color:transparent]">
      <div className="absolute inset-0 bg-black/70 animate-in fade-in duration-150" onClick={closeCart} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-200 ease-out will-change-transform touch-manipulation">

        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <h3 className="font-display text-xl font-extrabold text-white">Seu carrinho</h3>
            <p className="text-[11px] text-white/60">
              {items.length ? `${items.length} item${items.length > 1 ? "s" : ""}` : "vazio"}
            </p>
          </div>
          <button onClick={closeCart} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
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
                <div key={it.uid} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[oklch(0.24_0.14_305)]">
                    <img src={it.image} alt={it.name} className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{it.name}</div>
                        <div className="text-[11px] text-white/60">
                          {[it.size, it.flavor].filter(Boolean).join(" · ")}
                        </div>
                        {it.extras.length > 0 && (
                          <div className="mt-1 text-[11px] text-neon-cyan/90 line-clamp-2">
                            + {it.extras.map((e) => e.label).join(", ")}
                          </div>
                        )}
                        {it.removed.length > 0 && (
                          <div className="text-[11px] text-neon-pink/90">
                            Sem: {it.removed.join(", ")}
                          </div>
                        )}
                        {it.note && <div className="mt-1 text-[11px] italic text-white/60">"{it.note}"</div>}
                      </div>
                      <button
                        onClick={() => remove(it.uid)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/5 text-white/60 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                        <button
                          onClick={() => update(it.uid, { quantity: Math.max(1, it.quantity - 1) })}
                          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <div className="w-6 text-center text-sm font-bold text-white">{it.quantity}</div>
                        <button
                          onClick={() => update(it.uid, { quantity: it.quantity + 1 })}
                          className="grid h-7 w-7 place-items-center rounded-full bg-neon-cyan text-[oklch(0.18_0.11_305)]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="font-display text-base font-extrabold text-neon-yellow">
                        {brl(it.unitPrice * it.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 space-y-1 text-sm">
              <Row label="Subtotal" value={brl(subtotal)} />
              <Row label="Taxa de entrega" value={brl(BRAND.deliveryFee)} muted />
              <div className="mt-2 flex items-end justify-between">
                <span className="text-[11px] uppercase tracking-widest text-white/50">Total</span>
                <span className="font-display text-2xl font-extrabold text-neon-yellow glow-yellow-text">
                  {brl(total)}
                </span>
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

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-white/60" : "text-white/80"}>{label}</span>
      <span className={muted ? "text-white/70" : "text-white font-semibold"}>{value}</span>
    </div>
  );
}
