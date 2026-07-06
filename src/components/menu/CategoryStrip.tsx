import { CATEGORIES as STATIC_CATEGORIES } from "@/data/menu";
import { useCategories } from "@/lib/menu-data";

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
  const { data } = useCategories();
  const CATEGORIES = data && data.length > 0 ? data : STATIC_CATEGORIES;
  return (
    <section id="categorias" className="pb-2">
      <div className="hide-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-3 pt-1">
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
                "group relative snap-start shrink-0 w-[72px] h-[104px] rounded-[16px]",
                "transition active:scale-95",
                isActive && `${accent.glow}`,
              )}
              style={{
                boxShadow:
                  "0 8px 16px -8px rgba(0,0,0,0.7), 0 2px 6px -2px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className={cn(
                  "relative h-full w-full overflow-hidden rounded-[14px]",
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
                  className="relative h-[68px] w-full overflow-hidden"
                  style={{
                    boxShadow:
                      "inset 0 4px 8px -3px rgba(0,0,0,0.7), inset 0 -3px 8px -3px rgba(0,0,0,0.5)",
                  }}
                >
                  <img
                    src={c.image}
                    alt={c.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      transform: `translate(${c.imagePosX ?? 0}%, ${c.imagePosY ?? 0}%) scale(${c.imageScale ?? 1})`,
                      transformOrigin: "center",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.4)_100%)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-b from-transparent to-[#2a0a5c]" />
                </div>

                {/* Icon badge */}
                <div
                  className="absolute left-1/2 top-[68px] grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #4a1a9c 0%, #2a0a5c 70%, #180533 100%)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.35)",
                  }}
                >
                  <Icon
                    className="h-[12px] w-[12px]"
                    strokeWidth={2.4}
                    style={{ color: "#ffffff" }}
                  />
                </div>

                {/* Label */}
                <div className="absolute inset-x-0 bottom-1.5 px-1 text-center">
                  <div
                    className="truncate text-[8.5px] font-black uppercase tracking-[0.1em] text-white"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
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


