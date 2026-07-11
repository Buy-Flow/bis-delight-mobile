import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Star, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProductRef = { id: string; name: string };

type ExistingReview = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  product_id: string | null;
};

export function ReviewSubmitDialog({
  open,
  onClose,
  orderId,
  products,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  products?: ProductRef[];
  existing?: ExistingReview | null;
  onSaved?: () => void;
}) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [productId, setProductId] = useState<string | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setRating(existing.rating);
      setTitle(existing.title ?? "");
      setComment(existing.comment ?? "");
      setProductId(existing.product_id ?? "");
    } else {
      setRating(0);
      setTitle("");
      setComment("");
      setProductId(products && products.length === 1 ? products[0].id : "");
    }
    setHover(0);
  }, [open, existing, products]);

  const submit = async () => {
    if (rating < 1) {
      toast.error("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        toast.error("Faça login novamente.");
        return;
      }
      const payload = {
        user_id: uid,
        order_id: orderId,
        product_id: productId || null,
        rating,
        title: title.trim() || null,
        comment: comment.trim() || null,
        status: "published" as const,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      let error: { message: string } | null = null;
      if (existing) {
        const r = await client.from("reviews").update(payload).eq("id", existing.id);
        error = r.error;
      } else {
        const r = await client.from("reviews").insert(payload);
        error = r.error;
      }
      if (error) throw error;
      toast.success(existing ? "Avaliação atualizada. Obrigado!" : "Avaliação enviada. Obrigado!");
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Não foi possível salvar: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const label = (n: number) =>
    ["", "Não gostei", "Poderia melhorar", "Bom", "Muito bom", "Amei!"][n] ?? "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-[oklch(0.12_0.08_300)] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Sparkles className="h-5 w-5 text-neon-yellow" />
            {existing ? "Editar avaliação" : "Avaliar pedido"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="mb-2 text-xs text-white/60">Qual sua nota?</p>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hover || rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    className="transition active:scale-95"
                    aria-label={`${n} estrelas`}
                  >
                    <Star
                      className={cn(
                        "h-9 w-9 transition",
                        active
                          ? "fill-neon-yellow text-neon-yellow drop-shadow-[0_0_8px_rgba(255,214,10,0.6)]"
                          : "text-white/25",
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <p className="mt-1 h-4 text-xs font-bold text-neon-yellow">
              {label(hover || rating)}
            </p>
          </div>

          {products && products.length > 1 && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/50">
                Produto (opcional)
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-neon-pink focus:outline-none"
              >
                <option value="">Avaliação geral do pedido</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/50">
              Título (opcional)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Melhor açaí da cidade!"
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/50">
              Comentário
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Como foi sua experiência? O sabor, a entrega, a embalagem…"
              rows={4}
              maxLength={800}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-pink focus:outline-none"
            />
            <p className="mt-1 text-right text-[10px] text-white/40">{comment.length}/800</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || rating < 1}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 py-2.5 text-sm font-black text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {existing ? "Atualizar" : "Enviar avaliação"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
