import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Star,
  Loader2,
  ArrowLeft,
  Sparkles,
  Utensils,
  Bike,
  Package,
  HeartHandshake,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  MessageCircle,
  Camera,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/avaliar/$orderId")({
  component: AvaliarPage,
  head: () => ({
    meta: [
      { title: "Avaliar pedido — QueroBis" },
      { name: "description", content: "Conte como foi sua experiência: sabor, entrega, embalagem, atendimento e mais." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type OrderItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  image_url?: string | null;
};

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  mode: string;
  total: number;
  created_at: string;
  delivered_at: string | null;
  customer_name: string | null;
};

const TAGS = [
  "Rápido",
  "Chegou quente",
  "Bem embalado",
  "Sabor incrível",
  "Entregador simpático",
  "Muito bem servido",
  "Voltarei a pedir",
  "Melhor da cidade",
  "Atendimento nota 10",
  "Preço justo",
  "Foto igual à realidade",
  "Recomendo",
];

const NEG_TAGS = [
  "Demorou",
  "Chegou frio",
  "Embalagem ruim",
  "Faltou item",
  "Item errado",
  "Pouco recheio",
];

type Aspect = {
  key: "food" | "delivery" | "packaging" | "service" | "value";
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onlyDelivery?: boolean;
};

const ASPECTS: Aspect[] = [
  { key: "food", label: "Sabor & qualidade", hint: "Estava gostoso? Bem feito?", icon: Utensils, color: "text-orange-300" },
  { key: "delivery", label: "Entrega", hint: "Tempo, condição na chegada.", icon: Bike, color: "text-cyan-300", onlyDelivery: true },
  { key: "packaging", label: "Embalagem", hint: "Chegou bem embalado?", icon: Package, color: "text-emerald-300" },
  { key: "service", label: "Atendimento", hint: "Suporte, cordialidade.", icon: HeartHandshake, color: "text-neon-pink" },
  { key: "value", label: "Custo-benefício", hint: "Valeu o preço?", icon: DollarSign, color: "text-yellow-300" },
];

function AvaliarPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [existingId, setExistingId] = useState<string | null>(null);

  // form
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [subs, setSubs] = useState<Record<Aspect["key"], number>>({
    food: 0,
    delivery: 0,
    packaging: 0,
    service: 0,
    value: 0,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        toast.error("Faça login para avaliar.");
        navigate({ to: "/auth" });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data: ord, error: eOrd } = await client
        .from("orders")
        .select("id, user_id, status, mode, total, created_at, delivered_at, customer_name")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      if (eOrd || !ord) {
        toast.error("Pedido não encontrado.");
        navigate({ to: "/meus-pedidos" as never });
        return;
      }
      if (ord.user_id !== uid) {
        toast.error("Este pedido não é seu.");
        navigate({ to: "/meus-pedidos" as never });
        return;
      }
      setOrder(ord as OrderRow);

      const { data: itemsData } = await client
        .from("order_items")
        .select("product_id, name, quantity, image_url")
        .eq("order_id", orderId);
      setItems((itemsData ?? []) as OrderItem[]);

      const { data: existing } = await client
        .from("reviews")
        .select("*")
        .eq("order_id", orderId)
        .eq("user_id", uid)
        .maybeSingle();
      if (existing) {
        setExistingId(existing.id);
        setRating(existing.rating ?? 0);
        setTitle(existing.title ?? "");
        setComment(existing.comment ?? "");
        setProductId(existing.product_id ?? "");
        setRecommend(existing.would_recommend);
        setSelectedTags((existing.tags as string[] | null) ?? []);
        setPhotos((existing.photos as string[] | null) ?? []);
        setSubs({
          food: existing.rating_food ?? 0,
          delivery: existing.rating_delivery ?? 0,
          packaging: existing.rating_packaging ?? 0,
          service: existing.rating_service ?? 0,
          value: existing.rating_value ?? 0,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, navigate]);

  const isDelivery = order?.mode === "entrega";
  const activeAspects = useMemo(
    () => ASPECTS.filter((a) => !a.onlyDelivery || isDelivery),
    [isDelivery],
  );

  const canGoStep2 = rating >= 1;
  const canGoStep3 = activeAspects.every((a) => subs[a.key] >= 1);

  // Auto-fill sub-ratings when overall changes and no sub set
  useEffect(() => {
    if (rating < 1) return;
    setSubs((prev) => {
      const anySet = Object.values(prev).some((v) => v > 0);
      if (anySet) return prev;
      const filled: typeof prev = { ...prev };
      activeAspects.forEach((a) => (filled[a.key] = rating));
      return filled;
    });
  }, [rating, activeAspects]);

  const toggleTag = (t: string) =>
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 8)));

  const handlePhoto = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sem sessão.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 3 - photos.length)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} maior que 5MB.`);
          continue;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${uid}/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await client.storage.from("product-images").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (up.error) throw up.error;
        const pub = client.storage.from("product-images").getPublicUrl(path);
        urls.push(pub.data.publicUrl);
      }
      setPhotos((p) => [...p, ...urls].slice(0, 3));
    } catch (e) {
      toast.error("Falha ao enviar foto: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (rating < 1) {
      toast.error("Escolha uma nota geral.");
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sem sessão.");
      const payload = {
        user_id: uid,
        order_id: orderId,
        product_id: productId || null,
        rating,
        rating_food: subs.food || null,
        rating_delivery: isDelivery ? subs.delivery || null : null,
        rating_packaging: subs.packaging || null,
        rating_service: subs.service || null,
        rating_value: subs.value || null,
        would_recommend: recommend,
        tags: selectedTags,
        title: title.trim() || null,
        comment: comment.trim() || null,
        photos,
        order_mode: order?.mode ?? null,
        status: "published" as const,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      let error: { message: string } | null = null;
      if (existingId) {
        const r = await client.from("reviews").update(payload).eq("id", existingId);
        error = r.error;
      } else {
        const r = await client.from("reviews").insert(payload);
        error = r.error;
      }
      if (error) throw error;
      toast.success("Obrigado por avaliar! 💜");
      // mark as reviewed locally so popup doesn't nag
      try {
        const raw = localStorage.getItem("reviewed_orders") ?? "[]";
        const arr: string[] = JSON.parse(raw);
        if (!arr.includes(orderId)) arr.push(orderId);
        localStorage.setItem("reviewed_orders", JSON.stringify(arr));

        const promptRaw = localStorage.getItem("review_prompt_state_v2") ?? "{}";
        const promptState = JSON.parse(promptRaw);
        const orders = promptState.orders && typeof promptState.orders === "object" ? promptState.orders : {};
        orders[orderId] = {
          ...(orders[orderId] ?? {}),
          reviewedAt: Date.now(),
          dismissCount: 2,
        };
        localStorage.setItem("review_prompt_state_v2", JSON.stringify({ ...promptState, orders }));
      } catch { /* ignore */ }
      navigate({ to: "/recompensas" as never });
    } catch (e) {
      toast.error("Não foi possível salvar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0e0a1a] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-neon-pink" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0a1a] pb-32 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0e0a1a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/meus-pedidos"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-neon-pink/80">
              Sua opinião importa
            </div>
            <h1 className="truncate text-lg font-black">
              Avaliar pedido{" "}
              <span className="text-white/50">#{orderId.slice(0, 8)}</span>
            </h1>
          </div>
        </div>
        {/* progress */}
        <div className="mx-auto flex max-w-2xl gap-1 px-4 pb-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1 flex-1 rounded-full transition",
                n <= step ? "bg-gradient-to-r from-neon-pink to-fuchsia-500" : "bg-white/10",
              )}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Order summary */}
        <section className="mb-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/60">
            <Sparkles className="h-3 w-3 text-neon-yellow" /> Seu pedido
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {items.slice(0, 4).map((it, i) =>
              it.image_url ? (
                <img
                  key={i}
                  src={it.image_url}
                  alt=""
                  className="h-12 w-12 rounded-xl border border-white/10 object-cover"
                />
              ) : (
                <div key={i} className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold">
                  {it.name?.charAt(0) ?? "?"}
                </div>
              ),
            )}
            <div className="ml-2 min-w-0 flex-1">
              <div className="truncate text-sm font-bold">
                {items.map((it) => `${it.quantity}x ${it.name}`).join(" • ") || "Pedido"}
              </div>
              <div className="text-[11px] text-white/50">
                {order?.mode === "entrega" ? "Entrega" : order?.mode === "retirada" ? "Retirada" : order?.mode === "mesa" ? "Mesa" : "Balcão"}
                {" · R$ "}
                {Number(order?.total ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        {step === 1 && (
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neon-pink/10 via-white/[0.03] to-white/[0.02] p-6 text-center">
              <h2 className="text-2xl font-black">Como foi tudo?</h2>
              <p className="mt-1 text-sm text-white/60">Toque nas estrelas — do 1 (péssimo) ao 5 (perfeito).</p>
              <div className="mt-5 flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hover || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                      className="transition active:scale-90"
                      aria-label={`${n} estrelas`}
                    >
                      <Star
                        className={cn(
                          "h-12 w-12 transition-all sm:h-14 sm:w-14",
                          active
                            ? "fill-neon-yellow text-neon-yellow drop-shadow-[0_0_12px_rgba(255,214,10,0.6)]"
                            : "text-white/20",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 h-5 text-sm font-black text-neon-yellow">
                {["", "Não gostei", "Poderia melhorar", "Foi bom", "Muito bom", "Amei! 💜"][hover || rating] ?? ""}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/70">
                Você recomendaria a QueroBis?
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRecommend(true)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-bold transition",
                    recommend === true
                      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  <ThumbsUp className="h-5 w-5" /> Sim, com certeza
                </button>
                <button
                  onClick={() => setRecommend(false)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-bold transition",
                    recommend === false
                      ? "border-red-400/60 bg-red-500/15 text-red-300"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  <ThumbsDown className="h-5 w-5" /> Não recomendaria
                </button>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!canGoStep2}
              className="w-full rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 py-3.5 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar →
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-black">Nos conte os detalhes</h2>
              <p className="mt-1 text-sm text-white/60">
                Uma nota para cada aspecto do pedido.
              </p>
            </div>

            <div className="space-y-3">
              {activeAspects.map((a) => {
                const Icon = a.icon;
                return (
                  <div key={a.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-white/5", a.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-white">{a.label}</div>
                        <div className="text-[11px] text-white/50">{a.hint}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = subs[a.key] >= n;
                        return (
                          <button
                            key={n}
                            onClick={() => setSubs((s) => ({ ...s, [a.key]: n }))}
                            className="flex-1 rounded-lg py-2 transition active:scale-95"
                            aria-label={`${a.label}: ${n}`}
                          >
                            <Star
                              className={cn(
                                "mx-auto h-7 w-7 transition",
                                active ? "fill-yellow-300 text-yellow-300" : "text-white/15",
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {items.length > 1 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <label className="text-[11px] font-black uppercase tracking-widest text-white/60">
                  Foi por causa de um produto específico? (opcional)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setProductId("")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      productId === "" ? "border-neon-pink/60 bg-neon-pink/15 text-white" : "border-white/10 bg-white/5 text-white/70",
                    )}
                  >
                    Pedido inteiro
                  </button>
                  {items
                    .filter((it) => it.product_id)
                    .map((it) => (
                      <button
                        key={it.product_id!}
                        onClick={() => setProductId(it.product_id!)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                          productId === it.product_id
                            ? "border-neon-pink/60 bg-neon-pink/15 text-white"
                            : "border-white/10 bg-white/5 text-white/70",
                        )}
                      >
                        {it.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canGoStep3}
                className="flex-1 rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 py-3 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:opacity-40"
              >
                Continuar →
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-black">Toque final</h2>
              <p className="mt-1 text-sm text-white/60">Marque tags rápidas e, se quiser, escreva um comentário.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
                Pontos positivos
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <TagChip key={t} label={t} active={selectedTags.includes(t)} onToggle={() => toggleTag(t)} />
                ))}
              </div>
              {rating <= 3 && (
                <>
                  <div className="mt-4 text-[11px] font-black uppercase tracking-widest text-red-300">
                    O que poderia melhorar
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {NEG_TAGS.map((t) => (
                      <TagChip key={t} label={t} negative active={selectedTags.includes(t)} onToggle={() => toggleTag(t)} />
                    ))}
                  </div>
                </>
              )}
              <div className="mt-2 text-right text-[10px] text-white/40">{selectedTags.length}/8</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="text-[11px] font-black uppercase tracking-widest text-white/60">
                Título (opcional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Melhor açaí que já pedi!"
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
              />
              <label className="mt-3 block text-[11px] font-black uppercase tracking-widest text-white/60">
                Comentário
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte pra gente: o que amou, o que podemos melhorar…"
                rows={5}
                maxLength={800}
                className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
              />
              <div className="text-right text-[10px] text-white/40">{comment.length}/800</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-black">Adicione fotos (opcional)</div>
                  <div className="text-[11px] text-white/50">Mostre pra galera! Até 3 fotos, 5MB cada.</div>
                </div>
                <label className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10",
                  (uploading || photos.length >= 3) && "opacity-50 cursor-not-allowed",
                )}>
                  <Camera className="h-4 w-4" />
                  {uploading ? "Enviando…" : "Adicionar"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading || photos.length >= 3}
                    onChange={(e) => handlePhoto(e.target.files)}
                  />
                </label>
              </div>
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="h-20 w-20 rounded-xl border border-white/10 object-cover" />
                      <button
                        onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow"
                        aria-label="Remover foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
                disabled={saving}
              >
                Voltar
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 py-3 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {existingId ? "Atualizar avaliação" : "Enviar avaliação"}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-center text-[11px] text-white/50">
              <MessageCircle className="mr-1 inline h-3 w-3" />
              Sua avaliação nos ajuda a melhorar e vira selo pra fidelidade 💜
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function TagChip({
  label,
  active,
  negative,
  onToggle,
}: {
  label: string;
  active: boolean;
  negative?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95",
        active
          ? negative
            ? "border-red-400/60 bg-red-500/15 text-red-200"
            : "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
      )}
    >
      {label}
    </button>
  );
}
