import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/lib/confirm";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Archive,
  Package,
  Boxes,
  History,
  Plus,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Trash2,
  RefreshCcw,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  Sliders,
  DollarSign,
  Truck,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EstoquePage,
});

type ProductRow = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  stock: number | null;
  low_stock_threshold: number;
  cost_price: number | null;
  base_price: number;
  active: boolean;
};

type Ingredient = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  stock: number;
  low_stock_threshold: number;
  cost_per_unit: number | null;
  supplier: string | null;
  supplier_phone: string | null;
  sku: string | null;
  notes: string | null;
  active: boolean;
  updated_at: string;
};

type Movement = {
  id: string;
  item_type: "product" | "ingredient";
  product_id: string | null;
  ingredient_id: string | null;
  movement_type: "entrada" | "saida" | "ajuste" | "perda" | "venda";
  qty: number;
  unit_cost: number | null;
  reason: string | null;
  reference: string | null;
  created_at: string;
};

const MOVE_LABELS: Record<Movement["movement_type"], { label: string; color: string; icon: typeof ArrowUpCircle }> = {
  entrada: { label: "Entrada", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: ArrowUpCircle },
  saida: { label: "Saída", color: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: ArrowDownCircle },
  perda: { label: "Perda", color: "text-red-400 bg-red-500/10 border-red-500/30", icon: Ban },
  ajuste: { label: "Ajuste", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: Sliders },
  venda: { label: "Venda", color: "text-purple-400 bg-purple-500/10 border-purple-500/30", icon: TrendingDown },
};

