import { Plus, Sparkles } from "lucide-react";
import { brl, useCart } from "@/lib/cart-context";
import { useProducts } from "@/lib/menu-data";
import type { Product } from "@/data/menu";

export function CheckoutUpsellStrip() {
  const { data: products = [] } = useProducts();
  const { items, add } = useCart();
  const upsells = products.filter(
    (p) =>
      p.isUpsell &&
      p.active !== false &&
      !items.some((i) => i.productId === p.id),
  );
  if (upsells.length === 0) return null;

  const addUpsell = (p: Product) => {
    const price = p.upsellPrice ?? p.basePrice;
    add({
      productId: p.id,
      name: p.name,
      image: p.image,
      extras: [],
      removed: [],
      quantity: 1,
      unitPrice: price,
    });
  };

  return (
    <div className="rounded-3xl border border-neon-yellow/30 bg-gradient-to-br from-neon-yellow/[0.08] to-neon-pink/[0.06] p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-neon-yellow/20 text-neon-yellow">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neon-yellow">
          Que tal adicionar por menos?
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {upsells.map((p) => {
          const price = p.upsellPrice ?? p.basePrice;
          const savings = p.basePrice - price;
          return (
            <button
              key={p.id}
              onClick={() => addUpsell(p)}
              className="group relative flex w-full items-center gap-3 rounded-2xl border border-dashed border-neon-yellow/50 bg-white/[0.04] p-2 pr-3 text-left transition active:scale-[0.98] hover:border-neon-yellow hover:bg-white/[0.07]"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[oklch(0.24_0.14_305)]">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="truncate text-[14px] font-extrabold leading-tight text-white">
                  + {p.name}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-black text-neon-yellow">
                    por apenas {brl(price)}
                  </span>
                  {savings > 0 && (
                    <span className="text-[10px] text-white/50 line-through">
                      {brl(p.basePrice)}
                    </span>
                  )}
                </div>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neon-yellow text-black shadow-lg shadow-neon-yellow/30">
                <Plus className="h-4 w-4" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
