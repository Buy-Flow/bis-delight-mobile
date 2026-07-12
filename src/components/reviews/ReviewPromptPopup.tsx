import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Star, X, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * ReviewPromptPopup
 * -----------------------------------------------
 * Escaneia pedidos entregues do usuário que ainda não foram avaliados
 * e mostra um pop-up premium convidando à avaliação.
 *
 * Regras:
 * - Só aparece se autenticado.
 * - Só considera pedidos entregues (status = 'entregue') OU pagos com > 30min.
 * - Ignora pedidos já dispensados localmente por 3 dias.
 * - Ignora pedidos com avaliação existente no banco.
 * - Aparece 8s após o mount para não atrapalhar a experiência inicial.
 * - Não aparece na própria página /avaliar.
 */
const DISMISS_KEY = "review_prompt_dismissed";
const REVIEWED_KEY = "reviewed_orders";
const APPEAR_DELAY = 8_000;
// Só aparece 6h após o pedido; depois de mostrado/dispensado, não volta mais para o mesmo pedido.
const MIN_AGE_MS = 6 * 60 * 60 * 1000;

type Candidate = {
  id: string;
  created_at: string;
  delivered_at: string | null;
  status: string;
  mode: string;
  total: number;
  items_preview: string;
  items_images: string[];
};

export function ReviewPromptPopup() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (path.startsWith("/avaliar") || path.startsWith("/auth") || path.startsWith("/admin")) return;

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: orders } = await client
        .from("orders")
        .select("id, status, mode, total, created_at, delivered_at")
        .eq("user_id", uid)
        .in("status", ["entregue", "pago"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!orders || cancelled) return;

      // filter out reviewed & dismissed
      let dismissed: Record<string, number> = {};
      let reviewed: string[] = [];
      try {
        dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "{}");
        reviewed = JSON.parse(localStorage.getItem(REVIEWED_KEY) ?? "[]");
      } catch { /* ignore */ }
      const now = Date.now();

      // check reviews table
      const orderIds = orders.map((o: { id: string }) => o.id);
      const { data: existingReviews } = await client
        .from("reviews")
        .select("order_id")
        .eq("user_id", uid)
        .in("order_id", orderIds);
      const reviewedIds = new Set<string>([
        ...reviewed,
        ...((existingReviews ?? []) as { order_id: string }[]).map((r) => r.order_id).filter(Boolean),
      ]);

      const found = orders.find((o: { id: string; status: string; created_at: string }) => {
        if (reviewedIds.has(o.id)) return false;
        const dismissAt = dismissed[o.id];
        if (dismissAt && now - dismissAt < DISMISS_MS) return false;
        if (o.status === "entregue") return true;
        // pago com mais de 30min também prompta (retirada/mesa/balcão sem tracking de entrega)
        const age = now - new Date(o.created_at).getTime();
        return age > 30 * 60 * 1000;
      });

      if (!found) return;

      // pegar preview dos itens
      const { data: items } = await client
        .from("order_items")
        .select("name, image_url")
        .eq("order_id", found.id)
        .limit(4);
      const names = ((items ?? []) as { name: string }[]).map((i) => i.name).join(" · ");
      const images = ((items ?? []) as { image_url: string | null }[])
        .map((i) => i.image_url)
        .filter((x): x is string => !!x);

      if (cancelled) return;
      setCandidate({
        ...(found as Candidate),
        items_preview: names || "Seu último pedido",
        items_images: images.slice(0, 3),
      });
      timer = setTimeout(() => !cancelled && setVisible(true), APPEAR_DELAY);
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    if (!candidate) return;
    try {
      const raw = localStorage.getItem(DISMISS_KEY) ?? "{}";
      const map = JSON.parse(raw);
      map[candidate.id] = Date.now();
      localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
    setVisible(false);
  };

  const goToFullReview = () => {
    if (!candidate) return;
    setVisible(false);
    router.navigate({
      to: "/avaliar/$orderId" as never,
      params: { orderId: candidate.id },
      search: rating > 0 ? { r: rating } : undefined,
    } as never);
  };

  if (!visible || !candidate) return null;

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={dismiss}
      />
      {/* dialog */}
      <div className="fixed inset-x-2 bottom-2 z-[81] flex justify-center sm:inset-0 sm:items-center">
        <div
          className={cn(
            "relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10",
            "bg-[oklch(0.12_0.08_300)] text-white shadow-2xl shadow-neon-pink/30",
            "animate-in slide-in-from-bottom-8 fade-in duration-500",
          )}
        >
          {/* glow */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(236,72,153,0.4), transparent 70%)" }}
          />

          <button
            onClick={dismiss}
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative px-6 pt-8 pb-6 text-center">
            <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-neon-pink/30 bg-neon-pink/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neon-pink">
              <Sparkles className="h-3 w-3" /> Sua opinião vale muito
            </div>

            <h2 className="mt-4 text-2xl font-black leading-tight">
              Como foi seu pedido?
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Toque nas estrelas e ganhe um selo de fidelidade 💜
            </p>

            {candidate.items_images.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {candidate.items_images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-14 w-14 rounded-2xl border border-white/10 object-cover shadow-lg"
                  />
                ))}
              </div>
            )}
            <div className="mt-3 truncate px-4 text-xs text-white/50">
              {candidate.items_preview}
            </div>

            {/* stars */}
            <div className="mt-5 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hover || rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => {
                      setRating(n);
                      // pequena espera para o usuário ver a estrela acender
                      setTimeout(() => {
                        setVisible(false);
                        router.navigate({
                          to: "/avaliar/$orderId" as never,
                          params: { orderId: candidate.id },
                        } as never);
                      }, 250);
                    }}
                    className="p-1 transition active:scale-90"
                    aria-label={`${n} estrelas`}
                  >
                    <Star
                      className={cn(
                        "h-10 w-10 transition",
                        active
                          ? "fill-neon-yellow text-neon-yellow drop-shadow-[0_0_10px_rgba(255,214,10,0.6)]"
                          : "text-white/20",
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 h-4 text-xs font-bold text-neon-yellow">
              {["", "Não gostei", "Poderia melhorar", "Foi bom", "Muito bom", "Amei!"][hover || rating] ?? ""}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={goToFullReview}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 py-3 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110"
              >
                Avaliar em detalhes <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={dismiss}
                className="text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
