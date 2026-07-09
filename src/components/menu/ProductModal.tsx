import { useMemo, useRef, useState } from "react";
import { Minus, Plus, X, Check, Sparkles, ChevronsUpDown } from "lucide-react";
import { FavoriteButton } from "@/components/menu/FavoriteButton";
import type { ExtraOption, OptionGroup, OptionItem, Product } from "@/data/menu";
import { brl, useCart, type CartItem } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSiteSettings, useCategories } from "@/lib/menu-data";


const CATEGORY_LABEL: Record<string, string> = {
  acai: "Açaí artesanal",
  copos: "Copo especial",
  tacas: "Taça premium",
  shakes: "Shake cremoso",
  mix: "Mix da casa",
  kids: "Linha kids",
  casquinhas: "Casquinha",
};


/* Default customization pools by category — used when a product doesn't
   define its own extras/removable so every item has a rich "Personalizar" flow. */
const DEFAULT_EXTRAS_ACAI: ExtraOption[] = [
  { id: "d-leite-condensado", label: "Leite Condensado", price: 2 },
  { id: "d-creme-ninho", label: "Creme de Ninho", price: 3 },
  { id: "d-nutella", label: "Nutella", price: 4 },
  { id: "d-ovomaltine", label: "Ovomaltine", price: 3 },
  { id: "d-morango", label: "Morango fresco", price: 3 },
  { id: "d-banana", label: "Banana", price: 2 },
  { id: "d-granola", label: "Granola", price: 2 },
  { id: "d-pacoca", label: "Paçoca", price: 2 },
  { id: "d-chocoball", label: "Chocoball", price: 3 },
  { id: "d-leite-po", label: "Leite em Pó", price: 2 },
];

const DEFAULT_EXTRAS_TACA: ExtraOption[] = [
  { id: "t-chantilly-extra", label: "Chantilly extra", price: 3 },
  { id: "t-calda-quente", label: "Calda Quente", price: 3 },
  { id: "t-nutella", label: "Nutella", price: 4 },
  { id: "t-bombom", label: "Bombom extra", price: 5 },
  { id: "t-cereja", label: "Cereja", price: 2 },
  { id: "t-granulado", label: "Granulado", price: 2 },
  { id: "t-raspas-choc", label: "Raspas de Chocolate", price: 3 },
];

const DEFAULT_EXTRAS_SHAKE: ExtraOption[] = [
  { id: "s-chantilly", label: "Chantilly no topo", price: 3 },
  { id: "s-calda-choc", label: "Calda de Chocolate", price: 3 },
  { id: "s-calda-morango", label: "Calda de Morango", price: 3 },
  { id: "s-oreo", label: "Oreo triturado", price: 4 },
  { id: "s-nutella", label: "Nutella", price: 4 },
  { id: "s-canudo-gigante", label: "Canudo gigante", price: 1 },
];

const DEFAULT_EXTRAS_MIX: ExtraOption[] = [
  { id: "m-chantilly", label: "Chantilly", price: 3 },
  { id: "m-nutella", label: "Nutella", price: 4 },
  { id: "m-ninho", label: "Creme de Ninho", price: 3 },
  { id: "m-morango", label: "Morango fresco", price: 3 },
  { id: "m-pacoca", label: "Paçoca", price: 2 },
];

export function getDefaultExtras(category: string): ExtraOption[] {
  switch (category) {
    case "acai":
    case "copos":
      return DEFAULT_EXTRAS_ACAI;
    case "tacas":
      return DEFAULT_EXTRAS_TACA;
    case "shakes":
      return DEFAULT_EXTRAS_SHAKE;
    case "mix":
    case "kids":
    case "casquinhas":
      return DEFAULT_EXTRAS_MIX;
    default:
      return DEFAULT_EXTRAS_MIX;
  }
}


