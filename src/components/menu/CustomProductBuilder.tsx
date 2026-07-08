import { useMemo, useState } from "react";
import { X, Check, Sparkles, Minus, Plus } from "lucide-react";
import { brl, useCart, type CartItem } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Product, OptionGroup, OptionItem } from "@/data/menu";

type Selection = Record<string, string[]>;

function computeUnit(groups: OptionGroup[], selection: Selection): number {
  let total = 0;
  for (const g of groups) {
    const picked = selection[g.id] ?? [];
    const items = g.options.filter((o) => picked.includes(o.id));
    total += items.reduce((s, o) => s + (o.price || 0), 0);
    const free = g.freeCount ?? 0;
    const extra = g.pricePerExtra ?? 0;
    if (extra > 0 && picked.length > free) {
      total += (picked.length - free) * extra;
    }
  }
  return total;
}

function initialSelection(groups: OptionGroup[]): Selection {
  const sel: Selection = {};
  for (const g of groups) {
    if (g.type === "single") {
      if (g.required && g.options[0]) sel[g.id] = [g.options[0].id];
      else sel[g.id] = [];
    } else {
      // Pré-seleciona os "grátis" no início
      const free = g.freeCount ?? 0;
      sel[g.id] = free > 0 ? g.options.slice(0, free).map((o) => o.id) : [];
    }
  }
  return sel;
}

