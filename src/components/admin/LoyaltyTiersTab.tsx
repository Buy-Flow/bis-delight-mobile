import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Award, Loader2, Save } from "lucide-react";

type TierRow = {
  tier: string;
  sort_order: number;
  label: string;
  min_lifetime: number;
  stamps_per_order: number;
  min_order_value: number;
  coupon_value: number;
  redeem_cost: number;
};

const TIER_ACCENT: Record<string, string> = {
  bronze: "from-amber-700 to-orange-500",
  prata: "from-slate-300 to-slate-500",
  ouro: "from-yellow-300 to-amber-500",
};

export function LoyaltyTiersTab() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("loyalty_tiers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) toast.error("Erro ao carregar níveis");
      else setRows((data ?? []) as TierRow[]);
      setLoading(false);
    })();
  }, []);

  function update(tier: string, patch: Partial<TierRow>) {
    setRows((r) => r.map((x) => (x.tier === tier ? { ...x, ...patch } : x)));
  }

  async function save(row: TierRow) {
    setSaving(row.tier);
    const { error } = await supabase
      .from("loyalty_tiers")
      .update({
        label: row.label,
        min_lifetime: row.min_lifetime,
        stamps_per_order: row.stamps_per_order,
        min_order_value: row.min_order_value,
        coupon_value: row.coupon_value,
        redeem_cost: row.redeem_cost,
      })
      .eq("tier", row.tier);
    setSaving(null);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success(`Nível ${row.label} atualizado`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-neon-yellow to-orange-400 text-black">
          <Award className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Programa de Fidelidade</h2>
          <p className="text-xs text-white/60">
            Configure selos, cupom e requisitos de cada nível. A cartela sempre completa em {rows[0]?.redeem_cost ?? 10} selos.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.tier}
            className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur"
          >
            <div className={`mb-3 h-1.5 w-full rounded-full bg-gradient-to-r ${TIER_ACCENT[row.tier] ?? "from-white/20 to-white/40"}`} />
            <div className="mb-3 flex items-center justify-between">
              <input
                value={row.label}
                onChange={(e) => update(row.tier, { label: e.target.value })}
                className="w-32 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-lg font-bold uppercase tracking-wide text-white outline-none focus:border-neon-yellow"
              />
              <span className="text-[10px] uppercase tracking-widest text-white/40">{row.tier}</span>
            </div>

            <Field
              label="Selos por pedido"
              hint="Quantos selos o cliente ganha a cada pedido válido."
              value={row.stamps_per_order}
              onChange={(v) => update(row.tier, { stamps_per_order: v })}
              step={1}
              min={0}
            />
            <Field
              label="Pedido mínimo (R$)"
              hint="Valor mínimo do pedido para receber selos."
              value={row.min_order_value}
              onChange={(v) => update(row.tier, { min_order_value: v })}
              step={1}
              min={0}
            />
            <Field
              label="Cupom (R$)"
              hint="Valor do desconto quando completar uma cartela."
              value={row.coupon_value}
              onChange={(v) => update(row.tier, { coupon_value: v })}
              step={1}
              min={0}
            />
            <Field
              label="Selos p/ subir de nível"
              hint="Total acumulado de selos históricos para atingir este nível."
              value={row.min_lifetime}
              onChange={(v) => update(row.tier, { min_lifetime: v })}
              step={1}
              min={0}
              disabled={row.tier === "bronze"}
            />
            <Field
              label="Selos p/ cartela"
              hint="Quantidade de selos para gerar um cupom."
              value={row.redeem_cost}
              onChange={(v) => update(row.tier, { redeem_cost: v })}
              step={1}
              min={1}
            />

            <button
              onClick={() => save(row)}
              disabled={saving === row.tier}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink py-2 text-sm font-bold text-white transition hover:bg-neon-pink/90 disabled:opacity-50"
            >
              {saving === row.tier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neon-yellow/30 bg-neon-yellow/5 p-3 text-xs text-white/70">
        💡 As mudanças valem para novos pedidos. Selos e cupons já emitidos não são reprocessados.
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <label className="mb-2 block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-white/80">{label}</span>
      </div>
      <input
        type="number"
        step={step}
        min={min}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-neon-yellow disabled:opacity-40"
      />
      {hint && <p className="mt-0.5 text-[10px] text-white/40">{hint}</p>}
    </label>
  );
}
