// Web Vibration API wrapper — falha silenciosamente em desktop/iOS Safari.
// Padrões curtos para não parecer notificação; só reforço tátil de interação.

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function vibrate(pattern: number | number[]) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* noop */
  }
}

export const haptic = {
  /** Toque leve — botão qty +/-, seleção. */
  tap: () => vibrate(8),
  /** Clique médio — remoção, ação confirmatória. */
  medium: () => vibrate(14),
  /** Sucesso — pedido finalizado, cupom aplicado. */
  success: () => vibrate([10, 40, 20]),
  /** Erro — validação falhou. */
  error: () => vibrate([30, 60, 30]),
};
