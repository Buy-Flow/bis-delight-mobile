import { useEffect, useMemo, useState } from "react";
import { Star, Camera, ThumbsUp, BadgeCheck, X, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  photos: string[] | null;
  reply: string | null;
  replied_at: string | null;
  helpful_count: number;
  featured: boolean;
  created_at: string;
  reviewer_name: string;
  verified: boolean;
  tags: string[] | null;
};

type Stats = {
  total: number;
  avg: number;
  with_photos: number;
  d1: number; d2: number; d3: number; d4: number; d5: number;
};

type Settings = {
  enabled: boolean;
  show_on_product_page: boolean;
  gallery_style: "grid" | "carousel" | "masonry";
  default_sort: "helpful" | "recent" | "rating_high" | "rating_low" | "photos_first";
  show_reviewer_name: boolean;
  mask_reviewer_name: boolean;
  show_verified_badge: boolean;
  show_reply: boolean;
  min_reviews_to_display: number;
  cta_title: string | null;
  cta_subtitle: string | null;
  empty_state_text: string | null;
};

const DEFAULTS: Settings = {
  enabled: true,
  show_on_product_page: true,
  gallery_style: "grid",
  default_sort: "helpful",
  show_reviewer_name: true,
  mask_reviewer_name: false,
  show_verified_badge: true,
  show_reply: true,
  min_reviews_to_display: 0,
  cta_title: "O que dizem nossos clientes",
  cta_subtitle: "Avaliações reais de quem já pediu",
  empty_state_text: "Seja o primeiro a avaliar este produto!",
};

