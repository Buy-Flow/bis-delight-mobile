import { useEffect, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";
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
const queue: Pending[] = [];

/**
 * Confirmação assíncrona com visual neon (Radix AlertDialog).
 *
 * O host (`<ConfirmDialogHost />`) é montado no `__root`. Se por qualquer
 * motivo não houver host no momento da chamada (SSR, portal ainda não
 * hidratado, chamado antes do primeiro paint), o pedido entra numa fila
 * e é apresentado assim que o host montar — nunca cai no `window.confirm`
 * nativo que quebra o design do app.
 */
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const p: Pending = { ...opts, resolve };
    if (listener) listener(p);
    else queue.push(p);
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    listener = (p) => setPending(p);
    // Drena qualquer confirmação enfileirada antes do host montar.
    const next = queue.shift();
    if (next) setPending(next);
    return () => {
      listener = null;
    };
  }, []);

  const close = (v: boolean) => {
    if (!pending) return;
    pending.resolve(v);
    setPending(null);
    // Se houver mais pedidos aguardando, mostra o próximo no próximo tick.
    const next = queue.shift();
    if (next) {
      queueMicrotask(() => setPending(next));
    }
  };

  const open = pending !== null;
  const danger = pending?.tone !== "default";

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className={cn(
            "fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <AlertDialog.Content
          onEscapeKeyDown={() => close(false)}
          className={cn(
            "fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.12_0.09_305)]",
            "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="p-5">
            <div
              className={cn(
                "mb-3 grid h-11 w-11 place-items-center rounded-2xl",
                danger
                  ? "bg-red-500/15 text-red-300 ring-1 ring-red-400/30"
                  : "bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/30",
              )}
              aria-hidden
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialog.Title className="font-display text-lg font-black text-white">
              {pending?.title ?? (danger ? "Confirmar ação" : "Confirmação")}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-1 text-sm leading-relaxed text-white/70">
              {pending?.message}
            </AlertDialog.Description>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {pending?.cancelLabel ?? "Cancelar"}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                onClick={() => close(true)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-extrabold text-white focus-visible:outline-none focus-visible:ring-2",
                  danger
                    ? "bg-red-500 hover:bg-red-500/90 focus-visible:ring-red-300"
                    : "bg-neon-pink glow-pink focus-visible:ring-neon-pink",
                )}
              >
                {pending?.confirmLabel ?? (danger ? "Remover" : "Confirmar")}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
