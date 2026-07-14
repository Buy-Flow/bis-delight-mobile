import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS as STATIC_PRODUCTS,
  CATEGORIES as STATIC_CATEGORIES,
  BRAND as STATIC_BRAND,
  type Product,
  type Category,
  type SizeOption,
  type ExtraOption,
  type OptionGroup,
  type OptionItem,
} from "@/data/menu";
import {
  DEFAULT_DELIVERY_ZONE,
  parseDeliveryZone,
  type DeliveryZoneConfig,
} from "@/lib/delivery-zone";

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayHours = { day: WeekDay; closed: boolean; open: string; close: string };

/** Default option groups used as scaffold when the admin turns a product into "personalizado". */
export const DEFAULT_OPTION_GROUPS: OptionGroup[] = [
  {
    id: "tamanho",
    name: "Tamanho",
    type: "single",
    required: true,
    freeCount: 0,
    pricePerExtra: 0,
    options: [
      { id: "p", label: "Pequeno", price: 20 },
      { id: "m", label: "Médio", price: 25 },
      { id: "g", label: "Grande", price: 30 },
    ],
  },
];

export type SiteSettings = {
  name: string;
  tagline: string;
  city: string;
  address: string;
  hours: string;
  whatsapp: string;
  whatsappDisplay: string;
  mapsUrl: string;
  mapEmbed: string;
  deliveryFee: number;
  logo: string;
  texture: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  announcementText: string;
  announcementActive: boolean;
  pixKey: string;
  paymentMethods: string[];
  freeDeliveryThreshold: number;
  minOrder: number;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  openOverride: "auto" | "open" | "closed";
  hoursJson: DayHours[];
  newsActive: boolean;
  newsTitle: string;
  newsSubtitle: string;
  newsTicker: string;
  newsProductIds: string[];
  globalExtras: ExtraOption[];
  bgColor: string;
  accentColor: string;
  textureOpacity: number;
  textureSize: "cover" | "contain" | "small" | "medium" | "large";
  cardRadius: number;
  cardBorder: boolean;
  cardGlow: boolean;
  titleFont: string;
  heroImages: HeroImagesConfig;
  popup: PopupConfig;
  urgency: UrgencyConfig;
  storeLat: number | null;
  storeLng: number | null;
  deliveryZone: DeliveryZoneConfig;
};

export type UrgencyConfig = {
  active: boolean;
  text: string;
  endsAt: string | null;
  couponCode: string;
};

export const DEFAULT_URGENCY: UrgencyConfig = {
  active: false,
  text: "Sexta Especial acaba em",
  endsAt: null,
  couponCode: "",
};

export type PopupFrequency = "session" | "always" | "daily";
export type PopupConfig = {
  active: boolean;
  title: string;
  body: string;
  imageUrl: string;
  link: string;
  cta: string;
  imagePosX: number;
  imagePosY: number;
  imageScale: number;
  frequency: PopupFrequency;
};

export const DEFAULT_POPUP: PopupConfig = {
  active: false,
  title: "",
  body: "",
  imageUrl: "",
  link: "",
  cta: "Ver agora",
  imagePosX: 0,
  imagePosY: 0,
  imageScale: 1,
  frequency: "session",
};

export type HeroImageConfig = {
  url: string;
  offsetX: number; // px, negative = further off-screen
  offsetY: number; // px, positive = further down from bottom
  scale: number;   // 0.5 – 2
};
export type HeroImagesConfig = {
  left: HeroImageConfig;
  right: HeroImageConfig;
};

export const DEFAULT_HERO_IMAGES: HeroImagesConfig = {
  left: {
    url: "",
    offsetX: -150,
    offsetY: 0,
    scale: 1,
  },
  right: {
    url: "",
    offsetX: -150,
    offsetY: 0,
    scale: 1,
  },
};