const UNITS = ["un", "kg", "g", "L", "mL", "cx", "pct", "dz"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtQty(n: number, unit?: string) {
  const s = Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unit ? `${s} ${unit}` : s;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function EstoquePage() {
  const [tab, setTab] = useState<"produtos" | "insumos" | "movimentos">("produtos");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "ok">("all");

  const [editIng, setEditIng] = useState<Ingredient | "new" | null>(null);
  const [moveOpen, setMoveOpen] = useState<null | {
    item_type: "product" | "ingredient";
    id: string;
    name: string;
    unit?: string;
    currentStock: number;
  }>(null);

  async function load() {
    setLoading(true);
    const [p, i, m] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,category,image_url,stock,low_stock_threshold,cost_price,base_price,active")
        .order("name"),
      supabase.from("inventory_items").select("*").order("name"),
      supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (p.data) setProducts(p.data as ProductRow[]);
    if (i.data) setIngredients(i.data as Ingredient[]);
    if (m.data) setMovements(m.data as Movement[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("estoque-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);
  const ingMap = useMemo(() => {
    const m = new Map<string, { name: string; unit: string }>();
    ingredients.forEach((i) => m.set(i.id, { name: i.name, unit: i.unit }));
    return m;
  }, [ingredients]);

  const kpi = useMemo(() => {
    const trackedProds = products.filter((p) => p.stock !== null);
    const outProds = trackedProds.filter((p) => (p.stock ?? 0) <= 0).length;
    const lowProds = trackedProds.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= p.low_stock_threshold).length;
    const outIng = ingredients.filter((i) => i.stock <= 0 && i.active).length;
    const lowIng = ingredients.filter((i) => i.stock > 0 && i.stock <= i.low_stock_threshold && i.active).length;
    const valueIng = ingredients.reduce((s, i) => s + i.stock * (i.cost_per_unit ?? 0), 0);
    const valueProd = trackedProds.reduce((s, p) => s + (p.stock ?? 0) * (p.cost_price ?? 0), 0);
    return {
      totalItems: trackedProds.length + ingredients.length,
      alerts: outProds + outIng + lowProds + lowIng,
      out: outProds + outIng,
      low: lowProds + lowIng,
      value: valueIng + valueProd,
    };
  }, [products, ingredients]);

  const filteredProducts = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products
      .filter((p) => (query ? p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query) : true))
      .filter((p) => {
        if (filter === "all") return true;
        const s = p.stock;
        if (s === null) return false;
        if (filter === "out") return s <= 0;
        if (filter === "low") return s > 0 && s <= p.low_stock_threshold;
        if (filter === "ok") return s > p.low_stock_threshold;
        return true;
      });
  }, [products, q, filter]);

  const filteredIngredients = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ingredients
      .filter((i) =>
        query
          ? i.name.toLowerCase().includes(query) ||
            (i.category ?? "").toLowerCase().includes(query) ||
            (i.supplier ?? "").toLowerCase().includes(query)
          : true,
      )
      .filter((i) => {
        if (filter === "all") return true;
        if (filter === "out") return i.stock <= 0;
        if (filter === "low") return i.stock > 0 && i.stock <= i.low_stock_threshold;
        if (filter === "ok") return i.stock > i.low_stock_threshold;
        return true;
      });
  }, [ingredients, q, filter]);

  const filteredMovements = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return movements;
    return movements.filter((m) => {
      const name =
        m.item_type === "product"
          ? productMap.get(m.product_id ?? "") ?? ""
          : ingMap.get(m.ingredient_id ?? "")?.name ?? "";
      return name.toLowerCase().includes(query) || (m.reason ?? "").toLowerCase().includes(query);
    });
  }, [movements, q, productMap, ingMap]);

  async function updateProductThreshold(id: string, threshold: number) {
    const { error } = await supabase.from("products").update({ low_stock_threshold: threshold }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Alerta atualizado");
      load();
    }
  }

  async function deleteIngredient(id: string) {
    if (!(await confirmDialog({ message: "Excluir esse insumo? O histórico de movimentações será removido junto." }))) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Insumo removido");
      load();
    }
  }

  function exportCSV() {
    let rows: string[] = [];
    if (tab === "produtos") {
      rows = [
        "Produto,Categoria,Estoque,Alerta,Custo,Valor total",
        ...filteredProducts
          .filter((p) => p.stock !== null)
          .map(
            (p) =>
              `"${p.name}","${p.category}",${p.stock ?? 0},${p.low_stock_threshold},${p.cost_price ?? 0},${((p.stock ?? 0) * (p.cost_price ?? 0)).toFixed(2)}`,
          ),
      ];
    } else if (tab === "insumos") {
      rows = [
        "Insumo,Categoria,Unidade,Estoque,Alerta,Custo unitário,Fornecedor",
        ...filteredIngredients.map(
          (i) =>
            `"${i.name}","${i.category ?? ""}","${i.unit}",${i.stock},${i.low_stock_threshold},${i.cost_per_unit ?? 0},"${i.supplier ?? ""}"`,
        ),
      ];
    } else {
      rows = [
        "Data,Tipo,Item,Qtd,Custo,Motivo",
        ...filteredMovements.map((m) => {
          const name =
            m.item_type === "product"
              ? productMap.get(m.product_id ?? "") ?? "?"
              : ingMap.get(m.ingredient_id ?? "")?.name ?? "?";
          return `"${fmtDateTime(m.created_at)}","${MOVE_LABELS[m.movement_type].label}","${name}",${m.qty},${m.unit_cost ?? 0},"${(m.reason ?? "").replace(/"/g, "'")}"`;
        }),
      ];
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background text-white pb-24 md:pb-6">
      <div className="mx-auto max-w-7xl p-3 md:p-6 space-y-4 md:space-y-6">
        {/* HEADER */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-black grid place-items-center shadow-lg shadow-yellow-500/30">
              <Archive className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-bold truncate">Estoque</h1>
              <p className="text-white/60 text-xs md:text-sm truncate">
                {kpi.totalItems} itens · {kpi.alerts} alerta{kpi.alerts !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={load}
              aria-label="Atualizar"
              className="h-10 w-10 md:h-auto md:w-auto md:px-3 md:py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center justify-center gap-1.5"
            >
              <RefreshCcw className="w-4 h-4" /> <span className="hidden md:inline">Atualizar</span>
            </button>
            <button
              onClick={exportCSV}
              aria-label="Exportar CSV"
              className="h-10 w-10 md:h-auto md:w-auto md:px-3 md:py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" /> <span className="hidden md:inline">Exportar</span>
            </button>
            <button
              onClick={() => setEditIng("new")}
              className="h-10 px-3 md:px-3 md:py-2 rounded-lg bg-yellow-400 text-black text-sm font-semibold flex items-center gap-1.5 hover:bg-yellow-300"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo insumo</span><span className="sm:hidden">Novo</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="md:hidden grid grid-cols-2 gap-2.5">
          <div className="col-span-2">
            <KpiCard
              title="Precisam de atenção"
              value={kpi.alerts.toString()}
              subtitle={kpi.alerts > 0 ? `${kpi.out} sem estoque · ${kpi.low} baixo` : "Tudo em ordem"}
              icon={AlertTriangle}
              color="from-orange-500/25 to-red-600/10"
              highlight={kpi.alerts > 0}
              large
            />
          </div>
          <KpiCard title="Itens" value={kpi.totalItems.toString()} icon={Boxes} color="from-blue-500/20 to-blue-600/5" />
          <KpiCard title="Valor" value={fmtBRL(kpi.value)} icon={DollarSign} color="from-emerald-500/20 to-emerald-600/5" />
        </div>

        <div className="hidden md:grid md:grid-cols-5 gap-3">
          <KpiCard title="Itens rastreados" value={kpi.totalItems.toString()} icon={Boxes} color="from-blue-500/20 to-blue-600/5" />
          <KpiCard title="Sem estoque" value={kpi.out.toString()} icon={Ban} color="from-red-500/20 to-red-600/5" highlight={kpi.out > 0} />
          <KpiCard title="Estoque baixo" value={kpi.low.toString()} icon={AlertTriangle} color="from-orange-500/20 to-orange-600/5" highlight={kpi.low > 0} />
          <KpiCard title="Valor em estoque" value={fmtBRL(kpi.value)} icon={DollarSign} color="from-emerald-500/20 to-emerald-600/5" />
          <KpiCard title="Movimentos" value={movements.length.toString()} icon={History} color="from-purple-500/20 to-purple-600/5" />
        </div>

        {/* TABS + FILTROS */}
        <div className="sticky top-0 z-20 -mx-3 px-3 py-2 md:mx-0 md:px-0 md:py-0 md:static bg-[#0b0518]/85 backdrop-blur supports-[backdrop-filter]:bg-[#0b0518]/70 md:bg-transparent md:backdrop-blur-0 border-b border-white/5 md:border-0 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shrink-0 w-full md:w-auto">
              {(
                [
                  { id: "produtos", label: "Produtos", icon: Package, count: products.filter((p) => p.stock !== null).length },
                  { id: "insumos", label: "Insumos", icon: Boxes, count: ingredients.length },
                  { id: "movimentos", label: "Movimentos", icon: History, count: movements.length },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 md:flex-none px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5 font-medium transition-colors whitespace-nowrap",
                    tab === t.id ? "bg-yellow-400 text-black shadow-sm shadow-yellow-500/30" : "text-white/70 hover:bg-white/10",
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                  <span className={cn("text-[10px] px-1.5 rounded-full font-bold tabular-nums", tab === t.id ? "bg-black/20" : "bg-white/10")}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "movimentos" ? "Buscar por item ou motivo…" : "Buscar por nome, categoria…"}
                className="w-full pl-8 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-yellow-400/50"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Limpar busca"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5 text-white/50" />
                </button>
              )}
            </div>
          </div>
          {tab !== "movimentos" && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              {(
                [
                  { id: "all", label: "Todos", dot: "" },
                  { id: "out", label: "Sem estoque", dot: "bg-red-400" },
                  { id: "low", label: "Baixo", dot: "bg-orange-400" },
                  { id: "ok", label: "Regular", dot: "bg-emerald-400" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as typeof filter)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex items-center gap-1.5",
                    filter === f.id
                      ? "bg-white/10 border-white/25 text-white"
                      : "bg-transparent border-white/10 text-white/60 hover:bg-white/5",
                  )}
                >
                  {f.dot && <span className={cn("w-1.5 h-1.5 rounded-full", f.dot)} />}
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="text-center py-16 text-white/50">Carregando…</div>
        ) : tab === "produtos" ? (
          <ProductsTable
            products={filteredProducts}
            onOpenMovement={(p) =>
              setMoveOpen({ item_type: "product", id: p.id, name: p.name, currentStock: p.stock ?? 0 })
            }
            onUpdateThreshold={updateProductThreshold}
          />
        ) : tab === "insumos" ? (
          <IngredientsTable
            ingredients={filteredIngredients}
            onEdit={setEditIng}
            onDelete={deleteIngredient}
            onOpenMovement={(i) =>
              setMoveOpen({ item_type: "ingredient", id: i.id, name: i.name, unit: i.unit, currentStock: i.stock })
            }
          />
        ) : (
          <MovementsTable movements={filteredMovements} productMap={productMap} ingMap={ingMap} />
        )}
      </div>


      {editIng && (
        <IngredientDialog
          ingredient={editIng === "new" ? null : editIng}
          onClose={() => setEditIng(null)}
          onSaved={() => {
            setEditIng(null);
            load();
          }}
        />
      )}
      {moveOpen && (
        <MovementDialog
          target={moveOpen}
          onClose={() => setMoveOpen(null)}
          onSaved={() => {
            setMoveOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  highlight,
  large,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof Boxes;
  color: string;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 bg-gradient-to-br transition-all",
        color,
        highlight ? "border-orange-500/40 ring-1 ring-orange-500/30" : "border-white/10",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] md:text-xs text-white/60 uppercase tracking-wide font-medium">{title}</span>
        <Icon className={cn("w-4 h-4", highlight ? "text-orange-400" : "text-white/40")} />
      </div>
      <div className={cn("mt-1.5 font-bold tabular-nums truncate", large ? "text-3xl" : "text-2xl")}>{value}</div>
      {subtitle && <div className="text-[11px] text-white/50 mt-0.5 truncate">{subtitle}</div>}
    </div>
  );
}


function statusFor(stock: number, threshold: number): { label: string; className: string; tone: "red" | "orange" | "green" } {
  if (stock <= 0) return { label: "Sem estoque", className: "bg-red-500/15 text-red-300 border-red-500/40", tone: "red" };
  if (stock <= threshold) return { label: "Baixo", className: "bg-orange-500/15 text-orange-300 border-orange-500/40", tone: "orange" };
  return { label: "OK", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", tone: "green" };
}

function StockBar({ stock, threshold, tone }: { stock: number; threshold: number; tone: "red" | "orange" | "green" }) {
  // Escala: threshold representa ~40% da barra. Assim é fácil ler alertas.
  const target = Math.max(threshold * 2.5, 1);
  const pct = Math.max(0, Math.min(100, (stock / target) * 100));
  const bar = tone === "red" ? "bg-red-400" : tone === "orange" ? "bg-orange-400" : "bg-emerald-400";
  return (
    <div className="relative h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      {threshold > 0 && (
        <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: `${Math.min(100, (threshold / target) * 100)}%` }} />
      )}
    </div>
  );
}


function ProductsTable({
  products,
  onOpenMovement,
  onUpdateThreshold,
}: {
  products: ProductRow[];
  onOpenMovement: (p: ProductRow) => void;
  onUpdateThreshold: (id: string, threshold: number) => void;
}) {
  const tracked = products.filter((p) => p.stock !== null);
  const untracked = products.filter((p) => p.stock === null);
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="hidden md:grid grid-cols-[1fr,140px,180px,110px,120px,110px] px-4 py-2.5 bg-white/[0.06] text-[11px] uppercase tracking-wide text-white/50 font-semibold sticky top-0 backdrop-blur">
        <div>Produto</div>
        <div>Categoria</div>
        <div>Estoque</div>
        <div>Alerta ≤</div>
        <div className="text-right">Valor</div>
        <div className="text-right">Ações</div>
      </div>
      {tracked.length === 0 && (
        <div className="p-8 text-center text-sm text-white/50">
          Nenhum produto rastreando estoque. Marque um produto com estoque no cadastro pra começar.
        </div>
      )}
      {tracked.map((p, idx) => {
        const s = statusFor(p.stock ?? 0, p.low_stock_threshold);
        return (
          <div
            key={p.id}
            className={cn(
              "border-t border-white/5 transition-colors hover:bg-yellow-400/[0.04]",
              idx % 2 === 1 && "md:bg-white/[0.015]",
            )}
          >
            {/* MOBILE CARD */}
            <div className="md:hidden p-3 space-y-2">
              <div className="flex gap-3">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white/10 grid place-items-center shrink-0">
                    <Package className="w-6 h-6 text-white/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] text-white/50 truncate">{p.category}</div>
                    </div>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-medium", s.className)}>{s.label}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-white tabular-nums">{p.stock ?? 0}</span>
                    <span className="text-[11px] text-white/50">un no estoque</span>
                  </div>
                </div>
              </div>
              <StockBar stock={p.stock ?? 0} threshold={p.low_stock_threshold} tone={s.tone} />
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                  Alerta ≤
                  <input
                    type="number"
                    min={0}
                    defaultValue={p.low_stock_threshold}
                    onBlur={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v !== p.low_stock_threshold) onUpdateThreshold(p.id, v);
                    }}
                    className="w-14 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs tabular-nums"
                  />
                </label>
                <button
                  onClick={() => onOpenMovement(p)}
                  className="px-3 py-1.5 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-semibold hover:bg-yellow-400/30 shrink-0"
                >
                  + Movimento
                </button>
              </div>
            </div>


            {/* DESKTOP ROW */}
            <div className="hidden md:grid md:grid-cols-[1fr,140px,180px,110px,120px,110px] items-center px-4 py-3 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/10 grid place-items-center shrink-0">
                    <Package className="w-5 h-5 text-white/40" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[10px] text-white/40 truncate">{fmtBRL(p.cost_price ?? 0)} · custo</div>
                </div>
              </div>
              <div className="text-xs text-white/60 truncate">{p.category}</div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">{p.stock ?? 0}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", s.className)}>{s.label}</span>
                </div>
                <StockBar stock={p.stock ?? 0} threshold={p.low_stock_threshold} tone={s.tone} />
              </div>
              <div>
                <input
                  type="number"
                  min={0}
                  defaultValue={p.low_stock_threshold}
                  onBlur={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    if (v !== p.low_stock_threshold) onUpdateThreshold(p.id, v);
                  }}
                  className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs tabular-nums focus:outline-none focus:border-yellow-400/50"
                />
              </div>
              <div className="text-xs text-white/70 tabular-nums text-right">{fmtBRL((p.stock ?? 0) * (p.cost_price ?? 0))}</div>
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => onOpenMovement(p)}
                  className="px-2.5 py-1.5 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-semibold hover:bg-yellow-400/30"
                >
                  Movimento
                </button>
              </div>
            </div>

          </div>
        );
      })}

      {untracked.length > 0 && (
        <div className="border-t border-white/5 px-4 py-2 text-[11px] text-white/40">
          {untracked.length} produto(s) sem rastreamento de estoque. Ative em Produtos → editar → estoque.
        </div>
      )}
    </div>
  );
}

