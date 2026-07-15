export function detectCardBrand(num: string): string | null {
  const n = num.replace(/\D/g, "");
  if (!n) return null;
  if (/^(4011|4312|4389|4514|4573|5041|5066|5067|6277|6362|6363|6516|6550)/.test(n)) return "Elo";
  if (/^(606282|3841)/.test(n)) return "Hipercard";
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  return null;
}
