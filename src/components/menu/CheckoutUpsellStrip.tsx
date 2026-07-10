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
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {upsells.map((p) => {
          const price = p.upsellPrice ?? p.basePrice;
          const savings = p.basePrice - price;
          return (
            <button
              key={p.id}
              onClick={() => addUpsell(p)}
              className="group relative w-[140px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] text-left transition active:scale-[0.97] hover:border-neon-yellow/60"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-[oklch(0.24_0.14_305)] p-2">
                <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-contain" />
                <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-neon-yellow text-black">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                {savings > 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-neon-pink px-1.5 py-0.5 text-[9px] font-black uppercase text-white glow-pink">
                    -{brl(savings)}
                  </span>
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-[12px] font-extrabold leading-tight text-white">{p.name}</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <div className="text-[13px] font-black text-neon-yellow">{brl(price)}</div>
                  {savings > 0 && (
                    <div className="text-[10px] text-white/50 line-through">{brl(p.basePrice)}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
