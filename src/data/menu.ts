// Static seed / types for the menu. Products & categories live in Supabase;
// this file only exports type definitions and a minimal BRAND fallback.

import categoryAcaiMix from "@/assets/category-acai-mix.png";
import categoryAcai from "@/assets/category-acai.png";
import categoryTaca from "@/assets/category-taca.png";
import categoryMix from "@/assets/category-mix.png";
import categoryCasquinha from "@/assets/category-casquinha.png";
import categoryShake from "@/assets/category-shake.png";
import categoryCopo from "@/assets/category-copo.png";

export const BRAND = {
  name: "Quero Bis",
  tagline: "Sorveteria & Açaí",
  city: "Ouro Preto do Oeste - RO",
  address:
    "Av. Daniel Comboni, Centro — esquina com a JK, próx. à Igreja Matriz",
  hours: "10h às 23h — todos os dias",
  whatsapp: "5569992031044",
  whatsappDisplay: "(69) 99203-1044",
  mapsUrl:
    "https://www.google.com/maps/place/Quero+Bis+Sorveteria+e+A%C3%A7a%C3%AD/@-10.7413504,-62.2395392,14z/data=!4m6!3m5!1s0x93c97d334b230b9b:0x6e0572de5f6840e3!8m2!3d-10.7184204!4d-62.2527108!16s%2Fg%2F11fjg8xrcd?entry=ttu",
  mapEmbed:
    "https://www.google.com/maps?q=Quero+Bis+Sorveteria+e+A%C3%A7a%C3%AD&ll=-10.7184204,-62.2527108&z=17&t=k&output=embed",
  deliveryFee: 5,
  texture: "/__l5e/assets-v1/e0b5a853-d7ab-4cf1-891b-668246bea494/p12-01-X4.jpg",
  logo: "/__l5e/assets-v1/c68ad104-fffa-4ab6-8cc3-468543b25791/querobis-logo.png",
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  image: string;
  icon?: string | null;
  imagePosX?: number;
  imagePosY?: number;
  imageScale?: number;
  extras?: ExtraOption[];
};

export const CATEGORIES: Category[] = [
  { id: "all", name: "Tudo", emoji: "✨", image: categoryAcaiMix },
  { id: "acai", name: "Açaí", emoji: "🍇", image: categoryAcai },
  { id: "tacas", name: "Taças", emoji: "🍨", image: categoryTaca },
  { id: "mix", name: "Mix", emoji: "🍫", image: categoryMix },
  { id: "kids", name: "Kids", emoji: "🎈", image: categoryAcaiMix },
  { id: "casquinhas", name: "Casquinhas", emoji: "🍦", image: categoryCasquinha },
  { id: "shakes", name: "Milk Shakes", emoji: "🥤", image: categoryShake },
  { id: "copos", name: "Copos", emoji: "🧋", image: categoryCopo },
];

export type SizeOption = { id: string; label: string; priceDelta: number };
export type ExtraOption = { id: string; label: string; price: number; image?: string };

/** Item dentro de um grupo de opções (produto personalizado). */
export type OptionItem = { id: string; label: string; price: number; image?: string };

/** Grupo de opções configurável para produtos personalizados. */
export type OptionGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  required?: boolean;
  freeCount?: number;
  pricePerExtra?: number;
  options: OptionItem[];
};

export type Product = {
  id: string;
  name: string;
  category: string;
  image: string;
  description: string;
  ingredients: string[];
  basePrice: number;
  sizes: SizeOption[];
  flavors?: string[];
  extras?: ExtraOption[];
  removable?: string[];
  badge?: "Premium" | "Novidade" | "Favorito";
  hero?: boolean;
  active?: boolean;
  imagePosX?: number;
  imagePosY?: number;
  imageScale?: number;
  heroImage?: string;
  heroImagePosX?: number;
  heroImagePosY?: number;
  heroImageScale?: number;
  isCustom?: boolean;
  optionGroups?: OptionGroup[];
};

/**
 * Products are served from Supabase. This static array is only a last-resort
 * fallback if the DB is empty and is intentionally empty in production.
 */
export const PRODUCTS: Product[] = [];
