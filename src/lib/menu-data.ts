import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS as STATIC_PRODUCTS,
  CATEGORIES as STATIC_CATEGORIES,
  BRAND as STATIC_BRAND,
  type Product,
  type Category,
  type SizeOption,
  type ExtraOption,
} from "@/data/menu";

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
  };
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    emoji: String(row.emoji ?? "✨"),
    image: (row.image_url as string) || "",
    imagePosX: row.image_pos_x !== undefined && row.image_pos_x !== null ? Number(row.image_pos_x) : 0,
    imagePosY: row.image_pos_y !== undefined && row.image_pos_y !== null ? Number(row.image_pos_y) : 0,
    imageScale: row.image_scale !== undefined && row.image_scale !== null ? Number(row.image_scale) : 1,
  };
}

export function useProducts() {
  return useQuery({
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
  });
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

export function useCategories() {
  return useQuery({
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
        { id: "all", name: "Tudo", emoji: "✨", image: rows[0]?.image ?? "" } as Category,
        ...rows,
      ];
    },
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site_settings"],
    queryFn: async (): Promise<SiteSettings> => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
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
        };
      }
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
      };
    },
  });
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
  };
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
    }) => {
      const { error } = await supabase.from("categories").upsert(c, { onConflict: "id" });
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
      const { error } = await supabase.from("site_settings").update({
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
      }).eq("id", 1);
      if (error) throw error;
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

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
