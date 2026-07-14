/**
 * Utilidades unificadas para telefones brasileiros.
 * Fonte única de verdade — não reimplementar em outros arquivos.
 */

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Normaliza para dígitos locais (sem código de país 55).
 * Corrige o caso de fixo (10 dígitos) que veio com um "9" inserido por engano.
 */
export function normalizePhoneBR(s: string | null | undefined): string {
  let d = onlyDigits(s);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  // Fixo com 9 inserido por engano: 11 dígitos e terceiro dígito != 9 → remover o dígito extra
  if (d.length === 11 && d[2] !== "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

/**
 * Formato canônico de exibição:
 *   Celular: (XX) XXXXX-XXXX
 *   Fixo:    (XX) XXXX-XXXX
 * Retorna a string original se não for possível reconhecer.
 */
export function formatPhone(s: string | null | undefined): string {
  const raw = s ?? "";
  const d = normalizePhoneBR(raw);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw || "—";
}

/**
 * Máscara progressiva para inputs (conforme o usuário digita).
 * Mantém o mesmo formato final de formatPhone().
 */
export function maskPhoneInput(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
