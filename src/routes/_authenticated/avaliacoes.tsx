import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Star,
  Search,
  MessageSquare,
  MessageSquareReply,
  EyeOff,
  Eye,
  Trash2,
  Filter,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  X,
  Loader2,
  Download,
  ArrowUpDown,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/avaliacoes")({
  component: AvaliacoesPage,
});

type ReviewStatus = "published" | "hidden" | "pending";

type Review = {
  id: string;
  user_id: string;
  order_id: string | null;
  product_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  photos: string[] | null;
  status: ReviewStatus;
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  featured?: boolean | null;
  created_at: string;
  updated_at: string;
  // joined:
  profile?: { full_name: string | null; phone: string | null } | null;
  product?: { name: string | null; image_url: string | null } | null;
};

type StatusFilter = "todas" | ReviewStatus | "sem_resposta" | "com_foto" | "destacadas";
type SortKey = "recent" | "old" | "rating_desc" | "rating_asc" | "no_reply";

const STAR_COLORS = ["#ef4444", "#f97316", "#facc15", "#84cc16", "#22c55e"];

function AvaliacoesPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Review | null>(null);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = await client
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar avaliações: " + error.message);
      setLoading(false);
      return;
    }
    const rows: Review[] = data ?? [];

    // hydrate profiles & products
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const productIds = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]));
    const [profRes, prodRes] = await Promise.all([
      userIds.length
        ? client.from("profiles").select("id, full_name, phone").in("id", userIds)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? client.from("products").select("id, name, image_url").in("id", productIds)
        : Promise.resolve({ data: [] }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profMap = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p]));
    setReviews(
      rows.map((r) => ({
        ...r,
        profile: (profMap.get(r.user_id) as Review["profile"]) ?? null,
        product: r.product_id
          ? ((prodMap.get(r.product_id) as Review["product"]) ?? null)
          : null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // realtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel("reviews-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => load())
      .subscribe();
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++;
    });
    const semResposta = reviews.filter((r) => !r.reply && r.status === "published").length;
    const ocultas = reviews.filter((r) => r.status === "hidden").length;
    const comFoto = reviews.filter((r) => (r.photos?.length ?? 0) > 0).length;
    const now = Date.now();
    const last30 = reviews.filter((r) => now - new Date(r.created_at).getTime() < 30 * 24 * 3600 * 1000);
    const nps = last30.length
      ? Math.round(
          ((last30.filter((r) => r.rating >= 4).length - last30.filter((r) => r.rating <= 2).length) /
            last30.length) *
            100,
        )
      : 0;
    return { total, avg, dist, semResposta, ocultas, comFoto, last30: last30.length, nps };
  }, [reviews]);

  const filtered = useMemo(() => {
    let out = reviews;
    if (statusFilter === "published" || statusFilter === "hidden" || statusFilter === "pending") {
      out = out.filter((r) => r.status === statusFilter);
    } else if (statusFilter === "sem_resposta") {
      out = out.filter((r) => !r.reply);
    } else if (statusFilter === "com_foto") {
      out = out.filter((r) => (r.photos?.length ?? 0) > 0);
    } else if (statusFilter === "destacadas") {
      out = out.filter((r) => r.featured);
    }
    if (ratingFilter) out = out.filter((r) => r.rating === ratingFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.comment?.toLowerCase().includes(q) ||
          r.profile?.full_name?.toLowerCase().includes(q) ||
          r.product?.name?.toLowerCase().includes(q) ||
          r.reply?.toLowerCase().includes(q),
      );
    }
    switch (sort) {
      case "old":
        out = [...out].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        break;
      case "rating_desc":
        out = [...out].sort((a, b) => b.rating - a.rating || +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "rating_asc":
        out = [...out].sort((a, b) => a.rating - b.rating || +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "no_reply":
        out = [...out].sort((a, b) => Number(!!a.reply) - Number(!!b.reply));
        break;
      default:
        out = [...out].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return out;
  }, [reviews, statusFilter, ratingFilter, query, sort]);

  const updateOne = async (id: string, patch: Partial<Review>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("reviews").update(patch).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Atualizado!");
      load();
    }
  };

  const removeOne = async (id: string) => {
    if (!confirm("Apagar esta avaliação? Esta ação não pode ser desfeita.")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("reviews").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Apagada.");
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      load();
    }
  };

  const bulk = async (action: "publish" | "hide" | "delete") => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (action === "delete") {
      if (!confirm(`Apagar ${ids.length} avaliações? Ação irreversível.`)) return;
      const { error } = await client.from("reviews").delete().in("id", ids);
      if (error) return toast.error(error.message);
    } else {
      const status = action === "publish" ? "published" : "hidden";
      const { error } = await client.from("reviews").update({ status }).in("id", ids);
      if (error) return toast.error(error.message);
    }
    toast.success(`${ids.length} avaliações atualizadas.`);
    setSelected(new Set());
    load();
  };

  const exportCSV = () => {
    const rows = [
      ["Data", "Cliente", "Nota", "Título", "Comentário", "Produto", "Pedido", "Status", "Resposta"].join(","),
      ...filtered.map((r) =>
        [
          new Date(r.created_at).toLocaleString("pt-BR"),
          r.profile?.full_name ?? "",
          r.rating,
          r.title ?? "",
          (r.comment ?? "").replace(/[\r\n,]/g, " "),
          r.product?.name ?? "",
          r.order_id?.slice(0, 8) ?? "",
          r.status,
          (r.reply ?? "").replace(/[\r\n,]/g, " "),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `avaliacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="min-h-full bg-[#0e0a1a] pb-24 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-neon-pink/80">
              <Sparkles className="h-3 w-3" /> Central de reputação
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              Avaliações{" "}
              <span className="bg-gradient-to-r from-neon-pink to-fuchsia-400 bg-clip-text text-transparent">
                dos clientes
              </span>
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Modere, responda e transforme feedback em crescimento.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            icon={<Star className="h-4 w-4" />}
            label="Nota média"
            value={kpis.avg.toFixed(2)}
            hint={`${kpis.total} avaliações`}
            accent="from-yellow-400/30 to-yellow-500/10"
            iconColor="text-yellow-300"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="NPS 30d"
            value={`${kpis.nps > 0 ? "+" : ""}${kpis.nps}`}
            hint={`${kpis.last30} nos últimos 30d`}
            accent="from-emerald-400/30 to-emerald-500/10"
            iconColor="text-emerald-300"
          />
          <KpiCard
            icon={<MessageSquareReply className="h-4 w-4" />}
            label="Sem resposta"
            value={String(kpis.semResposta)}
            hint="Ação recomendada"
            accent="from-neon-pink/30 to-fuchsia-500/10"
            iconColor="text-neon-pink"
          />
          <KpiCard
            icon={<EyeOff className="h-4 w-4" />}
            label="Ocultas"
            value={String(kpis.ocultas)}
            hint={`${kpis.comFoto} com foto`}
            accent="from-cyan-400/30 to-cyan-500/10"
            iconColor="text-cyan-300"
          />
        </section>

        {/* Distribution */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-neon-pink" />
            <h2 className="text-sm font-black uppercase tracking-wider text-white/80">
              Distribuição por nota
            </h2>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = kpis.dist[n - 1];
              const pct = kpis.total ? (count / kpis.total) * 100 : 0;
              return (
                <button
                  key={n}
                  onClick={() => setRatingFilter(ratingFilter === n ? null : n)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5",
                    ratingFilter === n && "bg-white/10",
                  )}
                >
                  <div className="flex w-12 items-center gap-0.5 text-xs font-bold text-white/70">
                    {n} <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                  </div>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: STAR_COLORS[n - 1],
                        boxShadow: `0 0 10px ${STAR_COLORS[n - 1]}80`,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-xs font-bold tabular-nums text-white/60">
                    {count} <span className="text-white/40">({pct.toFixed(0)}%)</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filters bar */}
        <section className="mt-4 flex flex-wrap items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente, comentário ou produto…"
              className="w-full rounded-full border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
            />
          </div>
          <FilterChip active={statusFilter === "todas"} onClick={() => setStatusFilter("todas")}>
            <Filter className="h-3 w-3" /> Todas
          </FilterChip>
          <FilterChip active={statusFilter === "published"} onClick={() => setStatusFilter("published")}>
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Publicadas
          </FilterChip>
          <FilterChip active={statusFilter === "hidden"} onClick={() => setStatusFilter("hidden")}>
            <EyeOff className="h-3 w-3 text-white/60" /> Ocultas
          </FilterChip>
          <FilterChip active={statusFilter === "sem_resposta"} onClick={() => setStatusFilter("sem_resposta")}>
            <AlertCircle className="h-3 w-3 text-neon-pink" /> Sem resposta
          </FilterChip>
          <FilterChip active={statusFilter === "com_foto"} onClick={() => setStatusFilter("com_foto")}>
            <ImageIcon className="h-3 w-3" /> Com foto
          </FilterChip>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-white/80 focus:border-neon-pink focus:outline-none"
          >
            <option value="recent">Mais recentes</option>
            <option value="old">Mais antigas</option>
            <option value="rating_desc">Nota: maior</option>
            <option value="rating_asc">Nota: menor</option>
            <option value="no_reply">Sem resposta primeiro</option>
          </select>
          {(ratingFilter || query || statusFilter !== "todas") && (
            <button
              onClick={() => {
                setRatingFilter(null);
                setQuery("");
                setStatusFilter("todas");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/60 hover:bg-white/10"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </section>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="sticky top-2 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-neon-pink/40 bg-[#1a0b2e]/95 p-3 shadow-lg shadow-neon-pink/20 backdrop-blur">
            <div className="text-xs font-bold text-white">
              {selected.size} selecionadas
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => bulk("publish")}
                className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                Publicar
              </button>
              <button
                onClick={() => bulk("hide")}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15"
              >
                Ocultar
              </button>
              <button
                onClick={() => bulk("delete")}
                className="rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500"
              >
                Apagar
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <section className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/50">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando avaliações…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            filtered.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                selected={selected.has(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
                onOpen={() => setDetail(r)}
                onQuickReply={(reply) => updateOne(r.id, { reply })}
                onToggleStatus={() =>
                  updateOne(r.id, { status: r.status === "hidden" ? "published" : "hidden" })
                }
                onDelete={() => removeOne(r.id)}
              />
            ))
          )}
        </section>
      </div>

      {detail && (
        <ReviewDetailDialog
          review={detail}
          onClose={() => setDetail(null)}
          onUpdate={async (patch) => {
            await updateOne(detail.id, patch);
            setDetail((d) => (d ? { ...d, ...patch } : d));
          }}
          onDelete={async () => {
            await removeOne(detail.id);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: string;
  iconColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:p-5">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl", accent)} />
      <div className="relative">
        <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", iconColor)}>
          {icon}
          {label}
        </div>
        <div className="mt-1 font-['Barlow_Condensed',_ui-sans-serif] text-4xl font-black leading-none tracking-tight text-white sm:text-5xl">
          {value}
        </div>
        <div className="mt-1 text-[10px] text-white/50 sm:text-xs">{hint}</div>
      </div>
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
        active
          ? "border-neon-pink/60 bg-neon-pink/15 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function Stars({ n, size = 4 }: { n: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            i <= n ? "fill-yellow-300 text-yellow-300" : "text-white/15",
          )}
          style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  selected,
  onToggleSelect,
  onOpen,
  onQuickReply,
  onToggleStatus,
  onDelete,
}: {
  review: Review;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onQuickReply: (reply: string) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(review.reply ?? "");
  const name = review.profile?.full_name || "Cliente";
  const initial = name.charAt(0).toUpperCase();
  const created = new Date(review.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        "group rounded-3xl border p-4 transition sm:p-5",
        review.status === "hidden"
          ? "border-white/5 bg-white/[0.02] opacity-70"
          : "border-white/10 bg-white/[0.03] hover:border-neon-pink/30",
        selected && "border-neon-pink/60 ring-1 ring-neon-pink/40",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/30 accent-neon-pink"
        />
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-pink to-fuchsia-500 text-sm font-black text-white"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-bold text-white">{name}</span>
            <Stars n={review.rating} />
            {review.status === "hidden" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/60">
                <EyeOff className="h-2.5 w-2.5" /> Oculta
              </span>
            )}
            {!review.reply && review.status === "published" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon-pink/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-neon-pink">
                <AlertCircle className="h-2.5 w-2.5" /> Sem resposta
              </span>
            )}
            <span className="ml-auto text-[10px] text-white/40">{created}</span>
          </div>

          {review.title && (
            <h3 className="mt-1 text-sm font-black text-white">{review.title}</h3>
          )}
          {review.comment && (
            <p className="mt-1 text-sm leading-snug text-white/70">{review.comment}</p>
          )}
          {review.product?.name && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              {review.product.image_url && (
                <img
                  src={review.product.image_url}
                  alt=""
                  className="h-4 w-4 rounded object-cover"
                />
              )}
              {review.product.name}
            </div>
          )}
          {(review.photos?.length ?? 0) > 0 && (
            <div className="mt-2 flex gap-1.5">
              {review.photos!.slice(0, 4).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-white/10 object-cover"
                />
              ))}
            </div>
          )}

          {review.reply && (
            <div className="mt-3 rounded-2xl border border-neon-pink/20 bg-neon-pink/[0.06] p-3">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neon-pink">
                <MessageSquareReply className="h-3 w-3" /> Sua resposta
              </div>
              <p className="text-xs text-white/80">{review.reply}</p>
            </div>
          )}

          {replyOpen && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Agradeça, resolva ou convide para voltar…"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onQuickReply(replyText.trim() || "");
                    setReplyOpen(false);
                  }}
                  className="rounded-full bg-neon-pink px-4 py-1.5 text-xs font-black text-white hover:brightness-110"
                >
                  Enviar resposta
                </button>
                <button
                  onClick={() => setReplyOpen(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!replyOpen && (
              <button
                onClick={() => {
                  setReplyText(review.reply ?? "");
                  setReplyOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10"
              >
                <MessageSquare className="h-3 w-3" /> {review.reply ? "Editar resposta" : "Responder"}
              </button>
            )}
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10"
            >
              <Users className="h-3 w-3" /> Detalhes
            </button>
            <button
              onClick={onToggleStatus}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10"
            >
              {review.status === "hidden" ? (
                <>
                  <Eye className="h-3 w-3" /> Publicar
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" /> Ocultar
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
              aria-label="Apagar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ReviewDetailDialog({
  review,
  onClose,
  onUpdate,
  onDelete,
}: {
  review: Review;
  onClose: () => void;
  onUpdate: (patch: Partial<Review>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [reply, setReply] = useState(review.reply ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border-white/10 bg-[#120a24] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
            Avaliação de {review.profile?.full_name || "cliente"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Stars n={review.rating} size={5} />
            <span className="text-sm font-bold text-white/70">{review.rating}/5</span>
          </div>
          {review.title && <div className="text-base font-black">{review.title}</div>}
          {review.comment && (
            <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              {review.comment}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-white/60">
            <div>
              <div className="font-bold text-white/40">Cliente</div>
              <div className="text-white/80">{review.profile?.full_name || "—"}</div>
            </div>
            <div>
              <div className="font-bold text-white/40">Telefone</div>
              <div className="text-white/80">{review.profile?.phone || "—"}</div>
            </div>
            <div>
              <div className="font-bold text-white/40">Pedido</div>
              <div className="font-mono text-white/80">
                {review.order_id ? "#" + review.order_id.slice(0, 8).toUpperCase() : "—"}
              </div>
            </div>
            <div>
              <div className="font-bold text-white/40">Produto</div>
              <div className="text-white/80">{review.product?.name || "Geral"}</div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-neon-pink">
              Resposta da loja
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Escreva uma resposta pública…"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onUpdate({ reply: reply.trim() || null })}
              className="rounded-full bg-neon-pink px-4 py-2 text-xs font-black text-white hover:brightness-110"
            >
              Salvar resposta
            </button>
            <button
              onClick={() =>
                onUpdate({ status: review.status === "hidden" ? "published" : "hidden" })
              }
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
            >
              {review.status === "hidden" ? "Publicar" : "Ocultar"}
            </button>
            <button
              onClick={() => onUpdate({ featured: !review.featured })}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
            >
              {review.featured ? "Remover destaque" : "Destacar"}
            </button>
            <button
              onClick={onDelete}
              className="ml-auto rounded-full bg-red-500/90 px-4 py-2 text-xs font-black text-white hover:bg-red-500"
            >
              Apagar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-neon-pink/15 text-neon-pink">
        <Star className="h-6 w-6" />
      </div>
      <h3 className="text-base font-black text-white">Sem avaliações por aqui</h3>
      <p className="mt-1 text-sm text-white/50">
        Ajuste os filtros ou aguarde os próximos feedbacks dos clientes.
      </p>
    </div>
  );
}
