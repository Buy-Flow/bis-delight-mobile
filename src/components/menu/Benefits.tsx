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
    <section className="relative z-30 mt-2 px-4 pb-6">
      <div
        className="rounded-[32px] border border-white/10 px-3 py-4 shadow-lg"
        style={{ backgroundColor: "#3a1f5c" }}
      >

        <div className="grid grid-cols-3 items-center divide-x divide-white/20">
          {items.map((it) => (
            <div
              key={it.title}
              className="flex items-center gap-1.5 px-1.5 first:pl-0 last:pr-0"
            >
              <it.icon
                className={`h-7 w-7 shrink-0 ${it.color} ${it.anim}`}
                strokeWidth={2.25}
              />

              <div className="min-w-0 text-[9px] font-medium leading-snug tracking-tight text-white">
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
