import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import {
  LogOut,
  Package,
  Tag,
  Star,
  Settings,
  Sparkles,
  Plus,
  Trash2,
  Save,
  Loader2,
  Upload,
  Home,
  Search,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  X,
  ImagePlus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  useIsAdmin,
  useAllProducts,
  useCategories,
  useSiteSettings,
  useUpsertProduct,
  useDeleteProduct,
  useToggleHero,
  useToggleProductActive,
  useReorderProducts,
  useReorderCategories,
  useUpsertCategory,
  useDeleteCategory,
  useUpdateSettings,
  seedInitialMenu,
  useInvalidateMenu,
  uploadProductImage,
  type SiteSettings,
  type ProductInput,
} from "@/lib/menu-data";
import type { Product, Category } from "@/data/menu";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "products" | "categories" | "highlights" | "settings";

function AdminPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const [tab, setTab] = useState<Tab>("products");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] px-4 text-white">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-black">Acesso negado</h1>
          <p className="mt-2 text-sm text-white/60">
            Sua conta não tem permissão de administrador.
          </p>
          <button
            onClick={signOut}
            className="mt-6 rounded-2xl bg-neon-pink px-4 py-2 text-sm font-bold text-white"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "products", label: "Produtos", icon: Package },
    { id: "categories", label: "Categorias", icon: Tag },
    { id: "highlights", label: "Destaques", icon: Star },
    { id: "settings", label: "Loja", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.08_300)] text-white">
      <Toaster position="top-center" theme="dark" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[oklch(0.10_0.08_300)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-neon-yellow" />
            <h1
              className="font-display text-xl font-black uppercase"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Painel <span className="text-neon-yellow">Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white sm:inline-flex"
            >
              <Home className="h-3.5 w-3.5" /> Ver site
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                tab === t.id
                  ? "bg-neon-pink text-white glow-pink"
                  : "border border-white/10 text-white/70 hover:text-white",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "products" && <ProductsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "highlights" && <HighlightsTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

/* ============================= Seed helper ============================= */
function SeedButton() {
  const [loading, setLoading] = useState(false);
  const invalidate = useInvalidateMenu();
  const run = async () => {
    if (!confirm("Isso vai importar (ou atualizar) os produtos, categorias e configurações padrão. Continuar?")) return;
    setLoading(true);
    try {
      const r = await seedInitialMenu();
      toast.success(`Importado: ${r.products} produtos, ${r.categories} categorias.`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      Importar dados iniciais
    </button>
  );
}

/* =============================== Products =============================== */
function ProductsTab() {
  const { data: products = [] } = useAllProducts();
  const { data: categories = [] } = useCategories();
  const reorder = useReorderProducts();
  const toggleActive = useToggleProductActive();
  const upsert = useUpsertProduct();
  const [editing, setEditing] = useState<Product | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<Product[] | null>(null);

  const catList = categories.filter((c) => c.id !== "all");

  // Live list (local drag state wins until saved)
  const source = localOrder ?? products;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return source.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [source, filter, search]);

  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const list = [...(localOrder ?? products)];
    const from = list.findIndex((p) => p.id === dragId);
    const to = list.findIndex((p) => p.id === overId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setLocalOrder(list);
  };
  const onDragEnd = async () => {
    setDragId(null);
    if (!localOrder) return;
    const items = localOrder.map((p, i) => ({ id: p.id, sort_order: i }));
    try {
      await reorder.mutateAsync(items);
      toast.success("Ordem salva");
    } catch {
      toast.error("Falha ao salvar ordem");
    } finally {
      setLocalOrder(null);
    }
  };

  const duplicate = async (p: Product) => {
    const newId = `${p.id}-copia-${Date.now().toString(36)}`;
    await upsert.mutateAsync({
      id: newId,
      name: `${p.name} (cópia)`,
      category: p.category,
      image_url: p.image || null,
      description: p.description,
      ingredients: p.ingredients ?? [],
      base_price: p.basePrice,
      sizes: p.sizes ?? [],
      flavors: p.flavors ?? null,
      extras: p.extras ?? null,
      removable: p.removable ?? null,
      badge: p.badge ?? null,
      hero: false,
      active: true,
      sort_order: products.length,
    });
    toast.success("Produto duplicado");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-black">Produtos</h2>
          <p className="text-xs text-white/50">
            {visible.length} de {products.length} · arraste para reordenar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeedButton />
          <button
            onClick={() =>
              setEditing({
                id: "",
                name: "",
                category: catList[0]?.id ?? "acai",
                image: "",
                description: "",
                ingredients: [],
                basePrice: 0,
                sizes: [{ id: "u", label: "Único", priceDelta: 0 }],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white glow-pink"
          >
            <Plus className="h-3.5 w-3.5" /> Novo produto
          </button>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className={cn(inputCls, "pl-9")}
            placeholder="Buscar produto por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            Tudo <span className="opacity-60">({products.length})</span>
          </FilterChip>
          {catList.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            return (
              <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
                <span>{c.emoji}</span> {c.name} <span className="opacity-60">({count})</span>
              </FilterChip>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        {visible.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => onDragStart(p.id)}
            onDragOver={(e) => onDragOver(e, p.id)}
            onDragEnd={onDragEnd}
            className={cn(
              "group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 transition",
              dragId === p.id && "opacity-40",
              !p.active && "opacity-60",
            )}
          >
            <div className="grid h-8 w-6 shrink-0 cursor-grab place-items-center text-white/30 hover:text-white/70 active:cursor-grabbing">
              <GripVertical className="h-4 w-4" />
            </div>
            <button
              onClick={() => setEditing(p)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30">
                {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold">{p.name}</span>
                  {p.hero && <Star className="h-3.5 w-3.5 shrink-0 fill-neon-yellow text-neon-yellow" />}
                </div>
                <div className="text-[11px] text-white/50">
                  {p.category} · R$ {p.basePrice.toFixed(2)}
                </div>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <IconBtn
                title={p.active ? "Ocultar do cardápio" : "Mostrar no cardápio"}
                onClick={() => toggleActive.mutate({ id: p.id, active: !p.active })}
              >
                {p.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-white/40" />}
              </IconBtn>
              <IconBtn title="Duplicar" onClick={() => duplicate(p)}>
                <Copy className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
            Nenhum produto encontrado.
          </div>
        )}
      </div>

      {editing && (
        <ProductEditor
          initial={editing}
          categories={catList}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-neon-cyan text-[oklch(0.18_0.11_305)]"
          : "border border-white/10 text-white/70 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

type EditorTab = "basic" | "sizes" | "extras" | "advanced";

function ProductEditor({
  initial,
  categories,
  onClose,
}: {
  initial: Product;
  categories: Category[];
  onClose: () => void;
}) {
  const upsert = useUpsertProduct();
  const del = useDeleteProduct();
  const isNew = !initial.id;
  const [p, setP] = useState<Product>(initial);
  const [imageBusy, setImageBusy] = useState(false);
  const [tab, setTab] = useState<EditorTab>("basic");
  const [dirty, setDirty] = useState(false);

  const setField = <K extends keyof Product>(k: K, v: Product[K]) => {
    setP((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const minPrice = useMemo(() => {
    const deltas = (p.sizes ?? []).map((s) => s.priceDelta);
    const min = deltas.length ? Math.min(...deltas) : 0;
    return (Number(p.basePrice) || 0) + min;
  }, [p.basePrice, p.sizes]);

  const save = async () => {
    if (!p.name.trim()) return toast.error("Nome obrigatório");
    const id = (p.id || slugify(p.name)).trim();
    if (!id) return toast.error("ID inválido");
    const payload: ProductInput = {
      id,
      name: p.name.trim(),
      category: p.category,
      image_url: p.image || null,
      description: p.description || "",
      ingredients: p.ingredients ?? [],
      base_price: Number(p.basePrice) || 0,
      sizes: p.sizes ?? [],
      flavors: p.flavors && p.flavors.length ? p.flavors : null,
      extras: p.extras && p.extras.length ? p.extras : null,
      removable: p.removable && p.removable.length ? p.removable : null,
      badge: p.badge ?? null,
      hero: !!p.hero,
      ...(isNew ? { active: true, sort_order: 999999 } : {}),
    };
    await upsert.mutateAsync(payload);
    toast.success(isNew ? "Produto criado!" : "Alterações salvas!");
    setDirty(false);
    onClose();
  };

  const remove = async () => {
    if (!confirm(`Remover "${p.name}"? Essa ação não pode ser desfeita.`)) return;
    await del.mutateAsync(p.id);
    toast.success("Produto removido");
    onClose();
  };

  const onImage = async (file: File) => {
    setImageBusy(true);
    try {
      const url = await uploadProductImage(file);
      setField("image", url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao subir imagem");
    } finally {
      setImageBusy(false);
    }
  };

  const requestClose = () => {
    if (dirty && !confirm("Você tem alterações não salvas. Descartar?")) return;
    onClose();
  };

  const tabs: { id: EditorTab; label: string }[] = [
    { id: "basic", label: "Básico" },
    { id: "sizes", label: "Tamanhos & Sabores" },
    { id: "extras", label: "Complementos" },
    { id: "advanced", label: "Extras" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[oklch(0.14_0.09_305)] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-black">
              {isNew ? "Novo produto" : p.name || "Editar produto"}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
              <span>a partir de <b className="text-white/80">R$ {minPrice.toFixed(2)}</b></span>
              {dirty && <span className="rounded-full bg-neon-yellow/20 px-2 py-0.5 text-neon-yellow">não salvo</span>}
            </div>
          </div>
          <button onClick={requestClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                tab === t.id
                  ? "bg-neon-pink text-white glow-pink"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "basic" && (
            <div className="space-y-4">
              {/* Image dropzone */}
              <ImageDropzone
                url={p.image}
                busy={imageBusy}
                onFile={onImage}
                onClear={() => setField("image", "")}
              />
              <input
                className={cn(inputCls, "text-xs")}
                placeholder="ou cole uma URL da imagem"
                value={p.image}
                onChange={(e) => setField("image", e.target.value)}
              />

              <Field label="Nome do produto">
                <input
                  className={inputCls}
                  placeholder="Ex.: Açaí Tradicional"
                  value={p.name}
                  onChange={(e) => setField("name", e.target.value)}
                  maxLength={80}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <CategoryPicker
                    categories={categories}
                    value={p.category}
                    onChange={(id) => setField("category", id)}
                  />
                </Field>
                <Field label="Preço base (R$)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputCls}
                    value={p.basePrice}
                    onChange={(e) => setField("basePrice", Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field label="Descrição">
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder="Uma frase curta que aparece no card e no modal."
                  value={p.description}
                  onChange={(e) => setField("description", e.target.value)}
                  maxLength={200}
                />
                <div className="mt-1 text-right text-[10px] text-white/40">
                  {(p.description || "").length}/200
                </div>
              </Field>

              <Field label="Ingredientes principais">
                <ChipInput
                  values={p.ingredients ?? []}
                  onChange={(v) => setField("ingredients", v)}
                  placeholder="Digite e pressione Enter (ex.: Leite condensado)"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Selo">
                  <select
                    className={inputCls}
                    value={p.badge ?? ""}
                    onChange={(e) => setField("badge", (e.target.value || undefined) as Product["badge"])}
                  >
                    <option value="">Nenhum</option>
                    <option value="Premium">⭐ Premium</option>
                    <option value="Novidade">✨ Novidade</option>
                    <option value="Favorito">❤️ Favorito</option>
                  </select>
                </Field>
                <Field label="Destaque na home">
                  <Toggle
                    checked={!!p.hero}
                    onChange={(v) => setField("hero", v)}
                    label={p.hero ? "Aparece nos destaques" : "Não aparece"}
                  />
                </Field>
              </div>
            </div>
          )}

          {tab === "sizes" && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">Tamanhos / porções</div>
                    <div className="text-[11px] text-white/50">
                      O preço final é <b>preço base + acréscimo do tamanho</b>.
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setField("sizes", [
                        ...(p.sizes ?? []),
                        { id: `s${Date.now()}`, label: "Novo tamanho", priceDelta: 0 },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-3 py-1.5 text-xs font-bold text-neon-cyan hover:bg-neon-cyan/30"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>
                <RowList
                  items={p.sizes ?? []}
                  onChange={(v) => setField("sizes", v)}
                  render={(row, upd) => (
                    <>
                      <input
                        className={cn(inputCls, "flex-1")}
                        placeholder="Ex.: 400ml"
                        value={row.label}
                        onChange={(e) => upd({ ...row, label: e.target.value })}
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-white/50">+R$</span>
                        <input
                          type="number"
                          step="0.01"
                          className={cn(inputCls, "w-20")}
                          value={row.priceDelta}
                          onChange={(e) => upd({ ...row, priceDelta: Number(e.target.value) })}
                        />
                      </div>
                    </>
                  )}
                  emptyLabel="Nenhum tamanho — o cliente verá apenas o preço base."
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-bold">Sabores disponíveis</div>
                <ChipInput
                  values={p.flavors ?? []}
                  onChange={(v) => setField("flavors", v)}
                  placeholder="Ex.: Morango, Chocolate, Baunilha..."
                />
                <div className="mt-1 text-[11px] text-white/40">
                  Deixe vazio se o produto não tem escolha de sabor.
                </div>
              </div>
            </div>
          )}

          {tab === "extras" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">Complementos pagos</div>
                  <div className="text-[11px] text-white/50">
                    Adicionais que o cliente pode escolher, com preço unitário.
                  </div>
                </div>
                <button
                  onClick={() =>
                    setField("extras", [
                      ...(p.extras ?? []),
                      { id: `e${Date.now()}`, label: "Novo complemento", price: 0 },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-3 py-1.5 text-xs font-bold text-neon-cyan hover:bg-neon-cyan/30"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              <RowList
                items={p.extras ?? []}
                onChange={(v) => setField("extras", v)}
                render={(row, upd) => (
                  <>
                    <input
                      className={cn(inputCls, "flex-1")}
                      placeholder="Ex.: Leite Ninho"
                      value={row.label}
                      onChange={(e) => upd({ ...row, label: e.target.value })}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-white/50">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        className={cn(inputCls, "w-20")}
                        value={row.price}
                        onChange={(e) => upd({ ...row, price: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}
                emptyLabel="Nenhum complemento cadastrado."
              />
            </div>
          )}

          {tab === "advanced" && (
            <div className="space-y-4">
              <Field label="Ingredientes removíveis pelo cliente">
                <ChipInput
                  values={p.removable ?? []}
                  onChange={(v) => setField("removable", v)}
                  placeholder="Ex.: Granola, Leite condensado..."
                />
                <div className="mt-1 text-[11px] text-white/40">
                  O cliente pode desmarcar esses itens ao montar o produto.
                </div>
              </Field>

              <Field label="ID técnico (slug)">
                <input
                  className={cn(inputCls, "font-mono text-xs")}
                  value={p.id}
                  disabled={!isNew}
                  onChange={(e) => setField("id", e.target.value)}
                  placeholder={isNew ? "Gerado a partir do nome" : ""}
                />
                <div className="mt-1 text-[11px] text-white/40">
                  {isNew ? "Deixe vazio para gerar automaticamente." : "Não pode ser alterado após criado."}
                </div>
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3">
          {!isNew && (
            <button
              onClick={remove}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              title="Excluir produto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={requestClose}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={upsert.isPending || !dirty}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink disabled:opacity-40"
          >
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Criar produto" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================= Editor helpers ============================= */

function ImageDropzone({
  url,
  busy,
  onFile,
  onClear,
}: {
  url: string;
  busy: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "relative flex aspect-[16/10] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition",
        over ? "border-neon-cyan bg-neon-cyan/10" : "border-white/15 bg-white/5 hover:bg-white/10",
      )}
    >
      {url ? (
        <>
          <img src={url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3">
            <span className="text-[11px] text-white/70">Clique ou solte uma nova imagem</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClear();
              }}
              className="rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/80 hover:bg-black/80"
            >
              Remover
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-white/60">
          <ImagePlus className="h-8 w-8" />
          <div className="text-sm font-semibold">Adicionar foto do produto</div>
          <div className="text-[11px]">clique ou arraste um arquivo aqui</div>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (values.includes(v)) {
      setText("");
      return;
    }
    onChange([...values, v]);
    setText("");
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-neon-cyan/15 px-2.5 py-1 text-xs text-neon-cyan"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-neon-cyan/30"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="w-full bg-transparent px-1 py-1 text-sm text-white placeholder:text-white/40 outline-none"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function RowList<T extends { id: string }>({
  items,
  onChange,
  render,
  emptyLabel,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  render: (row: T, upd: (next: T) => void) => React.ReactNode;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/50">
        {emptyLabel}
      </div>
    );
  }
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {items.map((row, i) => (
        <div key={row.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="flex flex-col">
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="grid h-4 w-5 place-items-center text-white/40 hover:text-white disabled:opacity-20"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              className="grid h-4 w-5 place-items-center text-white/40 hover:text-white disabled:opacity-20"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
          {render(row, (next) => onChange(items.map((x, idx) => (idx === i ? next : x))))}
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-xs transition",
        checked
          ? "border-neon-yellow/50 bg-neon-yellow/10 text-neon-yellow"
          : "border-white/10 bg-white/5 text-white/60",
      )}
    >
      <span
        className={cn(
          "grid h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition",
          checked ? "bg-neon-yellow/40 justify-items-end" : "bg-white/10 justify-items-start",
        )}
      >
        <span className={cn("h-4 w-4 rounded-full", checked ? "bg-neon-yellow" : "bg-white/60")} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const list = categories.filter((c) => c.id !== "all");
  const current = list.find((c) => c.id === value) ?? list[0];

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(inputCls, "flex items-center justify-between text-left")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none">{current?.emoji ?? "✨"}</span>
          <span className="truncate">{current?.name ?? "Selecionar..."}</span>
        </span>
        <span className="ml-2 text-white/40">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[oklch(0.16_0.09_305)] p-1 shadow-2xl">
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                c.id === value
                  ? "bg-neon-pink/20 text-white"
                  : "text-white/80 hover:bg-white/10",
              )}
            >
              <span className="text-base leading-none">{c.emoji}</span>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}




/* ============================= Categories ============================= */
function CategoriesTab() {
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();
  const reorder = useReorderCategories();
  const base = categories.filter((c) => c.id !== "all");
  const [localOrder, setLocalOrder] = useState<Category[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const list = localOrder ?? base;
  const [draft, setDraft] = useState<{ id: string; name: string; emoji: string; image_url: string }>({
    id: "",
    name: "",
    emoji: "✨",
    image_url: "",
  });

  const add = async () => {
    const id = (draft.id || slugify(draft.name)).trim();
    if (!id || !draft.name.trim()) return toast.error("Preencha nome");
    await upsert.mutateAsync({
      id,
      name: draft.name.trim(),
      emoji: draft.emoji || "✨",
      image_url: draft.image_url || null,
      sort_order: list.length,
      active: true,
    });
    toast.success("Categoria criada");
    setDraft({ id: "", name: "", emoji: "✨", image_url: "" });
  };

  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const arr = [...list];
    const from = arr.findIndex((c) => c.id === dragId);
    const to = arr.findIndex((c) => c.id === overId);
    if (from < 0 || to < 0) return;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setLocalOrder(arr);
  };
  const onDragEnd = async () => {
    setDragId(null);
    if (!localOrder) return;
    try {
      await reorder.mutateAsync(localOrder.map((c, i) => ({ id: c.id, sort_order: i })));
      toast.success("Ordem salva");
    } catch {
      toast.error("Falha ao salvar ordem");
    } finally {
      setLocalOrder(null);
    }
  };

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-black">Categorias</h2>
      <p className="mb-4 text-xs text-white/50">Arraste para reordenar como aparecem no cardápio.</p>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-xs font-semibold text-white/70">Nova categoria</div>
        <div className="grid grid-cols-[60px_1fr_auto] gap-2">
          <input
            className={inputCls}
            placeholder="🍇"
            value={draft.emoji}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Nome (ex.: Açaí)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <button onClick={add} className="rounded-xl bg-neon-cyan px-3 text-xs font-bold text-[oklch(0.18_0.11_305)]">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <input
          className={cn(inputCls, "mt-2 text-xs")}
          placeholder="URL da imagem (opcional)"
          value={draft.image_url}
          onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        {list.map((c, i) => (
          <CategoryRow
            key={c.id}
            category={c}
            index={i}
            dragging={dragId === c.id}
            onDragStart={() => setDragId(c.id)}
            onDragOver={(e) => onDragOver(e, c.id)}
            onDragEnd={onDragEnd}
            onDelete={() => del.mutate(c.id)}
            onSave={(u) => upsert.mutate(u)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  index,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDelete,
  onSave,
}: {
  category: Category;
  index: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onSave: (u: { id: string; name: string; emoji: string; image_url: string | null; sort_order: number; active: boolean }) => void;
}) {
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [image, setImage] = useState(category.image);
  const dirty = name !== category.name || emoji !== category.emoji || image !== category.image;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 transition",
        dragging && "opacity-40",
      )}
    >
      <div className="grid h-8 w-6 shrink-0 cursor-grab place-items-center text-white/30 hover:text-white/70 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </div>
      <input className={cn(inputCls, "w-14 text-center")} value={emoji} onChange={(e) => setEmoji(e.target.value)} />
      <input className={cn(inputCls, "flex-1")} value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className={cn(inputCls, "hidden w-40 text-xs sm:block")}
        placeholder="URL imagem"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />
      {dirty && (
        <button
          onClick={() =>
            onSave({
              id: category.id,
              name,
              emoji,
              image_url: image || null,
              sort_order: index,
              active: true,
            })
          }
          className="grid h-9 w-9 place-items-center rounded-xl bg-neon-cyan text-[oklch(0.18_0.11_305)]"
        >
          <Save className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={() => {
          if (confirm(`Remover categoria "${category.name}"?`)) onDelete();
        }}
        className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/40 bg-red-500/10 text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ============================= Highlights ============================= */
function HighlightsTab() {
  const { data: products = [] } = useAllProducts();
  const toggle = useToggleHero();
  return (
    <div>
      <h2 className="mb-2 font-display text-2xl font-black">Nossos Destaques</h2>
      <p className="mb-4 text-xs text-white/50">
        Marque os produtos que devem aparecer no carrossel de destaques da home.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((p) => (
          <label
            key={p.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl border p-2 transition",
              p.hero ? "border-neon-yellow/50 bg-neon-yellow/5" : "border-white/10 bg-white/5",
            )}
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30">
              {p.image && <img src={p.image} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{p.name}</div>
              <div className="text-[11px] text-white/50">{p.category}</div>
            </div>
            <input
              type="checkbox"
              checked={!!p.hero}
              onChange={(e) => toggle.mutate({ id: p.id, hero: e.target.checked })}
              className="h-5 w-5 accent-neon-yellow"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/* ============================= Settings ============================= */
function SettingsTab() {
  const { data } = useSiteSettings();
  const update = useUpdateSettings();
  const [s, setS] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (data && !s) setS(data);
  }, [data, s]);

  if (!s) return <Loader2 className="h-6 w-6 animate-spin" />;

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));

  const save = async () => {
    if (!s) return;
    await update.mutateAsync(s);
    toast.success("Configurações salvas");
  };

  return (
    <div className="space-y-3">
      <h2 className="mb-2 font-display text-2xl font-black">Identidade da loja</h2>
      <Field label="Nome da loja">
        <input className={inputCls} value={s.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Slogan">
        <input className={inputCls} value={s.tagline} onChange={(e) => set("tagline", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade">
          <input className={inputCls} value={s.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Horário">
          <input className={inputCls} value={s.hours} onChange={(e) => set("hours", e.target.value)} />
        </Field>
      </div>
      <Field label="Endereço">
        <input className={inputCls} value={s.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="WhatsApp (só números com DDI)">
          <input className={inputCls} value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </Field>
        <Field label="WhatsApp (exibição)">
          <input className={inputCls} value={s.whatsappDisplay} onChange={(e) => set("whatsappDisplay", e.target.value)} />
        </Field>
      </div>
      <Field label="Taxa de entrega (R$)">
        <input
          type="number"
          step="0.01"
          className={inputCls}
          value={s.deliveryFee}
          onChange={(e) => set("deliveryFee", Number(e.target.value))}
        />
      </Field>
      <Field label="URL do Google Maps">
        <input className={inputCls} value={s.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} />
      </Field>
      <Field label="URL do mapa embed">
        <input className={inputCls} value={s.mapEmbed} onChange={(e) => set("mapEmbed", e.target.value)} />
      </Field>
      <Field label="URL do logo">
        <input className={inputCls} value={s.logo} onChange={(e) => set("logo", e.target.value)} />
      </Field>
      <Field label="URL da textura de fundo">
        <input className={inputCls} value={s.texture} onChange={(e) => set("texture", e.target.value)} />
      </Field>

      <button
        onClick={save}
        disabled={update.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink disabled:opacity-60"
      >
        {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar configurações
      </button>
    </div>
  );
}

/* ============================= UI helpers ============================= */
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</div>
      {children}
    </label>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
