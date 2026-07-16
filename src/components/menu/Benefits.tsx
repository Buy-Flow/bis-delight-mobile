import { Timer, GlassWater, Heart } from "lucide-react";

const items = [
  {
    icon: Timer,
    color: "text-neon-pink",
    anim: "animate-spin-slow",
    title: "Entrega rápida",
    sub: "em toda região",
  },
  {
    icon: GlassWater,
    color: "text-neon-cyan",
    anim: "animate-bob",
    title: "Produtos",
    sub: "preparados com amor",
  },
  {
    icon: Heart,
    color: "text-neon-yellow",
    anim: "animate-heartbeat",
    title: "Feito com amor",
    sub: "os melhores ingredientes",
  },

];


export function Benefits() {
  return (
    <section className="relative z-30 -mt-1 px-4 pb-6">
      <div
        className="rounded-4xl border border-white/10 bg-white/[0.04] px-2 py-4 shadow-lg backdrop-blur-sm"
      >


        <div className="grid grid-cols-3 items-center divide-x divide-white/15">
          {items.map((it) => (
            <div
              key={it.title}
              className="flex items-center gap-2 px-2 first:pl-1 last:pr-1"
            >
              <it.icon
                className={`h-7 w-7 shrink-0 ${it.color} ${it.anim}`}
                strokeWidth={2.25}
              />

              <div className="min-w-0 text-[9.5px] font-medium leading-[1.25] tracking-tight text-white">
                <div className="font-semibold">{it.title}</div>
                <div className="font-light text-white/70">{it.sub}</div>
              </div>


            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
