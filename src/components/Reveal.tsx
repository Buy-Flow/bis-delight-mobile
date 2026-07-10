import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// NOTA: Reveal foi neutralizado de propósito.
// Versões anteriores usavam IntersectionObserver + opacity/translate para animar
// a entrada das seções. Em navegação entre rotas com scroll restaurado (voltar
// de /favoritos, /recompensas, /carrinho para /), algumas seções ficavam presas
// em opacity:0 e o conteúdo "sumia" — bug reportado repetidas vezes.
// Preferimos renderização estável a animação bonita. Se quiser reintroduzir
// animação, faça-o via CSS puro (@keyframes) sem nunca começar com opacity:0.

type Direction = "up" | "down" | "left" | "right" | "none";

export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  distance?: number;
  duration?: number;
  once?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const Comp = Tag as unknown as React.ElementType;
  return <Comp className={cn(className)}>{children}</Comp>;
}
