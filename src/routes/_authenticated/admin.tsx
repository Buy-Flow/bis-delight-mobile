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
  AlertTriangle,
  Eraser,
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
  useUpdateProductExtras,
  useToggleHero,
  useUpdateHeroImage,
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
import { HighlightCard } from "@/components/menu/HighlightCard";
import { NewsPosterCard, BADGE_STYLES as NEWS_BADGES, EYEBROWS as NEWS_EYEBROWS } from "@/components/menu/NewsCarousel";
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

type Tab = "products" | "categories" | "highlights" | "extras" | "news" | "settings";

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
    { id: "extras", label: "Complementos", icon: Plus },
    { id: "news", label: "Novidades", icon: Sparkles },
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
        {tab === "extras" && <ExtrasTab />}
        {tab === "news" && <NewsTab />}
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
  const heroProducts = useMemo(() => products.filter((p) => p.hero), [products]);

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
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-black">Nossos Destaques</h2>
          <p className="text-xs text-white/50">
            Marque os produtos que devem aparecer no carrossel de destaques da home.{" "}
            <b className="text-neon-yellow">{heroCount}</b> em destaque.
          </p>
        </div>
        {heroProducts.length > 0 && (
          <button
            type="button"
            onClick={() => {
              document
                .getElementById("hero-image-editors")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="shrink-0 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 text-[11px] font-semibold text-neon-cyan hover:bg-neon-cyan/20"
          >
            Ajustar imagens ↓
          </button>
        )}
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

      {heroProducts.length > 0 && (
        <div id="hero-image-editors" className="mt-8 scroll-mt-24">
          <div className="mb-2">
            <h3 className="font-display text-lg font-black">Ajustar imagem de cada destaque</h3>
            <p className="text-[11px] text-white/50">
              Envie uma foto exclusiva para o card do carrossel e ajuste a posição com preview ao vivo.
              Se vazio, usa a foto do produto.
            </p>
          </div>
          <div className="space-y-3">
            {heroProducts.map((p) => (
              <HeroImageEditor key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroImageEditor({ product }: { product: Product }) {
  const update = useUpdateHeroImage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    heroImage: product.heroImage ?? "",
    posX: product.heroImagePosX ?? 0,
    posY: product.heroImagePosY ?? 0,
    scale: product.heroImageScale ?? 1.4,
  });

  // Sync when data reloads
  useEffect(() => {
    setDraft({
      heroImage: product.heroImage ?? "",
      posX: product.heroImagePosX ?? 0,
      posY: product.heroImagePosY ?? 0,
      scale: product.heroImageScale ?? 1.4,
    });
  }, [product.heroImage, product.heroImagePosX, product.heroImagePosY, product.heroImageScale]);

  const previewProduct: Product = {
    ...product,
    heroImage: draft.heroImage,
    heroImagePosX: draft.posX,
    heroImagePosY: draft.posY,
    heroImageScale: draft.scale,
  };

  const save = async (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    await update.mutateAsync({
      id: product.id,
      heroImage: next.heroImage,
      heroImagePosX: next.posX,
      heroImagePosY: next.posY,
      heroImageScale: next.scale,
    });
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadProductImage(file);
      await save({ heroImage: url });
      toast.success("Imagem do destaque atualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setBusy(false);
    }
  };

  const clearImage = async () => {
    await save({ heroImage: "" });
    toast.success("Imagem removida — voltou para a foto do produto");
  };

  const reset = () => save({ posX: 0, posY: 0, scale: 1.4 });

  // Drag on preview
  const CARD_W = 320;
  const CARD_H = 148;
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draft.heroImage) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: draft.posX, posY: draft.posY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / (CARD_W * 0.44)) * 100;
    const dy = ((e.clientY - d.startY) / CARD_H) * 100;
    setDraft((prev) => ({
      ...prev,
      posX: clamp(d.posX + dx, -80, 80),
      posY: clamp(d.posY + dy, -80, 80),
    }));
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // Persist on release
    void update.mutateAsync({
      id: product.id,
      heroImagePosX: draft.posX,
      heroImagePosY: draft.posY,
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30">
          <img
            src={draft.heroImage || product.image}
            className="h-full w-full object-cover"
            alt=""
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 fill-neon-yellow text-neon-yellow" />
            <div className="truncate text-sm font-bold">{product.name}</div>
          </div>
          <div className="text-[11px] text-white/50">
            {draft.heroImage ? "Imagem personalizada" : "Usando foto do produto"}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70",
            open && "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30",
          )}
        >
          {open ? "Fechar" : "Ajustar"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/5 p-3">
          {/* Live preview + drag surface */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Preview ao vivo — arraste a foto no card
            </div>
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="mx-auto touch-none select-none cursor-grab active:cursor-grabbing"
              style={{ width: CARD_W, height: CARD_H }}
            >
              <HighlightCard product={previewProduct} onOpen={() => {}} />
            </div>
          </div>

          {/* Image uploader */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Imagem exclusiva do destaque
            </div>
            <ImageDropzone
              url={draft.heroImage}
              busy={busy}
              onFile={onFile}
              onClear={clearImage}
            />
            <p className="mt-1 text-[10.5px] text-white/40">
              Dica: fundo transparente (PNG) fica melhor no card. Se vazio, usa a foto do produto.
            </p>
          </div>

          {/* Sliders */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
                <span>Zoom</span>
                <span className="text-white/50">{draft.scale.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={draft.scale}
                onChange={(e) => setDraft((p) => ({ ...p, scale: Number(e.target.value) }))}
                onPointerUp={() => save({ scale: draft.scale })}
                className="w-full accent-neon-cyan"
                disabled={!draft.heroImage}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
                  <span>Horizontal</span>
                  <span className="text-white/50">{draft.posX.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={draft.posX}
                  onChange={(e) => setDraft((p) => ({ ...p, posX: Number(e.target.value) }))}
                  onPointerUp={() => save({ posX: draft.posX })}
                  className="w-full accent-neon-cyan"
                  disabled={!draft.heroImage}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
                  <span>Vertical</span>
                  <span className="text-white/50">{draft.posY.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={draft.posY}
                  onChange={(e) => setDraft((p) => ({ ...p, posY: Number(e.target.value) }))}
                  onPointerUp={() => save({ posY: draft.posY })}
                  className="w-full accent-neon-cyan"
                  disabled={!draft.heroImage}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={!draft.heroImage}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-40"
            >
              Resetar posição e zoom
            </button>
          </div>
        </div>
      )}
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
  | "news"
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

function NewsTab() {
  const { data } = useSiteSettings();
  const update = useUpdateSettings();
  const [s, setS] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);

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
    toast.success("Novidades salvas");
    setDirty(false);
  };

  const discard = () => {
    if (!data) return;
    if (dirty && !confirm("Descartar alterações não salvas?")) return;
    setS(data);
    setDirty(false);
  };

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-black">Novidades</h2>
          <p className="text-xs text-white/50">
            Gerencie o carrossel de novidades que aparece na home.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-neon-yellow" />
          {s.newsActive ? "Ativo" : "Desativado"}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <NewsSection s={s} set={set} />
      </div>

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

function SettingsTab({ initialSection = "identity" }: { initialSection?: SettingsSection } = {}) {
  const { data } = useSiteSettings();
  const update = useUpdateSettings();
  const [s, setS] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState<SettingsSection>(initialSection);
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
    { id: "news", label: "Novidades", icon: Sparkles },
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
        {section === "news" && <NewsSection s={s} set={set} />}
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
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

  const summary: string[] = [];
  if (s.acceptsDelivery) {
    if (s.freeDeliveryThreshold > 0) {
      summary.push(
        `Entrega ${brl(s.deliveryFee)} — grátis a partir de ${brl(s.freeDeliveryThreshold)}`,
      );
    } else if (s.deliveryFee > 0) {
      summary.push(`Entrega ${brl(s.deliveryFee)}`);
    } else {
      summary.push("Entrega grátis");
    }
  }
  if (s.acceptsPickup) summary.push("Retirada no local disponível");
  if (s.minOrder > 0) summary.push(`Pedido mínimo ${brl(s.minOrder)}`);

  return (
    <div className="space-y-5">
      <SectionTitle icon={Truck} title="Entrega & Retirada" sub="Como o cliente recebe o pedido." />

      {/* Modalidades */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Truck className="h-3.5 w-3.5 text-neon-pink" /> Modalidades
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => set("acceptsDelivery", !s.acceptsDelivery)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border p-3 text-left transition",
              s.acceptsDelivery
                ? "border-neon-pink/50 bg-neon-pink/10 shadow-[0_0_20px_-8px_oklch(0.72_0.24_10/0.6)]"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                s.acceptsDelivery ? "bg-neon-pink/25 text-neon-pink" : "bg-white/5 text-white/40",
              )}
            >
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-white">Entrega em casa</div>
              <div className="text-[11px] text-white/50">
                {s.acceptsDelivery ? "Ativa · cobra taxa por pedido" : "Desativada"}
              </div>
            </div>
            <div
              className={cn(
                "h-5 w-5 shrink-0 rounded-full border-2 transition",
                s.acceptsDelivery ? "border-neon-pink bg-neon-pink" : "border-white/25",
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => set("acceptsPickup", !s.acceptsPickup)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border p-3 text-left transition",
              s.acceptsPickup
                ? "border-neon-cyan/50 bg-neon-cyan/10 shadow-[0_0_20px_-8px_oklch(0.80_0.16_200/0.6)]"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                s.acceptsPickup ? "bg-neon-cyan/25 text-neon-cyan" : "bg-white/5 text-white/40",
              )}
            >
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-white">Retirada no local</div>
              <div className="text-[11px] text-white/50">
                {s.acceptsPickup ? "Ativa · cliente busca na loja" : "Desativada"}
              </div>
            </div>
            <div
              className={cn(
                "h-5 w-5 shrink-0 rounded-full border-2 transition",
                s.acceptsPickup ? "border-neon-cyan bg-neon-cyan" : "border-white/25",
              )}
            />
          </button>
        </div>

        {!s.acceptsDelivery && !s.acceptsPickup && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>Nenhuma modalidade ativa — o cliente não consegue finalizar pedidos.</span>
          </div>
        )}
      </div>

      {/* Valores */}
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-black/20 p-4 transition",
          !s.acceptsDelivery && "opacity-60",
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <CreditCard className="h-3.5 w-3.5 text-neon-cyan" /> Valores
          </div>
          {!s.acceptsDelivery && (
            <span className="text-[10px] text-white/40">Ative a entrega para usar</span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Taxa de entrega" hint="Valor cobrado a mais no pedido em modo entrega.">
            <MoneyInput value={s.deliveryFee} onChange={(v) => set("deliveryFee", v)} />
          </Field>
          <Field label="Frete grátis a partir de" hint="0 = sempre cobra a taxa acima.">
            <MoneyInput
              value={s.freeDeliveryThreshold}
              onChange={(v) => set("freeDeliveryThreshold", v)}
            />
          </Field>
          <Field label="Pedido mínimo" hint="O cliente só finaliza a partir deste valor.">
            <MoneyInput value={s.minOrder} onChange={(v) => set("minOrder", v)} />
          </Field>
        </div>
      </div>

      {/* Resumo ao vivo */}
      {summary.length > 0 && (
        <div className="rounded-2xl border border-neon-yellow/25 bg-gradient-to-br from-neon-yellow/10 to-transparent p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neon-yellow/90">
            <Sparkles className="h-3.5 w-3.5" /> Como o cliente vê
          </div>
          <ul className="space-y-1.5">
            {summary.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12.5px] text-white/85">
                <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-neon-yellow" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const QUICK_PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Vale-refeição"];

function detectPixKeyType(key: string): { label: string; tone: string } | null {
  const k = key.trim();
  if (!k) return null;
  if (/^\d{11}$/.test(k.replace(/\D/g, "")) && k.replace(/\D/g, "").length === 11)
    return { label: "CPF", tone: "text-neon-cyan" };
  if (/^\d{14}$/.test(k.replace(/\D/g, ""))) return { label: "CNPJ", tone: "text-neon-cyan" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return { label: "E-mail", tone: "text-neon-yellow" };
  if (/^\+?\d{10,13}$/.test(k.replace(/\D/g, ""))) return { label: "Telefone", tone: "text-neon-pink" };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k))
    return { label: "Chave aleatória", tone: "text-emerald-300" };
  return { label: "Chave personalizada", tone: "text-white/60" };
}

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
  const pixType = detectPixKeyType(s.pixKey || "");

  return (
    <div className="space-y-5">
      <SectionTitle icon={CreditCard} title="Pagamento" sub="Como o cliente pode pagar o pedido." />

      {/* Pix */}
      <div className="relative overflow-hidden rounded-2xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/15 via-neon-cyan/5 to-transparent p-4">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-neon-cyan/20 blur-3xl" />
        <div className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neon-cyan/25 text-neon-cyan">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-white">Chave Pix</div>
              <div className="text-[10.5px] text-white/50">Aparece no checkout para o cliente copiar.</div>
            </div>
          </div>
          {pixType && (
            <span
              className={cn(
                "rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                pixType.tone,
              )}
            >
              {pixType.label}
            </span>
          )}
        </div>
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
        {!s.pixKey && (
          <div className="mt-2 flex items-start gap-1.5 text-[10.5px] text-white/50">
            <Info className="mt-[1px] h-3 w-3 shrink-0" />
            <span>Sem chave, o cliente não conseguirá pagar por Pix no checkout.</span>
          </div>
        )}
      </div>

      {/* Formas de pagamento */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <Check className="h-3.5 w-3.5 text-neon-yellow" /> Formas aceitas
          </div>
          <span className="text-[10px] text-white/40">
            {s.paymentMethods.length} ativa{s.paymentMethods.length === 1 ? "" : "s"}
          </span>
        </div>

        <ChipInput
          values={s.paymentMethods}
          onChange={(v) => set("paymentMethods", v)}
          placeholder="Digite e Enter (ex.: Cartão de crédito)"
        />

        {missingQuick.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-white/40">
              Adicionar rapidamente
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingQuick.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => addMethod(m)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan"
                >
                  <Plus className="h-3 w-3" /> {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {s.paymentMethods.length === 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>Sem formas de pagamento, o cliente não consegue finalizar o pedido.</span>
          </div>
        )}
      </div>

      {/* Prévia */}
      {(s.paymentMethods.length > 0 || s.pixKey) && (
        <div className="rounded-2xl border border-neon-yellow/25 bg-gradient-to-br from-neon-yellow/10 to-transparent p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neon-yellow/90">
            <Sparkles className="h-3.5 w-3.5" /> Como o cliente vê
          </div>
          {s.paymentMethods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.paymentMethods.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white/90"
                >
                  <Check className="h-3 w-3 text-neon-yellow" /> {m}
                </span>
              ))}
            </div>
          )}
          {s.pixKey && (
            <div className="mt-2 text-[11.5px] text-white/70">
              Pix disponível — chave{" "}
              <span className="font-mono text-white/90">{s.pixKey}</span>
            </div>
          )}
        </div>
      )}
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


const SOCIAL_NETWORKS = [
  {
    key: "instagram" as const,
    label: "Instagram",
    icon: Instagram,
    placeholder: "@seuinsta ou URL completa",
    accent: "from-[#f09433] via-[#e6683c] to-[#bc1888]",
    ring: "ring-[#e6683c]/40",
    text: "text-[#f5a97b]",
    baseUrl: "https://instagram.com/",
    resolve: (v: string) =>
      v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`,
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    icon: Facebook,
    placeholder: "URL da página",
    accent: "from-[#1877f2] to-[#0a58ca]",
    ring: "ring-[#1877f2]/40",
    text: "text-[#7cb0ff]",
    baseUrl: "https://facebook.com/",
    resolve: (v: string) =>
      v.startsWith("http") ? v : `https://facebook.com/${v.replace(/^@/, "")}`,
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    icon: Music2,
    placeholder: "@seutiktok ou URL",
    accent: "from-[#25f4ee] via-[#0d0d0d] to-[#fe2c55]",
    ring: "ring-[#fe2c55]/40",
    text: "text-[#ff7a95]",
    baseUrl: "https://tiktok.com/@",
    resolve: (v: string) =>
      v.startsWith("http")
        ? v
        : `https://tiktok.com/@${v.replace(/^@/, "")}`,
  },
];

function SocialSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const active = SOCIAL_NETWORKS.filter((n) => (s[n.key] as string)?.trim());

  return (
    <div className="space-y-5">
      <SectionTitle icon={Globe} title="Redes sociais" sub="Links exibidos no rodapé do cardápio." />

      <div className="space-y-3">
        {SOCIAL_NETWORKS.map((n) => {
          const value = (s[n.key] as string) || "";
          const filled = value.trim().length > 0;
          const Icon = n.icon;
          return (
            <div
              key={n.key}
              className={cn(
                "rounded-2xl border p-3 transition",
                filled
                  ? "border-white/15 bg-white/[0.04]"
                  : "border-white/10 bg-black/20",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition",
                    n.accent,
                    filled ? "opacity-100 ring-2" : "opacity-50",
                    filled && n.ring,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-bold text-white">{n.label}</div>
                    {filled && (
                      <a
                        href={n.resolve(value)}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold transition hover:bg-white/10",
                          n.text,
                        )}
                      >
                        Abrir <LinkIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <input
                    className={cn(inputCls, "mt-1 h-9 text-xs")}
                    placeholder={n.placeholder}
                    value={value}
                    onChange={(e) => set(n.key, e.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prévia */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Sparkles className="h-3.5 w-3.5 text-neon-yellow" /> Como aparece no rodapé
        </div>
        {active.length === 0 ? (
          <div className="text-[11.5px] text-white/40">
            Preencha ao menos uma rede para aparecer no rodapé do cardápio.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((n) => {
              const Icon = n.icon;
              return (
                <span
                  key={n.key}
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg",
                    n.accent,
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const ANNOUNCEMENT_TEMPLATES = [
  "🎉 Promoção de sexta! Açaí 500ml por R$ 15",
  "🚚 Entrega grátis nos pedidos acima de R$ 50",
  "🍦 Novidade: sabor do mês chegando!",
  "⏰ Hoje aberto até meia-noite",
];

function AnnouncementSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const len = s.announcementText?.length ?? 0;
  const max = 140;
  const pct = Math.min(100, (len / max) * 100);
  const hasText = len > 0;

  return (
    <div className="space-y-5">
      <SectionTitle icon={Megaphone} title="Anúncio no topo" sub="Barra amarela que aparece no topo do cardápio." />

      {/* Status toggle destacado */}
      <div
        className={cn(
          "rounded-2xl border p-4 transition",
          s.announcementActive
            ? "border-neon-yellow/40 bg-gradient-to-br from-neon-yellow/15 to-transparent"
            : "border-white/10 bg-black/20",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition",
              s.announcementActive ? "bg-neon-yellow text-[oklch(0.15_0.10_305)]" : "bg-white/5 text-white/40",
            )}
          >
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-white">
              {s.announcementActive ? "Anúncio ativo" : "Anúncio desativado"}
            </div>
            <div className="text-[11px] text-white/50">
              {s.announcementActive
                ? "Visível para todos os clientes no topo do cardápio."
                : "Ative para exibir a barra amarela no topo."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => set("announcementActive", !s.announcementActive)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full p-0.5 transition",
              s.announcementActive ? "bg-neon-yellow" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                s.announcementActive ? "left-[calc(100%-1.375rem)]" : "left-0.5",
              )}
            />
          </button>
        </div>
      </div>

      {/* Prévia ao vivo — sempre visível */}
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-white/50">
          <Sparkles className="h-3 w-3 text-neon-yellow" /> Prévia ao vivo
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.10_0.08_300)]">
          {hasText && s.announcementActive ? (
            <div className="flex items-center gap-2 bg-neon-yellow px-4 py-2 text-[12px] font-bold text-[oklch(0.15_0.10_305)]">
              <Megaphone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{s.announcementText}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 text-[11.5px] text-white/40">
              <EyeOff className="h-3.5 w-3.5" />
              {hasText ? "Anúncio desativado — não aparece para o cliente" : "Digite um texto abaixo para ver a prévia"}
            </div>
          )}
        </div>
      </div>

      {/* Texto */}
      <Field label="Texto do anúncio" hint="Curto e chamativo. Emoji ajuda! 🎉">
        <textarea
          rows={2}
          maxLength={max}
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
          <div
            className={cn(
              "text-[10px] tabular-nums",
              pct > 90 ? "text-red-300" : "text-white/50",
            )}
          >
            {len}/{max}
          </div>
        </div>
      </Field>

      {/* Templates rápidos */}
      <div>
        <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-white/40">Ideias rápidas</div>
        <div className="flex flex-wrap gap-1.5">
          {ANNOUNCEMENT_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("announcementText", t)}
              className="rounded-full border border-dashed border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-neon-yellow hover:bg-neon-yellow/10 hover:text-neon-yellow"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}



const TEXTURE_PRESETS = [
  { label: "Roxo escuro", url: "" },
  {
    label: "Neon purple",
    url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&q=80",
  },
  {
    label: "Aurora",
    url: "https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=800&q=80",
  },
  {
    label: "Gradiente rosa",
    url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
  },
];

function NewsSection({ s, set }: { s: SiteSettings; set: SetFn }) {
  const { data: products = [] } = useAllProducts();
  const [query, setQuery] = useState("");

  const selectedIds = s.newsProductIds;
  const selectedSet = new Set(selectedIds);
  const selected = selectedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is (typeof products)[number] => Boolean(p));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter(
        (p) => !selectedSet.has(p.id) && p.name.toLowerCase().includes(q),
      )
    : products.filter((p) => !selectedSet.has(p.id)).slice(0, 12);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      set("newsProductIds", selectedIds.filter((x) => x !== id));
    } else {
      set("newsProductIds", [...selectedIds, id]);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...selectedIds];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    set("newsProductIds", next);
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Sparkles}
        title="Novidades"
        sub="Carrossel que aparece antes de 'Nossos Destaques' na página inicial."
      />

      {/* Status */}
      <div
        className={cn(
          "rounded-2xl border p-4 transition",
          s.newsActive
            ? "border-neon-cyan/40 bg-gradient-to-br from-neon-cyan/15 to-transparent"
            : "border-white/10 bg-black/20",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition",
              s.newsActive ? "bg-neon-cyan/25 text-neon-cyan" : "bg-white/5 text-white/40",
            )}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-white">
              {s.newsActive ? "Novidades ativas" : "Novidades desativadas"}
            </div>
            <div className="text-[11px] text-white/50">
              {s.newsActive
                ? selected.length > 0
                  ? `${selected.length} produto${selected.length === 1 ? "" : "s"} no carrossel.`
                  : "Adicione produtos abaixo para o carrossel aparecer."
                : "Ative para exibir o carrossel de novidades no topo."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => set("newsActive", !s.newsActive)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full p-0.5 transition",
              s.newsActive ? "bg-neon-cyan" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                s.newsActive ? "left-[calc(100%-1.375rem)]" : "left-0.5",
              )}
            />
          </button>
        </div>
      </div>

      {/* Título */}
      <Field label="Título da seção" hint="Aparece grande no cardápio: 'Nossas [Título]'.">
        <input
          className={inputCls}
          value={s.newsTitle}
          onChange={(e) => set("newsTitle", e.target.value)}
          placeholder="Novidades"
          maxLength={24}
        />
      </Field>

      {/* Subtítulo */}
      <Field label="Subtítulo (frase escrita à mão)" hint="Aparece rotacionado ao lado do título. Deixe em branco para esconder.">
        <input
          className={inputCls}
          value={s.newsSubtitle}
          onChange={(e) => set("newsSubtitle", e.target.value)}
          placeholder="acabou de sair!"
          maxLength={40}
        />
      </Field>

      {/* Ticker */}
      <Field
        label="Texto da faixa animada (ticker)"
        hint="Separe cada item por vírgula. Deixe em branco para esconder a faixa."
      >
        <textarea
          className={cn(inputCls, "min-h-[70px] resize-y py-2 leading-relaxed")}
          value={s.newsTicker}
          onChange={(e) => set("newsTicker", e.target.value)}
          placeholder="Lançamento fresquinho, Edição limitada, Só na Quero Bis"
        />
      </Field>


      {/* Selecionados */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <Check className="h-3.5 w-3.5 text-neon-cyan" /> No carrossel
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">
              {selected.length} selecionado{selected.length === 1 ? "" : "s"}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Remover todos os produtos do carrossel?")) {
                    set("newsProductIds", []);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"
              >
                <Eraser className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        {selected.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-[11.5px] text-white/40">
            Nenhum produto selecionado ainda.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {selected.map((p, i) => {
              const hasHero = Boolean(p.heroImage);
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl bg-white/5 p-2"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-neon-cyan/20 text-[10px] font-black text-neon-cyan">
                    {i + 1}
                  </span>
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-white">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-white/40">
                      <span className="truncate">{p.category}</span>
                      {!hasHero && (
                        <span
                          title="Sem imagem hero (heroImage). O card usará a imagem padrão do produto."
                          className="inline-flex items-center gap-0.5 rounded-full bg-yellow-400/15 px-1.5 py-[1px] text-[9px] font-bold text-yellow-300"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" /> sem hero
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-md border border-white/10 bg-white/5 p-1 text-white/60 hover:bg-white/10 disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === selected.length - 1}
                      className="rounded-md border border-white/10 bg-white/5 p-1 text-white/60 hover:bg-white/10 disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="rounded-md border border-red-400/30 bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20"
                      aria-label="Remover"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {selected.length > 0 && selected.some((p) => !p.heroImage) && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-yellow-400/25 bg-yellow-400/5 p-3 text-[11px] text-yellow-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Alguns produtos não têm <b>imagem hero</b> configurada. O carrossel fica muito melhor com ela — edite o produto em <b>Cardápio</b> e defina a imagem hero.
            </span>
          </div>
        )}
      </div>

      {/* Foto & Posicionamento por produto */}
      {selected.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <ImagePlus className="h-3.5 w-3.5 text-neon-cyan" /> Foto & posicionamento
          </div>
          <p className="mb-3 text-[11px] text-white/50">
            Prévia real do card de Novidades — arraste a foto para reposicionar e use o zoom.
          </p>
          <div className="space-y-3">
            {selected.map((p, i) => (
              <NewsHeroEditor key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      )}


      {/* Adicionar */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">

        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Plus className="h-3.5 w-3.5 text-neon-yellow" /> Adicionar produtos
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            className={cn(inputCls, "pl-9")}
            placeholder="Buscar produto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="text-center text-[11.5px] text-white/40">
            {q ? "Nenhum produto encontrado." : "Todos os produtos já foram adicionados."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-left transition hover:border-neon-cyan/40 hover:bg-neon-cyan/10"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-semibold text-white">{p.name}</div>
                  <div className="truncate text-[10px] text-white/40">{p.category}</div>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-white/50" />
              </button>
            ))}
          </div>
        )}
      </div>
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
    <div className="space-y-5">
      <SectionTitle icon={Palette} title="Aparência" sub="Como o fundo do cardápio aparece." />

      {/* Prévia ao vivo */}
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-white/50">
          <Sparkles className="h-3 w-3 text-neon-yellow" /> Prévia ao vivo
        </div>
        <div
          className="relative h-40 overflow-hidden rounded-2xl border border-white/10"
          style={{
            backgroundColor: "#0d0322",
            backgroundImage: s.texture ? `url(${s.texture})` : undefined,
            backgroundSize: "cover",
            backgroundRepeat: "repeat",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div
              className="font-display text-lg font-black uppercase text-white drop-shadow-lg"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              {s.name || "Sua loja"}
            </div>
            <span className="rounded-full bg-neon-yellow px-2 py-0.5 text-[10px] font-black uppercase text-[oklch(0.15_0.10_305)]">
              Aberto
            </span>
          </div>
          {!s.texture && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/40">
              Sem textura — fundo roxo padrão
            </div>
          )}
        </div>
      </div>

      {/* Textura */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          <Palette className="h-3.5 w-3.5 text-neon-pink" /> Textura de fundo
        </div>
        <ImageDropzone
          url={s.texture}
          busy={textureBusy}
          onFile={onTexture}
          onClear={() => set("texture", "")}
        />
        <div className="mt-2 text-[10.5px] text-white/40">
          Imagem sutil e repetível funciona melhor. Recomendado 800×800 ou maior.
        </div>
        <div className="relative mt-3">
          <LinkIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            className={cn(inputCls, "h-9 pl-8 text-xs")}
            placeholder="ou cole uma URL"
            value={s.texture}
            onChange={(e) => set("texture", e.target.value)}
          />
        </div>

        {/* Presets */}
        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-white/40">Presets</div>
          <div className="grid grid-cols-4 gap-2">
            {TEXTURE_PRESETS.map((p) => {
              const active = (s.texture || "") === p.url;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => set("texture", p.url)}
                  className={cn(
                    "group relative flex aspect-square items-end overflow-hidden rounded-xl border p-1.5 text-left transition",
                    active
                      ? "border-neon-yellow ring-2 ring-neon-yellow/40"
                      : "border-white/10 hover:border-white/30",
                  )}
                  style={{
                    backgroundColor: "#0d0322",
                    backgroundImage: p.url ? `url(${p.url})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <span className="relative z-10 truncate text-[9px] font-bold text-white drop-shadow">
                    {p.label}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                  {active && (
                    <span className="absolute right-1 top-1 rounded-full bg-neon-yellow p-0.5 text-[oklch(0.15_0.10_305)]">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= Extras Tab ============================= */
function ExtrasTab() {
  const { data: products = [] } = useAllProducts();
  const { data: categories = [] } = useCategories();
  const update = useUpdateProductExtras();

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, import("@/data/menu").ExtraOption[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const catList = categories.filter((c) => c.id !== "all");
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, search]);

  const getList = (p: Product) => drafts[p.id] ?? p.extras ?? [];
  const setList = (id: string, list: import("@/data/menu").ExtraOption[]) =>
    setDrafts((d) => ({ ...d, [id]: list }));

  const dirty = (p: Product) => {
    const d = drafts[p.id];
    if (!d) return false;
    return JSON.stringify(d) !== JSON.stringify(p.extras ?? []);
  };

  const save = async (p: Product) => {
    setSavingId(p.id);
    try {
      await update.mutateAsync({ id: p.id, extras: getList(p) });
      setDrafts((d) => {
        const n = { ...d };
        delete n[p.id];
        return n;
      });
      toast.success("Complementos salvos");
    } catch {
      toast.error("Falha ao salvar");
    } finally {
      setSavingId(null);
    }
  };

  const discard = (id: string) =>
    setDrafts((d) => {
      const n = { ...d };
      delete n[id];
      return n;
    });

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-2xl font-black">Complementos</h2>
        <p className="text-xs text-white/50">
          Adicione, edite ou remova os adicionais pagos de cada produto.
        </p>
      </div>

      <GlobalExtrasSection />



      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={cn(inputCls, "w-auto")}
        >
          <option value="all">Todas categorias</option>
          {catList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
          Nenhum produto encontrado.
        </div>
      )}

      <div className="space-y-2">
        {visible.map((p) => {
          const list = getList(p);
          const isOpen = expanded === p.id;
          const isDirty = dirty(p);
          return (
            <div
              key={p.id}
              className="rounded-2xl border border-white/10 bg-white/5"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : p.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="truncate text-[11px] text-white/50">
                    {catList.find((c) => c.id === p.category)?.name ?? p.category} ·{" "}
                    {(p.extras?.length ?? 0)} complemento
                    {(p.extras?.length ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
                {isDirty && (
                  <span className="rounded-full bg-neon-yellow/20 px-2 py-0.5 text-[10px] font-bold uppercase text-neon-yellow">
                    Não salvo
                  </span>
                )}
                {isOpen ? (
                  <ArrowUp className="h-4 w-4 text-white/50" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-white/50" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-white/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] text-white/50">
                      Nome exibido e preço unitário do adicional.
                    </div>
                    <button
                      onClick={() =>
                        setList(p.id, [
                          ...list,
                          { id: `e${Date.now()}`, label: "Novo complemento", price: 0 },
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-3 py-1.5 text-xs font-bold text-neon-cyan hover:bg-neon-cyan/30"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </button>
                  </div>

                  <RowList
                    items={list}
                    onChange={(v) => setList(p.id, v)}
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

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {isDirty && (
                      <button
                        onClick={() => discard(p.id)}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
                      >
                        Descartar
                      </button>
                    )}
                    <button
                      onClick={() => save(p)}
                      disabled={!isDirty || savingId === p.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-neon-pink px-3 py-2 text-xs font-bold text-white glow-pink disabled:opacity-40"
                    >
                      {savingId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobalExtrasSection() {
  const { data: settings } = useSiteSettings();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<import("@/data/menu").ExtraOption[] | null>(null);
  const [saving, setSaving] = useState(false);

  const current = settings?.globalExtras ?? [];
  const list = draft ?? current;
  const isDirty = JSON.stringify(list) !== JSON.stringify(current);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await update.mutateAsync({ ...settings, globalExtras: list });
      setDraft(null);
      toast.success("Complementos globais salvos");
    } catch {
      toast.error("Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-black text-neon-cyan">
            Complementos globais
          </h3>
          <p className="text-[11px] text-white/60">
            Aparecem em <b>todos os produtos</b> automaticamente, junto com os complementos
            individuais do produto.
          </p>
        </div>
        <button
          onClick={() =>
            setDraft([
              ...list,
              { id: `g${Date.now()}`, label: "Novo complemento", price: 0 },
            ])
          }
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-neon-cyan/20 px-3 py-1.5 text-xs font-bold text-neon-cyan hover:bg-neon-cyan/30"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      <RowList
        items={list}
        onChange={(v) => setDraft(v)}
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
        emptyLabel="Nenhum complemento global. Clique em Adicionar."
      />

      {isDirty && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setDraft(null)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
          >
            Descartar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-neon-cyan px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[oklch(0.18_0.11_305)] disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
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
