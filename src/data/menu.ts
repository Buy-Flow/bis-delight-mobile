import acaiPuro from "@/assets/p11-10-X27.png.asset.json";
import acaiMix from "@/assets/p11-11-X29.png.asset.json";
import bubbleGreen from "@/assets/p11-03-X8.png.asset.json";
import bubbleMix from "@/assets/p11-04-X10.png.asset.json";
import sorveteCereja from "@/assets/p11-05-X13.png.asset.json";
import tacaRosa from "@/assets/p11-06-X15.png.asset.json";
import casquinhaMint from "@/assets/p11-07-X17.png.asset.json";
import milkOreo from "@/assets/p11-08-X21.png.asset.json";
import nutininho from "@/assets/p11-09-X25.png.asset.json";
import texturePurple from "@/assets/p12-01-X4.jpg.asset.json";
import logoAsset from "@/assets/querobis-logo.png.asset.json";

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
    "https://www.google.com/maps/search/?api=1&query=Av.+Daniel+Comboni+esquina+JK+Ouro+Preto+do+Oeste+RO",
  mapEmbed:
    "https://www.google.com/maps?q=Av.+Daniel+Comboni+esquina+JK+Ouro+Preto+do+Oeste+RO&output=embed",
  deliveryFee: 5,
  texture: texturePurple.url,
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  image: string;
};

export const CATEGORIES: Category[] = [
  { id: "all", name: "Tudo", emoji: "✨", image: acaiMix.url },
  { id: "acai", name: "Açaí", emoji: "🍇", image: acaiPuro.url },
  { id: "tacas", name: "Taças", emoji: "🍨", image: tacaRosa.url },
  { id: "mix", name: "Mix", emoji: "🍫", image: nutininho.url },
  { id: "kids", name: "Kids", emoji: "🎈", image: acaiMix.url },
  { id: "casquinhas", name: "Casquinhas", emoji: "🍦", image: casquinhaMint.url },
  { id: "shakes", name: "Milk Shakes", emoji: "🥤", image: milkOreo.url },
  { id: "copos", name: "Copos", emoji: "🧋", image: bubbleGreen.url },
];

export type SizeOption = { id: string; label: string; priceDelta: number };
export type ExtraOption = { id: string; label: string; price: number };

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
};

const SIZES_STD: SizeOption[] = [
  { id: "p", label: "300ml", priceDelta: 0 },
  { id: "m", label: "500ml", priceDelta: 6 },
  { id: "g", label: "700ml", priceDelta: 12 },
];

const SIZES_SHAKE: SizeOption[] = [
  { id: "m", label: "400ml", priceDelta: 0 },
  { id: "g", label: "600ml", priceDelta: 7 },
];

const FLAVORS = [
  "Chocolate",
  "Morango",
  "Baunilha",
  "Ninho",
  "Napolitano",
  "Menta",
  "Ovomaltine",
  "Flocos",
];

const EXTRAS_ACAI: ExtraOption[] = [
  { id: "granola", label: "Granola", price: 2 },
  { id: "leite-condensado", label: "Leite condensado", price: 3 },
  { id: "nutella", label: "Nutella", price: 5 },
  { id: "morango", label: "Morango", price: 4 },
  { id: "banana", label: "Banana", price: 3 },
  { id: "kiwi", label: "Kiwi", price: 5 },
  { id: "mm", label: "M&Ms", price: 4 },
  { id: "pacoca", label: "Paçoca", price: 3 },
  { id: "ovo", label: "Ovomaltine", price: 4 },
  { id: "coco", label: "Coco ralado", price: 2 },
];

const EXTRAS_SHAKE: ExtraOption[] = [
  { id: "nutella", label: "Nutella", price: 5 },
  { id: "oreo", label: "Oreo triturado", price: 4 },
  { id: "chantilly", label: "Chantilly", price: 3 },
  { id: "calda-choc", label: "Calda de chocolate", price: 2 },
  { id: "calda-morango", label: "Calda de morango", price: 2 },
];

