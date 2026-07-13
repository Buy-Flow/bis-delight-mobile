// Shared "beforeinstallprompt" capture.
// The browser fires this event exactly once per page load. If a component
// mounts AFTER the event fired (e.g. the user navigates to /baixar-app
// after the install popup already captured it), it would miss the event
// and never be able to trigger the native install prompt.
//
// This module installs a single window-level listener as soon as it's
// imported and stashes the event on window, so any consumer can grab it
// via getInstallPrompt() and subscribe to changes via onInstallPromptChange().

export type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Store = {
  event: BIPEvent | null;
  installed: boolean;
  subs: Set<() => void>;
};

declare global {
  interface Window {
    __qb_pwa_store?: Store;
  }
}

function getStore(): Store {
  if (typeof window === "undefined") {
    return { event: null, installed: false, subs: new Set() };
  }
  if (!window.__qb_pwa_store) {
    const store: Store = { event: null, installed: false, subs: new Set() };
    window.__qb_pwa_store = store;

    window.addEventListener("beforeinstallprompt", (e: Event) => {
      e.preventDefault();
      store.event = e as BIPEvent;
      store.subs.forEach((cb) => cb());
    });
    window.addEventListener("appinstalled", () => {
      store.installed = true;
      store.event = null;
      store.subs.forEach((cb) => cb());
    });
  }
  return window.__qb_pwa_store;
}

export function getInstallPrompt(): BIPEvent | null {
  return getStore().event;
}

export function isAppInstalled(): boolean {
  return getStore().installed;
}

export function onInstallPromptChange(cb: () => void): () => void {
  const store = getStore();
  store.subs.add(cb);
  return () => store.subs.delete(cb);
}

export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const store = getStore();
  const evt = store.event;
  if (!evt) return "unavailable";
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    store.event = null;
    store.subs.forEach((cb) => cb());
    return choice.outcome;
  } catch {
    return "dismissed";
  }
}
