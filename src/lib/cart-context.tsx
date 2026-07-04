import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isAcaiOpen, setAcaiOpen] = useState(false);

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
    };
  }, [items, isCartOpen, isCheckoutOpen, isAcaiOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