export const PRODUCTS: Product[] = [
  {
    id: "acai-puro",
    name: "Açaí Puro Cremoso",
    category: "acai",
    image: acaiPuro.url,
    description: "Açaí batido na hora, denso e gelado como tem que ser.",
    ingredients: ["Polpa de açaí", "Guaraná natural", "Banana"],
    basePrice: 14,
    sizes: SIZES_STD,
    extras: EXTRAS_ACAI,
    removable: ["Banana", "Guaraná"],
    badge: "Favorito",
    hero: true,
  },
  {
    id: "acai-turbinado",
    name: "Açaí Turbinado da Casa",
    category: "acai",
    image: acaiMix.url,
    description: "Açaí + creme ninho, choco e frutas — a explosão da Quero Bis.",
    ingredients: ["Açaí", "Creme ninho", "Chocolate", "Morango", "Granola"],
    basePrice: 22,
    sizes: SIZES_STD,
    extras: EXTRAS_ACAI,
    removable: ["Granola", "Morango"],
    badge: "Premium",
    hero: true,
  },
  {
    id: "bubble-green",
    name: "Copo Bubble Neon",
    category: "copos",
    image: bubbleGreen.url,
    description: "Bubbles de tapioca, leite gelado e xarope de menta.",
    ingredients: ["Bubbles de menta", "Leite gelado", "Gelo"],
    basePrice: 16,
    sizes: SIZES_STD,
    flavors: ["Menta", "Morango", "Maracujá", "Uva"],
    extras: EXTRAS_SHAKE,
    badge: "Novidade",
  },
  {
    id: "bubble-mix",
    name: "Copo Bubble Premium",
    category: "copos",
    image: bubbleMix.url,
    description: "Camadas de bubble, creme e calda especial da casa.",
    ingredients: ["Bubbles", "Creme", "Calda especial", "Gelo"],
    basePrice: 21,
    sizes: SIZES_STD,
    flavors: ["Menta", "Morango", "Cereja", "Maracujá"],
    extras: EXTRAS_SHAKE,
    badge: "Premium",
  },
  {
    id: "taca-cereja",
    name: "Taça Cerejinha",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Sorvete cremoso com calda de morango e cereja.",
    ingredients: ["Sorvete de baunilha", "Calda de morango", "Cereja"],
    basePrice: 13,
    sizes: SIZES_STD,
    flavors: FLAVORS,
    extras: EXTRAS_ACAI,
    badge: "Novidade",
  },
  {
    id: "taca-rosa",
    name: "Taça Rosa Marshmallow",
    category: "tacas",
    image: tacaRosa.url,
    description: "Sorvete rosa, marshmallow, wafer e chuva de granulado.",
    ingredients: ["Sorvete", "Marshmallow", "Wafer", "Granulado"],
    basePrice: 18,
    sizes: SIZES_STD,
    flavors: FLAVORS,
    extras: EXTRAS_ACAI,
    badge: "Favorito",
    hero: true,
  },
  {
    id: "casquinha-mint",
    name: "Casquinha Menta & Baunilha",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Sorvete de menta e baunilha em copo com casquinha.",
    ingredients: ["Sorvete de menta", "Sorvete de baunilha", "Casquinha"],
    basePrice: 11,
    sizes: [
      { id: "u", label: "1 bola", priceDelta: 0 },
      { id: "d", label: "2 bolas", priceDelta: 4 },
      { id: "t", label: "3 bolas", priceDelta: 8 },
    ],
    flavors: FLAVORS,
  },
  {
    id: "milk-oreo",
    name: "Milk Shake Oreo",
    category: "shakes",
    image: milkOreo.url,
    description: "Shake grosso de baunilha com Oreo triturado e chantilly.",
    ingredients: ["Sorvete de baunilha", "Oreo", "Leite gelado", "Chantilly"],
    basePrice: 19,
    sizes: SIZES_SHAKE,
    extras: EXTRAS_SHAKE,
    badge: "Premium",
    hero: true,
  },
  {
    id: "nutininho",
    name: "Nutininho da Casa",
    category: "mix",
    image: nutininho.url,
    description: "Sorvete + Nutella + Ovomaltine + leite em pó no potinho.",
    ingredients: ["Sorvete", "Nutella", "Ovomaltine", "Leite em pó"],
    basePrice: 17,
    sizes: [
      { id: "p", label: "Potinho", priceDelta: 0 },
      { id: "g", label: "Pote grande", priceDelta: 8 },
    ],
    extras: EXTRAS_SHAKE,
    badge: "Favorito",
  },
  {
    id: "kids-color",
    name: "Kids Colorido",
    category: "kids",
    image: acaiMix.url,
    description: "Pote pequeno com sorvete colorido e granulado divertido.",
    ingredients: ["Sorvete", "Granulado", "Bala colorida"],
    basePrice: 10,
    sizes: [{ id: "u", label: "Único", priceDelta: 0 }],
    extras: [
      { id: "chocobola", label: "Choco bola", price: 3 },
      { id: "granulado", label: "Granulado extra", price: 2 },
      { id: "confete", label: "Confete", price: 2 },
    ],
  },
];

/* Açaí builder options (special screen) */
export const ACAI_SIZES = [
  { id: "300", label: "300ml", price: 14 },
  { id: "500", label: "500ml", price: 20 },
  { id: "700", label: "700ml", price: 26 },
  { id: "1000", label: "1 Litro", price: 36 },
];

export const ACAI_FRUITS = [
  "Morango",
  "Banana",
  "Kiwi",
  "Uva",
  "Manga",
  "Abacaxi",
];

export const ACAI_CREAMS = [
  "Creme Ninho",
  "Creme de Ovomaltine",
  "Creme de Nutella",
  "Creme de Morango",
  "Creme de Maracujá",
];

export const ACAI_EXTRAS: ExtraOption[] = [
  { id: "granola", label: "Granola", price: 2 },
  { id: "leite-condensado", label: "Leite condensado", price: 3 },
  { id: "nutella", label: "Nutella", price: 5 },
  { id: "mm", label: "M&Ms", price: 4 },
  { id: "pacoca", label: "Paçoca", price: 3 },
  { id: "ovo", label: "Ovomaltine", price: 4 },
  { id: "coco", label: "Coco ralado", price: 2 },
  { id: "amendoim", label: "Amendoim", price: 3 },
  { id: "choc-confete", label: "Choco confete", price: 4 },
  { id: "leite-po", label: "Leite em pó", price: 3 },
];
