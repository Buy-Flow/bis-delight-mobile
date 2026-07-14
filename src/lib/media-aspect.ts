/**
 * Canonical media aspect ratios.
 *
 * Espelha os utilitários CSS definidos em `src/styles.css`
 * (`aspect-banner`, `aspect-story`, `aspect-tile`, `aspect-wide`).
 * Use estes tokens em qualquer TS/JSX que precise do ratio
 * numérico (crop de canvas, validação de upload, `next/image`,
 * cálculo de altura a partir da largura).
 *
 * Regra: NUNCA hardcode `aspect-[16/10]` ou `aspect-[9/16]` em
 * novos componentes. Importe a classe CSS ou o número daqui.
 */

export const MEDIA_ASPECT = {
  banner: { w: 16, h: 10, ratio: 16 / 10, className: "aspect-banner" },
  story:  { w: 9,  h: 16, ratio: 9 / 16,  className: "aspect-story"  },
  tile:   { w: 1,  h: 1,  ratio: 1,       className: "aspect-tile"   },
  wide:   { w: 21, h: 9,  ratio: 21 / 9,  className: "aspect-wide"   },
} as const;

export type MediaAspectKind = keyof typeof MEDIA_ASPECT;

/** Retorna altura em px para uma dada largura, preservando o ratio. */
export function heightFor(kind: MediaAspectKind, width: number): number {
  return Math.round(width / MEDIA_ASPECT[kind].ratio);
}
