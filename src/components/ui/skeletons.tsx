import { cn } from "@/lib/utils";
import { ProductCardSkeleton } from "@/components/menu/ProductCardSkeleton";

/* =========================================================================
 * Skeleton primitives — wrappers sobre o sistema unificado `.sk`.
 *
 * Fonte única de verdade:
 *  - CSS: `src/styles.css` (`.sk`, `.sk--pulse`, `.sk--wave`, `.sk--static`,
 *    keyframes `sk-shimmer`/`sk-pulse`, vars `--sk-*`).
 *  - Provider: `src/components/skeleton/SkeletonProvider.tsx` (aplica as
 *    vars em `:root` a partir de `skeleton_settings`, com realtime).
 *  - Primitives: `src/components/skeleton/Sk.tsx` (Sk/SkCircle/SkText).
 *
 * Estes `Skel*` são mantidos apenas para não quebrar imports legados;
 * NÃO reimplementam shimmer nem timing. Qualquer ajuste (velocidade, tom,
 * variante, motion) muda TUDO de uma vez pelo provider.
 * ========================================================================= */

type BaseProps = React.HTMLAttributes<HTMLDivElement> & { delay?: number };

/** Retângulo base — delega para `.sk`. */
export function SkelBox({ className, delay = 0, style, ...props }: BaseProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("sk", className)}
      style={{ animationDelay: `${delay}ms`, ...style }}
      {...props}
    />
  );
}

/** Linha de texto (barra fina arredondada). */
export function SkelLine({
  w = "100%",
  h = 12,
  className,
  delay,
}: {
  w?: string | number;
  h?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <SkelBox
      delay={delay}
      className={cn("rounded-full", className)}
      style={{ width: w, height: h, borderRadius: 999 }}
    />
  );
}

/** Círculo. */
export function SkelCircle({
  size = 40,
  className,
  delay,
}: {
  size?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <SkelBox
      delay={delay}
      className={cn("rounded-full", className)}
      style={{ width: size, height: size, borderRadius: 9999 }}
    />
  );
}



/* =========================================================================
 * Skeletons compostos por tela
 * ========================================================================= */

/** Um card de pedido em /conta. */
export function OrderCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkelLine w={90} h={9} delay={delay} />
          <SkelLine w={70} h={18} delay={delay + 60} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <SkelBox
            delay={delay + 100}
            className="h-5 w-20 rounded-full"
          />
          <SkelLine w={54} h={8} delay={delay + 140} />
        </div>
      </div>

      {/* tracker row */}
      <div className="mt-4 flex items-center gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelBox
            key={i}
            delay={delay + 160 + i * 40}
            className="h-1.5 flex-1 rounded-full"
          />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        <SkelLine w="80%" h={10} delay={delay + 200} />
        <SkelLine w="55%" h={10} delay={delay + 240} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SkelBox delay={delay + 280} className="h-8 rounded-xl" />
        <SkelBox delay={delay + 320} className="h-8 rounded-xl" />
      </div>
    </div>
  );
}

export function OrdersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} delay={i * 120} />
      ))}
    </div>
  );
}

/** Grid de favoritos: reusa o skeleton do ProductCard para bater pixel a pixel
 *  com o card real (mesma altura de imagem `h-[175px]` + mesmo miolo). */
export function FavoritesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} delay={i * 90} />
      ))}
    </div>
  );
}

/** Painel de perfil (avatar + campos). */
export function ProfilePanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-neon-pink/10 via-white/5 to-neon-cyan/10 p-4">
        <div className="flex items-center gap-3">
          <SkelBox className="h-14 w-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <SkelLine w="60%" h={14} delay={80} />
            <SkelLine w="45%" h={10} delay={140} />
          </div>
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <SkelLine w={90} h={9} delay={i * 80} />
          <div className="mt-3">
            <SkelBox delay={i * 80 + 60} className="h-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Painel de fidelidade em /conta. */
