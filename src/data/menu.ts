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
  texture: texturePurple.url,
  logo: logoAsset.url,
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

/**
 * Grupo de opções configurável para produtos personalizados.
 * - `single`: escolha única (ex.: Tamanho). O preço é `option.price`.
 * - `multi`: várias escolhas (ex.: Frutas, Cremes, Complementos).
 *     Preço final = soma de `option.price` dos selecionados
 *                 + max(0, qtd - freeCount) * pricePerExtra
 */
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
  /** Produto personalizado — usa `optionGroups` no lugar de sizes/extras. */
  isCustom?: boolean;
  optionGroups?: OptionGroup[];
};

/* Reusable size presets */
const SIZES_ACAI_TRAD: SizeOption[] = [
  { id: "400", label: "400ml", priceDelta: 0 },
  { id: "500", label: "500ml", priceDelta: 5 },
];
const SIZES_ACAI_MIX: SizeOption[] = [
  { id: "300", label: "300ml", priceDelta: 0 },
  { id: "400", label: "400ml", priceDelta: 3 },
  { id: "500", label: "500ml", priceDelta: 8 },
];
const SIZES_SHAKE_STD: SizeOption[] = [
  { id: "300", label: "300ml", priceDelta: 0 },
  { id: "400", label: "400ml", priceDelta: 2 },
  { id: "500", label: "500ml", priceDelta: 4 },
];
const SIZES_TACA_360_460: SizeOption[] = [
  { id: "360", label: "360ml", priceDelta: 0 },
  { id: "460", label: "460ml", priceDelta: 16 },
];
const SIZE_UNICO = (label: string): SizeOption[] => [
  { id: "u", label, priceDelta: 0 },
];

const SABORES_SORVETE = [
  "Chocolate",
  "Morango",
  "Baunilha",
  "Ninho",
  "Napolitano",
  "Flocos",
  "Ovomaltine",
  "Doce de Leite",
];

const SABORES_MILK_ESP = [
  "Açaí",
  "Pistache",
  "Banana",
  "Maracujá",
  "Menta",
  "Capuccino",
  "Flokito",
  "Leite Ninho",
  "Paçoca",
  "Dório",
  "Doce de Leite",
  "Chocotine",
];