function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    image: (row.image_url as string) || "",
    description: String(row.description ?? ""),
    ingredients: (row.ingredients as string[]) ?? [],
    basePrice: Number(row.base_price ?? 0),
    sizes: ((row.sizes as SizeOption[]) ?? []) as SizeOption[],
    flavors: (row.flavors as string[] | null) ?? undefined,
    extras: (row.extras as ExtraOption[] | null) ?? undefined,
    removable: (row.removable as string[] | null) ?? undefined,
    badge: (row.badge as Product["badge"]) ?? undefined,
    hero: Boolean(row.hero),
    active: row.active === undefined ? true : Boolean(row.active),
    imagePosX: row.image_pos_x !== undefined && row.image_pos_x !== null ? Number(row.image_pos_x) : 0,
    imagePosY: row.image_pos_y !== undefined && row.image_pos_y !== null ? Number(row.image_pos_y) : 0,
    imageScale: row.image_scale !== undefined && row.image_scale !== null ? Number(row.image_scale) : 1.1,
    heroImage: (row.hero_image_url as string) || "",
    heroImagePosX: row.hero_image_pos_x !== undefined && row.hero_image_pos_x !== null ? Number(row.hero_image_pos_x) : 0,
    heroImagePosY: row.hero_image_pos_y !== undefined && row.hero_image_pos_y !== null ? Number(row.hero_image_pos_y) : 0,
    heroImageScale: row.hero_image_scale !== undefined && row.hero_image_scale !== null ? Number(row.hero_image_scale) : 1.4,
    isCustom: Boolean(row.is_custom ?? false),
    optionGroups: normalizeOptionGroups(row.option_groups),
    isUpsell: Boolean(row.is_upsell ?? false),
    upsellPrice: row.upsell_price !== undefined && row.upsell_price !== null ? Number(row.upsell_price) : null,
    stock: row.stock !== undefined && row.stock !== null ? Number(row.stock) : null,
    lowStockThreshold: row.low_stock_threshold !== undefined && row.low_stock_threshold !== null ? Number(row.low_stock_threshold) : 5,
    pausedUntil: (row.paused_until as string | null) ?? null,
    pauseReason: (row.pause_reason as string | null) ?? null,
  };
}

function getStaticCategoryImage(id: string) {
  return STATIC_CATEGORIES.find((category) => category.id === id)?.image ?? "";
}

function rowToCategory(row: Record<string, unknown>): Category {
  const id = String(row.id);
  const rawExtras = row.extras as ExtraOption[] | null | undefined;
  return {
    id,
    name: String(row.name),
    emoji: String(row.emoji ?? "✨"),
    image: (row.image_url as string) || getStaticCategoryImage(id),
    icon: (row.icon as string | null) ?? null,
    imagePosX: row.image_pos_x !== undefined && row.image_pos_x !== null ? Number(row.image_pos_x) : 0,
    imagePosY: row.image_pos_y !== undefined && row.image_pos_y !== null ? Number(row.image_pos_y) : 0,
    imageScale: row.image_scale !== undefined && row.image_scale !== null ? Number(row.image_scale) : 1,
    extras: Array.isArray(rawExtras) ? rawExtras : [],
  };
}

function normalizeOptionGroups(raw: unknown): OptionGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((g) => {
    const r = (g && typeof g === "object" ? (g as Record<string, unknown>) : {}) as Record<string, unknown>;
    const type = r.type === "single" ? "single" : "multi";
    const opts = Array.isArray(r.options) ? (r.options as OptionItem[]) : [];
    return {
      id: String(r.id ?? uid()),
      name: String(r.name ?? ""),
      type,
      required: Boolean(r.required ?? false),
      freeCount: Number(r.freeCount ?? 0),
      pricePerExtra: Number(r.pricePerExtra ?? 0),
      options: opts.map((o) => ({
        id: String((o as Record<string, unknown>).id ?? uid()),
        label: String((o as Record<string, unknown>).label ?? ""),
        price: Number((o as Record<string, unknown>).price ?? 0),
      })),
    } satisfies OptionGroup;
  });
}

export const productsQueryOptions = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return STATIC_PRODUCTS;
    return data.map((r) => rowToProduct(r as Record<string, unknown>));
  },
  staleTime: 60_000,
});

export function useProducts() {
  return useQuery(productsQueryOptions);
}

export function useAllProducts() {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => rowToProduct(r as Record<string, unknown>));
    },
  });
}

