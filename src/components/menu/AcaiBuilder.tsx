import { useState } from "react";
import { X, Check, Sparkles } from "lucide-react";
import { brl, useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSiteSettings } from "@/lib/menu-data";
import { DEFAULT_ACAI_CONFIG } from "@/lib/menu-data";
import acaiHero from "@/assets/monte-acai.png.asset.json";

export function AcaiBuilder({ onClose }: { onClose: () => void }) {
  const { add } = useCart();
  const { data: settings } = useSiteSettings();
  const cfg = settings?.acaiConfig ?? DEFAULT_ACAI_CONFIG;
  const SIZES = cfg.sizes.length ? cfg.sizes : DEFAULT_ACAI_CONFIG.sizes;
  const FRUITS = cfg.fruits;
  const CREAMS = cfg.creams;
  const EXTRAS = cfg.extras;

  const [sizeId, setSizeId] = useState(SIZES[Math.min(1, SIZES.length - 1)].id);
  const [fruits, setFruits] = useState<string[]>(FRUITS.slice(0, Math.min(2, FRUITS.length)));
  const [creams, setCreams] = useState<string[]>(CREAMS.slice(0, Math.min(1, CREAMS.length)));
  const [extras, setExtras] = useState<string[]>([]);

  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
  const extrasSel = EXTRAS.filter((e) => extras.includes(e.id));
  const unit =
    size.price +
    extrasSel.reduce((s, e) => s + e.price, 0) +
    Math.max(0, fruits.length - cfg.freeFruits) * cfg.extraFruitPrice +
    Math.max(0, creams.length - cfg.freeCreams) * cfg.extraCreamPrice;

  const toggle = (arr: string[], set: (a: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = () => {
    add({
      productId: "monte-acai",
      name: `Açaí Personalizado ${size.label}`,
      image: acaiHero.url,
      size: size.label,
      extras: [
        ...fruits.map((f) => ({ label: `Fruta: ${f}`, price: 0 })),
        ...creams.map((c) => ({ label: c, price: 0 })),
        ...extrasSel.map((e) => ({ label: e.label, price: e.price })),
      ],
      removed: [],
      quantity: 1,
      unitPrice: unit,
    });
    toast.success("Seu açaí foi montado e adicionado! 🍇");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300">
        {/* Big header */}
        <div className="relative h-[260px] shrink-0 overflow-hidden">
          <div className="absolute inset-0 noise-purple" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_60%,oklch(0.86_0.18_200_/_0.3),transparent_65%)]" />
          <img
            src={acaiHero.url}
            alt="Açaí"
            className="absolute inset-0 mx-auto h-full w-full object-contain p-4 drop-shadow-[0_25px_25px_rgba(0,0,0,0.5)] animate-float-slow"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[oklch(0.18_0.11_305)] via-[oklch(0.18_0.11_305)]/70 to-transparent px-4 pb-4 pt-8">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-neon-cyan/40">
              <Sparkles className="h-3 w-3" /> Especial da casa
            </div>
            <h2 className="font-display text-3xl font-extrabold text-neon-yellow glow-yellow-text leading-none">
              Monte seu açaí
            </h2>
            <p className="mt-1 text-[12px] text-white/70">
              Escolha tamanho, frutas, cremes e complementos.
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <Group title="1. Tamanho">
            <div className="grid grid-cols-2 gap-2">
              {ACAI_SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSizeId(s.id)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left transition",
                    s.id === sizeId
                      ? "border-neon-cyan bg-neon-cyan/10 glow-cyan"
                      : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="text-sm font-bold text-white">{s.label}</div>
                  <div className="text-neon-yellow text-lg font-extrabold">{brl(s.price)}</div>
                </button>
              ))}
            </div>
          </Group>

          <Group title="2. Frutas" hint="2 grátis · extras + R$2">
            <Grid>
              {ACAI_FRUITS.map((f) => (
                <Pill key={f} active={fruits.includes(f)} onClick={() => toggle(fruits, setFruits, f)}>
                  {f}
                </Pill>
              ))}
            </Grid>
          </Group>

          <Group title="3. Cremes" hint="1 grátis · extras + R$4">
            <Grid>
              {ACAI_CREAMS.map((c) => (
                <Pill key={c} active={creams.includes(c)} onClick={() => toggle(creams, setCreams, c)}>
                  {c}
                </Pill>
              ))}
            </Grid>
          </Group>

          <Group title="4. Complementos">
            <div className="space-y-2">
              {ACAI_EXTRAS.map((e) => {
                const on = extras.includes(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => toggle(extras, setExtras, e.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-3 py-3 transition",
                      on ? "border-neon-cyan bg-neon-cyan/10 glow-cyan" : "border-white/10 bg-white/5",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-md border",
                          on ? "border-neon-cyan bg-neon-cyan text-[oklch(0.18_0.11_305)]" : "border-white/30",
                        )}
                      >
                        {on && <Check className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium text-white">{e.label}</span>
                    </div>
                    <span className="text-sm font-bold text-neon-yellow">+ {brl(e.price)}</span>
                  </button>
                );
              })}
            </div>
          </Group>
          <div className="h-24" />
        </div>

        <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">Total do açaí</div>
              <div className="font-display text-2xl font-extrabold text-neon-yellow glow-yellow-text">
                {brl(unit)}
              </div>
            </div>
            <div className="text-right text-[11px] text-white/60">
              {fruits.length} frutas · {creams.length} cremes · {extrasSel.length} extras
            </div>
          </div>
          <button
            onClick={submit}
            className="w-full rounded-2xl bg-neon-pink px-4 py-4 text-base font-extrabold text-white glow-pink active:scale-[.98]"
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-display text-[15px] font-extrabold uppercase tracking-wide text-white">
          {title}
        </h4>
        {hint && <span className="text-[10px] text-white/50">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-2 py-3 text-[12px] font-semibold transition",
        active ? "border-neon-cyan bg-neon-cyan/10 text-white glow-cyan" : "border-white/10 bg-white/5 text-white/80",
      )}
    >
      {children}
    </button>
  );
}
