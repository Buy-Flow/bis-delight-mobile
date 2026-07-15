import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, X, GripVertical, EyeOff, Eye } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useProductBadges, badgeInkFor, type ProductBadge } from "@/lib/product-badges";
import { confirmDialog } from "@/lib/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/selos")({
  component: SelosPage,
});

const DEFAULT_COLORS = [
  "oklch(0.87 0.19 95)", // amarelo
  "oklch(0.80 0.16 200)", // ciano
  "oklch(0.72 0.22 350)", // rosa neon
  "oklch(0.68 0.20 30)", // laranja
  "oklch(0.75 0.18 145)", // verde
  "oklch(0.65 0.22 280)", // roxo
];

const ICON_SUGGESTIONS = ["⭐", "✨", "❤️", "🔥", "🏆", "💎", "🌟", "⚡", "🎁", "🆕", "👑", "🍦"];

function SelosPage() {
  const { data: badges = [], isLoading } = useProductBadges();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ProductBadge> | null>(null);

  const openNew = () =>
    setEditing({
      name: "",
      color: DEFAULT_COLORS[0],
      icon: "⭐",
      sort_order: (badges.at(-1)?.sort_order ?? 0) + 1,
      active: true,
    });

  const save = async () => {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) return toast.error("Dá um nome ao selo");
    if (name.length > 30) return toast.error("Nome muito longo (máx 30)");
    const payload = {
      name,
      color: editing.color ?? DEFAULT_COLORS[0],
      icon: editing.icon ?? "🏷️",
      sort_order: editing.sort_order ?? 0,
      active: editing.active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("product_badges" as never).update(payload as never).eq("id" as never, editing.id as never)
      : await supabase.from("product_badges" as never).insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Selo atualizado" : "Selo criado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["product-badges"] });
  };

  const toggleActive = async (b: ProductBadge) => {
    const { error } = await supabase
      .from("product_badges" as never)
      .update({ active: !b.active } as never)
      .eq("id" as never, b.id as never);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["product-badges"] });
  };

  const remove = async (b: ProductBadge) => {
    const ok = await confirmDialog({
      title: `Apagar "${b.name}"?`,
      message: "Produtos com esse selo continuarão listados, mas o selo deixará de aparecer.",
      confirmLabel: "Apagar",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("product_badges" as never).delete().eq("id" as never, b.id as never);
    if (error) return toast.error(error.message);
    toast.success("Selo removido");
    qc.invalidateQueries({ queryKey: ["product-badges"] });
  };

  const move = async (b: ProductBadge, dir: -1 | 1) => {
    const sorted = [...badges];
    const i = sorted.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    await supabase.from("product_badges" as never).update({ sort_order: other.sort_order } as never).eq("id" as never, b.id as never);
    await supabase.from("product_badges" as never).update({ sort_order: b.sort_order } as never).eq("id" as never, other.id as never);
    qc.invalidateQueries({ queryKey: ["product-badges"] });
  };

  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-black text-white sm:text-3xl">Selos de produto</h1>
        <p className="mt-1 text-sm text-white/60">Crie, edite e organize os selos que aparecem nos cards do cardápio.</p>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/70">
          {badges.length} {badges.length === 1 ? "selo" : "selos"} cadastrado{badges.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-pink px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Novo selo
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-6 text-white/60">Carregando…</div>
      ) : badges.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhum selo cadastrado"
          description="Crie o primeiro selo para destacar produtos no cardápio."
          action={
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-neon-pink px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Criar selo
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b, idx) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      className="rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      onClick={() => move(b, -1)}
                      disabled={idx === 0}
                      aria-label="Subir"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      className="rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      onClick={() => move(b, 1)}
                      disabled={idx === badges.length - 1}
                      aria-label="Descer"
                    >
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>
                  <span
                    className="inline-flex -rotate-6 items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-black uppercase tracking-[0.14em] shadow-lg"
                    style={{
                      backgroundColor: b.color,
                      color: badgeInkFor(b.color),
                      boxShadow: "0 6px 12px -3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
                    }}
                  >
                    <span>{b.icon}</span> {b.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(b)}
                    className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                    title={b.active ? "Desativar" : "Ativar"}
                  >
                    {b.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => remove(b)}
                    className="rounded p-1.5 text-white/60 hover:bg-red-500/20 hover:text-red-300"
                    title="Apagar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                <span>Ordem #{b.sort_order}</span>
                <span className={b.active ? "text-emerald-300" : "text-amber-300"}>
                  {b.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <button
                onClick={() => setEditing(b)}
                className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10"
              >
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-neutral-950 p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-black text-white">{editing.id ? "Editar selo" : "Novo selo"}</h2>
              <button onClick={() => setEditing(null)} className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60">Nome</span>
                <input
                  type="text"
                  value={editing.name ?? ""}
                  maxLength={30}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:border-neon-pink focus:outline-none"
                  placeholder="Ex: Mais pedido"
                />
              </label>

              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60">Ícone</span>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_SUGGESTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setEditing({ ...editing, icon: ic })}
                      className={`rounded-lg border px-2.5 py-1.5 text-lg ${editing.icon === ic ? "border-neon-pink bg-neon-pink/20" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
                    >
                      {ic}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={editing.icon ?? ""}
                    maxLength={2}
                    onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                    className="w-14 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-center text-lg text-white focus:border-neon-pink focus:outline-none"
                    placeholder="✏️"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60">Cor</span>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, color: c })}
                      className={`h-10 w-10 rounded-lg border-2 ${editing.color === c ? "border-white" : "border-white/20"}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={editing.color ?? ""}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-white focus:border-neon-pink focus:outline-none"
                  placeholder="oklch(0.87 0.19 95)"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="h-4 w-4 accent-neon-pink"
                />
                Ativo (aparece no cardápio)
              </label>

              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60">Prévia</span>
                <div className="rounded-xl border border-white/10 bg-neutral-900 p-6">
                  <div
                    className="inline-flex -rotate-6 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-lg"
                    style={{
                      backgroundColor: editing.color ?? DEFAULT_COLORS[0],
                      color: badgeInkFor(editing.color ?? DEFAULT_COLORS[0]),
                      boxShadow: "0 6px 12px -3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
                    }}
                  >
                    <span>{editing.icon || "🏷️"}</span> {editing.name || "Selo"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-neon-pink px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:brightness-110"
              >
                <Save className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