export const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const rows =
      data && data.length > 0
        ? data.map((r) => rowToCategory(r as Record<string, unknown>))
        : STATIC_CATEGORIES.filter((c) => c.id !== "all");
    return [
      { id: "all", name: "Tudo", emoji: "✨", image: getStaticCategoryImage("all") || rows[0]?.image || "" } as Category,
      ...rows,
    ];
  },
  staleTime: 60_000,
});

export function useCategories() {
  return useQuery(categoriesQueryOptions);
}

export const DEFAULT_HOURS: DayHours[] = [
  { day: "mon", closed: false, open: "14:00", close: "22:00" },
  { day: "tue", closed: false, open: "14:00", close: "22:00" },
  { day: "wed", closed: false, open: "14:00", close: "22:00" },
  { day: "thu", closed: false, open: "14:00", close: "22:00" },
  { day: "fri", closed: false, open: "14:00", close: "23:00" },
  { day: "sat", closed: false, open: "14:00", close: "23:00" },
  { day: "sun", closed: false, open: "14:00", close: "22:00" },
];

const DEFAULT_EXTRA: Pick<
  SiteSettings,
  | "instagram"
  | "facebook"
  | "tiktok"
  | "announcementText"
  | "announcementActive"
  | "pixKey"
  | "paymentMethods"
  | "freeDeliveryThreshold"
  | "minOrder"
  | "acceptsDelivery"
  | "acceptsPickup"
  | "openOverride"
  | "hoursJson"
  | "newsActive"
  | "newsTitle"
  | "newsSubtitle"
  | "newsTicker"
  | "newsProductIds"
  | "globalExtras"
  | "bgColor"
  | "accentColor"
  | "textureOpacity"
  | "textureSize"
  | "cardRadius"
  | "cardBorder"
  | "cardGlow"
  | "titleFont"
  | "heroImages"
  | "popup"
  | "urgency"
  | "storeLat"
  | "storeLng"
  | "deliveryZone"

> = {
  instagram: "",
  facebook: "",
  tiktok: "",
  announcementText: "",
  announcementActive: false,
  pixKey: "",
  paymentMethods: ["Dinheiro", "Pix", "Cartão"],
  freeDeliveryThreshold: 0,
  minOrder: 0,
  acceptsDelivery: true,
  acceptsPickup: true,
  openOverride: "auto",
  hoursJson: DEFAULT_HOURS,
  newsActive: false,
  newsTitle: "Novidades",
  newsSubtitle: "acabou de sair!",
  newsTicker: "Lançamento fresquinho, Edição limitada, Só na Quero Bis, Novidade da semana",
  newsProductIds: [],
  globalExtras: [],
  bgColor: "#0d0322",
  accentColor: "#ffe600",
  textureOpacity: 1,
  textureSize: "cover",
  cardRadius: 24,
  cardBorder: true,
  cardGlow: false,
  titleFont: "Barlow Condensed",
  heroImages: DEFAULT_HERO_IMAGES,
  popup: DEFAULT_POPUP,
  urgency: DEFAULT_URGENCY,
  storeLat: null,
  storeLng: null,
  deliveryZone: DEFAULT_DELIVERY_ZONE,
};

function parseHeroImages(raw: unknown): HeroImagesConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_HERO_IMAGES;
  const r = raw as { left?: Partial<HeroImageConfig>; right?: Partial<HeroImageConfig> };
  const merge = (side: HeroImageConfig, patch?: Partial<HeroImageConfig>): HeroImageConfig => ({
    url: typeof patch?.url === "string" && patch.url ? patch.url : side.url,
    offsetX: Number.isFinite(patch?.offsetX as number) ? Number(patch!.offsetX) : side.offsetX,
    offsetY: Number.isFinite(patch?.offsetY as number) ? Number(patch!.offsetY) : side.offsetY,
    scale: Number.isFinite(patch?.scale as number) ? Number(patch!.scale) : side.scale,
  });
  return {
    left: merge(DEFAULT_HERO_IMAGES.left, r.left),
    right: merge(DEFAULT_HERO_IMAGES.right, r.right),
  };
}



