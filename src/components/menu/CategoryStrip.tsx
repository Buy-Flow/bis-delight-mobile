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
  hex: string; // personalized accent color for badge/glow
};

const ACCENTS: Record<string, Accent> = {
  all: {
    icon: Sparkles,
    bg: "bg-white/15",
    ring: "ring-white/70",
    glow: "shadow-[0_0_18px_rgba(255,255,255,0.25)]",
    hex: "#ffffff",
  },
  acai: {
    icon: Cherry,
    bg: "bg-[oklch(0.55_0.18_305)]",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.4)]",
    hex: "#b46bff",
  },
  tacas: {
    icon: IceCream2,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
    hex: "#ff4fb0",
  },
  mix: {
    icon: IceCream,
    bg: "bg-neon-cyan",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.5)]",
    hex: "#5ee7ff",
  },
  kids: {
    icon: Baby,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
    hex: "#ff8ad0",
  },
  casquinhas: {
    icon: Cookie,
    bg: "bg-neon-yellow",
    ring: "ring-neon-yellow",
    glow: "shadow-[0_0_18px_oklch(0.92_0.20_100/0.5)]",
    hex: "#ffd94a",
  },
  shakes: {
    icon: GlassWater,
    bg: "bg-neon-cyan",
    ring: "ring-neon-cyan",
    glow: "shadow-[0_0_18px_oklch(0.86_0.18_200/0.5)]",
    hex: "#7de3ff",
  },
  copos: {
    icon: CupSoda,
    bg: "bg-neon-pink",
    ring: "ring-neon-pink",
    glow: "shadow-[0_0_18px_oklch(0.72_0.26_350/0.5)]",
    hex: "#ff6dbf",
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
                "group relative snap-start shrink-0 w-[100px] h-[150px] rounded-[22px]",
                "transition active:scale-95",
                isActive && `${accent.glow}`,
              )}
              style={{
                boxShadow:
                  "0 14px 24px -12px rgba(0,0,0,0.75), 0 3px 8px -3px rgba(0,0,0,0.55)",
              }}
            >

              <div
                className={cn(
                  "relative h-full w-full overflow-hidden rounded-[20px]",
                  "bg-[#2a0a5c]",
                  isActive && `ring-2 ${accent.ring}`,
                )}
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 30%, oklch(0.28 0.16 305) 0%, #2a0a5c 55%, #1a0538 100%)",
                }}
              >
                {/* Top photo area */}
                <div
                  className="relative h-[80px] w-full overflow-hidden"
                  style={{
                    boxShadow:
                      "inset 0 6px 12px -5px rgba(0,0,0,0.7), inset 0 -4px 10px -4px rgba(0,0,0,0.5)",
                  }}
                >
                  <img
                    src={c.image}
                    alt={c.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.4)_100%)]" />
                  {/* Bottom fade into card */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-[#2a0a5c]" />
                </div>

                {/* Personalized icon badge — uses category's Lucide icon + hex color */}
                <div
                  className="absolute left-1/2 top-[80px] grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #4a1a9c 0%, #2a0a5c 70%, #180533 100%)",
                    boxShadow: `0 4px 10px rgba(0,0,0,0.55), inset 0 0 0 1.5px ${accent.hex}aa, inset 0 1px 0 rgba(255,255,255,0.15), 0 0 12px ${accent.hex}55`,
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={2.4}
                    style={{
                      color: accent.hex,
                      filter: `drop-shadow(0 0 4px ${accent.hex}88)`,
                    }}
                  />
                </div>

                {/* White label */}
                <div className="absolute inset-x-0 bottom-3 px-1.5 text-center">
                  <div
                    className="truncate text-[10.5px] font-black uppercase tracking-[0.14em] text-white"
                    style={{
                      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    {c.name}
                  </div>
                </div>
              </div>
            </button>
          );

        })}
      </div>
    </section>
  );
}

