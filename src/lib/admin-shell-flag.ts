import { useSyncExternalStore } from "react";

let mounted = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function markAdminShellMounted() {
  mounted += 1;
  emit();
  return () => {
    mounted = Math.max(0, mounted - 1);
    emit();
  };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useIsInsideAdminShell() {
  return useSyncExternalStore(
    subscribe,
    () => mounted > 0,
    () => false,
  );
}
