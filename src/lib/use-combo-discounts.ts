import { useMemo } from "react";
import { useCombos, type Combo } from "@/lib/menu-data";
import type { Product } from "@/data/menu";
import type { CartItem } from "@/lib/cart-context";

export type ComboMatch = {
  combo: Combo;
  discount: number;
};

/** Returns applicable combos and the biggest total discount. */
export function useComboDiscounts(items: CartItem[], products: Product[]) {
  const { data: combos = [] } = useCombos();
  return useMemo(() => {
    if (items.length === 0 || combos.length === 0) {
      return { matches: [] as ComboMatch[], discount: 0, subtotal: 0 };
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

    const matches: ComboMatch[] = [];
    for (const c of combos) {
      const meets = c.rules.every((rule) => {
        const qty = items.reduce((sum, it) => {
          const p = productMap.get(it.productId);
          if (!p) return sum;
          if (rule.category === "any" || p.category === rule.category) {
            return sum + it.quantity;
          }
          return sum;
        }, 0);
        return qty >= rule.minQty;
      });
      if (meets) {
        const d = Math.round((subtotal * c.discountPercent) / 100 * 100) / 100;
        matches.push({ combo: c, discount: d });
      }
    }

    // Apply only the largest single combo (avoids stacking abuse)
    matches.sort((a, b) => b.discount - a.discount);
    const best = matches[0];
    return {
      matches,
      discount: best?.discount ?? 0,
      subtotal,
    };
  }, [items, combos, products]);
}
