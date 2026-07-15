import { useMemo, useState } from "react";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Ticket,
  Sparkles,
  Percent,
  Package,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Pencil,
  Layers,
  Flame,
  X,
} from "lucide-react";
import {
  useAllCombos,
  useUpsertCombo,
  useDeleteCombo,
  useCategories,
  type Combo,
  type ComboRule,
} from "@/lib/menu-data";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-neon-pink focus:bg-black/60";

function emptyCombo(): Combo {
  return {
    id: "",
    name: "",
    description: "",
    imageUrl: "",
    rules: [{ category: "any", minQty: 3 }],
    discountPercent: 10,
    active: true,
    sortOrder: 0,
  };
}

function useCategoryLabel() {
  const { data: categories = [] } = useCategories();
  return (id: string) => {
    if (id === "any") return "Qualquer categoria";
    return categories.find((c) => c.id === id)?.name ?? id;
  };
}

export function CombosSection() {
  const { data: combos = [], isLoading } = useAllCombos();
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertCombo();
  const remove = useDeleteCombo();
  const [editing, setEditing] = useState<Combo | null>(null);
  const labelFor = useCategoryLabel();

  const stats = useMemo(() => {
    const active = combos.filter((c) => c.active).length;
    const inactive = combos.length - active;
    const avgDiscount = combos.length
      ? Math.round(
          combos.reduce((s, c) => s + (c.discountPercent || 0), 0) / combos.length,
        )
      : 0;
    const maxDiscount = combos.reduce((m, c) => Math.max(m, c.discountPercent || 0), 0);
    return { active, inactive, avgDiscount, maxDiscount, total: combos.length };
  }, [combos]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Dê um nome ao combo");
      return;
    }
    if (editing.rules.length === 0) {
      toast.error("Adicione ao menos uma regra");
      return;
    }
    try {
      await upsert.mutateAsync(editing);
      toast.success("Combo salvo!");
      setEditing(null);
    } catch (e) {
      toast.error("Erro ao salvar");
    }
  };

  const del = async (id: string) => {
    if (!(await confirmDialog({ message: "Remover este combo?" }))) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Combo removido");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const toggleActive = async (c: Combo) => {
    try {
      await upsert.mutateAsync({ ...c, active: !c.active });
      toast.success(c.active ? "Combo pausado" : "Combo ativado");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  return (
    <div className="space-y-5">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neon-pink/20 via-neon-purple/15 to-neon-cyan/10 p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-pink/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-neon-cyan/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink to-neon-purple text-white shadow-lg shadow-neon-pink/30">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-black text-white">
                  Combos com desconto
                </h2>
                <span className="rounded-full border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neon-yellow">
                  <Sparkles className="mr-1 inline h-2.5 w-2.5" /> Auto
                </span>
              </div>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-white/60">
                Kits que ganham desconto automático quando o cliente atinge as regras
                no carrinho.
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditing(emptyCombo())}
            className="group flex items-center gap-2 self-start rounded-2xl bg-neon-pink px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-neon-pink/40 transition-transform hover:scale-[1.02] active:scale-95 glow-pink sm:self-auto"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            Novo combo
          </button>
        </div>

        {/* KPI strip */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip
            icon={Layers}
            label="Total"
            value={stats.total}
            tone="white"
          />
          <StatChip
            icon={Flame}
            label="Ativos"
            value={stats.active}
            tone="cyan"
          />
          <StatChip
            icon={Percent}
            label="Desc. médio"
            value={`${stats.avgDiscount}%`}
            tone="yellow"
          />
          <StatChip
            icon={Sparkles}
            label="Melhor oferta"
            value={`-${stats.maxDiscount}%`}
            tone="pink"
          />
        </div>
      </div>

      {/* LIST */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : combos.length === 0 ? (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,45,149,0.12),transparent_60%)]" />
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-neon-pink/30 to-neon-purple/30 text-neon-pink">
            <Ticket className="h-8 w-8" />
          </div>
          <h3 className="relative mt-4 font-display text-xl font-black text-white">
            Nenhum combo ainda
          </h3>
          <p className="relative mx-auto mt-1 max-w-sm text-sm text-white/50">
            Crie kits com desconto para aumentar ticket médio e girar mais produtos por
            pedido.
          </p>
          <button
            onClick={() => setEditing(emptyCombo())}
            className="relative mt-5 inline-flex items-center gap-2 rounded-2xl bg-neon-pink px-5 py-3 text-sm font-extrabold text-white glow-pink"
          >
            <Plus className="h-4 w-4" /> Criar primeiro combo
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((c) => (
            <ComboCard
              key={c.id}
              combo={c}
              onEdit={() => setEditing(c)}
              onDelete={() => del(c.id)}
              onToggle={() => toggleActive(c)}
              labelFor={labelFor}
            />
          ))}
        </div>
      )}

      {/* EDITOR */}
      {editing && (
        <ComboEditor
          editing={editing}
          setEditing={setEditing}
          categories={categories}
          onSave={save}
          onClose={() => setEditing(null)}
          isSaving={upsert.isPending}
          labelFor={labelFor}
        />
      )}
    </div>
  );
}

