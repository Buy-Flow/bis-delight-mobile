import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Layers,
  Search,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Pencil,
  Copy,
  Save,
  X,
  Filter,
  Loader2,
  ImageIcon,
  ArrowDownAZ,
  Flame,
  Upload,
  Tag as TagIcon,
  TrendingUp,
  BadgeCheck,
  User as UserIcon,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { shortUid } from "@/lib/uid";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useCategories,
  useUpsertProduct,
  useIsAdmin,
  uploadProductImage,
  type ProductInput,
} from "@/lib/menu-data";

export const Route = createFileRoute("/_authenticated/modelos")({
  component: ModelosPage,
});

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  base_price: number;
  cost_price: number | null;
  packaging_cost: number | null;
  target_margin_pct: number | null;
  tags: string[] | null;
  is_official: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Filter = "todos" | "oficiais" | "meus";
type SortKey = "populares" | "recentes" | "preco_asc" | "preco_desc" | "nome";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ============================ Page ============================ */

function ModelosPage() {
  const { data: isAdmin } = useIsAdmin();
  const { data: categories = [] } = useCategories();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [category, setCategory] = useState<string>("todas");
  const [tag, setTag] = useState<string>("todas");
  const [sort, setSort] = useState<SortKey>("populares");

  const [applying, setApplying] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = await client
      .from("product_templates")
      .select("*")
      .order("is_official", { ascending: false })
      .order("usage_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar modelos: " + error.message);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Derived
  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => (it.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.category && set.add(it.category));
    categories.forEach((c) => c.name !== "Tudo" && set.add(c.name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items, categories]);

  const filtered = useMemo(() => {
    let list = items.slice();
    if (filter === "oficiais") list = list.filter((t) => t.is_official);
    if (filter === "meus") list = list.filter((t) => !t.is_official && t.created_by && t.created_by === userId);
    if (category !== "todas") list = list.filter((t) => (t.category ?? "").toLowerCase() === category.toLowerCase());
    if (tag !== "todas") list = list.filter((t) => (t.tags ?? []).includes(tag));
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          (t.description ?? "").toLowerCase().includes(needle) ||
          (t.tags ?? []).some((tg) => tg.toLowerCase().includes(needle)),
      );
    }
    list.sort((a, b) => {
      switch (sort) {
        case "populares":
          return (b.usage_count - a.usage_count) || (Number(b.is_official) - Number(a.is_official));
        case "recentes":
          return +new Date(b.created_at) - +new Date(a.created_at);
        case "preco_asc":
          return a.base_price - b.base_price;
        case "preco_desc":
          return b.base_price - a.base_price;
        case "nome":
          return a.name.localeCompare(b.name, "pt-BR");
      }
    });
    return list;
  }, [items, filter, category, tag, q, sort, userId]);

  const kpis = useMemo(() => {
    const total = items.length;
    const oficiais = items.filter((t) => t.is_official).length;
    const meus = items.filter((t) => !t.is_official && t.created_by === userId).length;
    const totalUso = items.reduce((s, t) => s + t.usage_count, 0);
    return { total, oficiais, meus, totalUso };
  }, [items, userId]);

  const onDelete = async (t: Template) => {
    if (!confirm(`Remover modelo "${t.name}"? Essa ação não pode ser desfeita.`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { error } = await client.from("product_templates").delete().eq("id", t.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Modelo removido");
    load();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-16 pt-4 sm:pt-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-950/60 via-[#1a0324]/70 to-purple-950/50 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                <Layers className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Modelos de Produto</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Catálogo pronto para você lançar novos produtos em segundos. Modelos oficiais já vêm com custos e margem sugerida —
              é só clicar em <strong className="text-white">Adicionar ao cardápio</strong> e ajustar o que quiser.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setCreatingNew(true)}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(236,72,153,0.6)] transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Novo modelo
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Layers} label="Total de modelos" value={kpis.total} tone="fuchsia" />
        <KpiCard icon={BadgeCheck} label="Oficiais" value={kpis.oficiais} tone="emerald" />
        <KpiCard icon={UserIcon} label="Meus modelos" value={kpis.meus} tone="sky" />
        <KpiCard icon={TrendingUp} label="Aplicações" value={kpis.totalUso} tone="amber" hint="produtos criados a partir de modelos" />
      </div>

      {/* Filters bar */}
      <div className="rounded-2xl border border-white/10 bg-[#160121]/70 p-3 shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="flex flex-col gap-3">
          {/* segmented + search */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl bg-white/5 p-1 text-xs font-semibold ring-1 ring-white/10">
              {(["todos", "oficiais", "meus"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 capitalize transition",
                    filter === f ? "bg-fuchsia-500/90 text-white shadow" : "text-white/60 hover:text-white",
                  )}
                >
                  {f === "todos" ? "Todos" : f === "oficiais" ? "Oficiais" : "Meus"}
                </button>
              ))}
            </div>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, descrição ou tag…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-fuchsia-500/60"
              />
            </div>

            <div className="flex items-center gap-2">
              <SortDropdown value={sort} onChange={setSort} />
            </div>
          </div>

          {/* category + tag chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              <Filter className="h-3 w-3" /> Categoria
            </span>
            <Chip active={category === "todas"} onClick={() => setCategory("todas")}>
              Todas
            </Chip>
            {allCategories.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                <TagIcon className="h-3 w-3" /> Tag
              </span>
              <Chip active={tag === "todas"} onClick={() => setTag("todas")}>
                Todas
              </Chip>
              {allTags.map((t) => (
                <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-white/60">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando modelos…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-white/60">
          <Layers className="mx-auto mb-2 h-8 w-8 text-white/30" />
          <p>Nenhum modelo encontrado com esses filtros.</p>
          {isAdmin && (
            <button
              onClick={() => setCreatingNew(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-fuchsia-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
            >
              <Plus className="h-4 w-4" /> Criar meu primeiro modelo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              isMine={!!userId && t.created_by === userId}
              isAdmin={!!isAdmin}
              onApply={() => setApplying(t)}
              onEdit={() => setEditing(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      {applying && (
        <ApplyDialog
          template={applying}
          onClose={() => setApplying(null)}
          onApplied={() => {
            setApplying(null);
            load();
          }}
        />
      )}
      {editing && isAdmin && (
        <TemplateEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {creatingNew && isAdmin && (
        <TemplateEditor
          initial={null}
          onClose={() => setCreatingNew(false)}
          onSaved={() => {
            setCreatingNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ============================ KPI ============================ */

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: typeof Layers;
  label: string;
  value: number | string;
  tone: "fuchsia" | "emerald" | "sky" | "amber";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    fuchsia: "from-fuchsia-500/15 to-fuchsia-500/0 text-fuchsia-300 ring-fuchsia-500/25",
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-300 ring-emerald-500/25",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-300 ring-sky-500/25",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-300 ring-amber-500/25",
  };
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-white/5 ring-1", tones[tone].split(" ").pop())}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/60">{label}</div>
      {hint && <div className="mt-1 text-[10px] text-white/40">{hint}</div>}
    </div>
  );
}

