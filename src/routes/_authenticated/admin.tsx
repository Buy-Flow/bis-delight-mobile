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

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((prev) => ({ ...prev, [k]: v }));

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
      active: true,
      sort_order: 0,
    };
    await upsert.mutateAsync(payload);
    toast.success(isNew ? "Produto criado!" : "Salvo!");
    onClose();
  };

  const remove = async () => {
    if (!confirm(`Remover "${p.name}"?`)) return;
    await del.mutateAsync(p.id);
    toast.success("Produto removido");
    onClose();
  };

  const onImage = async (file: File) => {
    setImageBusy(true);
    try {
      const url = await uploadProductImage(file);
      set("image", url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao subir imagem");
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[oklch(0.14_0.09_305)] p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-black">{isNew ? "Novo produto" : "Editar produto"}</h3>
          <button onClick={onClose} className="text-sm text-white/60 hover:text-white">Fechar</button>
        </div>

        <div className="space-y-3">
          <Field label="Nome">
            <input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select
                className={inputCls}
                value={p.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Preço base (R$)">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={p.basePrice}
                onChange={(e) => set("basePrice", Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              rows={2}
              className={inputCls}
              value={p.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <Field label="Imagem">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/40">
                {p.image ? <img src={p.image} className="h-full w-full object-cover" /> : null}
              </div>
              <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-white/20 px-3 py-2 text-center text-xs text-white/70 hover:bg-white/5">
                {imageBusy ? "Enviando..." : "Escolher imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImage(f);
                  }}
                />
              </label>
            </div>
            <input
              className={cn(inputCls, "mt-2 text-xs")}
              placeholder="ou cole uma URL da imagem"
              value={p.image}
              onChange={(e) => set("image", e.target.value)}
            />
          </Field>

          <Field label="Ingredientes (um por linha)">
            <textarea
              rows={3}
              className={inputCls}
              value={(p.ingredients ?? []).join("\n")}
              onChange={(e) => set("ingredients", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
            />
          </Field>

          <Field label="Tamanhos (label|preço extra) — um por linha">
            <textarea
              rows={3}
              className={inputCls}
              value={(p.sizes ?? []).map((s) => `${s.label}|${s.priceDelta}`).join("\n")}
              onChange={(e) =>
                set(
                  "sizes",
                  e.target.value
                    .split("\n")
                    .map((line, i) => {
                      const [label, price] = line.split("|");
                      if (!label?.trim()) return null;
                      return {
                        id: slugify(label) || `s${i}`,
                        label: label.trim(),
                        priceDelta: Number(price ?? 0) || 0,
                      };
                    })
                    .filter(Boolean) as Product["sizes"],
                )
              }
            />
          </Field>

          <Field label="Sabores (um por linha, opcional)">
            <textarea
              rows={2}
              className={inputCls}
              value={(p.flavors ?? []).join("\n")}
              onChange={(e) => set("flavors", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
            />
          </Field>

          <Field label="Complementos (label|preço) — um por linha">
            <textarea
              rows={3}
              className={inputCls}
              value={(p.extras ?? []).map((x) => `${x.label}|${x.price}`).join("\n")}
              onChange={(e) =>
                set(
                  "extras",
                  e.target.value
                    .split("\n")
                    .map((line, i) => {
                      const [label, price] = line.split("|");
                      if (!label?.trim()) return null;
                      return {
                        id: slugify(label) || `e${i}`,
                        label: label.trim(),
                        price: Number(price ?? 0) || 0,
                      };
                    })
                    .filter(Boolean) as Product["extras"],
                )
              }
            />
          </Field>

          <Field label="Ingredientes removíveis (um por linha, opcional)">
            <textarea
              rows={2}
              className={inputCls}
              value={(p.removable ?? []).join("\n")}
              onChange={(e) => set("removable", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Selo">
              <select
                className={inputCls}
                value={p.badge ?? ""}
                onChange={(e) => set("badge", (e.target.value || undefined) as Product["badge"])}
              >
                <option value="">Nenhum</option>
                <option value="Premium">Premium</option>
                <option value="Novidade">Novidade</option>
                <option value="Favorito">Favorito</option>
              </select>
            </Field>
            <Field label="Destaque na home">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
                <input
                  type="checkbox"
                  checked={!!p.hero}
                  onChange={(e) => set("hero", e.target.checked)}
                />
                <span className="text-xs">Aparecer em "Nossos Destaques"</span>
              </label>
            </Field>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={save}
              disabled={upsert.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink disabled:opacity-60"
            >
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
            {!isNew && (
              <button
                onClick={remove}
                className="grid h-12 w-12 place-items-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
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
