import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart-context";
import { toast } from "sonner";

export type Participant = { name: string; joined_at?: string; is_owner?: boolean };
export type SharedItem = CartItem & { participant: string; added_at?: string };
export type SharedCart = {
  token: string;
  owner_name: string;
  is_owner: boolean;
  title: string;
  message: string;
  items: SharedItem[];
  participants: Participant[];
  status: "open" | "closed" | "merged" | "expired";
  expires_at: string;
  created_at: string;
  merged_order_id: string | null;
};

const PARTICIPATE_KEY = "querobis:share_mode";
const RECENT_KEY = "querobis:share_recent";

export type ShareMode = { token: string; name: string; ownerName?: string } | null;
export type RecentShare = { token: string; name: string; ownerName?: string; lastAt: number };

/** Remove uma chave corrompida com segurança e loga o motivo. */
function purgeCorruptedKey(key: string, err: unknown, opts?: { silent?: boolean }) {
  // eslint-disable-next-line no-console
  console.warn(`[shared-cart] chave "${key}" corrompida — limpando`, err);
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("[shared-cart] falha ao remover chave corrompida", e);
  }
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    console.warn("[shared-cart] falha ao remover chave corrompida (session)", e);
  }
  if (!opts?.silent && typeof window !== "undefined") {
    // Avisa o usuário só quando afeta o modo de compartilhar ativo.
    if (key === PARTICIPATE_KEY) {
      toast.error("Sessão de carrinho compartilhado foi perdida", {
        description: "Dados locais estavam corrompidos. Entre novamente pelo link do convite.",
      });
      window.dispatchEvent(new Event("querobis:share_mode"));
    }
  }
}

