import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addSharedItem, readShareMode, writeShareMode, type ShareMode } from "@/lib/shared-cart";

export type CartItem = {
  uid: string;
  productId: string;
  name: string;
  image: string;
  size?: string;
  flavor?: string;
  extras: { label: string; price: number }[];
  removed: string[];
  note?: string;
  quantity: number;
  unitPrice: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "uid">) => void;
  update: (uid: string, patch: Partial<CartItem>) => void;
  remove: (uid: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  isCheckoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
  isAcaiOpen: boolean;
  openAcai: () => void;
  closeAcai: () => void;
  editingItem: CartItem | null;
  openEdit: (item: CartItem) => void;
  closeEdit: () => void;
  // Upsell: cart pede pra home abrir o modal de um produto sugerido
  pendingProductId: string | null;
  requestOpenProduct: (productId: string) => void;
  consumePendingProduct: () => void;
  shareMode: ShareMode;
  setShareMode: (m: ShareMode) => void;
};

const Ctx = createContext<CartCtx | null>(null);

const CART_KEY = "querobis:cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isAcaiOpen, setAcaiOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [shareMode, setShareModeState] = useState<ShareMode>(null);

  useEffect(() => {
    setShareModeState(readShareMode());
    const onChange = () => setShareModeState(readShareMode());
    window.addEventListener("querobis:share_mode", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("querobis:share_mode", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // hydrate from localStorage on mount
  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
    // auto-resume checkout after login
    if (sessionStorage.getItem("querobis:resume_checkout") === "1") {
      sessionStorage.removeItem("querobis:resume_checkout");
      setTimeout(() => setCheckoutOpen(true), 300);
    }
  }, []);

  // persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  // Track logged-in user for abandoned cart sync
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sync abandoned cart to Supabase (debounced) when logged in
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !userId) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const count = items.reduce((s, i) => s + i.quantity, 0);
      try {
        if (items.length === 0) {
          // Cart emptied: mark recovered (or leave if already gone)
          await supabase.from("abandoned_carts").delete().eq("user_id", userId);
        } else {
          await supabase.from("abandoned_carts").upsert({
            user_id: userId,
            items: items as unknown as never,
            subtotal,
            item_count: count,
            notified_at: null,
            recovered_at: null,
          });
        }
      } catch {}
    }, 1500);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [items, hydrated, userId]);

  const value = useMemo<CartCtx>(() => {
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const count = items.reduce((s, i) => s + i.quantity, 0);
    return {
      items,
      subtotal,
      count,
      add: (item) =>
        setItems((prev) => [
          ...prev,
          { ...item, uid: Math.random().toString(36).slice(2, 10) },
        ]),
      update: (uid, patch) =>
        setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it))),
      remove: (uid) => setItems((prev) => prev.filter((it) => it.uid !== uid)),
      clear: () => setItems([]),
      isCartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      isCheckoutOpen,
      openCheckout: () => {
        setCartOpen(false);
        setCheckoutOpen(true);
      },
      closeCheckout: () => setCheckoutOpen(false),
      isAcaiOpen,
      openAcai: () => setAcaiOpen(true),
      closeAcai: () => setAcaiOpen(false),
      editingItem,
      openEdit: (item) => {
        setCartOpen(false);
        setEditingItem(item);
      },
      closeEdit: () => setEditingItem(null),
      pendingProductId,
      requestOpenProduct: (productId) => {
        setCartOpen(false);
        setPendingProductId(productId);
      },
      consumePendingProduct: () => setPendingProductId(null),
    };
  }, [items, isCartOpen, isCheckoutOpen, isAcaiOpen, editingItem, pendingProductId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
