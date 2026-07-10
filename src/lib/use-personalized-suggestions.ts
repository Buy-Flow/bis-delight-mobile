import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { CartItem } from "@/lib/cart-context";
import type { Product } from "@/data/menu";

export type Suggestion = Product & { reason: string };

type UsageMap = Record<string, number>;

/**
 * Personalized upsell suggestions for the cart.
 * Signals combined:
 *  - What is currently in the cart (categories + custom açaí)
 *  - The customer's own purchase history (last 90 days)
 *  - Cart total (small carts → cheap add-ons, big carts → premium)
 *  - Time of day (morning → lighter, evening → sweeter)
 */
export function usePersonalizedSuggestions(
  items: CartItem[],
  allProducts: Product[],
  max = 6,
): Suggestion[] {
  const { user } = useAuth();
  const [history, setHistory] = useState<UsageMap>({});

  useEffect(() => {
    if (!user) {
      setHistory({});
      return;
    }
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("created_at, order_items(product_id, quantity)")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!alive) return;
      const map: UsageMap = {};
      for (const o of (data ?? []) as any[]) {
        for (const it of (o.order_items ?? []) as any[]) {
          if (!it.product_id) continue;
          map[it.product_id] = (map[it.product_id] ?? 0) + Number(it.quantity ?? 1);
        }
      }
      setHistory(map);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return useMemo(() => {
    if (!items.length || !allProducts.length) return [];

    const inCart = new Set(items.map((i) => i.productId));
    const cartCategories = new Set(
      items
        .map((i) => allProducts.find((p) => p.id === i.productId)?.category)
        .filter((c): c is string => !!c),
    );
    const cartSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const hasAcai = items.some((i) => /acai|açaí|açai/i.test(i.name));
    const hasCustom = items.some((i) => {
      const p = allProducts.find((x) => x.id === i.productId);
      return p?.isCustom;
    });
    const hasDrink = Array.from(cartCategories).some((c) =>
      /bebida|drink|suco|refri/i.test(c),
    );
    const hasDessert = Array.from(cartCategories).some((c) =>
      /sobremesa|sorvete|doce/i.test(c),
    );

    const hour = new Date().getHours();
    const isMorning = hour >= 6 && hour < 12;
    const isEvening = hour >= 18 || hour < 4;

    const candidates = allProducts.filter(
      (p) => !inCart.has(p.id) && !p.isCustom && p.active !== false && p.basePrice > 0,
    );

    // Score each candidate + attach the strongest reason.
    type Scored = { p: Product; score: number; reason: string };
    const scored: Scored[] = candidates.map((p) => {
      let score = 0;
      let reason = "Combina com seu pedido";

      // 1. Purchase history — strongest personal signal.
      const bought = history[p.id] ?? 0;
      if (bought > 0) {
        score += 100 + bought * 10;
        reason = bought >= 3 ? "Seu favorito de sempre" : "Você já pediu antes";
      }

      // 2. Category complement.
      const complementsAcai =
        hasAcai && !cartCategories.has(p.category) && /bebida|complemento|extra|topping/i.test(p.category);
      if (complementsAcai) {
        score += 55;
        reason = "Combina com açaí";
      }
      if (hasCustom && /bebida|drink|suco|refri/i.test(p.category) && !hasDrink) {
        score += 45;
        reason = "Pra acompanhar o seu açaí";
      }
      if (!hasDrink && /bebida|drink|suco|refri/i.test(p.category)) {
        score += 30;
        if (reason === "Combina com seu pedido") reason = "Faltou a bebida 🥤";
      }
      if (!hasDessert && /sobremesa|doce|sorvete/i.test(p.category) && cartSubtotal > 25) {
        score += 25;
        if (reason === "Combina com seu pedido") reason = "Fecha com uma sobremesa";
      }

      // 3. Price fit based on cart total.
      if (cartSubtotal < 25 && p.basePrice <= 12) {
        score += 20;
        if (reason === "Combina com seu pedido") reason = "Add barato pra completar";
      }
      if (cartSubtotal >= 60 && p.basePrice >= 20) {
        score += 15;
        if (reason === "Combina com seu pedido") reason = "Top pra galera";
      }

      // 4. Time of day.
      if (isEvening && /sobremesa|doce|chocolate|brigadeiro|sorvete/i.test(p.name + " " + p.category)) {
        score += 12;
        if (reason === "Combina com seu pedido") reason = "Perfeito pra noite";
      }
      if (isMorning && /fruta|granola|iogurte|light|suco/i.test(p.name + " " + p.category)) {
        score += 12;
        if (reason === "Combina com seu pedido") reason = "Pra começar leve";
      }

      // 5. Highlighted / badge products get a small nudge.
      if (p.badge) score += 5;
      if (p.hero) score += 3;

      // 6. Category diversity: prefer categories not yet in cart.
      if (!cartCategories.has(p.category)) score += 6;

      return { p, score, reason };
    });

    scored.sort((a, b) => b.score - a.score);

    // Prefer at most 2 items from the same category so the shelf feels varied.
    const perCat: Record<string, number> = {};
    const picked: Suggestion[] = [];
    for (const s of scored) {
      if (picked.length >= max) break;
      const c = s.p.category;
      if ((perCat[c] ?? 0) >= 2) continue;
      perCat[c] = (perCat[c] ?? 0) + 1;
      picked.push({ ...s.p, reason: s.reason });
    }

    // Fallback if scoring returned nothing meaningful (shouldn't happen once there are products).
    if (picked.length === 0) {
      return candidates.slice(0, max).map((p) => ({ ...p, reason: "Combina com seu pedido" }));
    }

    return picked;
  }, [allProducts, items, history]);
}