/* ============================ Chip ============================ */

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition",
        active
          ? "border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-200"
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/* ============================ Sort ============================ */

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const opts: { k: SortKey; label: string; icon: typeof Star }[] = [
    { k: "populares", label: "Mais populares", icon: Flame },
    { k: "recentes", label: "Recentes", icon: Sparkles },
    { k: "preco_asc", label: "Preço ↑", icon: ArrowDownAZ },
    { k: "preco_desc", label: "Preço ↓", icon: ArrowDownAZ },
    { k: "nome", label: "Nome A-Z", icon: ArrowDownAZ },
  ];
  const cur = opts.find((o) => o.k === value)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-white/20"
      >
        <cur.icon className="h-3.5 w-3.5" /> {cur.label} <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#1a0324] p-1 shadow-2xl">
            {opts.map((o) => (
              <button
                key={o.k}
                onClick={() => {
                  onChange(o.k);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium",
                  value === o.k ? "bg-fuchsia-500/20 text-fuchsia-200" : "text-white/80 hover:bg-white/5",
                )}
              >
                <o.icon className="h-3.5 w-3.5" /> {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ Card ============================ */

function TemplateCard({
  t,
  isMine,
  isAdmin,
  onApply,
  onEdit,
  onDelete,
}: {
  t: Template;
  isMine: boolean;
  isAdmin: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const margin =
    t.cost_price != null && t.base_price > 0
      ? ((t.base_price - (t.cost_price ?? 0) - (t.packaging_cost ?? 0)) / t.base_price) * 100
      : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#160121]/80 shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] transition hover:border-fuchsia-500/40 hover:shadow-[0_20px_45px_-15px_rgba(236,72,153,0.35)]">
      {/* Media */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-fuchsia-950/60 via-purple-950/50 to-[#1a0324]">
        {t.image_url ? (
          <img
            src={t.image_url}
            alt={t.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/25">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {t.is_official ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              <BadgeCheck className="h-3 w-3" /> Oficial
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              <UserIcon className="h-3 w-3" /> Personalizado
            </span>
          )}
          {t.usage_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
              <Flame className="h-3 w-3 text-amber-400" /> {t.usage_count}
            </span>
          )}
        </div>
        {/* Price */}
        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-3 py-1 text-sm font-bold text-white shadow-lg backdrop-blur">
          {fmtBRL(Number(t.base_price ?? 0))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-white">{t.name}</h3>
          {t.category && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
              {t.category}
            </span>
          )}
        </div>
        {t.description && <p className="line-clamp-2 text-xs text-white/60">{t.description}</p>}

        {/* Tags */}
        {t.tags && t.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {t.tags.slice(0, 4).map((tg) => (
              <span
                key={tg}
                className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200"
              >
                {tg}
              </span>
            ))}
          </div>
        )}

        {/* Meta line: margin */}
        {margin != null && (
          <div className="mt-1 flex items-center gap-3 text-[11px] text-white/50">
            <span>
              Margem{" "}
              <strong className={cn(margin >= 50 ? "text-emerald-300" : margin >= 30 ? "text-amber-300" : "text-rose-300")}>
                {margin.toFixed(0)}%
              </strong>
            </span>
            {t.cost_price != null && <span>Custo {fmtBRL(Number(t.cost_price))}</span>}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1.5 pt-2">
          <button
            onClick={onApply}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-2 text-xs font-bold text-white shadow-[0_8px_20px_-8px_rgba(236,72,153,0.7)] transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar ao cardápio
          </button>
          {(isAdmin || isMine) && (
            <>
              <button
                onClick={onEdit}
                title="Editar modelo"
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:border-fuchsia-500/40 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                title="Remover modelo"
                className="grid h-9 w-9 place-items-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ Apply Dialog ============================ */

function ApplyDialog({
  template,
  onClose,
  onApplied,
}: {
  template: Template;
  onClose: () => void;
  onApplied: () => void;
}) {
  const upsert = useUpsertProduct();
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState(template.name);
  const [category, setCategory] = useState(template.category ?? categories.find((c) => c.name !== "Tudo")?.name ?? "");
  const [price, setPrice] = useState<number>(Number(template.base_price ?? 0));
  const [cost, setCost] = useState<number | "">(template.cost_price ?? "");
  const [packaging, setPackaging] = useState<number | "">(template.packaging_cost ?? "");
  const [description, setDescription] = useState(template.description ?? "");
  const [busy, setBusy] = useState(false);

  const margin =
    price > 0 && cost !== ""
      ? ((price - Number(cost || 0) - Number(packaging || 0)) / price) * 100
      : null;

  const apply = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    if (!category) return toast.error("Categoria obrigatória");
    if (price <= 0) return toast.error("Informe um preço");
    setBusy(true);
    try {
      const baseId = slugify(name);
      const id = `${baseId}-${shortUid(6)}`;
      const payload: ProductInput = {
        id,
        name: name.trim(),
        category,
        image_url: template.image_url ?? null,
        description: description || "",
        ingredients: [],
        base_price: Number(price) || 0,
        sizes: [],
        flavors: null,
        extras: null,
        removable: null,
        badge: null,
        hero: false,
        image_pos_x: 0,
        image_pos_y: 0,
        image_scale: 1.1,
        is_custom: false,
        option_groups: null,
        is_upsell: false,
        upsell_price: null,
        stock: null,
        low_stock_threshold: 5,
        paused_until: null,
        pause_reason: null,
        active: true,
        sort_order: 999999,
      };
      await upsert.mutateAsync(payload);

      // enrich extra fields not covered by ProductInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      await client
        .from("products")
        .update({
          cost_price: cost === "" ? null : Number(cost),
          packaging_cost: packaging === "" ? null : Number(packaging),
          target_margin_pct: template.target_margin_pct,
        })
        .eq("id", id);

      await client
        .from("product_templates")
        .update({ usage_count: (template.usage_count ?? 0) + 1 })
        .eq("id", template.id);

      toast.success(`"${name}" adicionado ao cardápio!`);
      onApplied();
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error("Erro ao adicionar: " + ((e as any)?.message ?? "desconhecido"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#160121] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-fuchsia-400" /> Adicionar ao cardápio
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="relative h-40 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-950/60 to-purple-950/40 sm:h-full">
            {template.image_url ? (
              <img src={template.image_url} alt={template.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-white/25">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Field label="Nome do produto">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
              />
            </Field>
            <Field label="Categoria">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {categories
                  .filter((c) => c.name !== "Tudo")
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                {template.category && !categories.some((c) => c.name === template.category) && (
                  <option value={template.category}>{template.category} (novo)</option>
                )}
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Preço">
                <input
                  type="number"
                  step="0.10"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
              <Field label="Custo">
                <input
                  type="number"
                  step="0.10"
                  value={cost}
                  onChange={(e) => setCost(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
              <Field label="Embalagem">
                <input
                  type="number"
                  step="0.10"
                  value={packaging}
                  onChange={(e) => setPackaging(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
            </div>

            <Field label="Descrição">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
              />
            </Field>

            {margin != null && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <span className="text-white/60">Margem calculada</span>
                <span className={cn("font-bold", margin >= 50 ? "text-emerald-300" : margin >= 30 ? "text-amber-300" : "text-rose-300")}>
                  {margin.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar ao cardápio
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Editor ============================ */

function TemplateEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [price, setPrice] = useState<number>(Number(initial?.base_price ?? 0));
  const [cost, setCost] = useState<number | "">(initial?.cost_price ?? "");
  const [packaging, setPackaging] = useState<number | "">(initial?.packaging_cost ?? "");
  const [targetMargin, setTargetMargin] = useState<number | "">(initial?.target_margin_pct ?? "");
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(", "));
  const [isOfficial, setIsOfficial] = useState(initial?.is_official ?? false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setImageUrl(url);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error("Erro no upload: " + ((e as any)?.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    if (price <= 0) return toast.error("Informe um preço");
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description || null,
      category: category || null,
      image_url: imageUrl || null,
      base_price: Number(price),
      cost_price: cost === "" ? null : Number(cost),
      packaging_cost: packaging === "" ? null : Number(packaging),
      target_margin_pct: targetMargin === "" ? null : Number(targetMargin),
      tags: tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      is_official: isOfficial,
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      if (isNew) {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await client
          .from("product_templates")
          .insert({ ...payload, created_by: userData.user?.id ?? null });
        if (error) throw error;
      } else {
        const { error } = await client.from("product_templates").update(payload).eq("id", initial!.id);
        if (error) throw error;
      }
      toast.success(isNew ? "Modelo criado!" : "Modelo atualizado!");
      onSaved();
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error("Erro ao salvar: " + ((e as any)?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#160121] text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {isNew ? <Plus className="h-5 w-5 text-fuchsia-400" /> : <Pencil className="h-5 w-5 text-fuchsia-400" />}
            {isNew ? "Novo modelo" : "Editar modelo"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          {/* Image */}
          <div>
            <div className="relative h-52 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-950/60 to-purple-950/40">
              {imageUrl ? (
                <img src={imageUrl} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-white/25">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Enviando…" : "Enviar imagem"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="ou cole uma URL"
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/80 outline-none focus:border-fuchsia-500/60"
            />
          </div>

          {/* Form */}
          <div className="space-y-3">
            <Field label="Nome do modelo">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
              />
            </Field>
            <Field label="Descrição">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Preço sug.">
                <input
                  type="number"
                  step="0.10"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
              <Field label="Custo">
                <input
                  type="number"
                  step="0.10"
                  value={cost}
                  onChange={(e) => setCost(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
              <Field label="Embalagem">
                <input
                  type="number"
                  step="0.10"
                  value={packaging}
                  onChange={(e) => setPackaging(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
              <Field label="Margem alvo %">
                <input
                  type="number"
                  step="1"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Categoria">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex.: Açaí, Milkshakes…"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
              <Field label="Tags (separadas por vírgula)">
                <input
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="fit, promoção, family"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={isOfficial}
                onChange={(e) => setIsOfficial(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              Marcar como modelo <strong className="text-emerald-300">oficial</strong> (aparece para toda a equipe)
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Criar modelo" : "Salvar alterações"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Small ============================ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</span>
      {children}
    </label>
  );
}
