import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LoyaltyTier } from "@/components/menu/TierBadge";

export type LoyaltyTierRow = {
  tier: LoyaltyTier;
  label: string;
  sort_order: number;
  min_lifetime: number;
  stamps_per_order: number;
  min_order_value: number;
  coupon_value: number;
  redeem_cost: number;
};

export function useLoyaltyTiers() {
  const [tiers, setTiers] = useState<Record<LoyaltyTier, LoyaltyTierRow> | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const { data } = await supabase
        .from("loyalty_tiers")
        .select("tier,label,sort_order,min_lifetime,stamps_per_order,min_order_value,coupon_value,redeem_cost")
        .order("sort_order");
      if (cancel || !data) return;
      const map: Record<string, LoyaltyTierRow> = {};
      for (const r of data as LoyaltyTierRow[]) {
        map[r.tier] = {
          ...r,
          min_order_value: Number(r.min_order_value),
          coupon_value: Number(r.coupon_value),
        };
      }
      setTiers(map as Record<LoyaltyTier, LoyaltyTierRow>);
    };
    load();
    const channel = supabase
      .channel("loyalty-tiers-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_tiers" }, load)
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return tiers;
}
