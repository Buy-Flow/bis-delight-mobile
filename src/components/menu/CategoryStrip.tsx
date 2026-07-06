import { CATEGORIES } from "@/data/menu";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Cherry,
  IceCream,
  IceCream2,
  Cookie,
  Baby,
  GlassWater,
  CupSoda,
  type LucideIcon,
} from "lucide-react";

type Accent = {
  icon: LucideIcon;
  bg: string; // solid bg for icon circle
  ring: string; // active ring color
  glow: string; // active shadow color
};

const ACCENTS: Record<string, Accent> = {
  all: {
    icon: Sparkles,
    bg: "bg-white/15",
    ring: "ring-white/70",
    glow: "shadow-[0_0_18px_rgba(255,255,255,0.25)]",
  },
  acai: {
    icon: Cherry,
    bg: "bg-[oklch(0.55_0.18_305)]",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.4)]",
  },
  tacas: {
    icon: IceCream2,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
  },
  mix: {
    icon: IceCream,
    bg: "bg-neon-cyan",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.5)]",
  },
  kids: {
    icon: Baby,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
  },
  casquinhas: {
    icon: Cookie,
    bg: "bg-neon-yellow",
    ring: "ring-neon-yellow",
    glow: "shadow-[0_0_18px_oklch(0.92_0.20_100/0.5)]",
  },
  shakes: {
    icon: GlassWater,
    bg: "bg-neon-cyan",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.5)]",
  },
  copos: {
    icon: CupSoda,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
  },
};

export function CategoryStrip({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <section id="categorias" className="pb-4">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="font-display text-xl font-extrabold text-white">
          Categorias
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-white/50">
          Deslize →
        </span>
      </div>

      <div className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4 pt-2">
        {CATEGORIES.map((c) => {
          const isActive = active === c.id;
          const accent = ACCENTS[c.id] ?? ACCENTS.all;
          const Icon = accent.icon;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              aria-pressed={isActive}
              className={cn(
                "group relative snap-start shrink-0 w-[124px] h-[188px] rounded-[24px]",
                "bg-[oklch(0.20_0.12_305)] transition active:scale-95 overflow-hidden",
                "ring-1 ring-white/10",
                isActive && `ring-2 ${accent.ring} ${accent.glow}`,
              )}
            >
              {/* Photo top area */}
              <div className="relative h-[118px] w-full overflow-hidden">
                <img
                  src={c.image}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/* fade to card bg */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[oklch(0.20_0.12_305)]" />
              </div>

              {/* Icon circle overlapping */}
              <div
                className={cn(
                  "absolute left-1/2 top-[100px] grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full",
                  accent.bg,
                  "ring-4 ring-[oklch(0.20_0.12_305)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    accent.bg === "bg-neon-yellow"
                      ? "text-[oklch(0.18_0.11_305)]"
                      : "text-white",
                  )}
                  strokeWidth={2.2}
                />
              </div>

              {/* Label */}
              <div className="absolute inset-x-0 bottom-4 px-2 text-center">
                <div className="truncate text-[13px] font-extrabold uppercase tracking-wider text-white">
                  {c.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
