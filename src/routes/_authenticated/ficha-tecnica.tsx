import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/lib/confirm";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Search,
  Plus,
  Trash2,
  Save,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Percent,
  Package,
  Boxes,
  Calculator,
  ChefHat,
  Sparkles,
  X,
  Wand2,
  ChevronLeft,
  MoreHorizontal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ficha-tecnica")({
  head: () => ({
    meta: [
      { title: "Ficha técnica — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FichaTecnicaPage,
});

type Product = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  base_price: number;
  cost_price: number | null;
  packaging_cost: number | null;
  target_margin_pct: number | null;
  active: boolean;
};

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  cost_per_unit: number | null;
  category: string | null;
};

type RecipeRow = {
  id?: string;
  ingredient_id: string;
  qty: number;
  waste_pct: number;
  notes: string | null;
  sort_order: number;
  _isNew?: boolean;
  _deleted?: boolean;
};

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FichaTecnicaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipesByProduct, setRecipesByProduct] = useState<Record<string, RecipeRow[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [packaging, setPackaging] = useState<number>(0);
  const [targetMargin, setTargetMargin] = useState<number>(70);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "with" | "without">("all");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyOpen, setCopyOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);


  const load = async () => {
    setLoading(true);
    const [pRes, iRes, rRes] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,category,image_url,base_price,cost_price,packaging_cost,target_margin_pct,active")
        .order("category")
        .order("name"),
      supabase
        .from("inventory_items")
        .select("id,name,unit,stock,cost_per_unit,category")
        .eq("active", true)
        .order("name"),
      supabase
        .from("product_recipes")
        .select("id,product_id,ingredient_id,qty,waste_pct,notes,sort_order")
        .order("sort_order"),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    if (iRes.error) toast.error(iRes.error.message);
    if (rRes.error) toast.error(rRes.error.message);
    const prods = (pRes.data ?? []) as Product[];
    setProducts(prods);
    setIngredients((iRes.data ?? []) as Ingredient[]);
    const grouped: Record<string, RecipeRow[]> = {};
    for (const r of rRes.data ?? []) {
      const pid = (r as { product_id: string }).product_id;
      grouped[pid] ??= [];
      grouped[pid].push({
        id: (r as { id: string }).id,
        ingredient_id: (r as { ingredient_id: string }).ingredient_id,
        qty: Number((r as { qty: number }).qty),
        waste_pct: Number((r as { waste_pct: number }).waste_pct),
        notes: (r as { notes: string | null }).notes,
        sort_order: (r as { sort_order: number }).sort_order,
      });
    }
    setRecipesByProduct(grouped);
    if (!selectedId && prods.length > 0) setSelectedId(prods[0].id);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load selected product into editor
  useEffect(() => {
    if (!selectedId) return;
    const p = products.find((x) => x.id === selectedId);
    if (!p) return;
    setRows(recipesByProduct[selectedId] ?? []);
    setPackaging(Number(p.packaging_cost ?? 0));
    setTargetMargin(Number(p.target_margin_pct ?? 70));
  }, [selectedId, products, recipesByProduct]);

  const ingredientMap = useMemo(() => {
    const m = new Map<string, Ingredient>();
    ingredients.forEach((i) => m.set(i.id, i));
    return m;
  }, [ingredients]);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  const activeRows = rows.filter((r) => !r._deleted);

  const ingredientsCost = activeRows.reduce((acc, r) => {
    const ing = ingredientMap.get(r.ingredient_id);
    const cpu = Number(ing?.cost_per_unit ?? 0);
    return acc + r.qty * (1 + r.waste_pct / 100) * cpu;
  }, 0);
  const totalCMV = ingredientsCost + (packaging || 0);
  const margin = selected && selected.base_price > 0
    ? ((selected.base_price - totalCMV) / selected.base_price) * 100
    : 0;
  const marginRs = selected ? selected.base_price - totalCMV : 0;
  const suggestedPrice = totalCMV > 0 ? totalCMV / (1 - Math.min(targetMargin, 95) / 100) : 0;

  const filteredProducts = products.filter((p) => {
    if (search && !`${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    const has = (recipesByProduct[p.id]?.length ?? 0) > 0;
    if (filter === "with" && !has) return false;
    if (filter === "without" && has) return false;
    return true;
  });

  const productHasRecipe = (id: string) =>
    (recipesByProduct[id]?.length ?? 0) > 0;

  const addRow = () => {
    const first = ingredients[0];
    if (!first) {
      toast.error("Cadastre insumos em /estoque primeiro");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        ingredient_id: first.id,
        qty: 1,
        waste_pct: 0,
        notes: null,
        sort_order: prev.length,
        _isNew: true,
      },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => {
      const cp = [...prev];
      if (cp[idx]._isNew) cp.splice(idx, 1);
      else cp[idx] = { ...cp[idx], _deleted: true };
      return cp;
    });
  };

  const updateRow = (idx: number, patch: Partial<RecipeRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Deletions
      const toDelete = rows.filter((r) => r._deleted && r.id).map((r) => r.id!);
      if (toDelete.length) {
        const { error } = await supabase
          .from("product_recipes")
          .delete()
          .in("id", toDelete);
        if (error) throw error;
      }
      // Upserts (new + existing kept)
      const survivors = rows
        .filter((r) => !r._deleted)
        .map((r, i) => ({
          id: r.id,
          product_id: selected.id,
          ingredient_id: r.ingredient_id,
          qty: Number(r.qty) || 0,
          waste_pct: Number(r.waste_pct) || 0,
          notes: r.notes,
          sort_order: i,
        }));
      // Detect duplicated ingredients
      const seen = new Set<string>();
      for (const s of survivors) {
        if (seen.has(s.ingredient_id)) {
          throw new Error("Insumos duplicados na ficha. Some as quantidades ao invés.");
        }
        seen.add(s.ingredient_id);
      }
      if (survivors.length) {
        const { error } = await supabase
          .from("product_recipes")
          .upsert(survivors as never, { onConflict: "id" });
        if (error) throw error;
      }
      // Update product cost + packaging + margin
      const { error: pErr } = await supabase
        .from("products")
        .update({
          cost_price: Number(totalCMV.toFixed(4)),
          packaging_cost: packaging,
          target_margin_pct: targetMargin,
        })
        .eq("id", selected.id);
      if (pErr) throw pErr;

      toast.success("Ficha técnica salva • CMV atualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const copyFrom = async (fromId: string) => {
    if (!selected) return;
    const src = recipesByProduct[fromId] ?? [];
    setRows(
      src.map((r, i) => ({
        ingredient_id: r.ingredient_id,
        qty: r.qty,
        waste_pct: r.waste_pct,
        notes: r.notes,
        sort_order: i,
        _isNew: true,
      })),
    );
    setCopyOpen(false);
    toast.success("Receita copiada — revise e salve");
  };

  const applySuggestedPrice = async () => {
    if (!selected || suggestedPrice <= 0) return;
    const { error } = await supabase
      .from("products")
      .update({ base_price: Number(suggestedPrice.toFixed(2)) })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(`Preço atualizado para ${BRL(suggestedPrice)}`);
    await load();
  };

  const recalcAll = async () => {
    if (!(await confirmDialog({ message: "Recalcular CMV de todos os produtos com ficha técnica?" }))) return;
    let updated = 0;
    for (const p of products) {
      const rs = recipesByProduct[p.id];
      if (!rs || !rs.length) continue;
      const c = rs.reduce((acc, r) => {
        const ing = ingredientMap.get(r.ingredient_id);
        return acc + r.qty * (1 + r.waste_pct / 100) * Number(ing?.cost_per_unit ?? 0);
      }, 0) + Number(p.packaging_cost ?? 0);
      await supabase.from("products").update({ cost_price: Number(c.toFixed(4)) }).eq("id", p.id);
      updated++;
    }
    toast.success(`${updated} produto(s) recalculado(s)`);
    await load();
  };

  const exportCSV = () => {
    const lines = ["produto,categoria,insumo,unidade,qtd,perda_pct,custo_unit,subtotal"];
    for (const p of products) {
      const rs = recipesByProduct[p.id];
      if (!rs?.length) continue;
      for (const r of rs) {
        const ing = ingredientMap.get(r.ingredient_id);
        const cpu = Number(ing?.cost_per_unit ?? 0);
        const sub = r.qty * (1 + r.waste_pct / 100) * cpu;
        lines.push(
          [
            JSON.stringify(p.name),
            JSON.stringify(p.category),
            JSON.stringify(ing?.name ?? ""),
            ing?.unit ?? "",
            r.qty,
            r.waste_pct,
            cpu.toFixed(4),
            sub.toFixed(4),
          ].join(","),
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ficha-tecnica-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // KPIs
  const totalProducts = products.length;
  const withRecipe = products.filter((p) => productHasRecipe(p.id)).length;
  const avgMargin = (() => {
    const vals = products
      .filter((p) => productHasRecipe(p.id) && p.base_price > 0 && p.cost_price)
      .map((p) => ((p.base_price - Number(p.cost_price)) / p.base_price) * 100);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();
  const lowMargin = products.filter((p) => {
    if (!productHasRecipe(p.id) || !p.cost_price || p.base_price <= 0) return false;
    const m = ((p.base_price - Number(p.cost_price)) / p.base_price) * 100;
    return m < 40;
  }).length;

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-br from-card to-background px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
              <ClipboardCheck className="h-3 w-3" />
              Gestão · CMV
            </div>
            <h1 className="text-2xl font-black md:text-3xl">Ficha técnica</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              Monte a receita de cada produto vinculando insumos do estoque. O CMV é
              calculado automaticamente e o consumo é descontado do estoque a cada venda paga.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={recalcAll}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              <Calculator className="h-3.5 w-3.5" /> Recalcular tudo
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPI label="Produtos" value={totalProducts.toString()} icon={Package} tone="neutral" />
          <KPI
            label="Com ficha"
            value={`${withRecipe}/${totalProducts}`}
            hint={totalProducts ? `${((withRecipe / totalProducts) * 100).toFixed(0)}% coberto` : ""}
            icon={CheckCircle2}
            tone="good"
          />
          <KPI
            label="Margem média"
            value={`${avgMargin.toFixed(1)}%`}
            icon={Percent}
            tone={avgMargin >= 60 ? "good" : avgMargin >= 40 ? "warn" : "bad"}
          />
          <KPI
            label="Margem baixa (<40%)"
            value={lowMargin.toString()}
            icon={AlertTriangle}
            tone={lowMargin ? "bad" : "good"}
          />
        </div>
      </div>

      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[320px_1fr]">
        {/* Product list */}
        <aside className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-neon-pink/60"
              />
            </div>
            <div className="mt-2 flex gap-1">
              {(["all", "with", "without"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                    filter === f
                      ? "border-neon-pink/60 bg-neon-pink/15 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white",
                  )}
                >
                  {f === "all" ? "Todos" : f === "with" ? "Com ficha" : "Sem ficha"}
                </button>
              ))}
            </div>
          </div>
          <ul className="max-h-[70vh] divide-y divide-white/5 overflow-y-auto">
            {loading && (
              <li className="p-4 text-center text-xs text-white/40">Carregando...</li>
            )}
            {!loading && filteredProducts.length === 0 && (
              <li className="p-4 text-center text-xs text-white/40">Nenhum produto</li>
            )}
            {filteredProducts.map((p) => {
              const has = productHasRecipe(p.id);
              const m =
                has && p.cost_price && p.base_price > 0
                  ? ((p.base_price - Number(p.cost_price)) / p.base_price) * 100
                  : null;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left transition",
                      selectedId === p.id ? "bg-neon-pink/10" : "hover:bg-white/5",
                    )}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/40">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/50">
                        <span>{p.category}</span>
                        <span>·</span>
                        <span>{BRL(Number(p.base_price))}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {has ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold",
                            m === null
                              ? "bg-white/10 text-white/60"
                              : m >= 60
                                ? "bg-emerald-500/15 text-emerald-300"
                                : m >= 40
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-rose-500/15 text-rose-300",
                          )}
                        >
                          {m === null ? "OK" : `${m.toFixed(0)}%`}
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">
                          Sem ficha
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Editor */}
        <section className="rounded-2xl border border-white/10 bg-white/5">
          {!selected ? (
            <div className="grid h-full place-items-center p-10 text-white/40">
              Selecione um produto
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black/40">
                      {selected.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selected.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ChefHat className="h-5 w-5 text-white/40" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-white/40">
                        {selected.category}
                      </div>
                      <div className="text-lg font-black">{selected.name}</div>
                      <div className="text-xs text-white/50">
                        Preço de venda:{" "}
                        <span className="font-bold text-white">{BRL(selected.base_price)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCopyOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      <Copy className="h-3 w-3" /> Copiar de...
                    </button>
                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-neon-pink to-fuchsia-500 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-neon-pink/30 hover:brightness-110 disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> {saving ? "Salvando..." : "Salvar ficha"}
                    </button>
                  </div>
                </div>

                {/* Cost summary bar */}
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <Stat label="CMV total" value={BRL(totalCMV)} tone="warn" icon={Boxes} />
                  <Stat
                    label="Margem"
                    value={`${margin.toFixed(1)}%`}
                    hint={BRL(marginRs)}
                    tone={margin >= 60 ? "good" : margin >= 40 ? "warn" : "bad"}
                    icon={Percent}
                  />
                  <Stat label="Insumos" value={BRL(ingredientsCost)} icon={Package} />
                  <Stat label="Embalagem" value={BRL(packaging)} icon={Package} />
                </div>
              </div>

              {/* Recipe rows */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/30 text-[10px] uppercase tracking-widest text-white/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Insumo</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      <th className="px-3 py-2 text-left">Unid.</th>
                      <th className="px-3 py-2 text-right">Perda %</th>
                      <th className="px-3 py-2 text-right">Custo un.</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 text-left">Notas</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-xs text-white/40">
                          Nenhum insumo. Clique em <b>Adicionar</b> para montar a receita.
                        </td>
                      </tr>
                    )}
                    {rows.map((r, idx) => {
                      if (r._deleted) return null;
                      const ing = ingredientMap.get(r.ingredient_id);
                      const cpu = Number(ing?.cost_per_unit ?? 0);
                      const sub = r.qty * (1 + r.waste_pct / 100) * cpu;
                      const stockOk = ing ? ing.stock >= r.qty : true;
                      return (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2">
                            <select
                              value={r.ingredient_id}
                              onChange={(e) => updateRow(idx, { ingredient_id: e.target.value })}
                              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-neon-pink/60"
                            >
                              {ingredients.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.unit})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              value={r.qty}
                              onChange={(e) => updateRow(idx, { qty: Number(e.target.value) })}
                              className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-right text-sm text-white outline-none focus:border-neon-pink/60"
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-white/60">{ing?.unit ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={r.waste_pct}
                              onChange={(e) => updateRow(idx, { waste_pct: Number(e.target.value) })}
                              className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-right text-sm text-white outline-none focus:border-neon-pink/60"
                            />
                          </td>
                          <td className={cn("px-3 py-2 text-right text-xs", cpu === 0 ? "text-rose-300" : "text-white/70")}>
                            {cpu > 0 ? BRL(cpu) : "sem custo"}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-white">
                            {BRL(sub)}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={r.notes ?? ""}
                              onChange={(e) => updateRow(idx, { notes: e.target.value || null })}
                              placeholder="opcional"
                              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none focus:border-neon-pink/60"
                            />
                            {!stockOk && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-300">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Estoque insuficiente ({ing?.stock ?? 0} {ing?.unit})
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeRow(idx)}
                              className="grid h-7 w-7 place-items-center rounded-md text-rose-300 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 p-3">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  <Plus className="h-3 w-3" /> Adicionar insumo
                </button>
                <div className="text-xs text-white/50">
                  {activeRows.length} insumo(s) · CMV{" "}
                  <span className="font-bold text-white">{BRL(totalCMV)}</span>
                </div>
              </div>

              {/* Extras + suggested price */}
              <div className="grid gap-4 border-t border-white/10 p-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
                    Parâmetros
                  </div>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs text-white/60">
                        Embalagem por unidade (R$)
                      </span>
                      <div className="relative mt-1">
                        <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={packaging}
                          onChange={(e) => setPackaging(Number(e.target.value))}
                          className="w-full rounded-md border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-neon-pink/60"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-xs text-white/60">Margem alvo (%)</span>
                      <div className="relative mt-1">
                        <Percent className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="95"
                          value={targetMargin}
                          onChange={(e) => setTargetMargin(Number(e.target.value))}
                          className="w-full rounded-md border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-neon-pink/60"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-neon-pink/30 bg-gradient-to-br from-neon-pink/10 to-transparent p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neon-pink">
                    <Sparkles className="h-3 w-3" />
                    Preço sugerido
                  </div>
                  <div className="text-3xl font-black text-white">
                    {BRL(suggestedPrice)}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    para margem de {targetMargin}% · CMV {BRL(totalCMV)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
                    <span>Preço atual: {BRL(selected.base_price)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        selected.base_price >= suggestedPrice
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300",
                      )}
                    >
                      {selected.base_price >= suggestedPrice ? "Acima da meta" : "Abaixo da meta"}
                    </span>
                  </div>
                  <button
                    onClick={applySuggestedPrice}
                    disabled={suggestedPrice <= 0}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    <Wand2 className="h-3 w-3" />
                    Aplicar preço sugerido
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Copy dialog */}
      {copyOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black">Copiar ficha técnica</h3>
              <button
                onClick={() => setCopyOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-white/60">
              Escolha um produto com ficha cadastrada para copiar a receita.
            </p>
            <ul className="max-h-[50vh] divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
              {products
                .filter((p) => productHasRecipe(p.id) && p.id !== selectedId)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => copyFrom(p.id)}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-white/5"
                    >
                      <span className="text-sm text-white">{p.name}</span>
                      <span className="text-[10px] text-white/40">
                        {recipesByProduct[p.id]?.length ?? 0} insumo(s)
                      </span>
                    </button>
                  </li>
                ))}
              {products.filter((p) => productHasRecipe(p.id) && p.id !== selectedId).length ===
                0 && (
                <li className="p-4 text-center text-xs text-white/40">
                  Nenhum outro produto com ficha
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const tones: Record<string, string> = {
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    bad: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    neutral: "border-white/10 bg-white/5 text-white/70",
  };
  return (
    <div className={cn("rounded-xl border p-3", tones[tone])}>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
      {hint && <div className="text-[10px] text-white/50">{hint}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "good" | "warn" | "bad";
}) {
  const tones: Record<string, string> = {
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
  };
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/50">
        <span>{label}</span>
        <Icon className="h-3 w-3" />
      </div>
      <div className={cn("mt-1 text-lg font-black", tone ? tones[tone] : "text-white")}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-white/50">{hint}</div>}
    </div>
  );
}
