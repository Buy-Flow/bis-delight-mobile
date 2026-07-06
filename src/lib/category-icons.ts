import {
  Sparkles,
  Cherry,
  Grape,
  Apple,
  Banana,
  Citrus,
  Nut,
  Wheat,
  Leaf,
  IceCream,
  IceCream2,
  IceCreamCone,
  IceCreamBowl,
  Cake,
  CakeSlice,
  Cookie,
  Candy,
  CandyCane,
  Croissant,
  Donut,
  Popcorn,
  Coffee,
  CupSoda,
  GlassWater,
  Milk,
  Beer,
  Wine,
  Martini,
  Egg,
  Utensils,
  ChefHat,
  Star,
  Heart,
  Flame,
  Snowflake,
  Sun,
  Baby,
  PartyPopper,
  Gift,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icon library for an ice cream / açaí / dessert shop.
 * Keys are stable strings persisted in the database (`categories.icon`).
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Ice cream & desserts
  IceCream,
  IceCream2,
  IceCreamCone,
  IceCreamBowl,
  Cake,
  CakeSlice,
  Cookie,
  Candy,
  CandyCane,
  Croissant,
  Donut,
  Popcorn,
  // Drinks
  Coffee,
  CupSoda,
  GlassWater,
  Milk,
  Beer,
  Wine,
  Martini,
  // Fruits & ingredients
  Cherry,
  Grape,
  Apple,
  Banana,
  Citrus,
  Nut,
  Wheat,
  Leaf,
  Egg,
  // Extras
  ChefHat,
  Utensils,
  Sparkles,
  Star,
  Heart,
  Flame,
  Snowflake,
  Sun,
  Baby,
  PartyPopper,
  Gift,
  Trophy,
};

export const CATEGORY_ICON_LIST: { name: string; Icon: LucideIcon }[] =
  Object.entries(CATEGORY_ICONS).map(([name, Icon]) => ({ name, Icon }));

export function getCategoryIcon(name?: string | null): LucideIcon | null {
  if (!name) return null;
  return CATEGORY_ICONS[name] ?? null;
}
