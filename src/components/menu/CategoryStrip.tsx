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
                "group relative snap-start shrink-0 w-[100px] h-[150px] overflow-hidden rounded-[22px]",
                "bg-[#2a0a5c] ring-1 ring-white/10 transition active:scale-95",
                "shadow-[0_12px_22px_-10px_rgba(0,0,0,0.7),0_3px_8px_-3px_rgba(0,0,0,0.5)]",
                isActive && `ring-2 ${accent.ring} ${accent.glow}`,
              )}
            >
              {/* Top photo */}
              <div className="relative h-[80px] w-full overflow-hidden">
                <img
                  src={c.image}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/* Bottom fade into card */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-[#2a0a5c]" />
              </div>

              {/* Purple badge with white flat spark */}
              <div className="absolute left-1/2 top-[80px] grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#3a1585] ring-1 ring-white/15">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white" aria-hidden="true">
                  <path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" />
                  <circle cx="19" cy="5" r="1.4" />
                </svg>
              </div>

              {/* White label */}
              <div className="absolute inset-x-0 bottom-3 px-1.5 text-center">
                <div className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-white">
                  {c.name}
                </div>
              </div>

              {/* Hide unused accent icon (kept import for backwards compat) */}
              <span className="hidden">
                <Icon className="h-0 w-0" />
              </span>
            </button>
          );


        })}
      </div>
    </section>
  );
}
