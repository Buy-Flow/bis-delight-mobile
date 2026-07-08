import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type Pending = ConfirmOpts & { resolve: (v: boolean) => void };

let listener: ((p: Pending | null) => void) | null = null;

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const p: Pending = { ...opts, resolve };
    if (listener) listener(p);
    else resolve(window.confirm(opts.message));
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    listener = setPending;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const close = (v: boolean) => {
    if (!pending) return;
    pending.resolve(v);
    setPending(null);
  };

  if (!pending) return null;

  const danger = pending.tone !== "default";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.12_0.09_305)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <button
          type="button"
          onClick={() => close(false)}
          aria-label="Fechar"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="p-5">
          <div
            className={cn(
              "mb-3 grid h-11 w-11 place-items-center rounded-2xl",
              danger
                ? "bg-red-500/15 text-red-300 ring-1 ring-red-400/30"
                : "bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/30",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-black text-white">
            {pending.title ?? (danger ? "Confirmar ação" : "Confirmação")}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{pending.message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
          >
            {pending.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold text-white",
              danger ? "bg-red-500 hover:bg-red-500/90" : "bg-neon-pink glow-pink",
            )}
          >
            {pending.confirmLabel ?? (danger ? "Remover" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
