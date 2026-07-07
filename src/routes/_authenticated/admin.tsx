import { useEffect, useMemo, useRef, useState } from "react";
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
  Check,
  Info,
  X,

  ImagePlus,
  ArrowUp,
  ArrowDown,
  Instagram,
  Facebook,
  Music2,
  Truck,
  Store,
  MapPin,
  Clock,
  CreditCard,
  Megaphone,
  Palette,
  Phone,
  Globe,
  Link as LinkIcon,
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
  DEFAULT_HOURS,
  type SiteSettings,
  type DayHours,
  type WeekDay,
  type ProductInput,
} from "@/lib/menu-data";
import type { Product, Category } from "@/data/menu";
import { ProductCard } from "@/components/menu/ProductCard";
import { CategoryChip } from "@/components/menu/CategoryStrip";
import { CATEGORY_ICON_LIST, getCategoryIcon } from "@/lib/category-icons";

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
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Sparkles className="h-5 w-5 text-neon-yellow" />
            <h1
              className="font-display text-xl font-black uppercase"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Painel <span className="text-neon-yellow">Admin</span>
            </h1>
          </Link>
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

type EditorTab = "basic" | "photo" | "sizes" | "extras" | "advanced";

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
      image_pos_x: Number(p.imagePosX ?? 0),
      image_pos_y: Number(p.imagePosY ?? 0),
      image_scale: Number(p.imageScale ?? 1.1),
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
    { id: "photo", label: "Foto" },
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
              <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2 text-[11px] text-neon-cyan/90">
                Para reposicionar / dar zoom na foto, abra a aba <b>Foto</b>.
              </div>

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

          {tab === "photo" && (
            <PhotoTab
              product={p}
              onChange={(patch) => {
                setP((prev) => ({ ...prev, ...patch }));
                setDirty(true);
              }}
            />
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

function PhotoTab({
  product,
  onChange,
}: {
  product: Product;
  onChange: (patch: Partial<Product>) => void;
}) {
  const posX = product.imagePosX ?? 0;
  const posY = product.imagePosY ?? 0;
  const scale = product.imageScale ?? 1.1;

  // The site's product card image area is 150px tall; use a matching real-size preview.
  const CARD_W = 220;
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX, posY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Convert px delta to % of the image container (approx CARD_W × 150).
    const dx = ((e.clientX - d.startX) / CARD_W) * 100;
    const dy = ((e.clientY - d.startY) / 150) * 100;
    onChange({
      imagePosX: clamp(d.posX + dx, -80, 80),
      imagePosY: clamp(d.posY + dy, -80, 80),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const reset = () =>
    onChange({ imagePosX: 0, imagePosY: 0, imageScale: 1.1 });

  const nudge = (dx: number, dy: number) =>
    onChange({
      imagePosX: clamp(posX + dx, -80, 80),
      imagePosY: clamp(posY + dy, -80, 80),
    });

  if (!product.image) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/60">
        Adicione uma foto na aba <b className="text-white">Básico</b> primeiro.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Preview real — tamanho do card no site
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div style={{ width: CARD_W }}>
            <ProductCard product={product} onOpen={() => {}} />
          </div>
          <div className="text-[10px] text-white/40">Arraste a foto no card ou use os controles abaixo.</div>
        </div>
      </div>

      {/* Dedicated drag surface — same dimensions as the card image area, for precise handling */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Área de ajuste (arraste)
        </div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl border border-neon-cyan/30 bg-[oklch(0.14_0.09_305)] cursor-grab active:cursor-grabbing"
          style={{ width: CARD_W, height: 150 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.45 0.28 340) 0%, oklch(0.28 0.22 305) 45%, oklch(0.14 0.10 300) 100%)",
            }}
          />
          <img
            src={product.image}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-3 pointer-events-none"
            style={{
              transform: `translate(${posX}%, ${posY}%) scale(${scale})`,
              transformOrigin: "center",
            }}
          />
          {/* Center crosshair */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-full w-px bg-white/10" />
          </div>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-px w-full bg-white/10" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span>Zoom</span>
            <span className="text-white/50">{scale.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={scale}
            onChange={(e) => onChange({ imageScale: Number(e.target.value) })}
            className="w-full accent-neon-cyan"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Horizontal</span>
              <span className="text-white/50">{posX.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={posX}
              onChange={(e) => onChange({ imagePosX: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Vertical</span>
              <span className="text-white/50">{posY.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={posY}
              onChange={(e) => onChange({ imagePosY: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
          </div>
          <div className="flex flex-col items-stretch justify-end gap-1">
            <div className="grid grid-cols-3 gap-1">
              <div />
              <NudgeBtn onClick={() => nudge(0, -3)}>↑</NudgeBtn>
              <div />
              <NudgeBtn onClick={() => nudge(-3, 0)}>←</NudgeBtn>
              <NudgeBtn onClick={reset}>◎</NudgeBtn>
              <NudgeBtn onClick={() => nudge(3, 0)}>→</NudgeBtn>
              <div />
              <NudgeBtn onClick={() => nudge(0, 3)}>↓</NudgeBtn>
              <div />
            </div>
          </div>
        </div>

        <button
          onClick={reset}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
        >
          Resetar posição e zoom
        </button>
      </div>
    </div>
  );
}

function NudgeBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="grid h-7 place-items-center rounded-md border border-white/10 bg-white/5 text-sm text-white/80 hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}



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
        "flex h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left text-[12.5px] font-semibold transition",
        checked
          ? "border-neon-yellow/60 bg-neon-yellow/10 text-neon-yellow shadow-[0_0_14px_-4px_oklch(0.86_0.19_100/0.6)]"
          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
      )}
    >
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full p-0.5 transition",
          checked ? "bg-neon-yellow/70" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[calc(100%-1.375rem)]" : "left-0.5",
          )}
        />
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
  const reorder = useReorderCategories();
  const base = categories.filter((c) => c.id !== "all");
  const [localOrder, setLocalOrder] = useState<Category[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const list = localOrder ?? base;
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

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
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-black">Categorias</h2>
          <p className="text-xs text-white/50">
            Arraste para reordenar. Toque em uma categoria para editar foto, nome e ajustes.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-2xl bg-neon-pink px-3 py-2 text-xs font-extrabold text-white glow-pink"
        >
          <Plus className="h-4 w-4" /> Nova
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((c) => (
          <CategoryListRow
            key={c.id}
            category={c}
            dragging={dragId === c.id}
            onDragStart={() => setDragId(c.id)}
            onDragOver={(e) => onDragOver(e, c.id)}
            onDragEnd={onDragEnd}
            onClick={() => setEditing(c)}
          />
        ))}
      </div>

      {editing && (
        <CategoryEditor
          initial={editing}
          onClose={() => setEditing(null)}
          nextSortOrder={list.length}
        />
      )}
      {creating && (
        <CategoryEditor
          initial={{ id: "", name: "", emoji: "✨", image: "", imagePosX: 0, imagePosY: 0, imageScale: 1 }}
          onClose={() => setCreating(false)}
          nextSortOrder={list.length}
        />
      )}
    </div>
  );
}

function CategoryListRow({
  category,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onClick,
}: {
  category: Category;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 transition hover:bg-white/10",
        dragging && "opacity-40",
      )}
    >
      <div className="grid h-full w-6 shrink-0 cursor-grab place-items-center text-white/30 hover:text-white/70 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </div>
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <div className="shrink-0">
          <CategoryChip category={category} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            {(() => {
              const Ico = getCategoryIcon(category.icon);
              return Ico ? (
                <Ico className="h-4 w-4 shrink-0 text-neon-cyan" />
              ) : (
                <span className="text-lg leading-none">{category.emoji}</span>
              );
            })()}
            <span className="truncate">{category.name}</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-white/40">{category.id}</div>
          <div className="mt-1 text-[10px] text-neon-cyan/80">Toque para editar →</div>
        </div>
      </button>
    </div>
  );
}

type CategoryEditorTab = "basic" | "photo";

function CategoryEditor({
  initial,
  onClose,
  nextSortOrder,
}: {
  initial: Category;
  onClose: () => void;
  nextSortOrder: number;
}) {
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();
  const isNew = !initial.id;
  const [c, setC] = useState<Category>(initial);
  const [tab, setTab] = useState<CategoryEditorTab>("basic");
  const [imageBusy, setImageBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setField = <K extends keyof Category>(k: K, v: Category[K]) => {
    setC((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const save = async () => {
    if (!c.name.trim()) return toast.error("Nome obrigatório");
    const id = (c.id || slugify(c.name)).trim();
    if (!id) return toast.error("ID inválido");
    await upsert.mutateAsync({
      id,
      name: c.name.trim(),
      emoji: c.emoji || "✨",
      icon: c.icon ?? null,
      image_url: c.image || null,
      sort_order: isNew ? nextSortOrder : 0,
      active: true,
      image_pos_x: Number(c.imagePosX ?? 0),
      image_pos_y: Number(c.imagePosY ?? 0),
      image_scale: Number(c.imageScale ?? 1),
    });
    toast.success(isNew ? "Categoria criada!" : "Alterações salvas!");
    setDirty(false);
    onClose();
  };

  const remove = async () => {
    if (!confirm(`Remover categoria "${c.name}"?`)) return;
    await del.mutateAsync(c.id);
    toast.success("Categoria removida");
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

  const tabs: { id: CategoryEditorTab; label: string }[] = [
    { id: "basic", label: "Básico" },
    { id: "photo", label: "Foto" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[oklch(0.14_0.09_305)] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-black">
              {isNew ? "Nova categoria" : c.name || "Editar categoria"}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
              <span>{c.emoji} {c.id || "novo-id"}</span>
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
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-4">
                <ImageDropzone
                  url={c.image}
                  busy={imageBusy}
                  onFile={onImage}
                  onClear={() => setField("image", "")}
                />
                <input
                  className={cn(inputCls, "text-xs")}
                  placeholder="ou cole uma URL da imagem"
                  value={c.image}
                  onChange={(e) => setField("image", e.target.value)}
                />
                <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2 text-[11px] text-neon-cyan/90">
                  Para reposicionar / dar zoom na foto, abra a aba <b>Foto</b>.
                </div>

                <Field label="Nome da categoria">
                  <input
                    className={inputCls}
                    placeholder="Ex.: Açaí"
                    value={c.name}
                    onChange={(e) => setField("name", e.target.value)}
                    maxLength={40}
                  />
                </Field>

                <Field label="Ícone">
                  <IconPicker
                    value={c.icon ?? null}
                    onChange={(name) => setField("icon", name)}
                  />
                </Field>

                <Field label="ID técnico (slug)">
                  <input
                    className={cn(inputCls, "font-mono text-xs")}
                    value={c.id}
                    disabled={!isNew}
                    onChange={(e) => setField("id", e.target.value)}
                    placeholder={isNew ? "Gerado a partir do nome" : ""}
                  />
                  <div className="mt-1 text-[11px] text-white/40">
                    {isNew ? "Deixe vazio para gerar automaticamente." : "Não pode ser alterado após criado."}
                  </div>
                </Field>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Preview
                </div>
                <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/30 p-3">
                  <CategoryChip category={c} active />
                </div>
                <div className="mt-2 text-center text-[10px] text-white/40">
                  Tamanho real no cardápio
                </div>
              </div>
            </div>
          )}

          {tab === "photo" && (
            <CategoryPhotoTab
              category={c}
              onChange={(patch) => {
                setC((prev) => ({ ...prev, ...patch }));
                setDirty(true);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3">
          {!isNew && (
            <button
              onClick={remove}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              title="Excluir categoria"
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
            {isNew ? "Criar categoria" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryPhotoTab({
  category,
  onChange,
}: {
  category: Category;
  onChange: (patch: Partial<Category>) => void;
}) {
  const posX = category.imagePosX ?? 0;
  const posY = category.imagePosY ?? 0;
  const scale = category.imageScale ?? 1;

  // The site's category chip photo area is 72×68.
  const AREA_W = 72;
  const AREA_H = 68;
  // Zoomed drag surface: 4× to make handling easier while preserving proportions.
  const SURFACE_W = AREA_W * 4;
  const SURFACE_H = AREA_H * 4;
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX, posY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / SURFACE_W) * 100;
    const dy = ((e.clientY - d.startY) / SURFACE_H) * 100;
    onChange({
      imagePosX: clamp(d.posX + dx, -80, 80),
      imagePosY: clamp(d.posY + dy, -80, 80),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const reset = () => onChange({ imagePosX: 0, imagePosY: 0, imageScale: 1 });
  const nudge = (dx: number, dy: number) =>
    onChange({
      imagePosX: clamp(posX + dx, -80, 80),
      imagePosY: clamp(posY + dy, -80, 80),
    });

  if (!category.image) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/60">
        Adicione uma foto na aba <b className="text-white">Básico</b> primeiro.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Preview real — tamanho do card no cardápio
        </div>
        <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/40 p-4">
          <CategoryChip category={category} active />
          <div className="mt-2 text-[10px] text-white/40">Arraste na área abaixo ou use os controles.</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Área de ajuste (arraste)
        </div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl border border-neon-cyan/30 bg-[#2a0a5c] cursor-grab active:cursor-grabbing"
          style={{
            width: SURFACE_W,
            height: SURFACE_H,
            backgroundImage:
              "radial-gradient(circle at 50% 30%, oklch(0.28 0.16 305) 0%, #2a0a5c 55%, #1a0538 100%)",
          }}
        >
          <img
            src={category.image}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            style={{
              transform: `translate(${posX}%, ${posY}%) scale(${scale})`,
              transformOrigin: "center",
            }}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-full w-px bg-white/10" />
          </div>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-px w-full bg-white/10" />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span>Zoom</span>
            <span className="text-white/50">{scale.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={scale}
            onChange={(e) => onChange({ imageScale: Number(e.target.value) })}
            className="w-full accent-neon-cyan"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Horizontal</span>
              <span className="text-white/50">{posX.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={posX}
              onChange={(e) => onChange({ imagePosX: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Vertical</span>
              <span className="text-white/50">{posY.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={posY}
              onChange={(e) => onChange({ imagePosY: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
          </div>
          <div className="flex flex-col items-stretch justify-end gap-1">
            <div className="grid grid-cols-3 gap-1">
              <div />
              <NudgeBtn onClick={() => nudge(0, -3)}>↑</NudgeBtn>
              <div />
              <NudgeBtn onClick={() => nudge(-3, 0)}>←</NudgeBtn>
              <NudgeBtn onClick={reset}>◎</NudgeBtn>
              <NudgeBtn onClick={() => nudge(3, 0)}>→</NudgeBtn>
              <div />
              <NudgeBtn onClick={() => nudge(0, 3)}>↓</NudgeBtn>
              <div />
            </div>
          </div>
        </div>

        <button
          onClick={reset}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
        >
          Resetar posição e zoom
        </button>
      </div>
    </div>
  );
}


/* ============================= Highlights ============================= */
function HighlightsTab() {
  const { data: products = [] } = useAllProducts();
  const { data: categories = [] } = useCategories();
  const toggle = useToggleHero();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const catList = categories.filter((c) => c.id !== "all");
  const heroCount = products.filter((p) => p.hero).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "hero" && !p.hero) return false;
      else if (filter !== "all" && filter !== "hero" && p.category !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, search]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-2xl font-black">Nossos Destaques</h2>
        <p className="text-xs text-white/50">
          Marque os produtos que devem aparecer no carrossel de destaques da home.{" "}
          <b className="text-neon-yellow">{heroCount}</b> em destaque.
        </p>
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
          <FilterChip active={filter === "hero"} onClick={() => setFilter("hero")}>
            <Star className="h-3 w-3 fill-neon-yellow text-neon-yellow" /> Em destaque{" "}
            <span className="opacity-60">({heroCount})</span>
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

      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((p) => (
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
        {visible.length === 0 && (
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
            Nenhum produto encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= Settings ============================= */
type SettingsSection =
  | "identity"
  | "contact"
  | "hours"
  | "delivery"
  | "payment"
  | "social"
  | "announcement"
  | "appearance";

const DAY_LABEL: Record<WeekDay, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

function SettingsTab() {
  const { data } = useSiteSettings();
  const update = useUpdateSettings();
  const [s, setS] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState<SettingsSection>("identity");
  const [logoBusy, setLogoBusy] = useState(false);
  const [textureBusy, setTextureBusy] = useState(false);

  useEffect(() => {
    if (data && !s) setS(data);
  }, [data, s]);

  if (!s) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!s) return;
    await update.mutateAsync(s);
    toast.success("Configurações salvas");
    setDirty(false);
  };

  const discard = () => {
    if (!data) return;
    if (dirty && !confirm("Descartar alterações não salvas?")) return;
    setS(data);
    setDirty(false);
  };

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    try {
      set("logo", await uploadProductImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setLogoBusy(false);
    }
  };
  const uploadTexture = async (file: File) => {
    setTextureBusy(true);
    try {
      set("texture", await uploadProductImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setTextureBusy(false);
    }
  };

  const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "identity", label: "Identidade", icon: Store },
    { id: "contact", label: "Contato & Local", icon: MapPin },
    { id: "hours", label: "Horários", icon: Clock },
    { id: "delivery", label: "Entrega", icon: Truck },
    { id: "payment", label: "Pagamento", icon: CreditCard },
    { id: "social", label: "Redes sociais", icon: Globe },
    { id: "announcement", label: "Anúncio", icon: Megaphone },
    { id: "appearance", label: "Aparência", icon: Palette },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-black">Configurações da Loja</h2>
          <p className="text-xs text-white/50">
            Tudo que os clientes veem e como o pedido chega até você.
          </p>
        </div>
        <StoreStatusBadge s={s} />
      </div>

      {/* Section chips */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setSection(sec.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              section === sec.id
                ? "bg-neon-pink text-white glow-pink"
                : "border border-white/10 text-white/70 hover:text-white",
            )}
          >
            <sec.icon className="h-3.5 w-3.5" />
            {sec.label}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <StorePreview s={s} />

      {/* Body */}
      <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
        {section === "identity" && <IdentitySection s={s} set={set} onLogo={uploadLogo} logoBusy={logoBusy} />}
        {section === "contact" && <ContactSection s={s} set={set} />}
        {section === "hours" && <HoursSection s={s} set={set} />}
        {section === "delivery" && <DeliverySection s={s} set={set} />}
        {section === "payment" && <PaymentSection s={s} set={set} />}
        {section === "social" && <SocialSection s={s} set={set} />}
        {section === "announcement" && <AnnouncementSection s={s} set={set} />}
        {section === "appearance" && (
          <AppearanceSection s={s} set={set} onTexture={uploadTexture} textureBusy={textureBusy} />
        )}
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[oklch(0.12_0.09_305)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-neon-yellow" />
              <span className="text-white/70">Você tem alterações não salvas</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={discard}
                className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
              >
                Descartar
              </button>
              <button
                onClick={save}
                disabled={update.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-neon-pink px-4 py-2 text-xs font-extrabold text-white glow-pink disabled:opacity-60"
              >
                {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------- Live preview ------- */
function StorePreview({ s }: { s: SiteSettings }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[oklch(0.20_0.14_305)] to-[oklch(0.10_0.08_300)]">
      {s.announcementActive && s.announcementText && (
        <div className="flex items-center gap-2 bg-neon-yellow px-4 py-1.5 text-[11px] font-bold text-[oklch(0.15_0.10_305)]">
          <Megaphone className="h-3.5 w-3.5" />
          <span className="truncate">{s.announcementText}</span>
        </div>
      )}
      <div className="flex items-center gap-4 p-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-black/30">
          {s.logo && <img src={s.logo} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-black">{s.name || "Nome da loja"}</div>
          <div className="truncate text-xs text-white/60">{s.tagline || "Slogan"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-white/50">
            {s.address && <span>📍 {s.address}</span>}
            {s.whatsappDisplay && <span>📱 {s.whatsappDisplay}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreStatusBadge({ s }: { s: SiteSettings }) {
  const label =
    s.openOverride === "open"
      ? "Aberto (forçado)"
      : s.openOverride === "closed"
      ? "Fechado (forçado)"
      : "Automático (por horário)";
  const color =
    s.openOverride === "closed"
      ? "border-red-400/40 bg-red-500/10 text-red-300"
      : s.openOverride === "open"
      ? "border-green-400/40 bg-green-500/10 text-green-300"
      : "border-white/10 bg-white/5 text-white/60";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold", color)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ------- Sections ------- */
type SetFn = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => void;

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-neon-pink/30 via-neon-pink/15 to-neon-cyan/20 text-neon-pink ring-1 ring-neon-pink/30 shadow-[0_0_18px_-4px_oklch(0.72_0.22_340/0.5)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-base font-black text-white">{title}</div>
        {sub && <div className="text-[11.5px] text-white/55">{sub}</div>}
      </div>
    </div>
  );
}


function IdentitySection({
  s,
  set,
  onLogo,
  logoBusy,
}: {
  s: SiteSettings;
  set: SetFn;
  onLogo: (f: File) => void;
  logoBusy: boolean;
}) {
  const nameMax = 40;
  const taglineMax = 60;
  const nameLen = s.name?.length ?? 0;
  const taglineLen = s.tagline?.length ?? 0;

  return (
    <div className="space-y-5">
      <SectionTitle icon={Store} title="Identidade" sub="Como sua loja aparece no topo do cardápio." />

      {/* Live preview */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[oklch(0.20_0.14_305)] via-[oklch(0.14_0.10_300)] to-[oklch(0.10_0.08_300)] p-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-neon-pink/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-neon-cyan/15 blur-3xl" />
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
          <Sparkles className="h-3 w-3 text-neon-yellow" /> Prévia
        </div>
        <div className="relative flex items-center gap-3">
          {s.logo ? (
            <img
              src={s.logo}
              alt={s.name || "Logo"}
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-white/10 drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-white/30">
              <Store className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-display text-xl font-black uppercase text-white"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              {s.name || "Nome da loja"}
            </div>
            <div className="truncate text-[12px] text-white/60">
              {s.tagline || "Adicione um slogan curto"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Logo</div>
          <ImageDropzone url={s.logo} busy={logoBusy} onFile={onLogo} onClear={() => set("logo", "")} />
          <div className="text-[10.5px] text-white/40">PNG ou JPG · quadrado · min. 512×512</div>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              className={cn(inputCls, "h-9 pl-8 text-xs")}
              placeholder="ou cole uma URL"
              value={s.logo}
              onChange={(e) => set("logo", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Nome da loja" hint="Aparece no topo do cardápio e no rodapé.">
            <div className="relative">
              <input
                className={cn(inputCls, "pr-14")}
                maxLength={nameMax}
                value={s.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex.: Quero Bis"
              />
              <span
                className={cn(
                  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums",
                  nameLen > nameMax * 0.9 ? "text-neon-yellow" : "text-white/30",
                )}
              >
                {nameLen}/{nameMax}
              </span>
            </div>
          </Field>

          <Field label="Slogan" hint="Uma frase curta que resume o que você vende.">
            <div className="relative">
              <input
                className={cn(inputCls, "pr-14")}
                maxLength={taglineMax}
                value={s.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="Ex.: Sorvetes e açaí feitos com amor"
              />
              <span
                className={cn(
                  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums",
                  taglineLen > taglineMax * 0.9 ? "text-neon-yellow" : "text-white/30",
                )}
              >
                {taglineLen}/{taglineMax}
              </span>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function ContactSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const formatWhatsappDisplay = () => {
    const digits = (s.whatsapp || "").replace(/\D/g, "");
    // remove 55 se for BR
    const local = digits.startsWith("55") ? digits.slice(2) : digits;
    if (local.length < 10) return;
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    const pretty =
      rest.length === 9
        ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
        : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    set("whatsappDisplay", pretty);
  };

  return (
    <div className="space-y-5">
      <SectionTitle icon={MapPin} title="Contato & Localização" sub="Onde encontrar sua loja e como falam com você." />

      {/* Endereço */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <MapPin className="h-3.5 w-3.5 text-neon-pink" /> Endereço
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Cidade">
            <input
              className={inputCls}
              value={s.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Ouro Preto do Oeste"
            />
          </Field>
          <Field label="Endereço completo" hint="Rua, número, bairro — aparece no rodapé do cardápio.">
            <input
              className={inputCls}
              value={s.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Av. Brasil, 123 · Centro"
            />
          </Field>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <Phone className="h-3.5 w-3.5 text-neon-cyan" /> WhatsApp
          </div>
          {s.whatsappDisplay && (
            <a
              href={`https://wa.me/${(s.whatsapp || "").replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              Testar link →
            </a>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Número (só dígitos, com DDI)" hint="Usado para abrir o WhatsApp. Ex.: 5569999999999">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/40">
                +
              </span>
              <input
                className={cn(inputCls, "pl-6 tabular-nums")}
                placeholder="5569999999999"
                inputMode="numeric"
                value={s.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </Field>
          <Field label="Exibição bonita" hint="Como o número aparece para o cliente.">
            <div className="relative">
              <input
                className={cn(inputCls, "pr-20")}
                placeholder="(69) 99999-9999"
                value={s.whatsappDisplay}
                onChange={(e) => set("whatsappDisplay", e.target.value)}
              />
              <button
                type="button"
                onClick={formatWhatsappDisplay}
                disabled={!s.whatsapp}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-neon-cyan/20 px-2 py-1 text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-40"
              >
                Auto
              </button>
            </div>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Horário resumido (rodapé)" hint="Frase curta. O horário detalhado fica na aba Horários.">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                className={cn(inputCls, "pl-9")}
                placeholder="Ex.: Seg-Dom · 14h às 22h"
                value={s.hours}
                onChange={(e) => set("hours", e.target.value)}
              />
            </div>
          </Field>
        </div>
      </div>

      {/* Mapa */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Globe className="h-3.5 w-3.5 text-neon-yellow" /> Mapa
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Link do Google Maps" hint="Botão 'Compartilhar → Copiar link' no Google Maps.">
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                className={cn(inputCls, "pl-9")}
                value={s.mapsUrl}
                onChange={(e) => set("mapsUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>
          </Field>
          <Field label="URL de embed do mapa" hint="Google Maps → Compartilhar → Incorporar mapa → copiar apenas o valor do src.">
            <input
              className={cn(inputCls, "font-mono text-xs")}
              value={s.mapEmbed}
              onChange={(e) => set("mapEmbed", e.target.value)}
              placeholder="https://www.google.com/maps/embed?pb=..."
            />
          </Field>

          {s.mapEmbed ? (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <iframe
                src={s.mapEmbed}
                title="Prévia do mapa"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-40 w-full"
              />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-[11px] text-white/40">
              Cole a URL de embed acima para ver a prévia
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoursSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const hours = s.hoursJson.length ? s.hoursJson : DEFAULT_HOURS;

  const updateDay = (day: WeekDay, patch: Partial<DayHours>) => {
    set(
      "hoursJson",
      hours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    );
  };

  const copyAll = () => {
    const first = hours[0];
    set(
      "hoursJson",
      hours.map((h) => ({ ...h, open: first.open, close: first.close, closed: first.closed })),
    );
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={Clock} title="Horários de funcionamento" sub="Define quando o site aparece como aberto no modo automático." />

      <Field label="Status da loja">
        <div className="grid grid-cols-3 gap-2">
          {(["auto", "open", "closed"] as const).map((o) => (
            <button
              key={o}
              onClick={() => set("openOverride", o)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-bold transition",
                s.openOverride === o
                  ? "border-neon-pink bg-neon-pink/20 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              {o === "auto" ? "Automático" : o === "open" ? "Forçar aberto" : "Forçar fechado"}
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/70">Horário por dia</div>
          <button
            onClick={copyAll}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/60 hover:bg-white/10"
          >
            Aplicar segunda a todos
          </button>
        </div>
        <div className="space-y-1.5">
          {hours.map((h) => (
            <div
              key={h.day}
              className="rounded-xl bg-white/5 px-2.5 py-2"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-xs font-bold text-white/80">{DAY_LABEL[h.day]}</div>
                <button
                  onClick={() => updateDay(h.day, { closed: !h.closed })}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                    h.closed
                      ? "border-red-400/40 bg-red-500/10 text-red-300"
                      : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
                  )}
                >
                  {h.closed ? "Fechado" : "Aberto"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  disabled={h.closed}
                  className={cn(inputCls, "h-9 flex-1 py-1 text-xs disabled:opacity-40")}
                  value={h.open}
                  onChange={(e) => updateDay(h.day, { open: e.target.value })}
                />
                <span className="text-white/40">→</span>
                <input
                  type="time"
                  disabled={h.closed}
                  className={cn(inputCls, "h-9 flex-1 py-1 text-xs disabled:opacity-40")}
                  value={h.close}
                  onChange={(e) => updateDay(h.day, { close: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeliverySection({ s, set }: { s: SiteSettings; set: SetFn }) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={Truck} title="Entrega & Retirada" sub="Como o cliente recebe o pedido." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Toggle
          checked={s.acceptsDelivery}
          onChange={(v) => set("acceptsDelivery", v)}
          label={s.acceptsDelivery ? "Aceita entrega" : "Entrega desativada"}
        />
        <Toggle
          checked={s.acceptsPickup}
          onChange={(v) => set("acceptsPickup", v)}
          label={s.acceptsPickup ? "Aceita retirada" : "Retirada desativada"}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <CreditCard className="h-3.5 w-3.5 text-neon-cyan" />
          Valores
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Taxa de entrega" hint="Valor cobrado a mais no pedido em modo entrega.">
            <MoneyInput value={s.deliveryFee} onChange={(v) => set("deliveryFee", v)} />
          </Field>
          <Field label="Frete grátis a partir de" hint="0 = sempre cobra a taxa acima.">
            <MoneyInput value={s.freeDeliveryThreshold} onChange={(v) => set("freeDeliveryThreshold", v)} />
          </Field>
          <Field label="Pedido mínimo" hint="O cliente só finaliza a partir deste valor.">
            <MoneyInput value={s.minOrder} onChange={(v) => set("minOrder", v)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

const QUICK_PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Vale-refeição"];

function PaymentSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const [copied, setCopied] = useState(false);
  const copyPix = () => {
    if (!s.pixKey) return;
    navigator.clipboard.writeText(s.pixKey);
    setCopied(true);
    toast.success("Chave Pix copiada");
    setTimeout(() => setCopied(false), 1500);
  };

  const addMethod = (m: string) => {
    if (s.paymentMethods.includes(m)) return;
    set("paymentMethods", [...s.paymentMethods, m]);
  };
  const missingQuick = QUICK_PAYMENT_METHODS.filter((m) => !s.paymentMethods.includes(m));

  return (
    <div className="space-y-5">
      <SectionTitle icon={CreditCard} title="Pagamento" sub="Como o cliente pode pagar o pedido." />

      <div className="rounded-2xl border border-neon-cyan/25 bg-gradient-to-br from-neon-cyan/10 to-transparent p-4">
        <Field label="Chave Pix" hint="Aparece na tela de pagamento para o cliente copiar.">
          <div className="relative">
            <input
              className={cn(inputCls, "pr-24")}
              placeholder="CPF, telefone, e-mail ou chave aleatória"
              value={s.pixKey}
              onChange={(e) => set("pixKey", e.target.value)}
            />
            <button
              type="button"
              onClick={copyPix}
              disabled={!s.pixKey}
              className={cn(
                "absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition",
                s.pixKey
                  ? "bg-neon-cyan text-[oklch(0.18_0.11_305)] hover:brightness-110"
                  : "bg-white/5 text-white/30",
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </Field>
      </div>

      <Field label="Formas de pagamento aceitas" hint="Aparecem no checkout para o cliente escolher.">
        <ChipInput
          values={s.paymentMethods}
          onChange={(v) => set("paymentMethods", v)}
          placeholder="Digite e Enter (ex.: Cartão de crédito)"
        />
        {missingQuick.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[10.5px] uppercase tracking-wider text-white/40">Sugestões:</span>
            {missingQuick.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => addMethod(m)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:border-neon-cyan hover:text-neon-cyan"
              >
                <Plus className="h-3 w-3" /> {m}
              </button>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-white/50">R$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        className={cn(inputCls, "pl-9 font-mono tabular-nums")}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}


function SocialSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  return (
    <div className="space-y-4">
      <SectionTitle icon={Globe} title="Redes sociais" sub="Links exibidos no rodapé do cardápio." />
      <Field label="Instagram">
        <div className="relative">
          <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className={cn(inputCls, "pl-9")}
            placeholder="@seuinsta ou URL completa"
            value={s.instagram}
            onChange={(e) => set("instagram", e.target.value)}
          />
        </div>
      </Field>
      <Field label="Facebook">
        <div className="relative">
          <Facebook className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className={cn(inputCls, "pl-9")}
            placeholder="URL da página"
            value={s.facebook}
            onChange={(e) => set("facebook", e.target.value)}
          />
        </div>
      </Field>
      <Field label="TikTok">
        <div className="relative">
          <Music2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className={cn(inputCls, "pl-9")}
            placeholder="@seutiktok ou URL"
            value={s.tiktok}
            onChange={(e) => set("tiktok", e.target.value)}
          />
        </div>
      </Field>
    </div>
  );
}

function AnnouncementSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const len = s.announcementText.length;
  const pct = Math.min(100, (len / 140) * 100);
  return (
    <div className="space-y-5">
      <SectionTitle icon={Megaphone} title="Anúncio no topo" sub="Barra amarela que aparece no topo do cardápio." />

      <Toggle
        checked={s.announcementActive}
        onChange={(v) => set("announcementActive", v)}
        label={s.announcementActive ? "Anúncio visível para os clientes" : "Anúncio desativado"}
      />

      {s.announcementActive && s.announcementText && (
        <div className="flex items-center gap-2 rounded-2xl bg-neon-yellow px-4 py-2 text-[12px] font-bold text-[oklch(0.15_0.10_305)]">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{s.announcementText}</span>
          <span className="ml-auto text-[10px] uppercase tracking-widest opacity-70">Prévia</span>
        </div>
      )}

      <Field label="Texto do anúncio" hint="Curto e chamativo. Emoji ajuda! 🎉">
        <textarea
          rows={2}
          maxLength={140}
          className={inputCls}
          placeholder="Ex.: Promoção de sexta! Açaí 500ml por R$ 15 🎉"
          value={s.announcementText}
          onChange={(e) => set("announcementText", e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct > 90 ? "bg-red-400" : pct > 70 ? "bg-neon-yellow" : "bg-neon-cyan",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[10px] tabular-nums text-white/50">{len}/140</div>
        </div>
      </Field>
    </div>
  );
}


function AppearanceSection({
  s,
  set,
  onTexture,
  textureBusy,
}: {
  s: SiteSettings;
  set: SetFn;
  onTexture: (f: File) => void;
  textureBusy: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle icon={Palette} title="Aparência" sub="Imagens do fundo do site." />
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Textura de fundo</div>
        <ImageDropzone
          url={s.texture}
          busy={textureBusy}
          onFile={onTexture}
          onClear={() => set("texture", "")}
        />
        <input
          className={cn(inputCls, "mt-2 text-xs")}
          placeholder="ou cole uma URL"
          value={s.texture}
          onChange={(e) => set("texture", e.target.value)}
        />
      </div>
    </div>
  );
}

/* ============================= UI helpers ============================= */
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
      {children}
      {hint && (
        <div className="mt-1 flex items-start gap-1 text-[10.5px] text-white/45">
          <Info className="mt-[1px] h-3 w-3 shrink-0" />
          <span>{hint}</span>
        </div>
      )}
    </label>
  );
}


function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (name: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CATEGORY_ICON_LIST;
    return CATEGORY_ICON_LIST.filter((i) => i.name.toLowerCase().includes(s));
  }, [q]);

  const Current = getCategoryIcon(value);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/40 text-neon-cyan">
          {Current ? <Current className="h-5 w-5" /> : <Sparkles className="h-5 w-5 text-white/30" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-white/80">
            {value ?? "Nenhum ícone selecionado"}
          </div>
          <div className="text-[10px] text-white/40">Escolha um ícone da biblioteca abaixo.</div>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:bg-white/10"
          >
            Remover
          </button>
        )}
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
        <input
          className={cn(inputCls, "pl-8 py-1.5 text-xs")}
          placeholder="Buscar ícone (ex.: cream, cherry, cup)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto rounded-lg bg-black/20 p-1.5">
        {list.map(({ name, Icon }) => {
          const selected = name === value;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={cn(
                "grid aspect-square place-items-center rounded-md border transition",
                selected
                  ? "border-neon-pink bg-neon-pink/20 text-neon-pink"
                  : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-8 py-4 text-center text-[11px] text-white/40">
            Nenhum ícone encontrado.
          </div>
        )}
      </div>
    </div>
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
