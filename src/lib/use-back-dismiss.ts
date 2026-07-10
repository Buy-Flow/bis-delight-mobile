import { useEffect, useRef } from "react";

/**
 * Pushes a history entry while `open` is true so the browser/system back
 * button closes the overlay instead of navigating away from the site.
 *
 * When the overlay is closed programmatically (X button, backdrop click),
 * the extra history entry is popped so the browser history stays clean.
 */

const OVERLAY_STATE_KEY = "__lovableOverlayId";

// Module-level controls shared across all overlays. Only the top-most overlay
// should react to the browser/system back button; otherwise nested overlays
// like cart → edit product can all close at once.
let programmaticBackPending = 0;
let overlaySequence = 0;
const overlayStack: number[] = [];

const getActiveOverlayId = () => {
  if (typeof window === "undefined") return null;
  const state = window.history.state as Record<string, unknown> | null;
  return typeof state?.[OVERLAY_STATE_KEY] === "number"
    ? (state[OVERLAY_STATE_KEY] as number)
    : null;
};

const removeFromStack = (id: number) => {
  const index = overlayStack.lastIndexOf(id);
  if (index >= 0) overlayStack.splice(index, 1);
};

export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const idRef = useRef<number | null>(null);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const id = ++overlaySequence;
    idRef.current = id;
    overlayStack.push(id);

    const baseState =
      window.history.state && typeof window.history.state === "object"
        ? { ...(window.history.state as Record<string, unknown>) }
        : {};
    window.history.pushState({ ...baseState, [OVERLAY_STATE_KEY]: id }, "", window.location.href);

    let poppedByBack = false;
    const handlePop = () => {
      if (programmaticBackPending > 0) {
        programmaticBackPending -= 1;
        return;
      }
      if (overlayStack[overlayStack.length - 1] !== id) return;

      poppedByBack = true;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      removeFromStack(id);

      // Only remove the synthetic history entry if it is still the active
      // entry for this overlay. This prevents a UI close, StrictMode cleanup,
      // or stale cleanup from calling history.back() at the app's first page
      // and sending the installed PWA/browser out of the site.
      if (!poppedByBack && getActiveOverlayId() === id) {
        try {
          programmaticBackPending += 1;
          window.history.back();
        } catch {
          programmaticBackPending = Math.max(0, programmaticBackPending - 1);
        }
      }
    };
  }, [open]);
}
