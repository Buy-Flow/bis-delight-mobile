import { Timer, GlassWater, Heart } from "lucide-react";

const items = [
  {
    icon: Timer,
    color: "text-neon-pink",
    title: "Entrega rápida",
    sub: "em toda região",
  },
  {
    icon: GlassWater,
    color: "text-neon-cyan",
    title: "Produtos",
    sub: "preparados com amor",
  },
  {
    icon: Heart,
    color: "text-neon-yellow",
    title: "Feito com amor",
    sub: "os melhores ingredientes",
  },

];

export function Benefits() {
  return (
    <section className="px-4 pb-6">
      <div className="rounded-[36px] bg-[#c8b3e0] px-4 py-5 shadow-lg">
        <div className="grid grid-cols-3 items-center divide-x divide-white/50">
          {items.map((it) => (
            <div
              key={it.title}
              className="flex items-center gap-2 px-2 first:pl-0 last:pr-0"
            >
              <it.icon
                className={`h-9 w-9 shrink-0 ${it.color}`}
                strokeWidth={2.25}
              />
              <div className="min-w-0 text-[11px] font-bold leading-tight text-slate-800">
                <div>{it.title}</div>
                <div className="font-semibold text-slate-700">{it.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
