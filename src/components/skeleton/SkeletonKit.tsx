import { Sk, SkCircle, SkText } from "./Sk";

/**
 * Ready-to-use skeleton compositions matching the app's real surfaces so
 * layouts don't shift when data arrives. Import these instead of spinners.
 */

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-2xl border bg-card/50 space-y-3">
          <div className="flex items-center justify-between">
            <Sk className="h-3 w-20" delay={i * 60} />
            <SkCircle size={28} delay={i * 60} />
          </div>
          <Sk className="h-7 w-24" delay={i * 60 + 30} />
          <Sk className="h-2 w-16" delay={i * 60 + 60} />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-card/40">
          {avatar && <SkCircle size={44} delay={i * 60} />}
          <div className="flex-1 space-y-2">
            <Sk className="h-3 w-1/2" delay={i * 60 + 20} />
            <Sk className="h-2.5 w-1/3" delay={i * 60 + 40} />
          </div>
          <Sk className="h-8 w-16" delay={i * 60 + 60} radius={999} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="grid gap-3 p-3 bg-muted/50" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className="h-3" delay={i * 40} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3 p-3 border-t"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Sk key={c} className="h-3" delay={r * 40 + c * 20} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ bars = 12, height = 220 }: { bars?: number; height?: number }) {
  return (
    <div
      className="rounded-2xl border p-4 flex items-end gap-2"
      style={{ height }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const h = 30 + ((i * 37) % 65);
        return (
          <Sk
            key={i}
            className="flex-1"
            delay={i * 50}
            style={{ height: `${h}%`, borderRadius: 6 }}
          />
        );
      })}
    </div>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Sk className="h-3 w-24" delay={i * 60} />
          <Sk className="h-10 w-full" delay={i * 60 + 40} />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Sk className="h-10 w-28" radius={999} />
        <Sk className="h-10 w-20" radius={999} />
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 8,
  aspect = "aspect-[3/4]",
}: {
  count?: number;
  aspect?: string;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Sk className={`w-full ${aspect}`} delay={i * 60} radius={22} />
          <Sk className="h-3 w-3/4" delay={i * 60 + 40} />
          <Sk className="h-2.5 w-1/2" delay={i * 60 + 80} />
        </div>
      ))}
    </div>
  );
}

/** Full-page shell for admin dashboards (used e.g. by /rush). */
export function AdminPageSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 bg-background">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-6 w-40" />
          <Sk className="h-3 w-64" delay={80} />
        </div>
        <div className="flex gap-2">
          <Sk className="h-10 w-24" radius={999} delay={120} />
          <Sk className="h-10 w-24" radius={999} delay={160} />
        </div>
      </div>
      <KpiRowSkeleton />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ListSkeleton rows={5} />
        <div className="space-y-4">
          <ChartSkeleton height={200} bars={10} />
          <ListSkeleton rows={3} avatar={false} />
        </div>
      </div>
    </div>
  );
}