/** Reporta erros de escrita (quota cheia, modo privado, etc). */
function reportStorageWriteError(key: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[shared-cart] falha ao gravar "${key}"`, err);
  const name = (err as { name?: string } | null)?.name;
  const quota = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
  toast.error(
    quota
      ? "Sem espaço para salvar o carrinho compartilhado"
      : "Não foi possível salvar o carrinho compartilhado",
    {
      description: quota
        ? "Libere espaço do navegador (limpe dados de sites) e tente novamente."
        : "O modo compartilhado pode não persistir ao recarregar. Verifique se o navegador permite armazenamento local.",
    },
  );
}

export function readShareMode(): ShareMode {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    // Migração: aceita tanto localStorage (novo) quanto sessionStorage (legado)
    raw = localStorage.getItem(PARTICIPATE_KEY) || sessionStorage.getItem(PARTICIPATE_KEY);
  } catch (e) {
    console.warn("[shared-cart] localStorage indisponível", e);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShareMode;
    // Validação de shape: precisa ter token + name
    if (!parsed || typeof parsed !== "object" || !parsed.token || !parsed.name) {
      purgeCorruptedKey(PARTICIPATE_KEY, new Error("shape inválido"));
      return null;
    }
    return parsed;
  } catch (e) {
    purgeCorruptedKey(PARTICIPATE_KEY, e);
    return null;
  }
}

export function writeShareMode(mode: ShareMode) {
  if (typeof window === "undefined") return;
  try {
    if (mode) {
      localStorage.setItem(PARTICIPATE_KEY, JSON.stringify(mode));
      sessionStorage.removeItem(PARTICIPATE_KEY);
      pushRecentShare({ token: mode.token, name: mode.name, ownerName: mode.ownerName, lastAt: Date.now() });
    } else {
      localStorage.removeItem(PARTICIPATE_KEY);
      sessionStorage.removeItem(PARTICIPATE_KEY);
    }
  } catch (e) {
    reportStorageWriteError(PARTICIPATE_KEY, e);
  }
  window.dispatchEvent(new Event("querobis:share_mode"));
}

export function readRecentShares(): RecentShare[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECENT_KEY);
  } catch (e) {
    console.warn("[shared-cart] localStorage indisponível (recent)", e);
    return [];
  }
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as RecentShare[];
    if (!Array.isArray(list)) {
      purgeCorruptedKey(RECENT_KEY, new Error("não é array"), { silent: true });
      return [];
    }
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return list
      .filter((r) => r && typeof r === "object" && r.token && typeof r.lastAt === "number" && r.lastAt > cutoff)
      .sort((a, b) => b.lastAt - a.lastAt);
  } catch (e) {
    purgeCorruptedKey(RECENT_KEY, e, { silent: true });
    return [];
  }
}

function pushRecentShare(entry: RecentShare) {
  if (typeof window === "undefined") return;
  try {
    const cur = readRecentShares().filter((r) => r.token !== entry.token);
    const next = [entry, ...cur].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (e) {
    // Recentes são acessórios — não spamma toast, só loga.
    console.warn("[shared-cart] falha ao gravar recentes", e);
  }
}

export function removeRecentShare(token: string) {
  if (typeof window === "undefined") return;
  try {
    const next = readRecentShares().filter((r) => r.token !== token);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("querobis:share_mode"));
  } catch (e) {
    console.warn("[shared-cart] falha ao remover recente", e);
    // Ainda dispara evento para que UI atualize com estado remoto
    window.dispatchEvent(new Event("querobis:share_mode"));
  }
}


export async function createSharedCart(input: {
  title?: string;
  message?: string;
  ownerName: string;
  items: CartItem[];
}): Promise<string> {
  const ownerName = (input.ownerName || "").trim() || "Anônimo";
  const stamped: SharedItem[] = input.items.map((it) => ({
    ...it,
    participant: ownerName,
    added_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.rpc("create_shared_cart", {
    _title: input.title ?? "",
    _message: input.message ?? "",
    _owner_name: ownerName,
    _items: stamped as unknown as never,
  });
  if (error) throw error;
  return String(data);
}

export async function getSharedCart(token: string): Promise<SharedCart | null> {
  const { data, error } = await supabase.rpc("get_shared_cart", { _token: token });
  if (error) throw error;
  return (data as unknown as SharedCart) ?? null;
}

export type SharedCartStatus = SharedCart["status"] | "not_found" | "unknown";

/**
 * Consulta em paralelo o status de cada token. Não lança em erro individual —
 * um token que falhar entra como "unknown" e a UI decide se mantém ou não.
 * Também classifica como "expired" quando `expires_at` já passou, mesmo que
 * o servidor ainda retorne "open" (defesa contra job de expiração atrasado).
 */
export async function getSharedCartStatuses(
  tokens: string[],
): Promise<Record<string, SharedCartStatus>> {
  const unique = Array.from(new Set(tokens.filter(Boolean)));
  const now = Date.now();
  const entries = await Promise.all(
    unique.map(async (token): Promise<[string, SharedCartStatus]> => {
      try {
        const cart = await getSharedCart(token);
        if (!cart) return [token, "not_found"];
        if (cart.status === "open" && cart.expires_at) {
          const exp = Date.parse(cart.expires_at);
          if (Number.isFinite(exp) && exp <= now) return [token, "expired"];
        }
        return [token, cart.status];
      } catch (err) {
        console.warn("[shared-cart] status fetch falhou", token, err);
        return [token, "unknown"];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export async function addSharedItem(token: string, participant: string, item: CartItem) {
  const { error } = await supabase.rpc("add_shared_cart_item", {
    _token: token,
    _participant: participant,
    _item: item as unknown as never,
  });
  if (error) throw error;
}

export async function removeSharedItem(token: string, uid: string, participant: string) {
  const { error } = await supabase.rpc("remove_shared_cart_item", {
    _token: token,
    _uid: uid,
    _participant: participant,
  });
  if (error) throw error;
}

export async function closeSharedCart(token: string) {
  const { error } = await supabase.rpc("close_shared_cart", { _token: token });
  if (error) throw error;
}

export async function mergeSharedCart(token: string, orderId: string) {
  const { error } = await supabase.rpc("merge_shared_cart", {
    _token: token,
    _order_id: orderId,
  });
  if (error) throw error;
}

export function shareUrlFor(token: string): string {
  if (typeof window === "undefined") return `/c/${token}`;
  return `${window.location.origin}/c/${token}`;
}

export function totalOfShared(items: SharedItem[]): number {
  return items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
}

export function groupByParticipant(items: SharedItem[]) {
  const map = new Map<string, SharedItem[]>();
  for (const it of items) {
    const key = it.participant || "Anônimo";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries()).map(([name, list]) => ({
    name,
    items: list,
    subtotal: totalOfShared(list),
  }));
}