export const siteSettingsQueryOptions = queryOptions({
  queryKey: ["site_settings"],
  queryFn: async (): Promise<SiteSettings> => {
    // site_settings_public is a view that excludes the admin-only pix_key column.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("site_settings_public" as any) as any).select("*").eq("id", 1).maybeSingle();
    if (!data) {
      return {
        name: STATIC_BRAND.name,
        tagline: STATIC_BRAND.tagline,
        city: STATIC_BRAND.city,
        address: STATIC_BRAND.address,
        hours: STATIC_BRAND.hours,
        whatsapp: STATIC_BRAND.whatsapp,
        whatsappDisplay: STATIC_BRAND.whatsappDisplay,
        mapsUrl: STATIC_BRAND.mapsUrl,
        mapEmbed: STATIC_BRAND.mapEmbed,
        deliveryFee: STATIC_BRAND.deliveryFee,
        logo: STATIC_BRAND.logo,
        texture: STATIC_BRAND.texture,
        ...DEFAULT_EXTRA,
      };
    }
    const rawHours = (data.hours_json as unknown) as DayHours[] | null;
    const rawMethods = (data.payment_methods as unknown) as string[] | null;
    const rawNewsIds = (data.news_product_ids as unknown) as string[] | null;
    const rawGlobalExtras = ((data as Record<string, unknown>).global_extras as unknown) as ExtraOption[] | null;

    const rawOverride = String(data.open_override ?? "auto");
    return {
      name: data.name || STATIC_BRAND.name,
      tagline: data.tagline || STATIC_BRAND.tagline,
      city: data.city || STATIC_BRAND.city,
      address: data.address || STATIC_BRAND.address,
      hours: data.hours || STATIC_BRAND.hours,
      whatsapp: data.whatsapp || STATIC_BRAND.whatsapp,
      whatsappDisplay: data.whatsapp_display || STATIC_BRAND.whatsappDisplay,
      mapsUrl: data.maps_url || STATIC_BRAND.mapsUrl,
      mapEmbed: data.map_embed || STATIC_BRAND.mapEmbed,
      deliveryFee: Number(data.delivery_fee ?? STATIC_BRAND.deliveryFee),
      logo: data.logo_url || STATIC_BRAND.logo,
      texture: data.texture_url || STATIC_BRAND.texture,
      instagram: String(data.instagram ?? ""),
      facebook: String(data.facebook ?? ""),
      tiktok: String(data.tiktok ?? ""),
      announcementText: String(data.announcement_text ?? ""),
      announcementActive: Boolean(data.announcement_active ?? false),
      pixKey: "",
      paymentMethods: Array.isArray(rawMethods) && rawMethods.length ? rawMethods : ["Dinheiro", "Pix", "Cartão"],
      freeDeliveryThreshold: Number(data.free_delivery_threshold ?? 0),
      minOrder: Number(data.min_order ?? 0),
      acceptsDelivery: Boolean(data.accepts_delivery ?? true),
      acceptsPickup: Boolean(data.accepts_pickup ?? true),
      openOverride: rawOverride === "open" || rawOverride === "closed" ? rawOverride : "auto",
      hoursJson: Array.isArray(rawHours) && rawHours.length ? rawHours : DEFAULT_HOURS,
      newsActive: Boolean(data.news_active ?? false),
      newsTitle: String(data.news_title ?? "Novidades"),
      newsSubtitle: String((data as Record<string, unknown>).news_subtitle ?? "acabou de sair!"),
      newsTicker: String((data as Record<string, unknown>).news_ticker ?? "Lançamento fresquinho, Edição limitada, Só na Quero Bis, Novidade da semana"),
      newsProductIds: Array.isArray(rawNewsIds) ? rawNewsIds.map(String) : [],
      globalExtras: Array.isArray(rawGlobalExtras) ? rawGlobalExtras : [],
      bgColor: String((data as Record<string, unknown>).bg_color ?? "#0d0322"),
      accentColor: String((data as Record<string, unknown>).accent_color ?? "#ffe600"),
      textureOpacity: Number((data as Record<string, unknown>).texture_opacity ?? 1),
      textureSize: (String((data as Record<string, unknown>).texture_size ?? "cover") as SiteSettings["textureSize"]),
      cardRadius: Number((data as Record<string, unknown>).card_radius ?? 24),
      cardBorder: Boolean((data as Record<string, unknown>).card_border ?? true),
      cardGlow: Boolean((data as Record<string, unknown>).card_glow ?? false),
      titleFont: String((data as Record<string, unknown>).title_font ?? "Barlow Condensed"),
      heroImages: parseHeroImages((data as Record<string, unknown>).hero_images),
      popup: {
        active: Boolean((data as Record<string, unknown>).popup_active ?? false),
        title: String((data as Record<string, unknown>).popup_title ?? ""),
        body: String((data as Record<string, unknown>).popup_body ?? ""),
        imageUrl: String((data as Record<string, unknown>).popup_image_url ?? ""),
        link: String((data as Record<string, unknown>).popup_link ?? ""),
        cta: String((data as Record<string, unknown>).popup_cta ?? "Ver agora"),
        imagePosX: Number((data as Record<string, unknown>).popup_image_pos_x ?? 0),
        imagePosY: Number((data as Record<string, unknown>).popup_image_pos_y ?? 0),
        imageScale: Number((data as Record<string, unknown>).popup_image_scale ?? 1),
        frequency: (String((data as Record<string, unknown>).popup_frequency ?? "session") as PopupFrequency),
      },
      urgency: {
        active: Boolean((data as Record<string, unknown>).urgency_active ?? false),
        text: String((data as Record<string, unknown>).urgency_text ?? "Sexta Especial acaba em"),
        endsAt: ((data as Record<string, unknown>).urgency_ends_at as string | null) ?? null,
        couponCode: String((data as Record<string, unknown>).urgency_coupon_code ?? ""),
      },
      storeLat:
        (data as Record<string, unknown>).store_lat != null
          ? Number((data as Record<string, unknown>).store_lat)
          : null,
      storeLng:
        (data as Record<string, unknown>).store_lng != null
          ? Number((data as Record<string, unknown>).store_lng)
          : null,
      deliveryZone: parseDeliveryZone((data as Record<string, unknown>).delivery_zone_json),
    };
  },
  staleTime: 60_000,
});