/* ------------------------------- StatChip ------------------------------- */

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  tone: "pink" | "cyan" | "yellow" | "white";
}) {
  const toneMap = {
    pink: "text-neon-pink border-neon-pink/30 bg-neon-pink/10",
    cyan: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10",
    yellow: "text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10",
    white: "text-white border-white/15 bg-white/5",
  }[tone];

  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border ${toneMap} px-3 py-2 backdrop-blur-sm`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-[10px] font-bold uppercase tracking-wider opacity-80">
          {label}
        </div>
        <div className="font-display text-lg font-black leading-none">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------- ComboCard ------------------------------ */

function ComboCard({
  combo,
  onEdit,
  onDelete,
  onToggle,
  labelFor,
}: {
  combo: Combo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  labelFor: (id: string) => string;
}) {
  const totalItems = combo.rules.reduce((s, r) => s + (r.minQty || 0), 0);
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border transition-all ${
        combo.active
          ? "border-white/10 bg-white/[0.03] hover:border-neon-pink/40 hover:bg-white/[0.05]"
          : "border-white/5 bg-white/[0.015] opacity-70"
      }`}
    >
      {/* image / gradient */}
      <div className="relative h-32 overflow-hidden">
        {combo.imageUrl ? (
          <img
            src={combo.imageUrl}
            alt={combo.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/40 via-neon-pink/25 to-neon-cyan/20">
            <div className="absolute inset-0 grid place-items-center text-white/20">
              <Package className="h-14 w-14" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.08_0.05_305)] via-transparent to-transparent" />

        {/* discount ring */}
        <div className="absolute right-3 top-3 flex flex-col items-center rounded-2xl border border-neon-yellow/50 bg-black/60 px-3 py-1.5 backdrop-blur-md">
          <div className="font-display text-xl font-black leading-none text-neon-yellow">
            -{combo.discountPercent}%
          </div>
          <div className="text-[8px] font-bold uppercase tracking-wider text-neon-yellow/70">
            off
          </div>
        </div>

        {/* status pill */}
        <div className="absolute left-3 top-3">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
              combo.active
                ? "border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan"
                : "border-white/20 bg-black/50 text-white/60"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${combo.active ? "bg-neon-cyan shadow-[0_0_8px_currentColor]" : "bg-white/40"}`}
            />
            {combo.active ? "Ativo" : "Pausado"}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-display text-lg font-black text-white">
            {combo.name || "Sem nome"}
          </h3>
          {combo.description && (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/55">
              {combo.description}
            </p>
          )}
        </div>

        {/* rules */}
        <div className="flex flex-wrap gap-1.5">
          {combo.rules.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] font-semibold text-white/85"
            >
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-neon-purple/30 px-1 text-[9px] font-black text-white">
                {r.minQty}×
              </span>
              <span className="truncate">
                {r.label || labelFor(r.category)}
              </span>
            </span>
          ))}
        </div>

        {/* meta */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {combo.rules.length} regra{combo.rules.length !== 1 && "s"} · {totalItems} itens
          </span>
        </div>

        {/* actions */}
        <div className="flex gap-1.5">
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/8 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onToggle}
            title={combo.active ? "Pausar" : "Ativar"}
            className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-white transition-colors hover:bg-white/15"
          >
            {combo.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onDelete}
            title="Remover"
            className="grid h-8 w-8 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ ComboEditor ----------------------------- */

function ComboEditor({
  editing,
  setEditing,
  categories,
  onSave,
  onClose,
  isSaving,
  labelFor,
}: {
  editing: Combo;
  setEditing: (c: Combo) => void;
  categories: { id: string; name: string }[];
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  labelFor: (id: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/10 bg-[oklch(0.11_0.08_305)] shadow-2xl sm:rounded-3xl">
        {/* header */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-neon-pink/15 via-neon-purple/10 to-transparent px-5 py-4">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-neon-pink/20 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-neon-pink/20 text-neon-pink">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-black text-white">
                  {editing.id ? "Editar combo" : "Novo combo"}
                </h3>
                <p className="text-[11px] text-white/50">
                  O desconto é aplicado no carrinho quando as regras baterem.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-white/70 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid max-h-[75vh] gap-5 overflow-y-auto p-5 md:grid-cols-5">
          {/* form */}
          <div className="space-y-4 md:col-span-3">
            <FieldGroup title="Identificação" icon={Sparkles}>
              <label className="block">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                  Nome
                </div>
                <input
                  className={inputCls}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Kit Família"
                />
              </label>
              <label className="block">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                  Descrição
                </div>
                <input
                  className={inputCls}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="3 açaís + acompanhamentos com desconto"
                />
              </label>
              <label className="block">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                  <ImageIcon className="h-3 w-3" /> URL da imagem (opcional)
                </div>
                <input
                  className={inputCls}
                  value={editing.imageUrl}
                  onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </label>
            </FieldGroup>

            <FieldGroup title="Regras" icon={Layers}>
              <div className="space-y-2">
                {editing.rules.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2"
                  >
                    <input
                      type="number"
                      min={1}
                      className={`${inputCls} w-16 text-center`}
                      value={r.minQty}
                      onChange={(e) => {
                        const rules = [...editing.rules];
                        rules[idx] = {
                          ...r,
                          minQty: Number(e.target.value) || 1,
                        };
                        setEditing({ ...editing, rules });
                      }}
                    />
                    <span className="text-xs font-bold text-white/40">×</span>
                    <select
                      className={`${inputCls} flex-1`}
                      value={r.category}
                      onChange={(e) => {
                        const rules = [...editing.rules];
                        rules[idx] = { ...r, category: e.target.value };
                        setEditing({ ...editing, rules });
                      }}
                    >
                      <option value="any">Qualquer categoria</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        setEditing({
                          ...editing,
                          rules: editing.rules.filter((_, i) => i !== idx),
                        })
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const rule: ComboRule = { category: "any", minQty: 1 };
                    setEditing({ ...editing, rules: [...editing.rules, rule] });
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 px-3 py-2.5 text-xs font-bold text-white/70 transition-colors hover:border-neon-pink/50 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar regra
                </button>
              </div>
            </FieldGroup>

            <FieldGroup title="Desconto & status" icon={Percent}>
              <label className="block">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                  Desconto (%)
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    className="flex-1 accent-neon-pink"
                    value={editing.discountPercent}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        discountPercent: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <div className="grid w-20 place-items-center rounded-xl border border-neon-yellow/40 bg-neon-yellow/10 py-2 font-display text-lg font-black text-neon-yellow">
                    {editing.discountPercent}%
                  </div>
                </div>
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  {editing.active ? (
                    <Eye className="h-4 w-4 text-neon-cyan" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-white/40" />
                  )}
                  <div>
                    <div className="text-sm font-bold text-white">
                      {editing.active ? "Combo ativo" : "Combo pausado"}
                    </div>
                    <div className="text-[11px] text-white/50">
                      {editing.active
                        ? "Aparece automaticamente no carrinho dos clientes"
                        : "Fica escondido até você reativar"}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-neon-pink"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />
              </label>
            </FieldGroup>
          </div>

          {/* preview */}
          <div className="md:col-span-2">
            <div className="sticky top-0 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                Prévia
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="relative h-28 overflow-hidden">
                  {editing.imageUrl ? (
                    <img
                      src={editing.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/40 via-neon-pink/25 to-neon-cyan/20">
                      <div className="absolute inset-0 grid place-items-center text-white/20">
                        <Package className="h-10 w-10" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.11_0.08_305)] to-transparent" />
                  <div className="absolute right-2 top-2 rounded-xl border border-neon-yellow/50 bg-black/60 px-2 py-1 font-display text-sm font-black text-neon-yellow backdrop-blur-md">
                    -{editing.discountPercent}%
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <div className="font-display text-base font-black text-white">
                    {editing.name || "Sem nome"}
                  </div>
                  <div className="text-[11px] text-white/55">
                    {editing.description || "Adicione uma descrição…"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editing.rules.map((r, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-neon-purple/25 px-2 py-0.5 text-[10px] font-semibold text-white/85"
                      >
                        {r.minQty}× {labelFor(r.category)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[10.5px] leading-relaxed text-white/40">
                Assim o combo aparece para o cliente quando as regras baterem no
                carrinho.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/10 bg-black/30 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-neon-pink/30 transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-40 glow-pink"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar combo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ FieldGroup ------------------------------ */

function FieldGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-white/80">
        <Icon className="h-3.5 w-3.5 text-neon-pink" />
        <div className="text-[11px] font-bold uppercase tracking-wider">{title}</div>
      </div>
      {children}
    </section>
  );
}