export function ProductModal({
  product,
  onClose,
  editItem,
}: {
  product: Product | null;
  onClose: () => void;
  editItem?: CartItem | null;
}) {
  const { add, update } = useCart();
  const { data: settings } = useSiteSettings();
  const { data: categories = [] } = useCategories();

  // Resolve extras pool up-front for initial state derivation
  const resolveExtras = (p: Product): ExtraOption[] => {
    const productExtras =
      p.extras && p.extras.length > 0 ? p.extras : getDefaultExtras(p.category);
    const globalExtras: ExtraOption[] = settings?.globalExtras ?? [];
    const categoryExtras: ExtraOption[] =
      categories.find((c) => c.id === p.category)?.extras ?? [];
    const seen = new Set<string>();
    const out: ExtraOption[] = [];
    for (const e of [...globalExtras, ...categoryExtras, ...productExtras]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  };

  const initialFromEdit = (p: Product) => {
    if (!editItem) return null;
    const pool = resolveExtras(p);
    const sizeMatch = p.sizes.find((s) => s.label === editItem.size)?.id;
    const extraQty: Record<string, number> = {};
    for (const e of pool) {
      const n = editItem.extras.filter((x) => x.label === e.label || x.label.startsWith(`${e.label} x`)).length;
      // If saved as "Label x3", parse count
      const withCount = editItem.extras.find((x) => x.label.startsWith(`${e.label} x`));
      if (withCount) {
        const m = withCount.label.match(/x(\d+)$/);
        extraQty[e.id] = m ? parseInt(m[1], 10) : 1;
      } else if (n > 0) {
        extraQty[e.id] = 1;
      }
    }
    return {
      sizeId: sizeMatch ?? p.sizes[0]?.id ?? "u",
      flavor: editItem.flavor ?? p.flavors?.[0],
      extras: extraQty,
      removed: editItem.removed ?? [],
      qty: editItem.quantity ?? 1,
      note: editItem.note ?? "",
    };
  };


  const FALLBACK_SIZE = { id: "u", label: "Único", priceDelta: 0 };
  const getSizes = (p: Product | null) =>
    p && p.sizes && p.sizes.length > 0 ? p.sizes : [FALLBACK_SIZE];

  const seed = product ? initialFromEdit(product) : null;
  const [sizeId, setSizeId] = useState<string>(
    seed?.sizeId ?? getSizes(product)[0].id,
  );
  const [flavor, setFlavor] = useState<string | undefined>(
    seed?.flavor ?? product?.flavors?.[0],
  );
  const [extras, setExtras] = useState<Record<string, number>>(seed?.extras ?? {});
  const [removed, setRemoved] = useState<string[]>(seed?.removed ?? []);
  const [qty, setQty] = useState(seed?.qty ?? 1);
  const [note, setNote] = useState(seed?.note ?? "");
  const [collapsed, setCollapsed] = useState(false);

  // Option groups (produtos personalizados: monte seu açaí, etc.)
  const initialGroupSel = (p: Product | null): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    const groups = p?.optionGroups ?? [];
    for (const g of groups) {
      if (g.type === "single") {
        if (g.required && g.options[0]) out[g.id] = [g.options[0].id];
        else out[g.id] = [];
      } else {
        const free = g.freeCount ?? 0;
        out[g.id] = free > 0 ? g.options.slice(0, free).map((o) => o.id) : [];
      }
    }
    return out;
  };
  const [groupSel, setGroupSel] = useState<Record<string, string[]>>(
    initialGroupSel(product),
  );
  // qty por (groupId, optionId) — 1ª unidade preço cheio, próximas 50% off
  const [groupQty, setGroupQty] = useState<Record<string, Record<string, number>>>({});

  const [stepIndex, setStepIndex] = useState(0);
  const wizardCtxRef = useRef<{
    totalSteps: number;
    clampedStep: number;
    isLast: boolean;
    canAdvance: boolean;
    stepName: string;
  }>({ totalSteps: 1, clampedStep: 0, isLast: true, canAdvance: true, stepName: "" });

  useMemo(() => {
    if (product) {
      const s = initialFromEdit(product);
      setSizeId(s?.sizeId ?? getSizes(product)[0].id);
      setFlavor(s?.flavor ?? product.flavors?.[0]);
      setExtras(s?.extras ?? {});
      setRemoved(s?.removed ?? []);
      setQty(s?.qty ?? 1);
      setNote(s?.note ?? "");
      setGroupSel(initialGroupSel(product));
      setGroupQty({});
      setStepIndex(0);
    }

  }, [product?.id, editItem?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) return null;

  // Rich customization pools with sensible fallbacks per category
  const availableExtras = resolveExtras(product);

  const ingredientsList: string[] = product.ingredients ?? [];
  const removableList: string[] =
    product.removable && product.removable.length > 0
      ? product.removable
      : ingredientsList.filter((i) => i.toLowerCase() !== "açaí");
  const flavorList: string[] | undefined =
    product.flavors && product.flavors.length > 0
      ? product.flavors
      : product.category === "shakes" || product.category === "casquinhas" || product.category === "tacas"
        ? ["Chocolate", "Morango", "Baunilha", "Ninho", "Flocos", "Ovomaltine", "Doce de Leite"]
        : undefined;

  const productSizes = getSizes(product);
  const size = productSizes.find((s) => s.id === sizeId) ?? productSizes[0];
  const extrasSelected = availableExtras
    .filter((e) => (extras[e.id] ?? 0) > 0)
    .map((e) => ({ ...e, qty: extras[e.id] }));
  // Preço: primeira unidade cheia, adicionais com 50% desconto
  const extrasPrice = extrasSelected.reduce(
    (s, e) => s + e.price + e.price * 0.5 * (e.qty - 1),
    0,
  );


  // Modo personalizado: preço vem dos grupos, não de sizes/extras
  const optionGroups: OptionGroup[] = product.optionGroups ?? [];
  const isCustom = !!product.isCustom && optionGroups.length > 0;

  const groupsUnit = (() => {
    let t = 0;
    for (const g of optionGroups) {
      const picked = groupSel[g.id] ?? [];
      const items = g.options.filter((o) => picked.includes(o.id));
      t += items.reduce((s, o) => s + (o.price || 0), 0);
      const free = g.freeCount ?? 0;
      const extra = g.pricePerExtra ?? 0;
      if (extra > 0 && picked.length > free) {
        t += (picked.length - free) * extra;
      }
    }
    return t;
  })();

  const unit = isCustom
    ? groupsUnit
    : product.basePrice + size.priceDelta + extrasPrice;
  const total = unit * qty;


  const toggleExtra = (id: string) =>
    setExtras((prev) => {
      const cur = prev[id] ?? 0;
      const next = { ...prev };
      if (cur > 0) delete next[id];
      else next[id] = 1;
      return next;
    });
  const changeExtraQty = (id: string, delta: number) =>
    setExtras((prev) => {
      const cur = prev[id] ?? 0;
      const nextVal = Math.max(0, cur + delta);
      const next = { ...prev };
      if (nextVal === 0) delete next[id];
      else next[id] = nextVal;
      return next;
    });

  const toggleRemoved = (name: string) =>
    setRemoved((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  const toggleGroup = (g: OptionGroup, optId: string) => {
    setGroupSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.type === "single") {
        return {
          ...prev,
          [g.id]: cur[0] === optId ? (g.required ? cur : []) : [optId],
        };
      }
      const has = cur.includes(optId);
      return { ...prev, [g.id]: has ? cur.filter((x) => x !== optId) : [...cur, optId] };
    });
  };

  const canSubmit = !isCustom
    ? true
    : optionGroups.every((g) => (!g.required ? true : (groupSel[g.id] ?? []).length > 0));

  const submit = () => {
    if (isCustom) {
      if (!canSubmit) {
        toast.error("Escolha as opções obrigatórias.");
        return;
      }
      const groupExtras: { label: string; price: number }[] = [];
      let sizeLabel = "";
      for (const g of optionGroups) {
        const picked = (groupSel[g.id] ?? [])
          .map((id) => g.options.find((o) => o.id === id))
          .filter((o): o is OptionItem => !!o);
        if (g.type === "single") {
          if (picked[0]) sizeLabel = picked[0].label;
          continue;
        }
        const free = g.freeCount ?? 0;
        const extra = g.pricePerExtra ?? 0;
        picked.forEach((o, idx) => {
          const feeShare = extra > 0 && idx >= free ? extra : 0;
          groupExtras.push({
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
        extras: groupExtras,
        removed: [],
        note: note.trim() || undefined,
        quantity: qty,
        unitPrice: unit,
      };
      if (editItem) {
        update(editItem.uid, payload);
        toast.success(`${product.name} atualizado!`);
      } else {
        add(payload);
        toast.success(`${product.name} adicionado ao carrinho!`);
      }
      onClose();
      return;
    }
    const payload = {
      productId: product.id,
      name: product.name,
      image: product.image,
      size: size.label,
      flavor,
      extras: extrasSelected.map((e) => ({
        label: e.qty > 1 ? `${e.label} x${e.qty}` : e.label,
        price: e.price + e.price * 0.5 * (e.qty - 1),
      })),

      removed,
      note: note.trim() || undefined,
      quantity: qty,
      unitPrice: unit,
    };
    if (editItem) {
      update(editItem.uid, payload);
      toast.success(`${product.name} atualizado!`);
    } else {
      add(payload);
      toast.success(`${product.name} adicionado ao carrinho!`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 [-webkit-tap-highlight-color:transparent]">
      <div
        className="absolute inset-0 bg-black/70 animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[40px] bg-[oklch(0.18_0.11_305)] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-200 ease-out will-change-transform touch-manipulation">
        {/* Textura papel amassado como camada de fundo (não interfere no layout) */}
        <div className="paper-crumpled pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

        {/* HERO — imagem em bleed com gradiente descendo */}
        <div
          className={cn(
            "relative z-10 shrink-0 overflow-hidden transition-[height] duration-300 ease-out",
            collapsed ? "h-[72px]" : "h-44",
          )}
        >
          {!collapsed && (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,oklch(0.72_0.26_350_/_0.35),transparent_70%)]" />
              <img
                src={product.image}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-contain p-4 drop-shadow-[0_20px_30px_rgba(0,0,0,0.55)] animate-float-slow"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.18_0.11_305)] via-[oklch(0.18_0.11_305)]/60 to-transparent" />
            </>
          )}

          {/* Ações à esquerda: minimizar + favorito */}
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expandir imagem" : "Minimizar imagem"}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md active:scale-95"
            >
              <ChevronsUpDown className="h-5 w-5" />
            </button>
            <FavoriteButton
              productId={product.id}
              className="h-10 w-10 border border-white/20 bg-black/40 backdrop-blur-md"
            />
          </div>

          {/* Fechar à direita */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>



          {collapsed && (
            <div className="absolute inset-0 flex items-center px-16">
              <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-white truncate">
                {product.name}
              </h2>
            </div>
          )}
        </div>

        {/* Scroll body */}
        <div
          className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-40"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {!collapsed && (
            <div className="-mt-8 relative z-30 mb-6">
              <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-neon-cyan/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-neon-cyan/40">
                <Sparkles className="h-3 w-3" /> {CATEGORY_LABEL[product.category] ?? "Personalize"}
              </div>
              <h2
                className="text-3xl sm:text-4xl font-bold leading-[1.05] text-neon-yellow drop-shadow-[0_0_18px_rgba(253,224,71,0.35)] pb-1 break-words"
                style={{ fontFamily: "'Fredoka', 'Poppins', sans-serif" }}
              >
                {product.name}
              </h2>
              {product.description && (
                <p className="mt-2 max-w-[95%] text-[13px] text-white/70">
                  {product.description}
                </p>
              )}
            </div>
          )}

          {(() => {
            type Step = {
              key: string;
              name: string;
              required?: boolean;
              isValid: () => boolean;
              render: () => React.ReactNode;
            };
            const steps: Step[] = [];

            if (isCustom) {
              for (const g of optionGroups) {
                const picked = () => groupSel[g.id] ?? [];
                steps.push({
                  key: `g-${g.id}`,
                  name: g.name,
                  required: g.type === "single" && g.required,
                  isValid: () => !g.required || picked().length > 0,
                  render: () => {
                    const p = picked();
                    const free = g.freeCount ?? 0;
                    const extraFee = g.pricePerExtra ?? 0;
                    const isSingle = g.type === "single";
                    return isSingle ? (
                      <div className="grid grid-cols-3 gap-3">
                        {g.options.map((o) => {
                          const on = p.includes(o.id);
                          return (
                            <button
                              key={o.id}
                              onClick={() => toggleGroup(g, o.id)}
                              className={cn(
                                "rounded-2xl border p-3 text-center transition-all",
                                on
                                  ? "border-neon-pink bg-neon-pink/10 shadow-[0_0_15px_rgba(255,46,147,0.2)]"
                                  : "border-white/10 bg-white/5",
                              )}
                            >
                              <span
                                className="block font-display text-base font-extrabold uppercase leading-tight text-white"
                                style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                              >
                                {o.label}
                              </span>
                              {o.price > 0 && (
                                <span className="mt-0.5 block text-[10px] font-bold uppercase text-white/40">
                                  +{brl(o.price)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {free > 0 && (
                          <div className="mb-1 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-neon-cyan">
                              {Math.min(p.length, free)}/{free} grátis
                            </span>
                            {extraFee > 0 && (
                              <span className="text-neon-pink">
                                extra +{brl(extraFee)}
                              </span>
                            )}
                          </div>
                        )}
                        {g.options.map((o) => {
                          const on = p.includes(o.id);
                          const idx = p.indexOf(o.id);
                          const freeUsed = p.length;
                          const willBeCharged = on
                            ? idx >= free && extraFee > 0
                            : freeUsed >= free && extraFee > 0;
                          const priceLabel =
                            o.price > 0
                              ? `+ ${brl(o.price)}`
                              : willBeCharged
                                ? `+ ${brl(extraFee)}`
                                : "Grátis";
                          const priceColor =
                            o.price > 0 || willBeCharged ? "text-neon-pink" : "text-neon-cyan";
                          return (
                            <ComplementRow
                              key={o.id}
                              active={on}
                              onClick={() => toggleGroup(g, o.id)}
                              label={o.label}
                              price={priceLabel}
                              priceColor={priceColor}
                            />
                          );
                        })}
                      </div>
                    );

                  },
                });
              }
            } else {
              if (productSizes.length > 1) {
                steps.push({
                  key: "size",
                  name: "Tamanho",
                  required: true,
                  isValid: () => !!sizeId,
                  render: () => (
                    <div
                      className={cn(
                        "grid gap-3",
                        productSizes.length >= 3 ? "grid-cols-3" : "grid-cols-2",
                      )}
                    >
                      {productSizes.map((s) => {
                        const active = s.id === sizeId;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSizeId(s.id)}
                            className={cn(
                              "rounded-2xl border p-3 text-center transition-all",
                              active
                                ? "border-neon-pink bg-neon-pink/10 shadow-[0_0_15px_rgba(255,46,147,0.2)]"
                                : "border-white/10 bg-white/5",
                            )}
                          >
                            <span
                              className="block font-display text-lg font-extrabold uppercase leading-none text-white"
                              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                            >
                              {s.label}
                            </span>
                            {s.priceDelta > 0 && (
                              <span className="mt-1 block text-[10px] font-bold uppercase text-white/40">
                                +{brl(s.priceDelta)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ),
                });
              }
              if (flavorList) {
                steps.push({
                  key: "flavor",
                  name: "Sabor",
                  isValid: () => true,
                  render: () => (
                    <div className="grid grid-cols-2 gap-2">
                      {flavorList.map((f) => {
                        const on = f === flavor;
                        return (
                          <button
                            key={f}
                            onClick={() => setFlavor(f)}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-sm font-bold transition-all",
                              on
                                ? "border-neon-pink bg-neon-pink/10 text-white shadow-[0_0_15px_rgba(255,46,147,0.15)]"
                                : "border-white/10 bg-white/5 text-white/80",
                            )}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  ),
                });
              }
              if (removableList.length > 0) {
                steps.push({
                  key: "remove",
                  name: "Ingredientes",
                  isValid: () => true,
                  render: () => (
                    <div className="space-y-3">
                      <p className="text-[12px] text-white/60">
                        Toque em um ingrediente para removê-lo do seu pedido.
                      </p>
                      <div className="flex flex-col gap-2">
                        {removableList.map((r) => {
                          const off = removed.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => toggleRemoved(r)}
                              className={cn(
                                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-[14px] font-bold transition-all",
                                off
                                  ? "border-neon-pink bg-neon-pink/15 text-white line-through decoration-neon-pink"
                                  : "border-white/10 bg-white/5 text-white/90",
                              )}
                            >
                              <span>{off ? `Sem ${r}` : r}</span>
                              <span className={cn("text-[11px] font-semibold", off ? "text-neon-pink" : "text-white/40")}>
                                {off ? "removido" : "toque para remover"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ),

                });
              }
              if (availableExtras.length > 0) {
                steps.push({
                  key: "extras",
                  name: "Extras",
                  isValid: () => true,
                  render: () => (
                    <div className="space-y-2">
                      {availableExtras.map((e) => {
                        const qtyE = extras[e.id] ?? 0;
                        const on = qtyE > 0;
                        return (
                          <div
                            key={e.id}
                            className={cn(
                              "rounded-2xl border p-4 transition-all",
                              on
                                ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                                : "border-white/5 bg-white/5",
                            )}
                          >
                            <button
                              onClick={() => toggleExtra(e.id)}
                              className="flex w-full items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    "grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-all",
                                    on
                                      ? "border-neon-cyan bg-neon-cyan"
                                      : "border-white/30 bg-transparent",
                                  )}
                                >
                                  {on && (
                                    <Check
                                      className="h-3.5 w-3.5 text-[oklch(0.18_0.11_305)]"
                                      strokeWidth={3.5}
                                    />
                                  )}
                                </span>
                                <span className="text-[15px] font-medium text-white">
                                  {e.label}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-sm font-bold shrink-0",
                                  e.price > 0 ? "text-neon-pink" : "text-neon-cyan",
                                )}
                              >
                                {e.price > 0 ? `+ ${brl(e.price)}` : "Grátis"}
                              </span>
                            </button>

                            {on && e.price > 0 && (
                              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-neon-cyan/90">
                                  +unidade{" "}
                                  <span className="text-white/60">
                                    50% off ({brl(e.price * 0.5)})
                                  </span>
                                </div>
                                <div className="flex items-center rounded-full border border-white/15 bg-black/30 p-1">
                                  <button
                                    onClick={() => changeExtraQty(e.id, -1)}
                                    aria-label="Diminuir"
                                    className="grid h-7 w-7 place-items-center text-white/70 active:scale-95"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-bold text-white">
                                    {qtyE}
                                  </span>
                                  <button
                                    onClick={() => changeExtraQty(e.id, +1)}
                                    aria-label="Aumentar"
                                    className="grid h-7 w-7 place-items-center text-neon-cyan active:scale-95"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Promo explanation */}
                      <div className="mt-2 flex items-stretch gap-2 rounded-2xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/10 to-neon-pink/10 p-3">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 px-3">
                          <Sparkles className="h-4 w-4 text-neon-yellow" />
                        </div>
                        <div className="flex-1 space-y-1.5 text-[12px] leading-snug text-white/85">
                          <div className="flex items-center gap-2">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-neon-cyan text-[10px] font-black text-black">1</span>
                            <span><b className="text-white">1ª unidade</b> — preço cheio (100%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-neon-pink text-[10px] font-black text-white">%</span>
                            <span><b className="text-neon-pink">Repetiu?</b> as próximas saem com <b>50% off</b></span>
                          </div>
                        </div>
                      </div>
                    </div>


                  ),
                });
              }

            }

            // Sempre encerra com a etapa "Finalizar" (observação + revisão)
            steps.push({
              key: "finish",
              name: "Finalizar",
              isValid: () => true,
              render: () => (
                <div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex.: caprichar na calda, sem gelo…"
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
                    rows={3}
                  />
                </div>
              ),
            });

            const clampedStep = Math.min(stepIndex, steps.length - 1);
            const current = steps[clampedStep];
            const isMulti = steps.length > 1;
            const isLast = clampedStep >= steps.length - 1;
            const canAdvance = current.isValid();
            const totalSteps = steps.length;

            // Expõe pra usar no footer via ref-like: guarda em variáveis no closure externo
            wizardCtxRef.current = {
              totalSteps,
              clampedStep,
              isLast,
              canAdvance,
              stepName: current.name,
            };

            return (
              <div className="space-y-6">
                {isMulti && (
                  <div className="relative">
                    <div className="absolute left-5 right-5 top-5 h-[2px] bg-white/10" />
                    <div
                      className="absolute left-5 top-5 h-[2px] bg-gradient-to-r from-neon-pink to-[oklch(0.76_0.2_350)] transition-all duration-300"
                      style={{
                        width:
                          totalSteps > 1
                            ? `calc((100% - 2.5rem) * ${clampedStep / (totalSteps - 1)})`
                            : "0%",
                      }}
                    />
                    <div className="relative flex items-start justify-between">
                      {steps.map((s, i) => {
                        const done = i < clampedStep;
                        const cur = i === clampedStep;
                        return (
                          <button
                            key={s.key}
                            onClick={() => setStepIndex(i)}
                            className="flex min-w-0 flex-1 flex-col items-center gap-1"
                          >
                            <span
                              className={cn(
                                "grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-black transition-all",
                                cur
                                  ? "border-neon-pink bg-neon-pink text-white shadow-[0_0_20px_rgba(255,46,147,0.55)]"
                                  : done
                                    ? "border-neon-pink bg-neon-pink/20 text-neon-pink"
                                    : "border-white/15 bg-white/5 text-white/50",
                              )}
                            >
                              {done ? <Check className="h-4 w-4" strokeWidth={3.5} /> : i + 1}
                            </span>
                            <span
                              className={cn(
                                "truncate text-[11px] font-bold uppercase tracking-wide max-w-[70px]",
                                cur ? "text-white" : done ? "text-neon-pink/80" : "text-white/40",
                              )}
                            >
                              {s.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <h3
                      className="font-display text-2xl font-extrabold uppercase tracking-wider text-neon-cyan"
                      style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                    >
                      {current.name}
                    </h3>
                    {current.required ? (
                      <span className="rounded-full bg-neon-pink/20 px-2 py-0.5 text-[10px] font-bold uppercase text-neon-pink">
                        Obrigatório
                      </span>
                    ) : (
                      <span
                        className="text-lg text-white/40"
                        style={{ fontFamily: "'Caveat', cursive" }}
                      >
                        {current.key === "finish" ? "quase lá" : "opcional"}
                      </span>
                    )}
                  </div>
                  {current.render()}
                </div>
              </div>
            );
          })()}

          <div className="h-6" />
        </div>


        {/* Footer — quantidade + CTA gradiente pink */}
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[oklch(0.18_0.11_305)]/95 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          {(() => {
            const { totalSteps, clampedStep, isLast, canAdvance } = wizardCtxRef.current;
            const isWizard = totalSteps > 1;
            return (
              <div className="flex items-center gap-3">
                {isWizard && clampedStep > 0 && !isLast && (
                  <button
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    className="h-12 rounded-2xl border border-white/15 bg-white/5 px-4 font-display text-sm font-bold uppercase tracking-wider text-white/80 active:scale-95"
                  >
                    Voltar
                  </button>
                )}
                {isLast && (
                  <div className="flex items-center rounded-2xl border border-white/10 bg-white/10 p-1">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      aria-label="Diminuir"
                      className="grid h-10 w-10 place-items-center text-white/60 active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-base font-bold text-white">{qty}</span>
                    <button
                      onClick={() => setQty(qty + 1)}
                      aria-label="Aumentar"
                      className="grid h-10 w-10 place-items-center text-neon-cyan active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {isLast ? (
                  <button
                    onClick={submit}
                    className="flex h-12 flex-1 items-center justify-between rounded-2xl bg-gradient-to-r from-neon-pink to-[oklch(0.76_0.2_350)] px-5 shadow-[0_4px_20px_rgba(255,46,147,0.4)] transition-transform active:scale-[.97]"
                  >
                    <span
                      className="font-display text-lg font-bold uppercase tracking-wider text-white"
                      style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                    >
                      Adicionar
                    </span>
                    <span className="text-base font-extrabold text-white">{brl(total)}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!canAdvance) {
                        toast.error("Escolha uma opção para continuar.");
                        return;
                      }
                      setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
                    }}
                    disabled={!canAdvance}
                    className="flex h-12 flex-1 items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-neon-pink to-[oklch(0.76_0.2_350)] px-5 shadow-[0_4px_20px_rgba(255,46,147,0.4)] transition-transform active:scale-[.97] disabled:opacity-50"
                  >
                    <span
                      className="font-display text-lg font-bold uppercase tracking-wider text-white"
                      style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                    >
                      Próximo
                    </span>
                    <span
                      className="rounded-full bg-black/25 px-3 py-1 text-sm font-extrabold text-white"
                      style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                    >
                      {brl(total)}
                    </span>
                  </button>

                )}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}


function ComplementRow({
  active,
  onClick,
  label,
  price,
  priceColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  price: string;
  priceColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all",
        active
          ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_15px_rgba(0,229,255,0.15)]"
          : "border-white/5 bg-white/5",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-all",
            active
              ? "border-neon-cyan bg-neon-cyan"
              : "border-white/30 bg-transparent",
          )}
        >
          {active && <Check className="h-3.5 w-3.5 text-[oklch(0.18_0.11_305)]" strokeWidth={3.5} />}
        </span>
        <span className="text-[15px] font-medium text-white">{label}</span>
      </div>
      <span className={cn("text-sm font-bold shrink-0", priceColor)}>{price}</span>
    </button>
  );
}


function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

function Chip({
  active,
  onClick,
  children,
  small,
  variant = "cyan",
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
  variant?: "cyan" | "pink";
  className?: string;
}) {
  const activeCls =
    variant === "cyan"
      ? "border-neon-cyan bg-neon-cyan/15 text-white glow-cyan"
      : "border-neon-pink bg-neon-pink/15 text-white";
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 transition text-center",
        small ? "py-2 text-[13px]" : "py-3",
        active ? activeCls : "border-white/10 bg-white/5 text-white/80",
        className,
      )}
    >
      {children}
    </button>
  );
}

function GroupCard({
  index,
  title,
  hint,
  selectedLabel,
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  selectedLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-neon-pink text-[11px] font-black text-white shadow-[0_0_12px_rgba(255,60,140,0.5)]">
            {index}
          </span>
          <h4 className="font-display text-[15px] font-extrabold uppercase tracking-wide text-white">
            {title}
          </h4>
        </div>
        {selectedLabel ? (
          <div className="flex items-center gap-1 rounded-full bg-neon-yellow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow ring-1 ring-neon-yellow/40">
            <span className="opacity-70">Selecionado</span>
            <span>{selectedLabel}</span>
          </div>
        ) : hint ? (
          <span className="text-[10px] uppercase tracking-widest text-white/50">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function OptionCard({
  active,
  image,
  label,
  priceHint,
  onClick,
}: {
  active: boolean;
  image?: string;
  label: string;
  priceHint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center overflow-hidden rounded-2xl border p-1.5 pb-2 text-center transition",
        active
          ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_0_2px_var(--neon-cyan),0_8px_24px_-8px_var(--neon-cyan)]"
          : "border-white/10 bg-black/30 hover:border-white/25",
      )}
    >
      {active && (
        <span className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-neon-cyan text-[oklch(0.18_0.11_305)] shadow-[0_0_10px_var(--neon-cyan)]">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <div className="relative mb-1 aspect-square w-full overflow-hidden rounded-xl bg-white/5">
        {image ? (
          <img
            src={image}
            alt={label}
            className="h-full w-full object-contain p-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-lg opacity-60">✨</div>
        )}
      </div>
      <div
        className={cn(
          "line-clamp-2 min-h-[26px] text-[11px] font-bold leading-tight",
          active ? "text-neon-cyan" : "text-white",
        )}
      >
        {label}
      </div>
      {priceHint && (
        <div className="mt-0.5 text-[10px] font-extrabold text-neon-yellow">{priceHint}</div>
      )}
    </button>
  );
}