export function useSiteSettings() {
  return useQuery(siteSettingsQueryOptions);
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
}

export function useInvalidateMenu() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["site_settings"] });
    qc.invalidateQueries({ queryKey: ["combos"] });
  };
}

// ==================== COMBOS ====================
export type ComboRule = {
  category: string;      // category id (or "any")
  minQty: number;        // qty required
  label?: string;        // display label e.g. "3 açaí"
};

export type Combo = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rules: ComboRule[];
  discountPercent: number;
  active: boolean;
  sortOrder: number;
};

function rowToCombo(row: Record<string, unknown>): Combo {
  const rawRules = row.rules as unknown;
  const rules: ComboRule[] = Array.isArray(rawRules)
    ? rawRules.map((r) => {
        const rr = (r ?? {}) as Record<string, unknown>;
        return {
          category: String(rr.category ?? "any"),
          minQty: Number(rr.minQty ?? rr.min_qty ?? 1),
          label: rr.label ? String(rr.label) : undefined,
        };
      })
    : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    imageUrl: (row.image_url as string) ?? "",
    rules,
    discountPercent: Number(row.discount_percent ?? 0),
    active: Boolean(row.active ?? true),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export const combosQueryOptions = queryOptions({
  queryKey: ["combos"],
  queryFn: async (): Promise<Combo[]> => {
    const { data, error } = await supabase
      .from("combos" as never)
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return ((data ?? []) as Record<string, unknown>[]).map(rowToCombo);
  },
  staleTime: 60_000,
});

export function useCombos() {
  return useQuery(combosQueryOptions);
}

export function useAllCombos() {
  return useQuery({
    queryKey: ["combos", "all"],
    queryFn: async (): Promise<Combo[]> => {
      const { data, error } = await supabase
        .from("combos" as never)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map(rowToCombo);
    },
  });
}

export function useUpsertCombo() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (c: Combo) => {
      const payload = {
        id: c.id || undefined,
        name: c.name,
        description: c.description,
        image_url: c.imageUrl || null,
        rules: c.rules,
        discount_percent: c.discountPercent,
        active: c.active,
        sort_order: c.sortOrder,
      };
      const { error } = await supabase.from("combos" as never).upsert(payload as never, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCombo() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("combos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Seed DB with the initial static menu (idempotent via upsert). */
export async function seedInitialMenu() {
  const catRows = STATIC_CATEGORIES.filter((c) => c.id !== "all").map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    image_url: c.image,
    sort_order: i,
    active: true,
  }));
  const { error: catErr } = await supabase.from("categories").upsert(catRows, { onConflict: "id" });
  if (catErr) throw catErr;

  const prodRows = STATIC_PRODUCTS.map((p, i) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    image_url: p.image,
    description: p.description,
    ingredients: p.ingredients,
    base_price: p.basePrice,
    sizes: p.sizes,
    flavors: p.flavors ?? null,
    extras: p.extras ?? null,
    removable: p.removable ?? null,
    badge: p.badge ?? null,
    hero: !!p.hero,
    sort_order: i,
    active: true,
  }));
  const { error: prodErr } = await supabase.from("products").upsert(prodRows, { onConflict: "id" });
  if (prodErr) throw prodErr;

  const { error: sErr } = await supabase.from("site_settings").upsert(
    {
      id: 1,
      name: STATIC_BRAND.name,
      tagline: STATIC_BRAND.tagline,
      city: STATIC_BRAND.city,
      address: STATIC_BRAND.address,
      hours: STATIC_BRAND.hours,
      whatsapp: STATIC_BRAND.whatsapp,
      whatsapp_display: STATIC_BRAND.whatsappDisplay,
      maps_url: STATIC_BRAND.mapsUrl,
      map_embed: STATIC_BRAND.mapEmbed,
      delivery_fee: STATIC_BRAND.deliveryFee,
      logo_url: STATIC_BRAND.logo,
      texture_url: STATIC_BRAND.texture,
    },
    { onConflict: "id" },
  );
  if (sErr) throw sErr;

  return { categories: catRows.length, products: prodRows.length };
}

