// Utilitário central para lidar com erros que costumavam ser silenciados.
// - Sempre loga no console com um escopo claro (fica visível em dev/prod devtools).
// - Envia para window.__querobis_errors__ (buffer curto) para diagnóstico.
// - Detecta QuotaExceededError do localStorage e devolve flag para o chamador
//   decidir se mostra um toast para o usuário.

export type SilentErrorScope =
  | "cart:persist"
  | "cart:abandoned-sync"
  | "checkout:load-saved"
  | "checkout:save-customer"
  | string;

type ErrRecord = { scope: SilentErrorScope; message: string; at: number };

function pushBuffer(rec: ErrRecord) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __querobis_errors__?: ErrRecord[] };
  if (!w.__querobis_errors__) w.__querobis_errors__ = [];
  w.__querobis_errors__.push(rec);
  if (w.__querobis_errors__.length > 50) w.__querobis_errors__.shift();
}

export function isQuotaExceeded(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014
  );
}

export function logSilent(scope: SilentErrorScope, err: unknown): { quota: boolean } {
  const quota = isQuotaExceeded(err);
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(`[${scope}]`, err);
  pushBuffer({ scope, message, at: Date.now() });
  return { quota };
}
