import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductBadge = {
  id: string;
  name: string;
  color: string; // any CSS color (oklch/hex/rgb)
  icon: string;
  sort_order: number;
  active: boolean;
};

async function fetchBadges(): Promise<ProductBadge[]> {
  const { data, error } = await supabase
    .from("product_badges" as never)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as unknown as ProductBadge[]) ?? [];
}

export function useProductBadges() {
  return useQuery({
    queryKey: ["product-badges"],
    queryFn: fetchBadges,
    staleTime: 60_000,
  });
}

/** Legible ink color (dark or light) for a given badge color. Falls back to dark. */
export function badgeInkFor(color: string): string {
  // Simple heuristic: yellows/cyans/light greens read best with dark ink.
  const c = color.toLowerCase();
  if (c.includes("yellow") || c.includes("cyan") || c.includes("lime")) return "oklch(0.18 0.11 305)";
  // For pinks/purples/reds use dark ink too (brand tokens are saturated); tweak per-badge if needed.
  return "oklch(0.18 0.11 305)";
}