export function CustomProductBuilder({
  product,
  onClose,
  editItem,
}: {
  product: Product;
  onClose: () => void;
  editItem?: CartItem | null;
}) {
  const { add, update } = useCart();
  const groups = useMemo(() => product.optionGroups ?? [], [product.optionGroups]);

  const seededSelection = useMemo<Selection>(() => {
    if (!editItem) return initialSelection(groups);
    const sel: Selection = {};
    const extraLabels = new Set(editItem.extras.map((e) => e.label));
    for (const g of groups) {
      if (g.type === "single") {
        // Try to match by editItem.size
        const match = g.options.find((o) => o.label === editItem.size);
        if (match) sel[g.id] = [match.id];
        else if (g.required && g.options[0]) sel[g.id] = [g.options[0].id];
        else sel[g.id] = [];
      } else {
        sel[g.id] = g.options
          .filter((o) => extraLabels.has(`${g.name}: ${o.label}`))
          .map((o) => o.id);
      }
    }
    return sel;
  }, [groups, editItem]);

  const [sel, setSel] = useState<Selection>(seededSelection);
  const [qty, setQty] = useState(editItem?.quantity ?? 1);

  const unit = useMemo(() => computeUnit(groups, sel), [groups, sel]);
  const total = unit * qty;

  const toggle = (g: OptionGroup, optId: string) => {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.type === "single") {
        return { ...prev, [g.id]: cur[0] === optId ? (g.required ? cur : []) : [optId] };
      }
      const has = cur.includes(optId);
      return { ...prev, [g.id]: has ? cur.filter((x) => x !== optId) : [...cur, optId] };
    });
  };

  const canSubmit = groups.every((g) => {
    if (!g.required) return true;
    return (sel[g.id] ?? []).length > 0;
  });

  const submit = () => {
    if (!canSubmit) {
      toast.error("Escolha as opções obrigatórias.");
      return;
    }
    // Build cart extras list from all selections
    const extras: { label: string; price: number }[] = [];
    let sizeLabel = "";
    for (const g of groups) {
      const picked = (sel[g.id] ?? [])
        .map((id) => g.options.find((o) => o.id === id))
        .filter((o): o is OptionItem => !!o);
      if (g.type === "single") {
        if (picked[0]) sizeLabel = picked[0].label;
        continue;
      }
      const free = g.freeCount ?? 0;
      const extra = g.pricePerExtra ?? 0;
      picked.forEach((o, idx) => {
        // Distribute extra fee to the items beyond `free`
        const feeShare = extra > 0 && idx >= free ? extra : 0;
        extras.push({
          label: `${g.name}: ${o.label}`,
          price: (o.price || 0) + feeShare,
        });
      });
    }
    const payload = {
      productId: product.id,
      name: sizeLabel ? `${product.name} — ${sizeLabel}` : product.name,
      image: product.image,
      size: sizeLabel || undefined,
      extras,
      removed: [],
      quantity: qty,
      unitPrice: unit,
    };
    if (editItem) {
      update(editItem.uid, payload);
      toast.success("Item atualizado! ✨");
    } else {
      add(payload);
      toast.success("Adicionado ao carrinho! 🛒");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="relative h-[220px] shrink-0 overflow-hidden">
          <div className="absolute inset-0 noise-purple" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_60%,oklch(0.86_0.18_200_/_0.3),transparent_65%)]" />
          {product.image && (
            <img
              src={product.image}
              alt={product.name}
              className="absolute inset-0 mx-auto h-full w-full object-contain p-4 drop-shadow-[0_25px_25px_rgba(0,0,0,0.5)] animate-float-slow"
            />
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[oklch(0.18_0.11_305)] via-[oklch(0.18_0.11_305)]/70 to-transparent px-4 pb-4 pt-8">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-neon-cyan/40">
              <Sparkles className="h-3 w-3" /> Personalizado
            </div>
            <h2 className="font-display text-3xl font-extrabold text-neon-yellow glow-yellow-text leading-none">
              {product.name}
            </h2>
            {product.description && (
              <p className="mt-1 text-[12px] text-white/70">{product.description}</p>
            )}
          </div>
        </div>

        {/* Groups */}
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {groups.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/60">
              Este produto ainda não tem opções configuradas.
            </div>
          )}

          {groups.map((g, gi) => {
            const picked = sel[g.id] ?? [];
            const hint =
              g.type === "multi" && ((g.freeCount ?? 0) > 0 || (g.pricePerExtra ?? 0) > 0)
                ? `${g.freeCount ?? 0} grátis${
                    (g.pricePerExtra ?? 0) > 0 ? ` · extras + ${brl(g.pricePerExtra ?? 0)}` : ""
                  }`
                : g.required
                  ? "obrigatório"
                  : undefined;
            return (
              <div key={g.id}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h4 className="font-display text-[15px] font-extrabold uppercase tracking-wide text-white">
                    {gi + 1}. {g.name}
                  </h4>
                  {hint && <span className="text-[10px] text-white/50">{hint}</span>}
                </div>

                {g.type === "single" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {g.options.map((o) => {
                      const active = picked[0] === o.id;
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggle(g, o.id)}
                          className={cn(
                            "rounded-2xl border px-3 py-3 text-left transition",
                            active
                              ? "border-neon-cyan bg-neon-cyan/10 glow-cyan"
                              : "border-white/10 bg-white/5",
                          )}
                        >
                          <div className="text-sm font-bold text-white">{o.label}</div>
                          {o.price > 0 && (
                            <div className="text-neon-yellow text-lg font-extrabold">
                              {brl(o.price)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {g.options.map((o) => {
                      const on = picked.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggle(g, o.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-2xl border px-3 py-3 transition",
                            on
                              ? "border-neon-cyan bg-neon-cyan/10 glow-cyan"
                              : "border-white/10 bg-white/5",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "grid h-6 w-6 place-items-center rounded-md border",
                                on
                                  ? "border-neon-cyan bg-neon-cyan text-[oklch(0.18_0.11_305)]"
                                  : "border-white/30",
                              )}
                            >
                              {on && <Check className="h-4 w-4" />}
                            </div>
                            <span className="text-sm font-medium text-white">{o.label}</span>
                          </div>
                          {o.price > 0 && (
                            <span className="text-sm font-bold text-neon-yellow">
                              + {brl(o.price)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="h-24" />
        </div>

        {/* Footer — padrão: stepper + pill rosa com o valor no botão */}
        <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="Diminuir"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white active:scale-95"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-6 text-center text-base font-bold text-white">{qty}</div>
              <button
                onClick={() => setQty(qty + 1)}
                aria-label="Aumentar"
                className="grid h-9 w-9 place-items-center rounded-full bg-neon-cyan text-[oklch(0.18_0.11_305)] active:scale-95"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex-1 rounded-2xl bg-neon-pink px-4 py-3 text-base font-extrabold text-white glow-pink touch-manipulation [-webkit-tap-highlight-color:transparent] will-change-transform transition-transform duration-100 ease-out active:scale-[.97] disabled:opacity-50"
            >
              {brl(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
