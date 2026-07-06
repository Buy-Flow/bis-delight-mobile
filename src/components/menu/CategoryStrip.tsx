import { CATEGORIES } from "@/data/menu";
import { cn } from "@/lib/utils";

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

      <div className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible scroll-px-4 px-4 py-4">
        {CATEGORIES.map((c) => {
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className={cn(
                "group relative snap-start shrink-0 rounded-2xl transition active:scale-95",
                "w-[104px] card-acai overflow-hidden",
                isActive && "glow-cyan",
              )}
            >
              <div className="relative h-[104px] w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/40" />
                <img
                  src={c.image}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-contain p-3 drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]"
                />
              </div>
              <div className="px-3 py-2 text-left">
                <div className="truncate text-[13px] font-bold text-white">
                  {c.name}
                </div>
                <div
                  className={cn(
                    "text-[10px]",
                    isActive ? "text-neon-cyan" : "text-white/50",
                  )}
                >
                  {isActive ? "Selecionado" : "Ver itens"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
