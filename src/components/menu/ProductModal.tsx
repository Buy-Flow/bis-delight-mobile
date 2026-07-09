import { useMemo, useState } from "react";
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
    const extraIds = pool
      .filter((e) => editItem.extras.some((x) => x.label === e.label))
      .map((e) => e.id);
    return {
      sizeId: sizeMatch ?? p.sizes[0]?.id ?? "u",
      flavor: editItem.flavor ?? p.flavors?.[0],
      extras: extraIds,
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
  const [extras, setExtras] = useState<string[]>(seed?.extras ?? []);
  const [removed, setRemoved] = useState<string[]>(seed?.removed ?? []);
  const [qty, setQty] = useState(seed?.qty ?? 1);
  const [note, setNote] = useState(seed?.note ?? "");
  const [collapsed, setCollapsed] = useState(false);

  useMemo(() => {
    if (product) {
      const s = initialFromEdit(product);
      setSizeId(s?.sizeId ?? getSizes(product)[0].id);
      setFlavor(s?.flavor ?? product.flavors?.[0]);
      setExtras(s?.extras ?? []);
      setRemoved(s?.removed ?? []);
      setQty(s?.qty ?? 1);
      setNote(s?.note ?? "");
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
  const extrasSelected = availableExtras.filter((e) => extras.includes(e.id));
  const extrasPrice = extrasSelected.reduce((s, e) => s + e.price, 0);
  const unit = product.basePrice + size.priceDelta + extrasPrice;
  const total = unit * qty;


  const toggleExtra = (id: string) =>
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleRemoved = (name: string) =>
    setRemoved((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

  const submit = () => {
    const payload = {
      productId: product.id,
      name: product.name,
      image: product.image,
      size: size.label,
      flavor,
      extras: extrasSelected.map((e) => ({ label: e.label, price: e.price })),
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
      <div className="absolute inset-x-0 bottom-0 top-[8vh] flex flex-col overflow-hidden rounded-t-[28px] card-acai animate-in slide-in-from-bottom duration-200 ease-out will-change-transform touch-manipulation">

        {/* Header — colapsável para dar mais espaço à personalização */}
        <div
          className={cn(
            "relative shrink-0 overflow-hidden transition-[height] duration-300 ease-out",
            collapsed ? "h-[72px]" : "h-[220px]",
          )}
        >
          <div className="absolute inset-0 noise-purple" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_55%,oklch(0.86_0.18_200_/_0.35),transparent_65%)]" />
          {!collapsed && (
            <img
              src={product.image}
              alt={product.name}
              className="absolute left-1/2 -top-2 h-[200px] w-[100%] max-w-none -translate-x-1/2 object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.55)] animate-float-slow"
            />
          )}

          {/* Controles no topo */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expandir imagem" : "Minimizar imagem"}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-95"
            >
              <ChevronsUpDown className="h-5 w-5" />
            </button>
            <FavoriteButton
              productId={product.id}
              className="h-10 w-10 bg-black/50 backdrop-blur-sm"
            />
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 bg-gradient-to-t from-[oklch(0.18_0.11_305)] via-[oklch(0.18_0.11_305)]/70 to-transparent px-4 pb-3",
              collapsed ? "pt-2" : "pt-8",
            )}
          >
            {!collapsed && (
              <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-cyan ring-1 ring-neon-cyan/40">
                <Sparkles className="h-3 w-3" /> {CATEGORY_LABEL[product.category] ?? "Personalize o seu"}
              </div>
            )}
            <h2
              className={cn(
                "font-display font-extrabold text-neon-yellow glow-yellow-text leading-none",
                collapsed ? "text-lg" : "text-3xl",
              )}
            >
              {product.name}
            </h2>
            {!collapsed && (
              <p className="mt-1 text-[12px] text-white/70">{product.description}</p>
            )}
          </div>
        </div>




        {/* Scroll body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {productSizes.length > 1 && (
            <Section title="Tamanho">
              <div className="grid grid-cols-2 gap-2">
                {productSizes.map((s) => {
                  const active = s.id === sizeId;
                  return (
                    <Chip key={s.id} active={active} onClick={() => setSizeId(s.id)}>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-extrabold">{s.label}</span>
                        {s.priceDelta > 0 && (
                          <span className="text-[11px] text-white/60">
                            +{brl(s.priceDelta)}
                          </span>
                        )}
                      </div>
                    </Chip>
                  );
                })}
              </div>
            </Section>
          )}

          {flavorList && (
            <Section title="Sabor">
              <div className="grid grid-cols-2 gap-2">
                {flavorList.map((f) => (
                  <Chip key={f} active={f === flavor} onClick={() => setFlavor(f)}>
                    <span className="text-sm font-bold">{f}</span>
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {availableExtras.length > 0 && (
            <Section title="Complementos" hint="Adicione o que quiser">
              <div className="flex flex-col gap-2">
                {availableExtras.map((e) => {
                  const on = extras.includes(e.id);
                  return (
                    <Chip key={e.id} small active={on} onClick={() => toggleExtra(e.id)} className="w-full justify-between">
                      <span className="mr-1">{e.label}</span>
                      {e.price > 0 && (
                        <span className="text-[11px] text-white/60">+{brl(e.price)}</span>
                      )}
                    </Chip>
                  );
                })}
              </div>
            </Section>
          )}



          {removableList.length > 0 && (
            <Section title="Remover ingredientes" hint="Toque para tirar do pedido">
              <div className="flex flex-wrap gap-2">
                {removableList.map((r) => {
                  const off = removed.includes(r);
                  return (
                    <Chip
                      key={r}
                      small
                      active={off}
                      variant="pink"
                      onClick={() => toggleRemoved(r)}
                    >
                      {off ? `Sem ${r}` : r}
                    </Chip>
                  );
                })}
              </div>
            </Section>
          )}


          <Section title="Observação">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: caprichar na calda, sem gelo…"
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
              rows={3}
            />
          </Section>

          <div className="h-8" />
        </div>

        {/* Sticky footer */}
        <div className="border-t border-white/10 bg-[oklch(0.14_0.09_305)]/95 backdrop-blur px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
              className="flex-1 rounded-2xl bg-neon-pink px-4 py-3 text-base font-extrabold text-white glow-pink touch-manipulation [-webkit-tap-highlight-color:transparent] will-change-transform transition-transform duration-100 ease-out active:scale-[.97]"
            >
              {brl(total)}
            </button>
          </div>
        </div>


      </div>
    </div>
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