function maskName(name: string) {
  if (!name) return "Cliente";
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.length ? rest[rest.length - 1] : "";
  return last ? `${first} ${last[0]}.` : first;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (d < day) return "hoje";
  if (d < 2 * day) return "ontem";
  const days = Math.floor(d / day);
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? "ano" : "anos"}`;
}

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={cn(
            "transition-colors",
            i <= n ? "fill-yellow-400 text-yellow-400" : "fill-white/10 text-white/20"
          )}
        />
      ))}
    </div>
  );
}

type Filter = "all" | "photos" | 1 | 2 | 3 | 4 | 5;

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Settings["default_sort"]>("helpful");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(6);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const client = supabase as any;

      const [{ data: settingsRow }, revRes, statsRes, session] = await Promise.all([
        client.from("review_settings").select("*").maybeSingle(),
        client.rpc("get_product_reviews", { _product_id: productId, _limit: 100 }),
        client.rpc("get_product_review_stats", { _product_id: productId }),
        supabase.auth.getUser(),
      ]);

      if (cancelled) return;

      if (settingsRow) {
        setSettings({ ...DEFAULTS, ...settingsRow });
        setSort(settingsRow.default_sort ?? "helpful");
      }
      setReviews((revRes.data as ReviewRow[]) ?? []);
      setStats((statsRes.data as any)?.[0] ?? (statsRes.data as Stats) ?? null);

      const uid = session.data.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        const { data: votes } = await client
          .from("review_helpful_votes")
          .select("review_id")
          .eq("user_id", uid);
        if (!cancelled && votes) setVoted(new Set(votes.map((v: any) => v.review_id)));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const filtered = useMemo(() => {
    let arr = [...reviews];
    if (filter === "photos") arr = arr.filter((r) => (r.photos?.length ?? 0) > 0);
    else if (typeof filter === "number") arr = arr.filter((r) => r.rating === filter);

    switch (sort) {
      case "recent": arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); break;
      case "rating_high": arr.sort((a, b) => b.rating - a.rating); break;
      case "rating_low": arr.sort((a, b) => a.rating - b.rating); break;
      case "photos_first": arr.sort((a, b) => (b.photos?.length ?? 0) - (a.photos?.length ?? 0)); break;
      default: arr.sort((a, b) => (Number(b.featured) - Number(a.featured)) || (b.helpful_count - a.helpful_count));
    }
    return arr;
  }, [reviews, filter, sort]);

  const allPhotos = useMemo(
    () => reviews.flatMap((r) => (r.photos ?? []).map((p) => ({ url: p, reviewId: r.id }))),
    [reviews]
  );

  const toggleHelpful = async (reviewId: string) => {
    if (!userId) {
      toast.info("Entre na sua conta para curtir");
      return;
    }
    const client = supabase as any;
    if (voted.has(reviewId)) {
      setVoted((s) => { const n = new Set(s); n.delete(reviewId); return n; });
      setReviews((rs) => rs.map((r) => r.id === reviewId ? { ...r, helpful_count: Math.max(0, r.helpful_count - 1) } : r));
      await client.from("review_helpful_votes").delete().eq("review_id", reviewId).eq("user_id", userId);
    } else {
      setVoted((s) => new Set(s).add(reviewId));
      setReviews((rs) => rs.map((r) => r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r));
      const { error } = await client.from("review_helpful_votes").insert({ review_id: reviewId, user_id: userId });
      if (error) {
        setVoted((s) => { const n = new Set(s); n.delete(reviewId); return n; });
        setReviews((rs) => rs.map((r) => r.id === reviewId ? { ...r, helpful_count: Math.max(0, r.helpful_count - 1) } : r));
      }
    }
  };

  if (!settings.enabled || !settings.show_on_product_page) return null;
  if (loading) {
    return <div className="mt-6 h-20 animate-pulse rounded-2xl bg-white/5" />;
  }
  if (!stats || stats.total < Math.max(1, settings.min_reviews_to_display)) return null;

  const isEmpty = false;

  return (
    <section className="mt-8 space-y-5">
      <header>
        <h3 className="font-display text-lg font-black uppercase tracking-wider text-neon-yellow">
          {settings.cta_title ?? "Avaliações"}
        </h3>
        {settings.cta_subtitle && (
          <p className="mt-0.5 text-xs text-white/60">{settings.cta_subtitle}</p>
        )}
      </header>

      {isEmpty ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/70">{settings.empty_state_text ?? "Seja o primeiro a avaliar!"}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[auto,1fr]">
            <div className="flex flex-col items-center justify-center gap-1 border-white/10 sm:border-r sm:pr-6">
              <div className="font-display text-4xl font-black text-white">{stats.avg.toFixed(1)}</div>
              <Stars n={Math.round(stats.avg)} size={16} />
              <div className="text-[11px] uppercase tracking-wider text-white/50">
                {stats.total} {stats.total === 1 ? "avaliação" : "avaliações"}
              </div>
            </div>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = (stats as any)[`d${n}`] as number;
                const pct = stats.total ? (count / stats.total) * 100 : 0;
                return (
                  <button
                    key={n}
                    onClick={() => setFilter(filter === n ? "all" : (n as Filter))}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-left transition-colors",
                      filter === n ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    <span className="w-3 text-xs text-white/60">{n}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full bg-yellow-400/80" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-[11px] text-white/50">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Gallery */}
          {allPhotos.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/70">
                <Camera className="h-4 w-4" />
                Fotos dos clientes ({allPhotos.length})
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {allPhotos.slice(0, 20).map((p, idx) => (
                  <button
                    key={`${p.reviewId}-${idx}`}
                    onClick={() => setLightbox({ photos: allPhotos.map((x) => x.url), index: idx })}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 transition hover:border-neon-cyan hover:scale-[1.03]"
                  >
                    <img src={p.url} alt="Foto de cliente" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters + Sort */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todas</FilterChip>
            <FilterChip active={filter === "photos"} onClick={() => setFilter("photos")}>
              <Camera className="h-3 w-3" /> Com foto ({stats.with_photos})
            </FilterChip>
            {[5, 4, 3, 2, 1].map((n) => (
              <FilterChip key={n} active={filter === n} onClick={() => setFilter(n as Filter)}>
                {n}★
              </FilterChip>
            ))}
            <div className="ml-auto">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Settings["default_sort"])}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none"
              >
                <option value="helpful">Mais úteis</option>
                <option value="recent">Mais recentes</option>
                <option value="rating_high">Melhor nota</option>
                <option value="rating_low">Pior nota</option>
                <option value="photos_first">Com foto primeiro</option>
              </select>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {filtered.slice(0, visible).map((r) => {
              const isExpanded = expanded.has(r.id);
              const long = (r.comment?.length ?? 0) > 240;
              const displayComment = isExpanded || !long ? r.comment : r.comment?.slice(0, 240) + "...";
              const name = settings.show_reviewer_name
                ? (settings.mask_reviewer_name ? maskName(r.reviewer_name) : r.reviewer_name)
                : "Cliente";
              return (
                <article key={r.id} className={cn(
                  "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
                  r.featured && "border-neon-yellow/40 bg-yellow-400/[0.03]"
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">{name}</span>
                        {settings.show_verified_badge && r.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            <BadgeCheck className="h-3 w-3" /> Verificado
                          </span>
                        )}
                        {r.featured && (
                          <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-200">
                            ⭐ Destaque
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars n={r.rating} />
                        <span className="text-[11px] text-white/40">· {timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {r.title && <div className="mt-2 font-bold text-white/95">{r.title}</div>}
                  {r.comment && (
                    <p className="mt-1 text-sm leading-relaxed text-white/75 whitespace-pre-line">
                      {displayComment}
                      {long && (
                        <button
                          onClick={() => setExpanded((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                          className="ml-1 text-neon-cyan hover:underline"
                        >
                          {isExpanded ? "ver menos" : "ver mais"}
                        </button>
                      )}
                    </p>
                  )}

                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.photos && r.photos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {r.photos.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox({ photos: r.photos!, index: i })}
                          className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 hover:border-neon-cyan"
                        >
                          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {settings.show_reply && r.reply && (
                    <div className="mt-3 rounded-xl border-l-2 border-neon-cyan bg-white/5 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neon-cyan">
                        Resposta da loja
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/80">{r.reply}</p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => toggleHelpful(r.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                        voted.has(r.id)
                          ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"
                      )}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Útil {r.helpful_count > 0 && `(${r.helpful_count})`}
                    </button>
                  </div>
                </article>
              );
            })}

            {filtered.length > visible && (
              <button
                onClick={() => setVisible((v) => v + 6)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10"
              >
                Ver mais avaliações ({filtered.length - visible} restantes)
              </button>
            )}

            {filtered.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/60">
                Nenhuma avaliação para esse filtro.
              </div>
            )}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Fechar"
          >
            <X />
          </button>
          {lightbox.photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox((l) => l && ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length })); }}
                className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox((l) => l && ({ ...l, index: (l.index + 1) % l.photos.length })); }}
                className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight />
              </button>
            </>
          )}
          <img
            src={lightbox.photos[lightbox.index]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {lightbox.index + 1} / {lightbox.photos.length}
          </div>
        </div>
      )}
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition",
        active
          ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan"
          : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"
      )}
    >
      {children}
    </button>
  );
}
