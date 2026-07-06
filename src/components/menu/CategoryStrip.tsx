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

      <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 pt-2">
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
                "group relative snap-start shrink-0 w-[150px] h-[230px] rounded-[32px]",
                "bg-[#280a66] transition active:scale-95 overflow-hidden",
                "shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)]",
                "ring-1 ring-white/5",
                isActive && `ring-2 ${accent.ring} ${accent.glow}`,
              )}
            >
              {/* Photo top area (60%) */}
              <div className="relative h-[138px] w-full overflow-hidden">
                <img
                  src={c.image}
                  alt={c.name}
                  className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,0.55)]"
                />
                {/* fade to card bg */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[#280a66]" />
              </div>

              {/* Icon circle overlapping the seam */}
              <div
                className="absolute left-1/2 top-[138px] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#3d1a8a] ring-2 ring-[#7c5fd6]/70 shadow-[0_0_14px_rgba(124,95,214,0.35)]"
              >
                <Icon
                  className="h-6 w-6 text-white"
                  strokeWidth={2}
                />
              </div>

              {/* Label */}
              <div className="absolute inset-x-0 bottom-5 px-3 text-center">
                <div className="truncate text-[15px] font-black uppercase tracking-wide text-white">
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
