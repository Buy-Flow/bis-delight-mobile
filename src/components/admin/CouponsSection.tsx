import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, Check, Ticket, Power, PowerOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirm";

type Coupon = {
  id: string;
  code: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  min_order: number;
  max_uses: number | null;
  uses: number;
  per_user_limit: number;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function randomCode(prefix = "BIS") {
  const s = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
  return `${prefix}-${s}`;
}

export function CouponsSection() {
  const [items, setItems] = useState<Coupon[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("promo_coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar cupons");
      setItems([]);
      return;
    }
    setItems((data ?? []) as Coupon[]);
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success(`Código ${code} copiado!`);
    } catch {
      toast.error(`Copie manualmente: ${code}`);
    }
  };

  const toggleActive = async (c: Coupon) => {
    const { error } = await supabase.from("promo_coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error("Erro ao atualizar");
    load();
  };

  const remove = async (c: Coupon) => {
    const ok = await confirmDialog({
      title: `Excluir cupom ${c.code}?`,
      message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("promo_coupons").delete().eq("id", c.id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Cupom excluído");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-black">Cupons de desconto</h3>
          <p className="text-xs text-white/50">
            Crie códigos promocionais para seus clientes usarem no checkout.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white glow-pink"
        >
          <Plus className="h-3.5 w-3.5" /> Novo cupom
        </button>
      </div>

      {items === null && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
          <Ticket className="mx-auto mb-2 h-8 w-8 text-white/30" />
          Nenhum cupom criado ainda. Clique em "Novo cupom" pra começar.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const exhausted = c.max_uses != null && c.uses >= c.max_uses;
            const status = !c.active
              ? { label: "Inativo", tone: "bg-white/10 text-white/60" }
              : expired
                ? { label: "Expirado", tone: "bg-red-500/20 text-red-300" }
                : exhausted
                  ? { label: "Esgotado", tone: "bg-red-500/20 text-red-300" }
                  : { label: "Ativo", tone: "bg-emerald-500/20 text-emerald-300" };
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => copy(c.code)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-neon-yellow/15 px-2 py-1 font-mono text-sm font-bold text-neon-yellow"
                      title="Copiar código"
                    >
                      {c.code}
                      <Copy className="h-3 w-3" />
                    </button>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", status.tone)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/60">
                    <span>
                      Desconto:{" "}
                      <b className="text-white/90">
                        {c.discount_type === "fixed" ? brl(c.discount_value) : `${c.discount_value}%`}
                      </b>
                    </span>
                    {c.min_order > 0 && <span>Mínimo: {brl(c.min_order)}</span>}
                    <span>
                      Usos: <b className="text-white/90">{c.uses}</b>
                      {c.max_uses != null ? ` / ${c.max_uses}` : " (ilimitado)"}
                    </span>
                    <span>Por cliente: {c.per_user_limit}x</span>
                    {c.expires_at && (
                      <span>Expira: {new Date(c.expires_at).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                  {c.note && <div className="mt-1 text-[11px] text-white/40">{c.note}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleActive(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10"
                    title={c.active ? "Desativar" : "Ativar"}
                  >
                    {c.active ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-red-300 hover:bg-red-500/20"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CouponForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CouponForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(randomCode());
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return toast.error("Informe um código");
    const val = parseFloat(discountValue.replace(",", "."));
    if (!val || val <= 0) return toast.error("Informe o valor do desconto");
    if (discountType === "percent" && val > 100) return toast.error("Percentual máximo 100%");

    setSaving(true);
    const { error } = await supabase.from("promo_coupons").insert({
      code: cleanCode,
      discount_type: discountType,
      discount_value: val,
      min_order: parseFloat(minOrder.replace(",", ".")) || 0,
      max_uses: maxUses.trim() ? parseInt(maxUses, 10) : null,
      per_user_limit: parseInt(perUserLimit, 10) || 1,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      note: note.trim() || null,
      active: true,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("Já existe um cupom com esse código");
      else toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Cupom criado!");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[oklch(0.14_0.09_305)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-lg font-black">Novo cupom</h4>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
              Código
            </span>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-neon-pink"
                placeholder="EX: PROMO10"
              />
              <button
                onClick={() => setCode(randomCode())}
                className="rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5"
                type="button"
              >
                Gerar
              </button>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Tipo
              </span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "fixed" | "percent")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              >
                <option value="fixed">Valor fixo (R$)</option>
                <option value="percent">Percentual (%)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Valor {discountType === "fixed" ? "(R$)" : "(%)"}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Pedido mínimo (R$)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Expira em
              </span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Máx. usos totais
              </span>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Por cliente
              </span>
              <input
                type="number"
                min="1"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
              Observação (opcional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Campanha de aniversário"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neon-pink px-4 py-2 text-sm font-bold text-white glow-pink disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Criar cupom
          </button>
        </div>
      </div>
    </div>
  );
}