function IngredientsTable({
  ingredients,
  onEdit,
  onDelete,
  onOpenMovement,
}: {
  ingredients: Ingredient[];
  onEdit: (i: Ingredient) => void;
  onDelete: (id: string) => void;
  onOpenMovement: (i: Ingredient) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="hidden md:grid grid-cols-[1.5fr,1fr,200px,110px,110px,130px,130px] px-4 py-2.5 bg-white/[0.06] text-[11px] uppercase tracking-wide text-white/50 font-semibold sticky top-0 backdrop-blur">
        <div>Insumo</div>
        <div>Fornecedor</div>
        <div>Estoque</div>
        <div>Alerta</div>
        <div className="text-right">Custo</div>
        <div className="text-right">Valor total</div>
        <div className="text-right">Ações</div>
      </div>
      {ingredients.length === 0 && (
        <div className="p-8 text-center text-sm text-white/50">
          Nenhum insumo cadastrado. Clique em <span className="font-semibold text-yellow-300">Novo insumo</span> pra começar.
        </div>
      )}
      {ingredients.map((i, idx) => {
        const s = statusFor(i.stock, i.low_stock_threshold);
        return (
          <div
            key={i.id}
            className={cn(
              "border-t border-white/5 transition-colors hover:bg-yellow-400/[0.04]",
              idx % 2 === 1 && "md:bg-white/[0.015]",
              !i.active && "opacity-60",
            )}
          >
            {/* MOBILE CARD */}
            <div className="md:hidden p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {i.name}
                    {!i.active && <span className="text-[9px] px-1 rounded bg-white/10 text-white/50">inativo</span>}
                  </div>
                  <div className="text-[11px] text-white/50 truncate">
                    {i.category ? i.category + " · " : ""}{i.unit}
                    {i.sku ? " · SKU " + i.sku : ""}
                  </div>
                </div>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-medium", s.className)}>{s.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums">{fmtQty(i.stock, i.unit)}</span>
                <span className="text-[11px] text-white/40">/ alerta {fmtQty(i.low_stock_threshold, i.unit)}</span>
              </div>
              <StockBar stock={i.stock} threshold={i.low_stock_threshold} tone={s.tone} />
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
                  <div className="text-white/40">Custo unitário</div>
                  <div className="text-sm font-semibold text-white/90 tabular-nums truncate">{i.cost_per_unit ? fmtBRL(i.cost_per_unit) : "—"}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
                  <div className="text-white/40">Valor total</div>
                  <div className="text-sm font-semibold text-emerald-300 tabular-nums truncate">{fmtBRL(i.stock * (i.cost_per_unit ?? 0))}</div>
                </div>
              </div>
              {i.supplier && (
                <div className="flex items-center gap-2 text-[11px] text-white/60 rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
                  <Truck className="w-3.5 h-3.5 shrink-0 text-white/40" />
                  <span className="truncate">{i.supplier}</span>
                  {i.supplier_phone && (
                    <a href={`tel:${i.supplier_phone}`} className="ml-auto flex items-center gap-1 text-yellow-300 shrink-0 font-medium">
                      <Phone className="w-3 h-3" /> {i.supplier_phone}
                    </a>
                  )}
                </div>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={() => onOpenMovement(i)}
                  className="flex-1 px-3 py-2 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-semibold hover:bg-yellow-400/30"
                >
                  + Movimento
                </button>
                <button
                  onClick={() => onEdit(i)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                  aria-label="Editar"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(i.id)}
                  className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* DESKTOP ROW */}
            <div className="hidden md:grid md:grid-cols-[1.5fr,1fr,200px,110px,110px,130px,130px] items-center px-4 py-3 gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {i.name}
                  {!i.active && <span className="text-[9px] px-1 rounded bg-white/10 text-white/50">inativo</span>}
                </div>
                <div className="text-[11px] text-white/50 truncate">
                  {i.category ? i.category + " · " : ""}{i.unit}
                  {i.sku ? " · SKU " + i.sku : ""}
                </div>
              </div>
              <div className="text-xs text-white/60 truncate min-w-0">
                {i.supplier ? (
                  <>
                    <div className="flex items-center gap-1 truncate"><Truck className="w-3 h-3 shrink-0" /> <span className="truncate">{i.supplier}</span></div>
                    {i.supplier_phone && (
                      <a href={`tel:${i.supplier_phone}`} className="flex items-center gap-1 text-white/40 hover:text-yellow-300 mt-0.5 tabular-nums">
                        <Phone className="w-3 h-3" /> {i.supplier_phone}
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">{fmtQty(i.stock, i.unit)}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", s.className)}>{s.label}</span>
                </div>
                <StockBar stock={i.stock} threshold={i.low_stock_threshold} tone={s.tone} />
              </div>
              <div className="text-xs text-white/60 tabular-nums">{fmtQty(i.low_stock_threshold, i.unit)}</div>
              <div className="text-xs text-white/60 tabular-nums text-right">{i.cost_per_unit ? fmtBRL(i.cost_per_unit) : "—"}</div>
              <div className="text-xs text-emerald-300/90 tabular-nums text-right font-medium">{fmtBRL(i.stock * (i.cost_per_unit ?? 0))}</div>
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => onOpenMovement(i)}
                  className="px-2.5 py-1.5 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-semibold hover:bg-yellow-400/30"
                >
                  Movimento
                </button>
                <button
                  onClick={() => onEdit(i)}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                  aria-label="Editar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(i.id)}
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

    </div>
  );
}


function MovementsTable({
  movements,
  productMap,
  ingMap,
}: {
  movements: Movement[];
  productMap: Map<string, string>;
  ingMap: Map<string, { name: string; unit: string }>;
}) {
  if (movements.length === 0) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center text-sm text-white/50">
        Sem movimentações registradas ainda.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="hidden md:grid grid-cols-[140px,120px,1fr,120px,120px,1fr] px-4 py-2.5 bg-white/[0.06] text-[11px] uppercase tracking-wide text-white/50 font-semibold sticky top-0 backdrop-blur">
        <div>Quando</div>
        <div>Tipo</div>
        <div>Item</div>
        <div className="text-right">Qtd</div>
        <div className="text-right">Custo</div>
        <div>Motivo</div>
      </div>
      {movements.map((m) => {
        const info = MOVE_LABELS[m.movement_type];
        const name =
          m.item_type === "product"
            ? productMap.get(m.product_id ?? "") ?? "Produto removido"
            : ingMap.get(m.ingredient_id ?? "")?.name ?? "Insumo removido";
        const unit = m.item_type === "ingredient" ? ingMap.get(m.ingredient_id ?? "")?.unit : undefined;
        const sign = m.movement_type === "ajuste" ? (m.qty > 0 ? "+" : "") : m.movement_type === "entrada" ? "+" : "−";
        const qtyClass =
          m.movement_type === "entrada"
            ? "text-emerald-300"
            : m.movement_type === "perda" || m.movement_type === "saida" || m.movement_type === "venda"
              ? "text-orange-300"
              : "text-white";
        return (
          <div
            key={m.id}
            className={cn(
              "border-t border-white/5 text-sm transition-colors hover:bg-yellow-400/[0.04]",
              idx % 2 === 1 && "md:bg-white/[0.015]",
            )}
          >
            {/* MOBILE CARD */}
            <div className="md:hidden p-3 flex items-start gap-3">
              <div className={cn("shrink-0 w-9 h-9 rounded-lg grid place-items-center border", info.color)}>
                <info.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold truncate">{name}</div>
                  <div className={cn("text-sm font-bold shrink-0 tabular-nums", qtyClass)}>
                    {sign}{fmtQty(Math.abs(m.qty), unit)}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/50 mt-0.5 flex-wrap">
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]", info.color)}>
                    <info.icon className="w-2.5 h-2.5" /> {info.label}
                  </span>
                  <span>{fmtDateTime(m.created_at)}</span>
                  {m.unit_cost ? (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="tabular-nums">{fmtBRL(m.unit_cost)}</span>
                    </>
                  ) : null}
                </div>
                {m.reason && <div className="text-[11px] text-white/60 mt-1 line-clamp-2">{m.reason}</div>}
              </div>
            </div>

            {/* DESKTOP ROW */}
            <div className="hidden md:grid md:grid-cols-[140px,120px,1fr,120px,120px,1fr] items-center px-4 py-2.5 gap-2">
              <div className="text-xs text-white/60 tabular-nums">{fmtDateTime(m.created_at)}</div>
              <div>
                <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-medium", info.color)}>
                  <info.icon className="w-3 h-3" /> {info.label}
                </span>
              </div>
              <div className="truncate text-sm">{name}</div>
              <div className={cn("text-sm font-bold tabular-nums text-right", qtyClass)}>
                {sign}{fmtQty(Math.abs(m.qty), unit)}
              </div>
              <div className="text-xs text-white/60 tabular-nums text-right">{m.unit_cost ? fmtBRL(m.unit_cost) : "—"}</div>
              <div className="text-xs text-white/50 truncate">{m.reason || "—"}</div>
            </div>
          </div>
        );
      })}


    </div>
  );
}

function IngredientDialog({
  ingredient,
  onClose,
  onSaved,
}: {
  ingredient: Ingredient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: ingredient?.name ?? "",
    category: ingredient?.category ?? "",
    unit: ingredient?.unit ?? "un",
    stock: ingredient?.stock ?? 0,
    low_stock_threshold: ingredient?.low_stock_threshold ?? 0,
    cost_per_unit: ingredient?.cost_per_unit ?? "",
    supplier: ingredient?.supplier ?? "",
    supplier_phone: ingredient?.supplier_phone ?? "",
    sku: ingredient?.sku ?? "",
    notes: ingredient?.notes ?? "",
    active: ingredient?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.name.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const payload = {
      name: f.name.trim(),
      category: f.category.trim() || null,
      unit: f.unit,
      stock: Number(f.stock) || 0,
      low_stock_threshold: Number(f.low_stock_threshold) || 0,
      cost_per_unit: f.cost_per_unit === "" ? null : Number(f.cost_per_unit),
      supplier: f.supplier.trim() || null,
      supplier_phone: f.supplier_phone.trim() || null,
      sku: f.sku.trim() || null,
      notes: f.notes.trim() || null,
      active: f.active,
    };
    const q = ingredient
      ? supabase.from("inventory_items").update(payload).eq("id", ingredient.id)
      : supabase.from("inventory_items").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(ingredient ? "Insumo atualizado" : "Insumo criado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-[#150829] border border-white/10 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{ingredient ? "Editar insumo" : "Novo insumo"}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Nome *">
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              placeholder="Ex: Morango"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <input
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                placeholder="Frutas / Embalagem…"
              />
            </Field>
            <Field label="Unidade">
              <select
                value={f.unit}
                onChange={(e) => setF({ ...f, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Estoque atual">
              <input
                type="number"
                step="any"
                value={f.stock}
                onChange={(e) => setF({ ...f, stock: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </Field>
            <Field label="Alerta abaixo de">
              <input
                type="number"
                step="any"
                value={f.low_stock_threshold}
                onChange={(e) => setF({ ...f, low_stock_threshold: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </Field>
            <Field label="Custo unitário (R$)">
              <input
                type="number"
                step="0.01"
                value={f.cost_per_unit}
                onChange={(e) => setF({ ...f, cost_per_unit: e.target.value === "" ? "" : Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                placeholder="0,00"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fornecedor">
              <input
                value={f.supplier}
                onChange={(e) => setF({ ...f, supplier: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </Field>
            <Field label="Telefone">
              <input
                value={f.supplier_phone}
                onChange={(e) => setF({ ...f, supplier_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </Field>
          </div>
          <Field label="SKU">
            <input
              value={f.sku}
              onChange={(e) => setF({ ...f, sku: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
            />
          </Field>
          <Field label="Observações">
            <textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm resize-none"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Insumo ativo
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementDialog({
  target,
  onClose,
  onSaved,
}: {
  target: { item_type: "product" | "ingredient"; id: string; name: string; unit?: string; currentStock: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<Movement["movement_type"]>("entrada");
  const [qty, setQty] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const parsedQty = Number(qty) || 0;
  const preview = useMemo(() => {
    let delta = 0;
    if (type === "entrada") delta = parsedQty;
    else if (type === "saida" || type === "perda") delta = -parsedQty;
    else if (type === "ajuste") delta = parsedQty; // ajuste aceita negativo
    return target.currentStock + delta;
  }, [type, parsedQty, target.currentStock]);

  async function save() {
    if (!qty || parsedQty === 0) return toast.error("Informe uma quantidade");
    if (type !== "ajuste" && parsedQty < 0) return toast.error("Quantidade deve ser positiva");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      item_type: target.item_type,
      product_id: target.item_type === "product" ? target.id : null,
      ingredient_id: target.item_type === "ingredient" ? target.id : null,
      movement_type: type,
      qty: parsedQty,
      unit_cost: unitCost === "" ? null : Number(unitCost),
      reason: reason.trim() || null,
      user_id: userData.user?.id ?? null,
    };
    const { error } = await supabase.from("inventory_movements").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Movimento registrado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[#150829] border border-white/10 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Novo movimento</h3>
            <p className="text-xs text-white/50">
              {target.name} · atual: {fmtQty(target.currentStock, target.unit)}
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {(Object.keys(MOVE_LABELS) as Movement["movement_type"][])
            .filter((t) => t !== "venda") // venda vem só automática
            .map((t) => {
              const info = MOVE_LABELS[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 justify-center",
                    active ? info.color + " ring-2 ring-yellow-400/40" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10",
                  )}
                >
                  <info.icon className="w-4 h-4" /> {info.label}
                </button>
              );
            })}
        </div>

        <div className="space-y-3">
          <Field label={`Quantidade ${type === "ajuste" ? "(use negativo para reduzir)" : ""}`}>
            <input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              placeholder="0"
              autoFocus
            />
          </Field>
          {type === "entrada" && (
            <Field label="Custo unitário (R$)">
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                placeholder="0,00"
              />
            </Field>
          )}
          <Field label="Motivo / Nota">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              placeholder={
                type === "perda" ? "Ex: Vencimento, quebra…" : type === "entrada" ? "NF, fornecedor…" : "Contexto"
              }
            />
          </Field>

          <div
            className={cn(
              "rounded-lg p-3 border flex items-center justify-between text-sm",
              preview < 0
                ? "bg-red-500/10 border-red-500/40 text-red-300"
                : preview <= 0
                  ? "bg-orange-500/10 border-orange-500/40 text-orange-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
            )}
          >
            <span className="text-white/60">Estoque após</span>
            <span className="font-bold">{fmtQty(preview, target.unit)}</span>
          </div>
          {preview < 0 && (
            <div className="text-xs text-red-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Estoque ficará negativo. Confira a quantidade.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? "Salvando…" : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Registrar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/50 font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