export type ProductInput = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  description: string;
  ingredients: string[];
  base_price: number;
  sizes: SizeOption[];
  flavors: string[] | null;
  extras: ExtraOption[] | null;
  removable: string[] | null;
  badge: string | null;
  hero: boolean;
  active?: boolean;
  sort_order?: number;
  image_pos_x?: number;
  image_pos_y?: number;
  image_scale?: number;
  is_custom?: boolean;
  option_groups?: OptionGroup[] | null;
  is_upsell?: boolean;
  upsell_price?: number | null;
  stock?: number | null;
  low_stock_threshold?: number;
  paused_until?: string | null;
  pause_reason?: string | null;
};

export function useUpsertProduct() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (p: ProductInput) => {
      const { error } = await supabase.from("products").upsert(p, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateProductExtras() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async ({ id, extras }: { id: string; extras: ExtraOption[] | null }) => {
      const { error } = await supabase
        .from("products")
        .update({ extras: extras && extras.length ? extras : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useToggleHero() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async ({ id, hero }: { id: string; hero: boolean }) => {
      const { error } = await supabase.from("products").update({ hero }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateHeroImage() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (p: {
      id: string;
      heroImage?: string | null;
      heroImagePosX?: number;
      heroImagePosY?: number;
      heroImageScale?: number;
    }) => {
      const patch: {
        hero_image_url?: string | null;
        hero_image_pos_x?: number;
        hero_image_pos_y?: number;
        hero_image_scale?: number;
      } = {};
      if (p.heroImage !== undefined) patch.hero_image_url = p.heroImage || null;
      if (p.heroImagePosX !== undefined) patch.hero_image_pos_x = p.heroImagePosX;
      if (p.heroImagePosY !== undefined) patch.hero_image_pos_y = p.heroImagePosY;
      if (p.heroImageScale !== undefined) patch.hero_image_scale = p.heroImageScale;
      const { error } = await supabase.from("products").update(patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpsertCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (c: {
      id: string;
      name: string;
      emoji: string;
      image_url: string | null;
      sort_order: number;
      active: boolean;
      image_pos_x?: number;
      image_pos_y?: number;
      image_scale?: number;
      icon?: string | null;
      extras?: ExtraOption[] | null;
    }) => {
      const { error } = await supabase.from("categories").upsert(c as never, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateSettings() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (s: SiteSettings) => {
      const { error } = await supabase.from("site_settings").upsert({
        id: 1,
        name: s.name,
        tagline: s.tagline,
        city: s.city,
        address: s.address,
        hours: s.hours,
        whatsapp: s.whatsapp,
        whatsapp_display: s.whatsappDisplay,
        maps_url: s.mapsUrl,
        map_embed: s.mapEmbed,
        delivery_fee: s.deliveryFee,
        logo_url: s.logo,
        texture_url: s.texture,
        instagram: s.instagram,
        facebook: s.facebook,
        tiktok: s.tiktok,
        announcement_text: s.announcementText,
        announcement_active: s.announcementActive,
        // pix_key is admin-restricted; set via RPC below
        payment_methods: s.paymentMethods,
        free_delivery_threshold: s.freeDeliveryThreshold,
        min_order: s.minOrder,
        accepts_delivery: s.acceptsDelivery,
        accepts_pickup: s.acceptsPickup,
        open_override: s.openOverride,
        hours_json: s.hoursJson,
        news_active: s.newsActive,
        news_title: s.newsTitle,
        news_subtitle: s.newsSubtitle,
        news_ticker: s.newsTicker,
        news_product_ids: s.newsProductIds,
        global_extras: s.globalExtras,
        bg_color: s.bgColor,
        accent_color: s.accentColor,
        texture_opacity: s.textureOpacity,
        texture_size: s.textureSize,
        card_radius: s.cardRadius,
        card_border: s.cardBorder,
        card_glow: s.cardGlow,
        title_font: s.titleFont,
        hero_images: s.heroImages,
        popup_active: s.popup.active,
        popup_title: s.popup.title,
        popup_body: s.popup.body,
        popup_image_url: s.popup.imageUrl,
        popup_link: s.popup.link,
        popup_cta: s.popup.cta,
        popup_image_pos_x: s.popup.imagePosX,
        popup_image_pos_y: s.popup.imagePosY,
        popup_image_scale: s.popup.imageScale,
        popup_frequency: s.popup.frequency,
        urgency_active: s.urgency.active,
        urgency_text: s.urgency.text,
        urgency_ends_at: s.urgency.endsAt,
        urgency_coupon_code: s.urgency.couponCode,
        store_lat: s.storeLat,
        store_lng: s.storeLng,
        delivery_zone_json: s.deliveryZone,
      }, { onConflict: "id" });
      if (error) throw error;
      // Persist PIX key via admin-only RPC (RLS-enforced)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: pixErr } = await (supabase.rpc as any)("set_pix_key", { _val: s.pixKey ?? "" });
      if (pixErr) throw pixErr;
    },
    onSuccess: invalidate,
  });
}

export function useReorderProducts() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      await Promise.all(
        items.map((it) =>
          supabase.from("products").update({ sort_order: it.sort_order }).eq("id", it.id),
        ),
      );
    },
    onSuccess: invalidate,
  });
}

export function useReorderCategories() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      await Promise.all(
        items.map((it) =>
          supabase.from("categories").update({ sort_order: it.sort_order }).eq("id", it.id),
        ),
      );
    },
    onSuccess: invalidate,
  });
}

export function useToggleProductActive() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function usePauseProduct() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: async ({
      id,
      pausedUntil,
      reason,
    }: {
      id: string;
      pausedUntil: string | null; // ISO string; null = resume
      reason?: string | null;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({
          paused_until: pausedUntil,
          pause_reason: pausedUntil ? (reason ?? null) : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Returns whether a product is currently paused (paused_until in the future). */
export function isProductPaused(p: { pausedUntil?: string | null }): boolean {
  if (!p.pausedUntil) return false;
  const t = Date.parse(p.pausedUntil);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

/** Sentinel far-future date used for "indefinite" pauses. */
export const PAUSE_INDEFINITE_ISO = "2999-12-31T23:59:59.000Z";
export function isIndefinitePause(iso?: string | null): boolean {
  if (!iso) return false;
  return Date.parse(iso) > Date.parse("2999-01-01T00:00:00.000Z");
}

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  // Bucket is private (workspace blocks public buckets), so use a long-lived signed URL.
  const { data, error: signErr } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL da imagem");
  return data.signedUrl;
}

