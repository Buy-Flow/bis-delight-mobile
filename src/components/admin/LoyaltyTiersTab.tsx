import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadProductImage } from "@/lib/menu-data";
import {
  Award,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Search,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type TierRow = {
  tier: string;
  sort_order: number;
  label: string;
  min_lifetime: number;
  stamps_per_order: number;
  min_order_value: number;
  coupon_value: number;
  redeem_cost: number;
  icon_url: string | null;
  description: string | null;
  perks: string | null;
  color: string | null;
};

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n || 0),
  );

const DEFAULT_COLORS = [
  "#f59e0b", // amber
  "#e5e7eb", // silver
  "#facc15", // gold
  "#a78bfa", // violet
  "#38bdf8", // cyan
  "#f472b6", // pink
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || `nivel_${Date.now().toString(36).slice(-4)}`;

export function LoyaltyTiersTab() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [openTier, setOpenTier] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [uploadingTier, setUploadingTier] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("loyalty_tiers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) toast.error("Erro ao carregar níveis");
      else {
        const list = (data ?? []) as TierRow[];
        setRows(list);
        if (list.length && !openTier) setOpenTier(list[0].tier);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markDirty(tier: string) {
    setDirty((d) => {
      const n = new Set(d);
      n.add(tier);
      return n;
    });
  }

  function update(tier: string, patch: Partial<TierRow>) {
    setRows((r) => r.map((x) => (x.tier === tier ? { ...x, ...patch } : x)));
    markDirty(tier);
  }

  async function save(row: TierRow) {
    setSaving(row.tier);
    const { error } = await supabase
      .from("loyalty_tiers")
      .upsert(
        {
          tier: row.tier,
          sort_order: row.sort_order,
          label: row.label,
          min_lifetime: row.min_lifetime,
          stamps_per_order: row.stamps_per_order,
          min_order_value: row.min_order_value,
          coupon_value: row.coupon_value,
          redeem_cost: row.redeem_cost,
          icon_url: row.icon_url,
          description: row.description,
          perks: row.perks,
          color: row.color,
        },
        { onConflict: "tier" },
      );
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    setDirty((d) => {
      const n = new Set(d);
      n.delete(row.tier);
      return n;
    });
    toast.success(`Nível ${row.label} salvo`);
  }

  async function saveAll() {
    for (const r of rows.filter((r) => dirty.has(r.tier))) {
      // eslint-disable-next-line no-await-in-loop
      await save(r);
    }
  }

  async function remove(row: TierRow) {
    if (
      !window.confirm(
        `Remover o nível "${row.label}"? Clientes já classificados nele serão realocados automaticamente.`,
      )
    )
      return;
    const { error } = await supabase
      .from("loyalty_tiers")
      .delete()
      .eq("tier", row.tier);
    if (error) {
      toast.error("Erro ao remover", { description: error.message });
      return;
    }
    setRows((r) => r.filter((x) => x.tier !== row.tier));
    setDirty((d) => {
      const n = new Set(d);
      n.delete(row.tier);
      return n;
    });
    if (openTier === row.tier) setOpenTier(null);
    toast.success("Nível removido");
  }

  async function addTier() {
    const name = window.prompt(
      "Nome do novo nível (ex.: Diamante, Platinum, Lenda):",
    );
    if (!name) return;
    const key = slug(name);
    if (rows.some((r) => r.tier === key)) {
      toast.error("Já existe um nível com esse nome");
      return;
    }
    const newRow: TierRow = {
      tier: key,
      sort_order: (rows.at(-1)?.sort_order ?? 0) + 1,
      label: name,
      min_lifetime:
        (rows.at(-1)?.min_lifetime ?? 0) + 20,
      stamps_per_order: 1,
      min_order_value: 10,
      coupon_value: 10,
      redeem_cost: 10,
      icon_url: null,
      description: null,
      perks: null,
      color: DEFAULT_COLORS[rows.length % DEFAULT_COLORS.length],
    };
    const { error } = await supabase.from("loyalty_tiers").insert(newRow);
    if (error) {
      toast.error("Erro ao criar nível", { description: error.message });
      return;
    }
    setRows((r) => [...r, newRow]);
    setOpenTier(key);
    toast.success(`Nível ${name} criado`);
  }

  async function move(tier: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.tier === tier);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    const reindexed = next.map((r, i) => ({ ...r, sort_order: i + 1 }));
    setRows(reindexed);
    const results = await Promise.all(
      reindexed.map((r) =>
        supabase
          .from("loyalty_tiers")
          .update({ sort_order: r.sort_order })
          .eq("tier", r.tier),
      ),
    );
    const error = results.find((r) => r.error)?.error;
    if (error) toast.error("Erro ao reordenar", { description: error.message });
  }

  async function handleImage(row: TierRow, file: File) {
    setUploadingTier(row.tier);
    try {
      const url = await uploadProductImage(file);
      update(row.tier, { icon_url: url });
      toast.success("Imagem atualizada — clique em Salvar");
    } catch (e: any) {
      toast.error("Falha no upload", { description: e?.message });
    } finally {
      setUploadingTier(null);
    }
  }

  const stats = useMemo(
    () => ({
      total: rows.length,
      dirty: dirty.size,
    }),
    [rows.length, dirty],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-neon-yellow to-orange-400 text-black">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Programa de Fidelidade</h2>
            <p className="text-xs text-white/60">
              {stats.total} nível{stats.total === 1 ? "" : "eis"} configurado
              {stats.total === 1 ? "" : "s"}
              {stats.dirty > 0 && (
                <span className="ml-1 text-neon-yellow">
                  · {stats.dirty} não salvo{stats.dirty === 1 ? "" : "s"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats.dirty > 0 && (
            <button
              onClick={saveAll}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-1.5 text-xs font-bold text-neon-yellow transition hover:bg-neon-yellow/20"
            >
              <Save className="h-3.5 w-3.5" /> Salvar tudo
            </button>
          )}
          <button
            onClick={addTier}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-neon-pink px-3 py-1.5 text-xs font-bold text-white shadow shadow-neon-pink/20 transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" /> Novo nível
          </button>
        </div>
      </header>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <TierCard
            key={row.tier}
            row={row}
            index={i}
            total={rows.length}
            open={openTier === row.tier}
            saving={saving === row.tier}
            uploading={uploadingTier === row.tier}
            dirty={dirty.has(row.tier)}
            onToggle={() =>
              setOpenTier((o) => (o === row.tier ? null : row.tier))
            }
            onChange={(patch) => update(row.tier, patch)}
            onMove={(dir) => move(row.tier, dir)}
            onSave={() => save(row)}
            onDelete={() => remove(row)}
            onImage={(f) => handleImage(row, f)}
            onImageClear={() => update(row.tier, { icon_url: null })}
          />
        ))}
        {rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
            Nenhum nível ainda. Crie o primeiro em "Novo nível".
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-neon-yellow/30 bg-neon-yellow/5 p-3 text-xs text-white/70">
        💡 As mudanças valem para novos pedidos. Selos e cupons já emitidos não
        são reprocessados.
      </div>

      <LoyaltyAuditPanel rows={rows} />
    </div>
  );
}

function TierCard({
  row,
  index,
  total,
  open,
  saving,
  uploading,
  dirty,
  onToggle,
  onChange,
  onMove,
  onSave,
  onDelete,
  onImage,
  onImageClear,
}: {
  row: TierRow;
  index: number;
  total: number;
  open: boolean;
  saving: boolean;
  uploading: boolean;
  dirty: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<TierRow>) => void;
  onMove: (dir: -1 | 1) => void;
  onSave: () => void;
  onDelete: () => void;
  onImage: (f: File) => void;
  onImageClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const color = row.color || "#facc15";

  return (
    <div
      className={
        "overflow-hidden rounded-3xl border bg-white/[0.03] backdrop-blur transition " +
        (open
          ? "border-white/20 shadow-lg shadow-black/20"
          : "border-white/10 hover:border-white/15")
      }
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex flex-col">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded p-0.5 text-white/40 transition hover:text-white disabled:opacity-30"
            aria-label="Mover para cima"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <span className="text-center text-[9px] font-black text-white/40">
            {index + 1}
          </span>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded p-0.5 text-white/40 transition hover:text-white disabled:opacity-30"
            aria-label="Mover para baixo"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div
            className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border"
            style={{
              borderColor: `${color}55`,
              background: `linear-gradient(135deg, ${color}22, transparent)`,
            }}
          >
            {row.icon_url ? (
              <img
                src={row.icon_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-4 w-4 text-white/40" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate font-bold text-white">{row.label}</p>
              <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-white/50">
                {row.tier}
              </span>
              {dirty && (
                <span className="rounded-full bg-neon-yellow/20 px-1.5 py-0.5 text-[9px] font-bold text-neon-yellow">
                  não salvo
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/50">
              <span>
                {row.stamps_per_order} selo(s)/pedido · min{" "}
                {BRL(row.min_order_value)}
              </span>
              <span>Cupom {BRL(row.coupon_value)}</span>
              <span>
                {row.redeem_cost} p/ cartela · {row.min_lifetime} p/ atingir
              </span>
            </div>
          </div>

          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-white/40 transition-transform " +
              (open ? "rotate-180" : "")
            }
          />
        </button>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-white/5 px-4 pb-4 pt-4 sm:px-5">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            {/* Image column */}
            <div className="space-y-2">
              <div
                className="relative aspect-square overflow-hidden rounded-2xl border"
                style={{
                  borderColor: `${color}55`,
                  background: `linear-gradient(135deg, ${color}22, transparent)`,
                }}
              >
                {row.icon_url ? (
                  <img
                    src={row.icon_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-white/40">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/60">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImage(f);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {row.icon_url ? "Trocar" : "Enviar"}
                </button>
                {row.icon_url && (
                  <button
                    onClick={onImageClear}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-white/70">
                  Cor do nível
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange({ color: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent"
                  />
                  <input
                    value={color}
                    onChange={(e) => onChange({ color: e.target.value })}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-white outline-none focus:border-neon-yellow"
                  />
                </div>
              </label>
            </div>

            {/* Fields column */}
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Text
                  label="Nome exibido"
                  value={row.label}
                  onChange={(v) => onChange({ label: v })}
                />
                <Text
                  label="Chave interna"
                  value={row.tier}
                  disabled
                  hint="Identificador imutável"
                />
              </div>

              <Text
                label="Descrição curta"
                placeholder="Ex.: Para quem tá começando a conhecer nossa loja"
                value={row.description ?? ""}
                onChange={(v) => onChange({ description: v || null })}
              />

              <Text
                label="Benefícios (mostrados ao cliente)"
                placeholder="Ex.: Cupom de 10 · Frete grátis acima de R$40"
                value={row.perks ?? ""}
                onChange={(v) => onChange({ perks: v || null })}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Num
                  label="Selos por pedido"
                  hint="Ganhos a cada pedido válido."
                  value={row.stamps_per_order}
                  onChange={(v) => onChange({ stamps_per_order: v })}
                  min={0}
                />
                <Num
                  label="Pedido mínimo (R$)"
                  hint="Valor mínimo para receber selos."
                  value={row.min_order_value}
                  onChange={(v) => onChange({ min_order_value: v })}
                  min={0}
                />
                <Num
                  label="Cupom (R$)"
                  hint="Desconto ao completar uma cartela."
                  value={row.coupon_value}
                  onChange={(v) => onChange({ coupon_value: v })}
                  min={0}
                />
                <Num
                  label="Selos p/ cartela"
                  hint="Quantidade para gerar um cupom."
                  value={row.redeem_cost}
                  onChange={(v) => onChange({ redeem_cost: v })}
                  min={1}
                />
                <Num
                  label="Selos p/ atingir o nível"
                  hint="Total acumulado histórico exigido."
                  value={row.min_lifetime}
                  onChange={(v) => onChange({ min_lifetime: v })}
                  min={0}
                  disabled={index === 0}
                />
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    Ordem
                  </div>
                  <div className="text-lg font-bold text-white">
                    #{row.sort_order}
                  </div>
                  <div className="text-[10px] text-white/40">
                    Reordene pelas setas acima
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-neon-pink px-4 py-2 text-xs font-bold text-white shadow shadow-neon-pink/20 transition hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salvar nível
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Text({
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-white/70">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-neon-yellow disabled:opacity-50"
      />
      {hint && <p className="mt-0.5 text-[10px] text-white/40">{hint}</p>}
    </label>
  );
}

function Num({
  label,
  hint,
  value,
  onChange,
  min,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-white/70">
        {label}
      </span>
      <input
        type="number"
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

// ============================================================
// Auditoria de Fidelidade (sanfona)
// ============================================================

type CouponRow = {
  id: string;
  user_id: string;
  code: string;
  discount_value: number;
  used_at: string | null;
  created_at: string;
};

type LoyaltyRow = {
  user_id: string;
  stamps: number;
  lifetime_stamps: number;
  total_redeemed: number;
  updated_at: string;
};

type ProfileRow = { id: string; full_name: string | null; phone: string | null };

type AuditUserRow = {
  user_id: string;
  name: string;
  phone: string;
  tier: string;
  tier_color: string;
  stamps: number;
  lifetime: number;
  issued: number;
  redeemed: number;
  discount: number;
  last_activity: string | null;
};

const PERIODS = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
] as const;

function LoyaltyAuditPanel({ rows: tiers }: { rows: TierRow[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  const [q, setQ] = useState("");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());

  async function load() {
    setLoading(true);
    try {
      let coupQ = supabase.from("loyalty_coupons").select("*").order("created_at", { ascending: false }).limit(2000);
      if (period !== "all") {
        const since = new Date(Date.now() - Number(period) * 86400_000).toISOString();
        coupQ = coupQ.gte("created_at", since);
      }
      const [{ data: cData, error: cErr }, { data: lData, error: lErr }] = await Promise.all([
        coupQ,
        supabase.from("loyalty").select("user_id,stamps,lifetime_stamps,total_redeemed,updated_at").limit(2000),
      ]);
      if (cErr) throw cErr;
      if (lErr) throw lErr;
      const c = (cData ?? []) as CouponRow[];
      const l = (lData ?? []) as LoyaltyRow[];
      const ids = Array.from(new Set([...c.map((x) => x.user_id), ...l.map((x) => x.user_id)]));
      let pMap = new Map<string, ProfileRow>();
      if (ids.length) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id,full_name,phone")
          .in("id", ids);
        pMap = new Map((pData ?? []).map((p: any) => [p.id, p]));
      }
      setCoupons(c);
      setLoyalty(l);
      setProfiles(pMap);
    } catch (e: any) {
      toast.error("Erro ao carregar auditoria", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period]);

  const tierByLifetime = useMemo(() => {
    const sorted = [...tiers].sort((a, b) => a.min_lifetime - b.min_lifetime);
    return (lifetime: number) => {
      let match = sorted[0];
      for (const t of sorted) if (lifetime >= t.min_lifetime) match = t;
      return match;
    };
  }, [tiers]);

  const kpis = useMemo(() => {
    const issued = coupons.length;
    const redeemed = coupons.filter((c) => c.used_at).length;
    const discountRedeemed = coupons
      .filter((c) => c.used_at)
      .reduce((s, c) => s + Number(c.discount_value || 0), 0);
    const discountPending = coupons
      .filter((c) => !c.used_at)
      .reduce((s, c) => s + Number(c.discount_value || 0), 0);
    const totalStamps = loyalty.reduce((s, l) => s + Number(l.lifetime_stamps || 0), 0);
    return { issued, redeemed, discountRedeemed, discountPending, totalStamps };
  }, [coupons, loyalty]);

  const byUser: AuditUserRow[] = useMemo(() => {
    const map = new Map<string, AuditUserRow>();
    const ensure = (uid: string): AuditUserRow => {
      let row = map.get(uid);
      if (!row) {
        const p = profiles.get(uid);
        row = {
          user_id: uid,
          name: p?.full_name || "—",
          phone: p?.phone || "",
          tier: "",
          tier_color: "#facc15",
          stamps: 0,
          lifetime: 0,
          issued: 0,
          redeemed: 0,
          discount: 0,
          last_activity: null,
        };
        map.set(uid, row);
      }
      return row;
    };
    for (const l of loyalty) {
      const r = ensure(l.user_id);
      r.stamps = l.stamps;
      r.lifetime = l.lifetime_stamps;
      const t = tierByLifetime(l.lifetime_stamps);
      if (t) { r.tier = t.label; r.tier_color = t.color || "#facc15"; }
      if (!r.last_activity || l.updated_at > r.last_activity) r.last_activity = l.updated_at;
    }
    for (const c of coupons) {
      const r = ensure(c.user_id);
      r.issued += 1;
      if (c.used_at) {
        r.redeemed += 1;
        r.discount += Number(c.discount_value || 0);
      }
      const ts = c.used_at || c.created_at;
      if (!r.last_activity || ts > r.last_activity) r.last_activity = ts;
    }
    let list = Array.from(map.values());
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((r) =>
        r.name.toLowerCase().includes(term) ||
        r.phone.toLowerCase().includes(term) ||
        r.user_id.toLowerCase().includes(term),
      );
    }
    list.sort((a, b) => b.discount - a.discount || b.issued - a.issued);
    return list;
  }, [loyalty, coupons, profiles, q, tierByLifetime]);

  function exportCSV() {
    const header = [
      "cliente","telefone","nivel","selos_atuais","selos_totais",
      "cupons_emitidos","cupons_resgatados","desconto_resgatado_brl","ultima_atividade",
    ];
    const lines = [header.join(";")];
    for (const r of byUser) {
      lines.push([
        JSON.stringify(r.name), JSON.stringify(r.phone), JSON.stringify(r.tier),
        r.stamps, r.lifetime, r.issued, r.redeemed,
        r.discount.toFixed(2).replace(".", ","),
        r.last_activity ? new Date(r.last_activity).toISOString() : "",
      ].join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-fidelidade-${period}d-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-colors open:border-white/20 open:bg-white/[0.04]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 text-black">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">Auditoria de benefícios</p>
          <p className="text-[11px] text-white/60">
            Selos concedidos, cupons emitidos e resgatados por cliente e período.
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/50 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-white/5 p-4 space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={
                  "rounded-xl px-3 py-1 text-xs font-bold transition " +
                  (period === p.key ? "bg-neon-yellow text-black" : "text-white/60 hover:text-white")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou telefone…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white outline-none focus:border-neon-yellow"
            />
          </label>
          <button
            onClick={exportCSV}
            disabled={!byUser.length}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi icon={Award} tint="from-amber-400/30 to-amber-600/10" label="Selos concedidos" value={kpis.totalStamps.toLocaleString("pt-BR")} hint="Histórico total" />
          <Kpi icon={Ticket} tint="from-fuchsia-400/30 to-fuchsia-600/10" label="Cupons emitidos" value={kpis.issued.toLocaleString("pt-BR")} hint={period === "all" ? "Todo período" : `Últimos ${period}d`} />
          <Kpi icon={CheckCircle2} tint="from-emerald-400/30 to-emerald-600/10" label="Cupons resgatados" value={kpis.redeemed.toLocaleString("pt-BR")} hint={`${kpis.issued ? Math.round((kpis.redeemed / kpis.issued) * 100) : 0}% de conversão`} />
          <Kpi icon={Clock} tint="from-sky-400/30 to-sky-600/10" label="Desconto (R$)" value={BRL(kpis.discountRedeemed)} hint={`Pendente: ${BRL(kpis.discountPending)}`} />
        </div>

        {/* Tabela por cliente */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black/60 text-left uppercase tracking-widest text-white/50 backdrop-blur">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Nível</th>
                  <th className="px-3 py-2 text-right">Selos</th>
                  <th className="px-3 py-2 text-right">Emitidos</th>
                  <th className="px-3 py-2 text-right">Resgatados</th>
                  <th className="px-3 py-2 text-right">Desconto</th>
                  <th className="px-3 py-2">Última ativ.</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-white/50">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                )}
                {!loading && byUser.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-white/50">
                      Nenhum registro no período.
                    </td>
                  </tr>
                )}
                {!loading && byUser.map((r) => (
                  <tr key={r.user_id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-white">{r.name}</div>
                      <div className="text-[10px] text-white/40">{r.phone || r.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2">
                      {r.tier ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: `${r.tier_color}22`, color: r.tier_color }}
                        >
                          {r.tier}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.stamps}<span className="text-white/30">/{r.lifetime}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.issued}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-300">{r.redeemed}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-white">{BRL(r.discount)}</td>
                    <td className="px-3 py-2 text-white/50">
                      {r.last_activity ? new Date(r.last_activity).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos cupons */}
        <details className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-bold text-white/80 [&::-webkit-details-marker]:hidden">
            <span>Últimos cupons</span>
            <ChevronDown className="h-3.5 w-3.5 text-white/50 transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-64 overflow-auto border-t border-white/5">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black/60 text-left uppercase tracking-widest text-white/50">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Emitido</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.slice(0, 100).map((c) => {
                  const p = profiles.get(c.user_id);
                  return (
                    <tr key={c.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5 font-mono text-neon-yellow">{c.code}</td>
                      <td className="px-3 py-1.5 text-white/80">{p?.full_name || c.user_id.slice(0, 8)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{BRL(Number(c.discount_value))}</td>
                      <td className="px-3 py-1.5 text-white/50">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-1.5">
                        {c.used_at ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Resgatado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </details>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tint,
}: {
  icon: typeof Award;
  label: string;
  value: string;
  hint?: string;
  tint: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tint} p-3`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/60">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
      {hint && <div className="text-[10px] text-white/50">{hint}</div>}
    </div>
  );
}
