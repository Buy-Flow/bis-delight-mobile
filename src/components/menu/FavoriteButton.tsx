import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

// simple in-memory cache so we don't re-query every card mount
let cache: Set<string> | null = null;
let loadedForUser: string | null = null;
let loadingPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function loadFavorites(userId: string) {
  if (loadedForUser === userId) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", userId);
    cache = new Set((data ?? []).map((r) => r.product_id as string));
    loadedForUser = userId;
    listeners.forEach((fn) => fn());
  })().finally(() => {
    loadingPromise = null;
  });
  return loadingPromise;
}

function useFavorites() {
  const { user } = useAuth();
  const [, force] = useState(0);

  useEffect(() => {
    if (!user) {
      cache = new Set();
      loadedForUser = null;
      return;
    }
    if (loadedForUser !== user.id) {
      loadFavorites(user.id);
    }
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, [user]);

  return cache ?? new Set<string>();
}

export function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const { user } = useAuth();
  const favs = useFavorites();
  const navigate = useNavigate();
  const isFav = favs.has(productId);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast.info("Entre para salvar favoritos");
      navigate({ to: "/auth" });
      return;
    }
    if (isFav) {
      cache?.delete(productId);
      listeners.forEach((fn) => fn());
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId);
    } else {
      cache?.add(productId);
      listeners.forEach((fn) => fn());
      const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
      if (error) {
        cache?.delete(productId);
        listeners.forEach((fn) => fn());
        toast.error("Não foi possível favoritar");
      }
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full backdrop-blur-md transition active:scale-90",
        isFav ? "bg-neon-pink text-white glow-pink" : "bg-black/40 text-white hover:bg-black/60",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
    </button>
  );
}

export function useFavoriteIds() {
  return useFavorites();
}
