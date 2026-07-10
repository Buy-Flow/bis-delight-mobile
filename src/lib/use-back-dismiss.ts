import { useEffect, useRef } from "react";

/**
 * Pushes a history entry while `open` is true so the browser/system back
 * button closes the overlay instead of navigating away from the site.
 *
 * When the overlay is closed programmatically (X button, backdrop click),
 * the extra history entry is popped so the browser history stays clean.
 */

// Module-level flag shared across all overlays. When we programmatically
// call history.back() during cleanup, the resulting popstate event must NOT
// trigger onClose on any other mounted overlay (which would immediately
// close a modal that just opened).
let programmaticBackPending = 0;

export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    window.history.pushState({ __overlay: true }, "");

    let poppedByBack = false;
    const handlePop = () => {
      if (programmaticBackPending > 0) {
        programmaticBackPending -= 1;
        return;
      }
      poppedByBack = true;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      if (!poppedByBack) {
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