export const PRODUCTS: Product[] = [
  /* ================== AÇAÍ TRADICIONAL ================== */
  {
    id: "acai-tradicional",
    name: "Açaí Tradicional",
    category: "acai",
    image: acaiPuro.url,
    description: "O clássico da casa — cremoso, gelado e recheado.",
    ingredients: ["Açaí", "Banana", "Neston", "Granola", "Morango", "Leite Condensado"],
    basePrice: 23,
    sizes: SIZES_ACAI_TRAD,
    badge: "Favorito",
    hero: true,
  },
  {
    id: "acai-light",
    name: "Açaí Light",
    category: "acai",
    image: acaiPuro.url,
    description: "Versão leve com frutas frescas, mel e aveia.",
    ingredients: ["Açaí", "Banana", "Mamão", "Maçã", "Mel", "Aveia"],
    basePrice: 23,
    sizes: SIZES_ACAI_TRAD,
  },
  {
    id: "acai-kids",
    name: "Açaí Kids",
    category: "acai",
    image: acaiMix.url,
    description: "Feito para a criançada: cobertura, wafer e chantilly.",
    ingredients: ["Açaí", "Cobertura de Chocolate", "Disquete", "Wafer", "Miniball", "Chantilly"],
    basePrice: 23,
    sizes: SIZES_ACAI_TRAD,
  },
  {
    id: "acai-patrao",
    name: "Açaí Patrão",
    category: "acai",
    image: acaiMix.url,
    description: "Turbinado com farinha láctea, leite em pó e condensado.",
    ingredients: ["Açaí", "Leite em Pó", "Banana", "Maçã", "Farinha Láctea", "Leite Condensado"],
    basePrice: 23,
    sizes: SIZES_ACAI_TRAD,
    badge: "Premium",
  },
  {
    id: "acai-floresta-negra",
    name: "Açaí Floresta Negra",
    category: "acai",
    image: acaiMix.url,
    description: "Açaí com cereja, chantilly e raspas de chocolate.",
    ingredients: ["Açaí", "Cereja", "Chantilly", "Morango", "Raspas de Chocolate", "Granulado"],
    basePrice: 23,
    sizes: SIZES_ACAI_TRAD,
    hero: true,
  },
  {
    id: "acai-chocolegal",
    name: "Açaí Chocolegal",
    category: "acai",
    image: acaiMix.url,
    description: "Combinação irresistível de Ovomaltine e Chocoball.",
    ingredients: ["Açaí", "Leite em Pó", "Ovomaltine", "Chocoball", "Leite Condensado", "Chantilly"],
    basePrice: 23,
    sizes: SIZES_ACAI_TRAD,
    badge: "Favorito",
  },

  /* ================== AÇAÍ MIX (Monte do seu jeito) ================== */
  {
    id: "acai-mix-monte",
    name: "Açaí Mix — Monte do seu jeito",
    category: "acai",
    image: acaiPuro.url,
    description:
      "Escolha o tamanho, as caldas e os acompanhamentos do seu jeito.",
    ingredients: ["Açaí batido na hora"],
    basePrice: 20,
    sizes: SIZES_ACAI_MIX,
    extras: [
      { id: "leite-condensado", label: "Calda Leite Condensado", price: 0 },
      { id: "creme-ninho", label: "Calda Creme de Ninho", price: 0 },
      { id: "creme-leite", label: "Calda Creme de Leite", price: 0 },
      { id: "calda-quente", label: "Calda Quente", price: 0 },
      { id: "amendoim", label: "Amendoim", price: 0 },
      { id: "ovomaltine", label: "Ovomaltine", price: 0 },
      { id: "leite-po", label: "Leite em Pó", price: 0 },
      { id: "banana", label: "Banana", price: 0 },
    ],
    hero: true,
  },

  /* ================== VITAMINAS DE AÇAÍ ================== */
  {
    id: "vintao",
    name: "Vintão",
    category: "acai",
    image: acaiPuro.url,
    description: "Vitamina energética 400ml.",
    ingredients: ["Açaí", "Leite", "Leite em Pó", "Paçoca", "Xarope de Guaraná"],
    basePrice: 20,
    sizes: SIZE_UNICO("400ml"),
  },
  {
    id: "quarentao",
    name: "Quarentão",
    category: "acai",
    image: acaiPuro.url,
    description: "Reforçado com pó de guaraná.",
    ingredients: ["Açaí", "Leite", "Leite em Pó", "Paçoca", "Pó de Guaraná", "Xarope de Guaraná"],
    basePrice: 21,
    sizes: SIZE_UNICO("400ml"),
  },
  {
    id: "sessentao",
    name: "Sessentão",
    category: "acai",
    image: acaiPuro.url,
    description: "Full power: catuaba, mirantã e mais.",
    ingredients: [
      "Açaí",
      "Leite",
      "Leite em Pó",
      "Paçoca",
      "Pó de Guaraná",
      "Xarope de Guaraná",
      "Catuaba",
      "Mirantã",
      "Nó de Cachorro",
      "Vergatez",
      "Ovo de Codorna",
    ],
    basePrice: 22,
    sizes: SIZE_UNICO("400ml"),
    badge: "Premium",
  },

  /* ================== AÇAÍ NA GARRAFINHA (Pede Bis) ================== */
  {
    id: "garrafinha-01",
    name: "Garrafinha #01",
    category: "copos",
    image: bubbleGreen.url,
    description: "Açaí prático para levar — 250ml.",
    ingredients: ["Açaí", "Creme de Amendoim", "Paçoca"],
    basePrice: 16,
    sizes: SIZE_UNICO("250ml"),
  },
  {
    id: "garrafinha-02",
    name: "Garrafinha #02",
    category: "copos",
    image: bubbleGreen.url,
    description: "Açaí com Nutella e Ovomaltine — 250ml.",
    ingredients: ["Açaí", "Nutella", "Ovomaltine"],
    basePrice: 16,
    sizes: SIZE_UNICO("250ml"),
  },
  {
    id: "garrafinha-03",
    name: "Garrafinha #03",
    category: "copos",
    image: bubbleMix.url,
    description: "Cremoso com Ninho e leite em pó — 250ml.",
    ingredients: ["Açaí", "Creme de Ninho", "Leite em Pó"],
    basePrice: 16,
    sizes: SIZE_UNICO("250ml"),
  },

  /* ================== TAÇAS COM AÇAÍ ================== */
  {
    id: "taca-casadinho-acai",
    name: "Taça Casadinho de Açaí",
    category: "tacas",
    image: tacaRosa.url,
    description: "Sorvete de açaí com recheio de Ninho e chantilly.",
    ingredients: ["Sorvete de Açaí", "Recheio de Ninho", "Chantilly"],
    basePrice: 20,
    sizes: SIZE_UNICO("360ml"),
  },
  {
    id: "mix-acaitella",
    name: "Mix Açaítella",
    category: "tacas",
    image: nutininho.url,
    description: "Açaí + Nutella cremosos com leite em pó e chantilly.",
    ingredients: ["Sorvete de Açaí", "Leite em Pó", "Nutella", "Chantilly"],
    basePrice: 19,
    sizes: SIZE_UNICO("237ml"),
  },
  {
    id: "milk-shake-acai",
    name: "Milk Shake Especial de Açaí",
    category: "shakes",
    image: milkOreo.url,
    description: "Milk shake grosso e cremoso de açaí.",
    ingredients: ["Sorvete de Açaí", "Leite"],
    basePrice: 17,
    sizes: SIZES_SHAKE_STD,
  },

  /* ================== TAÇAS ESPECIAIS (460ml) ================== */
  {
    id: "taca-ferrero-rocher",
    name: "Ferrero Rocher",
    category: "tacas",
    image: tacaRosa.url,
    description: "Bombom Ferrero, avelã, Nutella e chantilly.",
    ingredients: ["Nutella", "Amendoim", "Creme de Avelã", "Bombom Ferrero Rocher", "Chantilly"],
    basePrice: 36,
    sizes: SIZE_UNICO("460ml"),
    flavors: SABORES_SORVETE,
    badge: "Premium",
    hero: true,
  },
  {
    id: "taca-supremo-coffe",
    name: "Supremo Coffe",
    category: "tacas",
    image: tacaRosa.url,
    description: "Sorvete de cappuccino com raspas amargas.",
    ingredients: ["Cobertura de Chocolate", "Sorvete de Cappuccino", "Bombons", "Raspas de Chocolate Meio Amargo", "Chantilly"],
    basePrice: 31,
    sizes: SIZE_UNICO("460ml"),
    flavors: SABORES_SORVETE,
  },
  {
    id: "taca-kinder",
    name: "Kinder",
    category: "tacas",
    image: tacaRosa.url,
    description: "Chocolate Kinder, Nutella e recheios cremosos.",
    ingredients: ["Creme de Ninho", "Creme de Chocolate", "Nutella", "Chocolate Kinder", "Chantilly"],
    basePrice: 33,
    sizes: SIZE_UNICO("460ml"),
    flavors: SABORES_SORVETE,
    badge: "Premium",
  },
  {
    id: "taca-enamorados",
    name: "Enamorados",
    category: "tacas",
    image: tacaRosa.url,
    description: "Bombons, wafer, cereja e calda quente.",
    ingredients: ["Cobertura de Chocolate", "Bombons", "Wafer", "Cereja", "Calda Quente", "Chantilly"],
    basePrice: 25,
    sizes: SIZE_UNICO("460ml"),
    flavors: SABORES_SORVETE,
  },
  {
    id: "taca-rafaello",
    name: "Rafaello",
    category: "tacas",
    image: tacaRosa.url,
    description: "Brigadeiro branco, coco e Rafaello.",
    ingredients: ["Brigadeiro Branco", "Coco", "Bombom Rafaello", "Creme de Amêndoas", "Chantilly"],
    basePrice: 36,
    sizes: SIZE_UNICO("460ml"),
    flavors: SABORES_SORVETE,
    badge: "Premium",
  },

  /* ================== TAÇAS 360/460 ================== */
  {
    id: "taca-pudim",
    name: "Pudim",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Cookie, laka e calda de caramelo com pudim.",
    ingredients: ["Calda de Caramelo", "Cookie", "Laka", "Pudim"],
    basePrice: 20,
    sizes: SIZES_TACA_360_460,
  },
  {
    id: "taca-nuleite",
    name: "Nuleite",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Nutella + leite em pó em camadas cremosas.",
    ingredients: ["Cobertura de Chocolate", "Nutella", "Leite em Pó", "Chantilly"],
    basePrice: 20,
    sizes: SIZES_TACA_360_460,
  },

  /* ================== TAÇAS 360ml ================== */
  {
    id: "taca-sensacao",
    name: "Sensação",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Morangos frescos com leite condensado.",
    ingredients: ["Cobertura de Morango", "Leite Condensado", "Morangos", "Chantilly"],
    basePrice: 20,
    sizes: SIZE_UNICO("360ml"),
  },
  {
    id: "taca-banoffe",
    name: "Banoffe",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Banana com doce de leite e canela.",
    ingredients: ["Banana", "Canela", "Doce de Leite", "Creme de Leite", "Chantilly"],
    basePrice: 21,
    sizes: SIZE_UNICO("360ml"),
  },
  {
    id: "taca-big-sandey",
    name: "Big Sandey",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Castanha, Ovomaltine e calda quente.",
    ingredients: ["Cobertura de Chocolate", "Castanha de Caju", "Ovomaltine", "Calda Quente", "Cereja", "Chantilly"],
    basePrice: 20,
    sizes: SIZE_UNICO("360ml"),
  },
  {
    id: "taca-ostentacao",
    name: "Ostentação",
    category: "tacas",
    image: sorveteCereja.url,
    description: "Ninho, abacaxi e chocolate.",
    ingredients: ["Recheio de Ninho", "Geléia de Abacaxi", "Creme de Chocolate", "Chantilly"],
    basePrice: 20,
    sizes: SIZE_UNICO("360ml"),
  },

  /* ================== MIX E SOBREMESAS ================== */
  {
    id: "brownie-sorvete",
    name: "Brownie com Sorvete",
    category: "mix",
    image: nutininho.url,
    description: "Brownie quentinho com sorvete e calda.",
    ingredients: ["Brownie de Chocolate", "Recheio de Ninho", "Creme de Chocolate", "Morango", "Calda Quente"],
    basePrice: 29,
    sizes: SIZE_UNICO("Único"),
    flavors: SABORES_SORVETE,
    badge: "Premium",
  },
  {
    id: "canecake-kinder",
    name: "Canecake Kinder",
    category: "mix",
    image: nutininho.url,
    description: "Bolo de chocolate, Kinder e Nutella na caneca.",
    ingredients: ["Creme de Chocolate", "Bolo de Chocolate", "Recheio de Ninho", "Chocolate Kinder", "Nutella", "Chantilly"],
    basePrice: 40,
    sizes: SIZE_UNICO("360ml"),
    badge: "Premium",
    hero: true,
  },
  {
    id: "copo-felicidade",
    name: "Copo da Felicidade",
    category: "mix",
    image: bubbleMix.url,
    description: "Ninho, brigadeiro e Ovomaltine em camadas.",
    ingredients: ["Recheio de Ninho", "Brigadeiro", "Ovomaltine", "Chantilly"],
    basePrice: 20,
    sizes: SIZE_UNICO("250ml"),
    badge: "Favorito",
  },
  {
    id: "mix-moranguito",
    name: "Mix Moranguito",
    category: "mix",
    image: nutininho.url,
    description: "Geléia de morango com creme de Ninho.",
    ingredients: ["Geléia de Morango", "Creme de Ninho", "Chantilly"],
    basePrice: 19,
    sizes: SIZE_UNICO("237ml"),
  },
  {
    id: "mix-ovo-nutella",
    name: "Mix Ovomaltine + Nutella",
    category: "mix",
    image: nutininho.url,
    description: "A dupla imbatível com chantilly.",
    ingredients: ["Ovomaltine", "Nutella", "Chantilly"],
    basePrice: 19,
    sizes: SIZE_UNICO("237ml"),
  },
  {
    id: "doce-limao",
    name: "Doce de Limão",
    category: "mix",
    image: nutininho.url,
    description: "Refrescante polpa de limão com Ninho.",
    ingredients: ["Polpa de Limão", "Creme de Ninho", "Chantilly"],
    basePrice: 19,
    sizes: SIZE_UNICO("300ml"),
  },
  {
    id: "banana-caramelada",
    name: "Banana Caramelada",
    category: "mix",
    image: nutininho.url,
    description: "Banana caramelizada com crocantes.",
    ingredients: ["Calda de Banana Caramelizada", "Crocantes de Bolacha", "Chantilly"],
    basePrice: 19,
    sizes: SIZE_UNICO("300ml"),
  },
  {
    id: "toffemelo",
    name: "Toffemelo",
    category: "mix",
    image: nutininho.url,
    description: "Caramelo, fudge e pé de moleque.",
    ingredients: ["Calda de Caramelo", "Fudge", "Amendoim", "Pé de Moleque", "Chantilly"],
    basePrice: 19,
    sizes: SIZE_UNICO("300ml"),
  },

  /* ================== LINHA KIDS ================== */
  {
    id: "alegria-kids",
    name: "Alegria Kids / Kids Bis",
    category: "kids",
    image: tacaRosa.url,
    description: "Casquinha, micro ball e coberturas coloridas.",
    ingredients: ["Casquinha", "Micro Ball", "Cereliz", "Disquete", "Coberturas (Chiclete, Blue Ice, Abacaxi)", "Chantilly"],
    basePrice: 16,
    sizes: SIZE_UNICO("Único"),
    badge: "Favorito",
  },
  {
    id: "milk-shake-magic-kids",
    name: "Milk Shake Magic Kids",
    category: "kids",
    image: milkOreo.url,
    description: "Milk shake divertido feito para os pequenos.",
    ingredients: ["Sorvete", "Leite", "Cobertura colorida"],
    basePrice: 17,
    sizes: SIZES_SHAKE_STD,
  },
  {
    id: "cascao-fantasia-kids",
    name: "Cascão Fantasia Kids",
    category: "kids",
    image: casquinhaMint.url,
    description: "Cascão colorido especial para a criançada.",
    ingredients: ["Cascão", "Sorvete", "Confeitos"],
    basePrice: 16,
    sizes: SIZE_UNICO("Único"),
  },
  {
    id: "casquinha-croc-kids",
    name: "Casquinha Trufada Croc Kids",
    category: "kids",
    image: casquinhaMint.url,
    description: "Casquinha trufada mini para crianças.",
    ingredients: ["Casquinha", "Recheio Trufado"],
    basePrice: 10,
    sizes: SIZE_UNICO("Único"),
  },
  {
    id: "sandey-kids",
    name: "Sandey Kids",
    category: "kids",
    image: nutininho.url,
    description: "Sundae kids com calda e chantilly.",
    ingredients: ["Sorvete", "Calda", "Chantilly"],
    basePrice: 16,
    sizes: SIZE_UNICO("250ml"),
  },
  {
    id: "ninho-kids",
    name: "Ninho Kids",
    category: "kids",
    image: nutininho.url,
    description: "Cremoso de Ninho no copinho.",
    ingredients: ["Sorvete de Ninho", "Recheio de Ninho", "Chantilly"],
    basePrice: 16,
    sizes: SIZE_UNICO("250ml"),
  },
  {
    id: "choco-kids",
    name: "Choco Kids",
    category: "kids",
    image: nutininho.url,
    description: "Cremoso de chocolate no copinho.",
    ingredients: ["Sorvete de Chocolate", "Cobertura", "Chantilly"],
    basePrice: 16,
    sizes: SIZE_UNICO("250ml"),
  },

  /* ================== CASQUINHAS E CASCÕES ================== */
  {
    id: "casquinha-tradicional",
    name: "Casquinha Tradicional",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Casquinha clássica — escolha o adicional.",
    ingredients: ["Casquinha", "Sorvete"],
    basePrice: 8,
    sizes: [
      { id: "trad", label: "Tradicional", priceDelta: 0 },
      { id: "calda", label: "C/ Calda Quente", priceDelta: 1 },
      { id: "trufada", label: "Trufada", priceDelta: 2 },
    ],
    flavors: SABORES_SORVETE,
  },
  {
    id: "cascao-tradicional",
    name: "Cascão Tradicional",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Cascão crocante com o sabor da casa.",
    ingredients: ["Cascão", "Sorvete"],
    basePrice: 11,
    sizes: SIZE_UNICO("Único"),
    flavors: SABORES_SORVETE,
  },
  {
    id: "cascao-sonho-valsa",
    name: "Cascão Sonho de Valsa",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Cascão especial com Sonho de Valsa.",
    ingredients: ["Cascão", "Sorvete", "Sonho de Valsa"],
    basePrice: 18,
    sizes: SIZE_UNICO("Único"),
    badge: "Premium",
  },
  {
    id: "cascao-2-amores",
    name: "Cascão 2 Amores",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Cascão com Ninho e chocolate.",
    ingredients: ["Cascão", "Sorvete", "Recheio de Ninho", "Chocolate"],
    basePrice: 20,
    sizes: SIZE_UNICO("Único"),
  },
  {
    id: "cascao-ovomaltine",
    name: "Cascão Ovomaltine",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Cascão coberto com Ovomaltine.",
    ingredients: ["Cascão", "Sorvete", "Ovomaltine"],
    basePrice: 18,
    sizes: SIZE_UNICO("Único"),
  },
  {
    id: "cascao-cajuzinho",
    name: "Cascão Cajuzinho",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Cascão especial com cajuzinho.",
    ingredients: ["Cascão", "Sorvete", "Cajuzinho"],
    basePrice: 16,
    sizes: SIZE_UNICO("Único"),
  },
  {
    id: "cascao-maltella",
    name: "Cascão Maltella",
    category: "casquinhas",
    image: casquinhaMint.url,
    description: "Cascão premium com Ovomaltine + Nutella.",
    ingredients: ["Cascão", "Sorvete", "Ovomaltine", "Nutella"],
    basePrice: 25,
    sizes: SIZE_UNICO("Único"),
    badge: "Premium",
  },

  /* ================== MILK SHAKES ================== */
  {
    id: "milk-tradicional",
    name: "Milk Shake Tradicional",
    category: "shakes",
    image: milkOreo.url,
    description: "Milk shake cremoso — escolha seu sabor.",
    ingredients: ["Sorvete", "Leite"],
    basePrice: 14,
    sizes: SIZES_SHAKE_STD,
    flavors: SABORES_SORVETE,
  },
  {
    id: "milk-especial",
    name: "Milk Shake Especial",
    category: "shakes",
    image: milkOreo.url,
    description: "Sabores especiais e cremosos.",
    ingredients: ["Sorvete Especial", "Leite"],
    basePrice: 17,
    sizes: SIZES_SHAKE_STD,
    flavors: SABORES_MILK_ESP,
    badge: "Favorito",
    hero: true,
  },
  {
    id: "milk-popping",
    name: "Milk Popping",
    category: "shakes",
    image: milkOreo.url,
    description: "Shake com bolinhas de popping — surpresa a cada gole.",
    ingredients: ["Sorvete", "Leite", "Popping Balls"],
    basePrice: 19,
    sizes: SIZES_SHAKE_STD,
    badge: "Novidade",
  },
  {
    id: "milk-brownitella",
    name: "Milk Shake Brownitella",
    category: "shakes",
    image: milkOreo.url,
    description: "Shake com brownie e Nutella.",
    ingredients: ["Sorvete", "Brownie", "Nutella"],
    basePrice: 27,
    sizes: SIZE_UNICO("360ml"),
    badge: "Premium",
  },
  {
    id: "milk-nutininho",
    name: "Milk Shake Nutininho",
    category: "shakes",
    image: milkOreo.url,
    description: "Nutella + Ninho num shake supremo.",
    ingredients: ["Sorvete", "Nutella", "Creme de Ninho"],
    basePrice: 22,
    sizes: SIZE_UNICO("350ml"),
  },

  /* ================== POTES ================== */
  {
    id: "pote-acai-cremoso",
    name: "Açaí Cremoso — Pote 1L",
    category: "mix",
    image: acaiPuro.url,
    description: "Pote de 1 litro do nosso açaí cremoso.",
    ingredients: ["Açaí cremoso"],
    basePrice: 43,
    sizes: SIZE_UNICO("1 Litro"),
  },
  {
    id: "pote-sorvete",
    name: "Pote de Sorvete 1L",
    category: "mix",
    image: sorveteCereja.url,
    description: "Escolha de 2 a 8 sabores no pote de 1 litro.",
    ingredients: ["Sorvete artesanal"],
    basePrice: 40,
    sizes: SIZE_UNICO("1 Litro"),
    flavors: SABORES_SORVETE,
  },
];

