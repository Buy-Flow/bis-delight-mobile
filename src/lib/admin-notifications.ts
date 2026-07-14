// Admin notification center store — persisted in localStorage.
// Feeds the bell in AdminShell header.

import { shortUid } from "@/lib/uid";
import { safeLocalRead, safeLocalWrite } from "@/lib/silent-errors";

export type AdminNotifKind =
  | "order_new"
  | "order_paid"
  | "order_cancelled"
  | "order_dispatched"
  | "order_delivered"
  | "order_late"
  | "review_new"
  | "stock_low"
  | "system";

export type AdminNotif = {
  id: string;
  kind: AdminNotifKind;
  title: string;
  description?: string;
  href?: string;
  createdAt: number;
  read: boolean;
  refId?: string; // dedupe key (e.g. order id + kind)
};

const KEY = "qb-admin-notifs-v1";
const MAX_ITEMS = 100;

type Listener = (state: AdminNotif[]) => void;
const listeners = new Set<Listener>();
let state: AdminNotif[] = load();
// Dedupe within a session (avoid double insert from re-subscribes)
const seenRefs = new Set<string>(state.map((n) => n.refId ?? n.id));

function load(): AdminNotif[] {
  const raw = safeLocalRead(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AdminNotif[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function persist() {
  safeLocalWrite(KEY, JSON.stringify(state.slice(0, MAX_ITEMS)));
}

function emit() {
  for (const l of listeners) l(state);
}

export function subscribeAdminNotifs(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getAdminNotifs(): AdminNotif[] {
  return state;
}

export function pushAdminNotif(input: Omit<AdminNotif, "id" | "createdAt" | "read"> & { id?: string }): AdminNotif | null {
  const refKey = input.refId ?? `${input.kind}:${input.title}`;
  if (seenRefs.has(refKey)) return null;
  seenRefs.add(refKey);
  const notif: AdminNotif = {
    id: input.id ?? shortUid(10),
    kind: input.kind,
    title: input.title,
    description: input.description,
    href: input.href,
    refId: input.refId,
    createdAt: Date.now(),
    read: false,
  };
  state = [notif, ...state].slice(0, MAX_ITEMS);
  persist();
  emit();
  return notif;
}

export function markAllRead() {
  state = state.map((n) => (n.read ? n : { ...n, read: true }));
  persist();
  emit();
}

export function markRead(id: string) {
  state = state.map((n) => (n.id === id ? { ...n, read: true } : n));
  persist();
  emit();
}

export function clearAdminNotifs() {
  state = [];
  persist();
  emit();
}

export function unreadCount(): number {
  return state.reduce((n, x) => n + (x.read ? 0 : 1), 0);
}
