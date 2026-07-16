import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addSharedItem, readShareMode, writeShareMode, type ShareMode } from "@/lib/shared-cart";
import { logSilent } from "@/lib/silent-errors";
import { shortUid } from "@/lib/uid";

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
  /** Reinsere um item (usado para "Desfazer" remoção). Idempotente por uid. */
  restore: (item: CartItem, index?: number) => void;
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
  /** true once localStorage has been read on mount — before this, items[] is a placeholder empty array. */
  hydrated: boolean;
};

const Ctx = createContext<CartCtx | null>(null);

const CART_KEY = "querobis:cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch (e) {
    logSilent("cart:persist", e);
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
    const loaded = loadCart();
    setItems(loaded);
    lastPersistedRef.current = loaded;
    setHydrated(true);
    // auto-resume checkout after login
    if (sessionStorage.getItem("querobis:resume_checkout") === "1") {
      sessionStorage.removeItem("querobis:resume_checkout");
      setTimeout(() => setCheckoutOpen(true), 300);
    }
  }, []);

  // Cross-tab convergence: adopt another tab's cart when localStorage changes.
  // Sem isso, duas abas fazem upsert independentes e a última grava por cima.
  const skipPersistRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CART_KEY) return;
      try {
        const next: CartItem[] = e.newValue ? JSON.parse(e.newValue) : [];
        skipPersistRef.current = true;
        setItems(next);
      } catch (err) {
        logSilent("cart:storage-merge", err);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // persist to localStorage — em caso de quota, reverte o estado para o último
  // snapshot persistido com sucesso, garantindo que UI e storage nunca divirjam
  // (item que não coube não continua na cesta e some silenciosamente no reload).
  const lastPersistedRef = useRef<CartItem[]>([]);
  useEffect(() => {
    if (!hydrated) return;
    if (skipPersistRef.current) {
      // Estado veio de outra aba via evento storage — não re-persistir para
      // não disparar loop de storage → setState → setItem em cadeia.
      skipPersistRef.current = false;
      lastPersistedRef.current = items;
      return;
    }
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      lastPersistedRef.current = items;
    } catch (e) {
      const { quota } = logSilent("cart:persist", e);
      const rollback = lastPersistedRef.current;
      if (quota) {
        toast.error("Cesta cheia — item removido", {
          description:
            "Sem espaço no navegador para salvar mais itens. Finalize o pedido ou libere espaço para continuar adicionando.",
          id: "cart-quota",
        });
      } else {
        toast.error("Não foi possível salvar seu carrinho", {
          description: "Tente novamente ou finalize o pedido agora.",
          id: "cart-persist",
        });
      }
      // Reverte para o último estado que coube no storage, evitando divergência
      // entre UI (mostra o item) e storage (perde no próximo reload).
      skipPersistRef.current = true;
      setItems(rollback);
    }
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

  // Cross-device cart hydration + realtime sync.
  // - No login: puxa carrinho salvo da conta. Se local também tem itens, escolhe
  //   o mais recente (por updated_at). Local vazio + remoto com itens = adota remoto.
  // - Realtime: escuta mudanças em abandoned_carts (mesmo user_id) e adota
  //   automaticamente quando outro dispositivo altera o carrinho.
  const lastSyncStampRef = useRef<number>(0); // marca quando NÓS gravamos, para ignorar o eco realtime
  const remoteRevRef = useRef<string | null>(null); // updated_at remoto conhecido

  const applyRemote = (remote: CartItem[], toastLabel = "Carrinho sincronizado") => {
    // Só adota se realmente diferente do estado atual — evita re-render em loop.
    const current = JSON.stringify(items);
    const next = JSON.stringify(remote);
    if (current === next) return;
    skipPersistRef.current = false; // persiste no localStorage também
    setItems(remote);
    if (remote.length > 0) {
      const total = remote.reduce((s, i) => s + i.quantity, 0);
      toast.success(toastLabel, {
        description: `${total} ${total === 1 ? "item sincronizado" : "itens sincronizados"} da sua conta.`,
        id: "cart-cross-device",
      });
    }
  };

  // Pull inicial ao logar / trocar de dispositivo.
  useEffect(() => {
    if (!hydrated || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("abandoned_carts")
          .select("items, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const remote = (data?.items as unknown as CartItem[] | null) ?? [];
        remoteRevRef.current = data?.updated_at ?? null;
        if (!Array.isArray(remote)) return;

        if (items.length === 0 && remote.length > 0) {
          applyRemote(remote, "Carrinho recuperado");
          return;
        }
        // Conflito: local e remoto têm itens. Se o remoto for mais novo do que
        // a última gravação local conhecida, adota remoto. Caso contrário,
        // a próxima sync (efeito abaixo) empurra o local para o remoto.
        if (items.length > 0 && remote.length > 0 && data?.updated_at) {
          const remoteTime = new Date(data.updated_at).getTime();
          if (remoteTime > lastSyncStampRef.current + 2000) {
            applyRemote(remote, "Carrinho atualizado em outro dispositivo");
          }
        }
      } catch (e) {
        logSilent("cart:cross-device-pull", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hydrated]);

  // Realtime: outro dispositivo alterou o carrinho → adota imediatamente.
  useEffect(() => {
    if (!hydrated || !userId) return;
    const channel = supabase
      .channel(`cart-sync:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "abandoned_carts",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            const row = (payload.new ?? payload.old) as {
              items?: CartItem[] | null;
              updated_at?: string | null;
            } | null;
            const updatedAt = row?.updated_at ? new Date(row.updated_at).getTime() : Date.now();
            // Ignora o eco da nossa própria gravação (últimos 2s).
            if (updatedAt <= lastSyncStampRef.current + 2000) return;
            if (payload.eventType === "DELETE") {
              applyRemote([], "");
              return;
            }
            const remote = Array.isArray(row?.items) ? (row!.items as CartItem[]) : [];
            remoteRevRef.current = row?.updated_at ?? null;
            applyRemote(remote, "Carrinho atualizado em outro dispositivo");
          } catch (e) {
            logSilent("cart:realtime", e);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hydrated]);

  // Push do carrinho local para o remoto (debounced). Marca lastSyncStamp para
  // que o eco realtime desta gravação não sobrescreva o estado local.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !userId) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const doSync = async () => {
        const fresh = loadCart();
        const subtotal = fresh.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        const count = fresh.reduce((s, i) => s + i.quantity, 0);
        try {
          lastSyncStampRef.current = Date.now();
          if (fresh.length === 0) {
            const { error } = await supabase
              .from("abandoned_carts")
              .delete()
              .eq("user_id", userId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("abandoned_carts").upsert({
              user_id: userId,
              items: fresh as unknown as never,
              subtotal,
              item_count: count,
              notified_at: null,
              recovered_at: null,
            });
            if (error) throw error;
          }
        } catch (e) {
          logSilent("cart:abandoned-sync", e);
        }
      };
      const lockName = `querobis:cart-sync:${userId}`;
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "locks" in nav && nav.locks?.request) {
        nav.locks
          .request(lockName, { mode: "exclusive" }, doSync)
          .catch((e) => {
            logSilent("cart:lock", e);
            return doSync();
          });
      } else {
        void doSync();
      }
    }, 1200);
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
      add: (item) => {
        const uid = shortUid(8);
        const full = { ...item, uid };
        setItems((prev) => [...prev, full]);
        if (shareMode?.token) {
          // Sync ao carrinho compartilhado com 1 retry e feedback visível ao
          // convidado — falha silenciosa fazia o item sumir do lado do dono.
          const trySync = async (attempt: number): Promise<void> => {
            try {
              await addSharedItem(shareMode.token, shareMode.name, full);
            } catch (err) {
              logSilent("cart:shared-add", err);
              if (attempt < 1) {
                await new Promise((r) => setTimeout(r, 800));
                return trySync(attempt + 1);
              }
              toast.error("Não foi possível enviar o item ao anfitrião", {
                description: "Verifique sua conexão. Toque para tentar novamente.",
                action: { label: "Tentar de novo", onClick: () => void trySync(0) },
              });
            }
          };
          void trySync(0);
        }
      },
      update: (uid, patch) =>
        setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it))),
      remove: (uid) => setItems((prev) => prev.filter((it) => it.uid !== uid)),
      restore: (item, index) =>
        setItems((prev) => {
          if (prev.some((it) => it.uid === item.uid)) return prev;
          if (index == null || index < 0 || index > prev.length) return [...prev, item];
          const next = prev.slice();
          next.splice(index, 0, item);
          return next;
        }),
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
      shareMode,
      setShareMode: (m) => {
        writeShareMode(m);
        setShareModeState(m);
      },
      hydrated,
    };
  }, [items, isCartOpen, isCheckoutOpen, isAcaiOpen, editingItem, pendingProductId, shareMode, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
