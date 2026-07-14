import { cn } from "@/lib/utils";

/**
 * Skeleton com a MESMA silhueta de <ProductCard /> para zerar o CLS entre
 * o placeholder e o card real.
 *
 * Espelho fiel de ProductCard.tsx:
 *  - Container: `rounded-2xl`, flex-col, altura conduzida pelo conteúdo.
 *  - Imagem: bloco fixo `h-[175px]` no topo (idêntico ao card real).
 *  - Conteúdo: `px-3 pt-3 pb-3`, título (~2 linhas 13.5px), linha de
 *    ingredientes, e rodapé com stack de preço + botão redondo `h-10 w-10`.
 *
 * Não usa `aspect-*` porque o card real NÃO tem aspect fixo — a altura
 * total varia conforme o número de linhas do título/ingredientes. Reservar
 * um aspect-ratio arbitrário faria o layout "pular" quando o card real
 * renderizasse com altura diferente.
 */
export function ProductCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // Usa o sistema unificado `.sk` (shimmer/pulse/motion vindos do
        // SkeletonProvider). O container inteiro é o skeleton — as caixas
        // internas apenas desenham a silhueta do card real.
        "sk relative flex h-full w-full flex-col overflow-hidden rounded-2xl",
      )}
      style={{
        background:
          "linear-gradient(180deg, oklch(0.22 0.15 305 / 0.6) 0%, oklch(0.12 0.08 300 / 0.6) 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.05)",
        animationDelay: `${delay}ms`,
        // Radius local vence o `--sk-radius` global só neste card.
        borderRadius: 22,
      }}
    >
      {/* Imagem — mesmo bloco `h-[175px]` do ProductCard real */}
      <div className="relative h-[175px] w-full overflow-hidden rounded-t-[22px] bg-white/[0.05]">
        {/* placeholder do círculo do favorito (top-right) */}
        <div className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/[0.08]" />
      </div>

      {/* Conteúdo — replica px-3 pt-3 pb-3 do card real */}
      <div className="relative flex flex-1 flex-col px-3 pt-3 pb-3">
        {/* Título (~2 linhas de 13.5px uppercase) */}
        <div className="space-y-1.5">
          <div className="h-3 w-11/12 rounded-full bg-white/[0.09]" />
          <div className="h-3 w-2/3 rounded-full bg-white/[0.07]" />
        </div>

        {/* Linha de ingredientes (mt-1.5, ~1 linha 9.5px) */}
        <div className="mt-1.5 h-2.5 w-4/5 rounded-full bg-white/[0.05]" />

        {/* Rodapé de preço + botão redondo (mt-3, botão h-10 w-10) */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-16 rounded-full bg-white/[0.06]" />
            <div className="h-5 w-20 rounded-md bg-white/[0.10]" />
          </div>
          <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.09]" />
        </div>
      </div>
    </div>
  );
}

