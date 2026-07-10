import { useEffect, useRef } from "react";

/**
 * Pushes a history entry while `open` is true so the browser/system back
 * button closes the overlay instead of navigating away from the site.
 *
 * When the overlay is closed programmatically (X button, backdrop click),
 * the extra history entry is popped so the browser history stays clean.
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const marker = `overlay-${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ __overlay: marker }, "");

    let poppedByBack = false;
    const handlePop = () => {
      poppedByBack = true;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      if (!poppedByBack) {
        // Overlay closed via UI — remove the marker entry we pushed.
        try {
          window.history.back();
        } catch {
          /* noop */
        }
      }
    };
  }, [open]);
}
