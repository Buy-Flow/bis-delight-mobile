import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Library,
  Search,
  Upload,
  Loader2,
  Star,
  Trash2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  HardDrive,
  Layers,
  Tag as TagIcon,
  X,
  Save,
  CheckSquare,
  Square,
  Grid3x3,
  List as ListIcon,
  ArrowDownAZ,
  ArrowUpDown,
  Filter,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsAdmin } from "@/lib/menu-data";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  component: BibliotecaPage,
});

type MediaItem = {
  id: string;
  name: string;
  storage_path: string;
  url: string;
  bucket: string;
  category: string | null;
  tags: string[];
  alt_text: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  usage_count: number;
  is_favorite: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["produto", "banner", "categoria", "popup", "logo", "outros"] as const;
type Category = (typeof CATEGORIES)[number];

type PendingUpload = {
  file: File;
  previewUrl: string;
  name: string;
  category: Category | "";
  tags: string;
  alt: string;
};


const BUCKET = "product-images";
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365 * 10; // 10y

type SortKey = "recent" | "oldest" | "name" | "size" | "usage";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function readImageDims(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function BibliotecaPage() {
  const { data: isAdmin } = useIsAdmin();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"todos" | Category>("todos");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pending, setPending] = useState<PendingUpload[] | null>(null);


  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setItems((data ?? []) as MediaItem[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar biblioteca");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsageCounts = useCallback(async () => {
    // Match products.image_url against media_library.url to compute usage_count.
    try {
      const { data: products } = await supabase
        .from("products")
        .select("image_url")
        .not("image_url", "is", null);
      const counts = new Map<string, number>();
      for (const p of products ?? []) {
        const url = (p as { image_url: string | null }).image_url;
        if (!url) continue;
        counts.set(url, (counts.get(url) ?? 0) + 1);
      }
      setItems((prev) =>
        prev.map((it) => ({ ...it, usage_count: counts.get(it.url) ?? 0 })),
      );
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!loading && items.length > 0) void refreshUsageCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const kpis = useMemo(() => {
    const totalSize = items.reduce((sum, i) => sum + (i.size_bytes ?? 0), 0);
    const unused = items.filter((i) => i.usage_count === 0).length;
    const favorites = items.filter((i) => i.is_favorite).length;
    const cats = new Set(items.map((i) => i.category).filter(Boolean)).size;
    return { total: items.length, totalSize, unused, favorites, cats };
  }, [items]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((i) => {
      if (categoryFilter !== "todos" && i.category !== categoryFilter) return false;
      if (onlyFavorites && !i.is_favorite) return false;
      if (onlyUnused && i.usage_count > 0) return false;
      if (activeTags.size > 0 && !Array.from(activeTags).every((t) => i.tags.includes(t))) return false;
      if (q) {
        const hay = `${i.name} ${i.alt_text ?? ""} ${i.tags.join(" ")} ${i.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        case "name":
          return a.name.localeCompare(b.name, "pt-BR");
        case "size":
          return (b.size_bytes ?? 0) - (a.size_bytes ?? 0);
        case "usage":
          return b.usage_count - a.usage_count;
        case "recent":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return list;
  }, [items, search, categoryFilter, onlyFavorites, onlyUnused, activeTags, sortKey]);

  const guessCategory = useCallback((filename: string): Category | "" => {
    const n = filename.toLowerCase();
    if (/(banner|hero|capa|cover)/.test(n)) return "banner";
    if (/(logo|marca|brand)/.test(n)) return "logo";
    if (/(popup|pop-up|modal)/.test(n)) return "popup";
    if (/(categoria|category|cat[-_])/.test(n)) return "categoria";
    if (/(produto|product|item|acai|shake|combo)/.test(n)) return "produto";
    return "";
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!isAdmin) {
        toast.error("Somente administradores podem enviar mídias");
        return;
      }
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) {
        toast.error("Nenhuma imagem válida selecionada");
        return;
      }
      const queue: PendingUpload[] = arr.map((file) => {
        const clean = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          name: clean.slice(0, 80) || "sem-nome",
          category: guessCategory(file.name),
          tags: "",
          alt: "",
        };
      });
      setPending(queue);
    },
    [isAdmin, guessCategory],
  );

  const cancelPending = useCallback(() => {
    setPending((prev) => {
      prev?.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return null;
    });
  }, []);

  const confirmUpload = useCallback(async () => {
    if (!pending || pending.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: pending.length });
    const { data: userData } = await supabase.auth.getUser();
    const uploaderId = userData.user?.id ?? null;
    let ok = 0;
    let fail = 0;
    for (const p of pending) {
      try {
        const ext = (p.file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, p.file, { upsert: false, cacheControl: "3600" });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_TTL_SECONDS);
        if (signErr || !signed?.signedUrl) throw signErr ?? new Error("URL falhou");
        const dims = await readImageDims(p.file);
        const tagsArr = p.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        const { error: insErr } = await supabase.from("media_library").insert({
          name: p.name.trim().slice(0, 80) || "sem-nome",
          storage_path: path,
          url: signed.signedUrl,
          bucket: BUCKET,
          mime_type: p.file.type,
          size_bytes: p.file.size,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          uploaded_by: uploaderId,
          category: p.category || null,
          tags: tagsArr,
          alt_text: p.alt.trim() || null,
        });
        if (insErr) throw insErr;
        ok++;
      } catch (err) {
        fail++;
        console.error("upload fail", err);
      }
      setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : null));
    }
    setUploading(false);
    setUploadProgress(null);
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending(null);
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? "mídia enviada" : "mídias enviadas"}`);
    if (fail > 0) toast.error(`${fail} envio(s) falharam`);
    await loadItems();
  }, [pending, loadItems]);


  const toggleSelect = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelection(new Set());

  const bulkDelete = async () => {
    if (selection.size === 0) return;
    if (!(await confirmDialog({ message: `Excluir ${selection.size} mídia(s)? Esta ação não pode ser desfeita.` }))) return;
    const ids = Array.from(selection);
    const toDelete = items.filter((i) => ids.includes(i.id));
    // Storage delete
    const paths = toDelete.map((i) => i.storage_path);
    await supabase.storage.from(BUCKET).remove(paths);
    const { error } = await supabase.from("media_library").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} mídia(s) excluída(s)`);
    clearSelection();
    await loadItems();
  };

  const deleteOne = async (item: MediaItem) => {
    if (!(await confirmDialog({ message: `Excluir "${item.name}"?` }))) return;
    await supabase.storage.from(BUCKET).remove([item.storage_path]);
    const { error } = await supabase.from("media_library").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mídia excluída");
    setActiveItem(null);
    await loadItems();
  };

  const toggleFavorite = async (item: MediaItem) => {
    const next = !item.is_favorite;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_favorite: next } : i)));
    if (activeItem?.id === item.id) setActiveItem({ ...item, is_favorite: next });
    const { error } = await supabase
      .from("media_library")
      .update({ is_favorite: next })
      .eq("id", item.id);
    if (error) toast.error(error.message);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const saveMeta = async (patch: Partial<MediaItem>) => {
    if (!activeItem) return;
    const { error } = await supabase
      .from("media_library")
      .update({
        name: patch.name ?? activeItem.name,
        category: patch.category ?? activeItem.category,
        tags: patch.tags ?? activeItem.tags,
        alt_text: patch.alt_text ?? activeItem.alt_text,
      })
      .eq("id", activeItem.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Alterações salvas");
    setItems((prev) => prev.map((i) => (i.id === activeItem.id ? { ...i, ...patch } : i)));
    setActiveItem((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 to-pink-500/10 ring-1 ring-fuchsia-400/30">
              <Library className="h-5 w-5 text-fuchsia-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Biblioteca de Mídias</h1>
              <p className="text-xs text-white/50">
                Repositório central de imagens reutilizáveis do seu site
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isAdmin || uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-bold shadow-[0_0_24px_rgba(236,72,153,0.35)] disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading && uploadProgress
                ? `Enviando ${uploadProgress.done}/${uploadProgress.total}`
                : "Enviar mídia"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          <KpiCard icon={<ImageIcon className="h-4 w-4" />} label="Total" value={kpis.total.toString()} tone="fuchsia" />
          <KpiCard icon={<HardDrive className="h-4 w-4" />} label="Armazenamento" value={formatBytes(kpis.totalSize)} tone="cyan" />
          <KpiCard icon={<Layers className="h-4 w-4" />} label="Categorias" value={kpis.cats.toString()} tone="amber" />
          <KpiCard icon={<Star className="h-4 w-4" />} label="Favoritas" value={kpis.favorites.toString()} tone="yellow" />
          <KpiCard icon={<Sparkles className="h-4 w-4" />} label="Não utilizadas" value={kpis.unused.toString()} tone="rose" />
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
          {/* Row 1: search + selects */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, tag ou alt…"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-9 text-sm outline-none focus:border-fuchsia-400/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "todos" | Category)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm outline-none"
            >
              <option value="todos">Todas categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm outline-none"
            >
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="name">Nome (A-Z)</option>
              <option value="size">Maior tamanho</option>
              <option value="usage">Mais usadas</option>
            </select>
          </div>

          {/* Row 2: filter chips + view */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                onlyFavorites
                  ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-200"
                  : "border-white/10 bg-white/[0.04] text-white/70",
              )}
            >
              <Star className="h-3.5 w-3.5" />
              Favoritas
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnused((v) => !v)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                onlyUnused
                  ? "border-rose-400/50 bg-rose-400/10 text-rose-200"
                  : "border-white/10 bg-white/[0.04] text-white/70",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Não usadas
            </button>
            {allTags.length > 0 && (
              <button
                type="button"
                onClick={() => setTagsOpen((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                  activeTags.size > 0
                    ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200"
                    : "border-white/10 bg-white/[0.04] text-white/70",
                )}
              >
                <TagIcon className="h-3.5 w-3.5" />
                Tags
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {activeTags.size > 0 ? `${activeTags.size}/${allTags.length}` : allTags.length}
                </span>
              </button>
            )}
            {(activeTags.size > 0 || onlyFavorites || onlyUnused || categoryFilter !== "todos" || search) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTags(new Set());
                  setOnlyFavorites(false);
                  setOnlyUnused(false);
                  setCategoryFilter("todos");
                  setSearch("");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 text-xs font-semibold text-white/60 hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </button>
            )}
            <div className="ml-auto inline-flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn("px-3 py-2", view === "grid" ? "bg-white/10 text-white" : "text-white/50")}
                aria-label="Grade"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn("px-3 py-2", view === "list" ? "bg-white/10 text-white" : "text-white/50")}
                aria-label="Lista"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Row 3: Tag chips (collapsible) */}
          {tagsOpen && allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
              {allTags.map((t) => {
                const active = activeTags.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setActiveTags((prev) => {
                        const next = new Set(prev);
                        if (next.has(t)) next.delete(t);
                        else next.add(t);
                        return next;
                      });
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                      active
                        ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10",
                    )}
                  >
                    <TagIcon className="h-3 w-3" />
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </div>



        {/* Selection bar */}
        {selection.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm">
            <CheckSquare className="h-4 w-4 text-fuchsia-300" />
            <span>{selection.size} selecionada(s)</span>
            <button
              type="button"
              onClick={bulkDelete}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        )}

        {/* Drop zone / empty */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-2xl border-2 border-dashed transition",
            dragActive
              ? "border-fuchsia-400/70 bg-fuchsia-500/10"
              : "border-white/10 bg-white/[0.02]",
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center py-24 text-white/50">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
                <ImageIcon className="h-6 w-6 text-white/40" />
              </div>
              <div>
                <div className="font-semibold">Nenhuma mídia encontrada</div>
                <div className="text-xs text-white/40">
                  Arraste imagens aqui ou clique em "Enviar mídia"
                </div>
              </div>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  selected={selection.has(item.id)}
                  onSelect={() => toggleSelect(item.id)}
                  onOpen={() => setActiveItem(item)}
                  onToggleFav={() => toggleFavorite(item)}
                  onCopy={() => copyUrl(item.url)}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((item) => (
                <MediaRow
                  key={item.id}
                  item={item}
                  selected={selection.has(item.id)}
                  onSelect={() => toggleSelect(item.id)}
                  onOpen={() => setActiveItem(item)}
                  onToggleFav={() => toggleFavorite(item)}
                  onCopy={() => copyUrl(item.url)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <MediaDetailDialog
        item={activeItem}
        onClose={() => setActiveItem(null)}
        onSave={saveMeta}
        onDelete={deleteOne}
        onToggleFav={toggleFavorite}
        onCopy={copyUrl}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "fuchsia" | "cyan" | "amber" | "yellow" | "rose";
}) {
  const toneMap: Record<string, string> = {
    fuchsia: "from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-200 ring-fuchsia-400/20",
    cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-200 ring-cyan-400/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-200 ring-amber-400/20",
    yellow: "from-yellow-400/20 to-yellow-400/5 text-yellow-200 ring-yellow-400/20",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-200 ring-rose-400/20",
  };
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br p-3 ring-1", toneMap[tone])}>
      <div className="flex items-center gap-2 text-xs opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-black tracking-tight sm:text-xl">{value}</div>
    </div>
  );
}

function MediaCard({
  item,
  selected,
  onSelect,
  onOpen,
  onToggleFav,
  onCopy,
}: {
  item: MediaItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleFav: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition",
        selected
          ? "border-fuchsia-400/70 ring-2 ring-fuchsia-400/40"
          : "border-white/10 hover:border-white/25",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full overflow-hidden bg-white/[0.03]"
      >
        <img
          src={item.url}
          alt={item.alt_text ?? item.name}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </button>

      <button
        type="button"
        onClick={onSelect}
        aria-label="Selecionar"
        className={cn(
          "absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-lg border transition",
          selected
            ? "border-fuchsia-400 bg-fuchsia-500 text-white"
            : "border-white/20 bg-black/50 text-white/70 opacity-0 group-hover:opacity-100",
        )}
      >
        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={onToggleFav}
        aria-label="Favoritar"
        className={cn(
          "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg border transition",
          item.is_favorite
            ? "border-yellow-400/70 bg-yellow-400/20 text-yellow-200"
            : "border-white/20 bg-black/50 text-white/70 opacity-0 group-hover:opacity-100",
        )}
      >
        <Star className={cn("h-4 w-4", item.is_favorite && "fill-current")} />
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
        <div className="truncate text-[11px] font-semibold">{item.name}</div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-white/60">
          <span>
            {item.width && item.height ? `${item.width}×${item.height}` : "—"}
          </span>
          <span>{formatBytes(item.size_bytes)}</span>
        </div>
        {item.usage_count > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
            {item.usage_count} uso{item.usage_count > 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copiar URL"
          className="grid h-7 w-7 place-items-center rounded-lg border border-white/20 bg-black/60 text-white/80 hover:bg-black/80"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function MediaRow({
  item,
  selected,
  onSelect,
  onOpen,
  onToggleFav,
  onCopy,
}: {
  item: MediaItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleFav: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03]",
        selected && "bg-fuchsia-500/10",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "grid h-6 w-6 place-items-center rounded-md border",
          selected ? "border-fuchsia-400 bg-fuchsia-500 text-white" : "border-white/20 text-white/50",
        )}
      >
        {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={onOpen} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
        <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block truncate text-sm font-semibold hover:text-fuchsia-200"
        >
          {item.name}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
          {item.category && <span className="rounded bg-white/5 px-1.5 py-0.5">{item.category}</span>}
          <span>{item.width && item.height ? `${item.width}×${item.height}` : "—"}</span>
          <span>{formatBytes(item.size_bytes)}</span>
          {item.usage_count > 0 && (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">
              {item.usage_count} uso{item.usage_count > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleFav}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg border",
          item.is_favorite
            ? "border-yellow-400/70 bg-yellow-400/20 text-yellow-200"
            : "border-white/10 text-white/50 hover:text-white",
        )}
      >
        <Star className={cn("h-4 w-4", item.is_favorite && "fill-current")} />
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:text-white"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

function MediaDetailDialog({
  item,
  onClose,
  onSave,
  onDelete,
  onToggleFav,
  onCopy,
}: {
  item: MediaItem | null;
  onClose: () => void;
  onSave: (patch: Partial<MediaItem>) => void;
  onDelete: (item: MediaItem) => void;
  onToggleFav: (item: MediaItem) => void;
  onCopy: (url: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [alt, setAlt] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category ?? "");
      setTags(item.tags);
      setAlt(item.alt_text ?? "");
      setTagInput("");
    }
  }, [item?.id]);

  if (!item) return null;

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl border-white/10 bg-[#0d0d14] p-0 text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-black/40 p-4">
            <div className="aspect-square overflow-hidden rounded-xl bg-white/5">
              <img src={item.url} alt={item.alt_text ?? item.name} className="h-full w-full object-contain" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-white/60">
              <div className="rounded-lg bg-white/5 py-2">
                <div className="font-semibold text-white">
                  {item.width && item.height ? `${item.width}×${item.height}` : "—"}
                </div>
                <div>Dimensões</div>
              </div>
              <div className="rounded-lg bg-white/5 py-2">
                <div className="font-semibold text-white">{formatBytes(item.size_bytes)}</div>
                <div>Tamanho</div>
              </div>
              <div className="rounded-lg bg-white/5 py-2">
                <div className="font-semibold text-white">{item.usage_count}</div>
                <div>Usos</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-white/40">Detalhes</div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onToggleFav(item)}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg border",
                    item.is_favorite
                      ? "border-yellow-400/70 bg-yellow-400/20 text-yellow-200"
                      : "border-white/10 text-white/60",
                  )}
                >
                  <Star className={cn("h-4 w-4", item.is_favorite && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={() => onCopy(item.url)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:text-white"
                  aria-label="Copiar URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:text-white"
                  aria-label="Abrir"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            <Field label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-fuchsia-400/50"
              />
            </Field>

            <Field label="Categoria">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none"
              >
                <option value="">Sem categoria</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Texto alternativo (alt)">
              <input
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Descrição para acessibilidade e SEO"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-fuchsia-400/50"
              />
            </Field>

            <Field label="Tags">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                <div className="mb-2 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] text-fuchsia-200"
                    >
                      {t}
                      <button type="button" onClick={() => removeTag(t)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Nova tag + Enter"
                    className="h-8 flex-1 rounded-md border border-white/10 bg-black/20 px-2 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="rounded-md bg-white/10 px-2 text-xs hover:bg-white/20"
                  >
                    Add
                  </button>
                </div>
              </div>
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  onSave({
                    name: name.trim() || item.name,
                    category: category || null,
                    tags,
                    alt_text: alt.trim() || null,
                  })
                }
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-sm font-bold shadow-[0_0_18px_rgba(236,72,153,0.35)]"
              >
                <Save className="h-4 w-4" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/30"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-[10px] text-white/40">
              <div className="truncate">
                <span className="text-white/60">Storage:</span> {item.bucket}/{item.storage_path}
              </div>
              <div>Criado: {new Date(item.created_at).toLocaleString("pt-BR")}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </div>
      {children}
    </label>
  );
}

// Unused imports guard-out (prevent lint) — types re-exported explicitly
export type { MediaItem };
// keep ArrowDown icons imported for future sort UI
void ArrowDownAZ;
void ArrowUpDown;
