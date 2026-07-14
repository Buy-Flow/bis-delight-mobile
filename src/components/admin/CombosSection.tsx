import { useState } from "react";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  useAllCombos,
  useUpsertCombo,
  useDeleteCombo,
  useCategories,
  type Combo,
  type ComboRule,
} from "@/lib/menu-data";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink";

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

export function CombosSection() {
  const { data: combos = [], isLoading } = useAllCombos();
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertCombo();
  const remove = useDeleteCombo();
  const [editing, setEditing] = useState<Combo | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-black text-white">Combos com desconto</h2>
          <p className="text-[12px] text-white/50">
            Kits que ganham desconto automático quando o cliente atinge as regras.
          </p>
        </div>
        <button
          onClick={() => setEditing(emptyCombo())}
          className="flex items-center gap-2 rounded-2xl bg-neon-pink px-4 py-2 text-sm font-extrabold text-white glow-pink"
        >
          <Plus className="h-4 w-4" /> Novo combo
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-10 text-center text-sm text-white/50">
          Nenhum combo criado. Clique em "Novo combo" para começar.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {combos.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${c.active ? "bg-neon-cyan" : "bg-white/30"}`}
                    />
                    <h3 className="truncate font-display text-lg font-black text-white">
                      {c.name}
                    </h3>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-white/60">
                    {c.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.rules.map((r, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-neon-purple/20 px-2 py-0.5 text-[10px] font-semibold text-white/80"
                      >
                        {r.label || `${r.minQty}× ${r.category === "any" ? "qualquer" : r.category}`}
                      </span>
                    ))}
                    <span className="rounded-full bg-neon-yellow/20 px-2 py-0.5 text-[10px] font-black text-neon-yellow">
                      -{c.discountPercent}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setEditing(c)}
                    className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => del(c.id)}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-[oklch(0.12_0.08_305)] sm:rounded-3xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-xl font-black text-white">
                {editing.id ? "Editar combo" : "Novo combo"}
              </h3>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              <label className="block">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Nome</div>
                <input
                  className={inputCls}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Kit Família"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Descrição</div>
                <input
                  className={inputCls}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="3 açaís + acompanhamentos com desconto"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">URL da imagem (opcional)</div>
                <input
                  className={inputCls}
                  value={editing.imageUrl}
                  onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                />
              </label>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">Regras</div>
                <div className="space-y-2">
                  {editing.rules.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
                      <input
                        type="number"
                        min={1}
                        className={`${inputCls} w-16`}
                        value={r.minQty}
                        onChange={(e) => {
                          const rules = [...editing.rules];
                          rules[idx] = { ...r, minQty: Number(e.target.value) || 1 };
                          setEditing({ ...editing, rules });
                        }}
                      />
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
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          setEditing({
                            ...editing,
                            rules: editing.rules.filter((_, i) => i !== idx),
                          });
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-300"
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
                    className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs font-bold text-white/70 hover:border-white/40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar regra
                  </button>
                </div>
              </div>

              <label className="block">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Desconto (%)</div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={inputCls}
                  value={editing.discountPercent}
                  onChange={(e) => setEditing({ ...editing, discountPercent: Number(e.target.value) || 0 })}
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neon-pink"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                <span className="text-sm font-semibold text-white">Combo ativo</span>
              </label>
            </div>

            <div className="flex gap-2 border-t border-white/10 bg-black/20 px-5 py-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={upsert.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink disabled:opacity-40"
              >
                {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
