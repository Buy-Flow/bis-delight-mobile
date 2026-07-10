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
let overlaySequence = 0;
const overlayStack: number[] = [];

const getCurrentOverlayId = () => {
  const state = window.history.state as Record<string, unknown> | null;
  return typeof state?.[OVERLAY_STATE_KEY] === "number"
    ? (state[OVERLAY_STATE_KEY] as number)
    : null;
};

const clearCurrentOverlayState = (id: number) => {
  if (getCurrentOverlayId() !== id) return;
  const state =
    window.history.state && typeof window.history.state === "object"
      ? { ...(window.history.state as Record<string, unknown>) }
      : {};
  delete state[OVERLAY_STATE_KEY];
  window.history.replaceState(state, "", window.location.href);
};

const removeFromStack = (id: number) => {
  const index = overlayStack.lastIndexOf(id);
  if (index >= 0) overlayStack.splice(index, 1);
};

export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const idRef = useRef<number | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    const id = idRef.current ?? getCurrentOverlayId() ?? ++overlaySequence;
    idRef.current = id;
    if (!overlayStack.includes(id)) overlayStack.push(id);

    if (getCurrentOverlayId() !== id) {
      const baseState =
        window.history.state && typeof window.history.state === "object"
          ? { ...(window.history.state as Record<string, unknown>) }
          : {};
      window.history.pushState({ ...baseState, [OVERLAY_STATE_KEY]: id }, "", window.location.href);
    }

    let poppedByBack = false;
    const handlePop = () => {
      if (overlayStack[overlayStack.length - 1] !== id) return;

      poppedByBack = true;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);

      cleanupTimerRef.current = window.setTimeout(() => {
        removeFromStack(id);
        if (!poppedByBack) clearCurrentOverlayState(id);
        cleanupTimerRef.current = null;
      }, 0);
    };
  }, [open]);
}
