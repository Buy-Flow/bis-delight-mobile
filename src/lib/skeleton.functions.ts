import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  variant: z.enum(["shimmer", "pulse", "wave", "static"]).optional(),
  speed_ms: z.number().int().min(200).max(6000).optional(),
  radius_px: z.number().int().min(0).max(48).optional(),
  tone: z.enum(["auto", "light", "dark", "brand"]).optional(),
  intensity: z.number().min(0.02).max(0.4).optional(),
  tint: z.enum(["neutral", "brand", "warm", "cool"]).optional(),
  stagger_ms: z.number().int().min(0).max(400).optional(),
  on_menu: z.boolean().optional(),
  on_orders: z.boolean().optional(),
  on_admin: z.boolean().optional(),
  on_lists: z.boolean().optional(),
  on_forms: z.boolean().optional(),
  reduce_motion_respect: z.boolean().optional(),
});

export const updateSkeletonSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => patchSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("skeleton_settings")
      .update(data)
      .eq("id", "default")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
