import { cn } from "@/lib/utils";

/**
 * Skeleton with the same silhouette as <ProductCard /> so the layout
 * doesn't shift when real data arrives. Uses a soft shimmer instead of
 * the default fade for a snappier perceived load.
 */
export function ProductCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-[22px]",
        "animate-pulse",
      )}
      style={{
        background:
          "linear-gradient(180deg, oklch(0.22 0.15 305 / 0.6) 0%, oklch(0.12 0.08 300 / 0.6) 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.05)",
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
          animation: "skeleton-shimmer 1.6s ease-in-out infinite",
          animationDelay: `${delay}ms`,
        }}
      />

      {/* Image area */}
      <div className="relative aspect-square w-full p-3">
        <div className="h-full w-full rounded-2xl bg-white/[0.06]" />
      </div>

      {/* Text block */}
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
        <div className="h-3 w-3/4 rounded-full bg-white/[0.08]" />
        <div className="h-2.5 w-1/2 rounded-full bg-white/[0.06]" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-4 w-16 rounded-full bg-white/[0.09]" />
          <div className="h-8 w-8 rounded-full bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}