/* Açaí builder options (special screen) */
export const ACAI_SIZES = [
  { id: "300", label: "300ml", price: 20 },
  { id: "400", label: "400ml", price: 23 },
  { id: "500", label: "500ml", price: 28 },
  { id: "1000", label: "1 Litro", price: 43 },
];

export const ACAI_FRUITS = [
  "Morango",
  "Banana",
  "Mamão",
  "Maçã",
  "Kiwi",
  "Uva",
  "Abacaxi",
];

export const ACAI_CREAMS = [
  "Creme de Ninho",
  "Creme de Leite",
  "Leite Condensado",
  "Calda Quente",
  "Creme de Ovomaltine",
  "Creme de Nutella",
];

export const ACAI_EXTRAS: ExtraOption[] = [
  { id: "granola", label: "Granola", price: 2 },
  { id: "leite-condensado", label: "Leite condensado", price: 3 },
  { id: "nutella", label: "Nutella", price: 5 },
  { id: "ovomaltine", label: "Ovomaltine", price: 4 },
  { id: "pacoca", label: "Paçoca", price: 3 },
  { id: "amendoim", label: "Amendoim", price: 3 },
  { id: "leite-po", label: "Leite em pó", price: 3 },
  { id: "coco", label: "Coco ralado", price: 2 },
  { id: "chocoball", label: "Chocoball", price: 4 },
  { id: "mm", label: "M&Ms", price: 4 },
];
