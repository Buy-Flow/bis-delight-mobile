import { cn } from "@/lib/utils";

/**
 * Wrapper shadcn compatível — delega para o sistema unificado `.sk`
 * (ver `src/components/skeleton/Sk.tsx` + `src/styles.css`).
 *
 * Timing, tom, radius, respeito a `prefers-reduced-motion` e o kill-switch
 * global vêm de `SkeletonProvider` via CSS vars (`--sk-*`). Não redefina
 * animação/pulse aqui — a duplicação foi o que gerou 3 sistemas paralelos.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("sk", className)} {...props} />;
}

export { Skeleton };
