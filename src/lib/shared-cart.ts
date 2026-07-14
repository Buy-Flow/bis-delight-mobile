import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart-context";

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

export function readShareMode(): ShareMode {
  if (typeof window === "undefined") return null;
  try {
    // Migração: aceita tanto localStorage (novo) quanto sessionStorage (legado)
    const raw =
      localStorage.getItem(PARTICIPATE_KEY) || sessionStorage.getItem(PARTICIPATE_KEY);
    return raw ? (JSON.parse(raw) as ShareMode) : null;
  } catch {
    return null;
  }
}

export function writeShareMode(mode: ShareMode) {
  if (typeof window === "undefined") return;
  if (mode) {
    localStorage.setItem(PARTICIPATE_KEY, JSON.stringify(mode));
    sessionStorage.removeItem(PARTICIPATE_KEY);
    pushRecentShare({ token: mode.token, name: mode.name, ownerName: mode.ownerName, lastAt: Date.now() });
  } else {
    localStorage.removeItem(PARTICIPATE_KEY);
    sessionStorage.removeItem(PARTICIPATE_KEY);
  }
  window.dispatchEvent(new Event("querobis:share_mode"));
}

export function readRecentShares(): RecentShare[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as RecentShare[]) : [];
    // Mantém apenas 7 dias
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return list.filter((r) => r.lastAt > cutoff).sort((a, b) => b.lastAt - a.lastAt);
  } catch {
    return [];
  }
}

function pushRecentShare(entry: RecentShare) {
  if (typeof window === "undefined") return;
  try {
    const cur = readRecentShares().filter((r) => r.token !== entry.token);
    const next = [entry, ...cur].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export function removeRecentShare(token: string) {
  if (typeof window === "undefined") return;
  try {
    const next = readRecentShares().filter((r) => r.token !== token);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("querobis:share_mode"));
  } catch {}
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