export function LoyaltyPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-neon-yellow/30 bg-gradient-to-br from-neon-pink/15 via-purple-800/25 to-neon-cyan/10 p-5">
        <div className="flex items-center gap-3">
          <SkelCircle size={56} />
          <div className="flex-1 space-y-2">
            <SkelLine w={90} h={9} delay={60} />
            <SkelLine w={140} h={18} delay={120} />
          </div>
        </div>
        <div className="mt-5">
          <SkelLine w="35%" h={9} />
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <SkelBox
              delay={100}
              className="h-full rounded-full"
              style={{ width: "60%" }}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkelCircle key={i} size={28} delay={i * 40} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <SkelLine w="40%" h={12} />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkelBox key={i} delay={80 * i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Página /recompensas completa (hero + trilha + cupons). */
export function RecompensasSkeleton() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 pt-5 space-y-5">
      {/* Hero card */}
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#3a1f5c] via-[#4a2470] to-[#2a1240] p-6">
        <div className="flex items-center gap-3">
          <SkelCircle size={64} />
          <div className="flex-1 space-y-2">
            <SkelLine w={120} h={10} delay={60} />
            <SkelLine w={180} h={22} delay={120} />
            <SkelLine w={210} h={10} delay={180} />
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <SkelLine w={140} h={10} />
            <SkelBox className="h-12 w-28 rounded-lg" delay={80} />
          </div>
          <SkelBox className="h-14 w-24 rounded-2xl" delay={160} />
        </div>
        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <SkelBox className="h-full rounded-full" style={{ width: "45%" }} />
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkelCircle key={i} size={30} delay={i * 40} />
          ))}
        </div>
      </section>

      {/* Trilha de níveis */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <SkelLine w={160} h={14} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2"
            >
              <SkelCircle size={44} delay={i * 100} />
              <SkelLine w="70%" h={10} delay={i * 100 + 60} />
              <SkelLine w="50%" h={8} delay={i * 100 + 120} />
            </div>
          ))}
        </div>
      </section>

      {/* Cupons */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <SkelLine w={120} h={14} />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkelBox key={i} delay={i * 100} className="h-16 rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Página /rastrear/$orderId. */
export function TrackingPageSkeleton() {
  return (
    <main className="min-h-screen bg-[#1a0b2e] pb-24 text-white">
      <div className="sticky top-0 z-20 border-b border-white/5 bg-[#1a0b2e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <SkelBox className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkelLine w={160} h={12} delay={60} />
            <SkelLine w={90} h={9} delay={120} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {/* Hero animado */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neon-cyan/10 via-purple-900/30 to-neon-pink/10 p-5">
          <div className="flex items-center gap-3">
            <SkelCircle size={56} />
            <div className="flex-1 space-y-2">
              <SkelLine w={140} h={11} delay={60} />
              <SkelLine w={90} h={9} delay={120} />
            </div>
            <SkelBox className="h-8 w-20 rounded-full" delay={180} />
          </div>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <SkelBox className="h-full rounded-full" style={{ width: "55%" }} />
          </div>
          <div className="mt-3 flex justify-between">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkelLine key={i} w={54} h={8} delay={i * 60} />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <SkelLine w={120} h={12} />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <SkelCircle size={32} delay={i * 100} />
                <div className="flex-1 space-y-2 border-l border-white/10 pl-4 pb-4">
                  <SkelLine w="55%" h={11} delay={i * 100 + 60} />
                  <SkelLine w="35%" h={9} delay={i * 100 + 120} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Itens do pedido */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <SkelLine w={100} h={12} />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl bg-white/5 p-2"
              >
                <SkelBox delay={i * 80} className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkelLine w="65%" h={10} delay={i * 80 + 40} />
                  <SkelLine w="40%" h={8} delay={i * 80 + 100} />
                </div>
                <SkelLine w={40} h={12} delay={i * 80 + 140} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/** Linha de cliente em /clientes. */
export function ClientRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <li
      className="flex items-center gap-3 px-4 py-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <SkelCircle size={40} delay={delay} />
      <div className="flex-1 space-y-2">
        <SkelLine w="45%" h={11} delay={delay + 60} />
        <SkelLine w="30%" h={9} delay={delay + 120} />
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1.5">
        <SkelLine w={70} h={10} delay={delay + 160} />
        <SkelLine w={50} h={8} delay={delay + 220} />
      </div>
      <SkelBox delay={delay + 260} className="h-8 w-8 rounded-full" />
    </li>
  );
}

export function ClientsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="divide-y divide-purple-900/40">
      {Array.from({ length: count }).map((_, i) => (
        <ClientRowSkeleton key={i} delay={i * 80} />
      ))}
    </ul>
  );
}

/** Detalhes de cliente no dialog. */
export function ClientDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2"
          >
            <SkelLine w={60} h={8} delay={i * 60} />
            <SkelLine w={90} h={16} delay={i * 60 + 60} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <SkelLine w={120} h={12} />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelBox key={i} delay={i * 80} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** KPI dashboard financeiro. */
export function FinanceDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <SkelCircle size={32} delay={i * 80} />
              <SkelLine w={80} h={10} delay={i * 80 + 60} />
            </div>
            <SkelLine w="70%" h={22} delay={i * 80 + 120} />
            <SkelLine w="40%" h={8} delay={i * 80 + 180} />
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <SkelLine w={140} h={12} />
        <div className="mt-4 h-56 w-full">
          <SkelBox className="h-full w-full rounded-xl" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-white/10 bg-white/5 p-5"
          >
            <SkelLine w={120} h={12} />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <SkelBox key={j} delay={j * 60} className="h-10 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/** Full-page spinner substituto para bloqueadores admin. */
export function AdminGateSkeleton() {
  return (
    <main className="min-h-screen bg-[#1a0b2e] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <SkelLine w={200} h={22} />
        <SkelLine w={280} h={10} delay={80} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkelBox key={i} delay={i * 100} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
