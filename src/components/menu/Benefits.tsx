import { Truck, Snowflake, Heart } from "lucide-react";

const items = [
  { icon: Truck, title: "Entrega rápida", sub: "Chegou quentinho — quer dizer, geladinho." },
  { icon: Snowflake, title: "Sempre fresco", sub: "Batido na hora, servido no ponto." },
  { icon: Heart, title: "Feito pra você", sub: "Personalize cada colher do seu jeito." },
];

export function Benefits() {
  return (
    <section className="px-4 pb-6">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="card-acai rounded-2xl p-3 text-center"
          >
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/40">
              <it.icon className="h-4 w-4" />
            </div>
            <div className="text-[12px] font-bold leading-tight text-white">
              {it.title}
            </div>
            <div className="mt-1 text-[10px] leading-tight text-white/60">
              {it.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
