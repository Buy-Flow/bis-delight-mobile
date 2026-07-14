/**
 * Camada central de toasts.
 *
 * Motivação: sonner é importado direto em ~600 call sites. Sem coordenação,
 * sequências rápidas (ex.: um loop de retries, um listener de realtime que
 * dispara várias vezes) empilham N toasts idênticos.
 *
 * Esta camada expõe a MESMA superfície do sonner e adiciona duas garantias:
 *
 *   1. **Dedupe por conteúdo**: chamadas com o mesmo texto (title + description)
 *      dentro de uma janela curta reusam o mesmo `id` do sonner. Isso faz o
 *      toast existente ser ATUALIZADO em vez de empilhar um novo.
 *
 *   2. **Cap global**: o `<Toaster visibleToasts={3} />` no __root já limita
 *      a pilha visual; a dedupe evita que o backlog engula toasts úteis.
 *
 * Uso preferido em código novo:
 *
 *   import { toast } from "@/lib/toast";
 *   toast.success("Salvo");
 *
 * Chamadas antigas (`from "sonner"`) continuam funcionando — os dois pontos
 * de entrada compartilham a mesma instância global do sonner, então o
 * `visibleToasts={3}` do Toaster também vale para elas. A dedupe só se
 * aplica a call sites migrados para `@/lib/toast`.
 */
import { toast as sonner, type ExternalToast } from "sonner";

const DEDUPE_WINDOW_MS = 1200;
const recent = new Map<string, { id: string | number; at: number }>();

function keyFor(message: unknown, opts?: ExternalToast): string {
  const msg = typeof message === "string" ? message : JSON.stringify(message);
  const desc =
    opts?.description == null
      ? ""
      : typeof opts.description === "string"
        ? opts.description
        : "[node]";
  return `${msg}::${desc}`;
}

function pickId(message: unknown, opts?: ExternalToast): string | number | undefined {
  if (opts?.id != null) return opts.id;
  const key = keyFor(message, opts);
  const now = Date.now();
  const hit = recent.get(key);
  if (hit && now - hit.at < DEDUPE_WINDOW_MS) {
    hit.at = now;
    return hit.id;
  }
  const id = `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  recent.set(key, { id, at: now });
  // GC leve — 200 entradas é MAIS que suficiente para uma sessão.
  if (recent.size > 200) {
    const cutoff = now - DEDUPE_WINDOW_MS * 4;
    for (const [k, v] of recent) if (v.at < cutoff) recent.delete(k);
  }
  return id;
}

type ToastFn = (message: React.ReactNode, opts?: ExternalToast) => string | number;

function wrap(fn: ToastFn): ToastFn {
  return (message, opts) => {
    const id = pickId(message, opts);
    return fn(message, { ...opts, id });
  };
}

const base = wrap(sonner as unknown as ToastFn) as unknown as typeof sonner;

// Reencapsula variantes preservando a API do sonner.
base.success = wrap(sonner.success as unknown as ToastFn) as typeof sonner.success;
base.error = wrap(sonner.error as unknown as ToastFn) as typeof sonner.error;
base.warning = wrap(sonner.warning as unknown as ToastFn) as typeof sonner.warning;
base.info = wrap(sonner.info as unknown as ToastFn) as typeof sonner.info;
base.message = wrap(sonner.message as unknown as ToastFn) as typeof sonner.message;
base.loading = wrap(sonner.loading as unknown as ToastFn) as typeof sonner.loading;

// Passa-diretos (não fazem sentido deduplicar).
base.custom = sonner.custom;
base.promise = sonner.promise;
base.dismiss = sonner.dismiss;

export const toast = base;
export type { ExternalToast };
