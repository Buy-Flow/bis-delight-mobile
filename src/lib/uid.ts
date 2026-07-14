/**
 * Geração de identificadores únicos.
 *
 * Padroniza o uso de `crypto.randomUUID()` em todo o app, substituindo
 * o antigo padrão `Math.random().toString(36)` (previsível, com risco
 * real de colisão em loops rápidos ou renders concorrentes).
 *
 * Fallback: em runtimes muito antigos onde `crypto.randomUUID` não
 * exista, usa `crypto.getRandomValues` para gerar 16 bytes aleatórios
 * criptograficamente seguros e formata como UUID v4.
 */

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

function getCrypto(): CryptoLike | null {
  if (typeof globalThis !== "undefined" && (globalThis as { crypto?: CryptoLike }).crypto) {
    return (globalThis as { crypto?: CryptoLike }).crypto ?? null;
  }
  return null;
}

/** UUID v4 completo (36 chars). Use quando precisa de unicidade global. */
export function uid(): string {
  const c = getCrypto();
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // último recurso — não deve ocorrer em browsers/Workers modernos
  return `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fragmento curto derivado de um UUID v4 (default: 8 chars).
 * Uso: chaves locais de UI, `uid` de linhas de carrinho, IDs efêmeros
 * de drafts. NÃO usar para persistência ou chaves primárias.
 */
export function shortUid(length = 8): string {
  const clamped = Math.max(4, Math.min(32, length));
  return uid().replace(/-/g, "").slice(0, clamped);
}
