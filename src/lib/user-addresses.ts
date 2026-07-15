import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserAddress = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string | null;
  address: string;
  reference: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type UserAddressInput = {
  label: string;
  recipient_name?: string | null;
  address: string;
  reference?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_default?: boolean;
};

export function useUserAddresses(userId: string | undefined) {
  const [items, setItems] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    setItems((data ?? []) as UserAddress[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: UserAddressInput) => {
      if (!userId) throw new Error("not_authenticated");
      const shouldBeDefault = input.is_default ?? items.length === 0;
      const { data, error } = await supabase
        .from("user_addresses")
        .insert({
          user_id: userId,
          label: input.label.trim() || "Casa",
          recipient_name: input.recipient_name?.trim() || null,
          address: input.address.trim(),
          reference: input.reference?.trim() || null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          is_default: shouldBeDefault,
        })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data as UserAddress;
    },
    [userId, items.length, refresh],
  );

  const update = useCallback(
    async (id: string, input: Partial<UserAddressInput>) => {
      const patch: {
        label?: string;
        address?: string;
        reference?: string | null;
        lat?: number | null;
        lng?: number | null;
        is_default?: boolean;
      } = {};
      if (input.label !== undefined) patch.label = input.label.trim() || "Casa";
      if (input.address !== undefined) patch.address = input.address.trim();
      if (input.reference !== undefined) patch.reference = input.reference?.trim() || null;
      if (input.lat !== undefined) patch.lat = input.lat;
      if (input.lng !== undefined) patch.lng = input.lng;
      if (input.is_default !== undefined) patch.is_default = input.is_default;
      const { error } = await supabase.from("user_addresses").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("user_addresses").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const setDefault = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("user_addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { items, loading, refresh, create, update, remove, setDefault };
}
