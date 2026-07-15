import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check,
  Ticket,
  Power,
  PowerOff,
  Search,
  Pencil,
  CalendarClock,
  X,
  Sparkles,
  TrendingUp,
  Percent,
  DollarSign,
  Flame,
  Clock,
  Users,
} from "lucide-react";
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
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
};

type TabKey = "active" | "scheduled" | "expired" | "inactive" | "all";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L) para leitura em voz alta
// e digitação sem erro. 32 símbolos → 8 chars ≈ 1.1 × 10¹² combinações.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(prefix = "BIS", length = 8): string {
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  let out = "";
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    // Rejection sampling para distribuição uniforme sobre o alfabeto.
    const max = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
    const buf = new Uint8Array(length * 2);
    while (out.length < length) {
      cryptoObj.getRandomValues(buf);
      for (let i = 0; i < buf.length && out.length < length; i++) {
        const b = buf[i];
        if (b < max) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      }
    }
  } else {
    // Fallback improvável (SSR/ambientes sem crypto).
    for (let i = 0; i < length; i++) {
      out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  }
  return `${prefix}-${out}`;
}

/**
 * Gera um código garantidamente único consultando a tabela antes de retornar.
 * Aumenta o comprimento gradualmente se houver colisões repetidas (extremamente
 * improvável, mas defensivo).
 */
async function generateUniqueCode(prefix = "BIS"): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const length = 8 + Math.floor(attempt / 2); // 8, 8, 9, 9, 10, 10
    const candidate = randomCode(prefix, length);
    const { data, error } = await supabase
      .from("promo_coupons")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();
    // PGRST116 = no rows; qualquer outro erro trata como "não sei", tenta de novo.
    if (!error && !data) return candidate;
    if (error && error.code === "PGRST116") return candidate;
  }
  // Última tentativa: sufixo temporal para praticamente eliminar colisão.
  return `${prefix}-${randomCode("", 10).slice(-10)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function getStatus(c: Coupon): {
  key: TabKey;
  label: string;
  tone: string;
} {
  const now = new Date();
  const starts = c.starts_at ? new Date(c.starts_at) : null;
  const expires = c.expires_at ? new Date(c.expires_at) : null;
  const exhausted = c.max_uses != null && c.uses >= c.max_uses;

  if (!c.active)
    return { key: "inactive", label: "Inativo", tone: "bg-white/10 text-white/60" };
  if (expires && expires < now)
    return { key: "expired", label: "Expirado", tone: "bg-red-500/20 text-red-300" };
  if (exhausted)
    return { key: "expired", label: "Esgotado", tone: "bg-red-500/20 text-red-300" };
  if (starts && starts > now)
    return {
      key: "scheduled",
      label: "Agendado",
      tone: "bg-amber-500/20 text-amber-300",
    };
  return { key: "active", label: "Ativo", tone: "bg-emerald-500/20 text-emerald-300" };
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "scheduled", label: "Agendados" },
  { key: "expired", label: "Expirados" },
  { key: "inactive", label: "Inativos" },
  { key: "all", label: "Todos" },
];

export function CouponsSection() {
  const [items, setItems] = useState<Coupon[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [tab, setTab] = useState<TabKey>("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "fixed" | "percent">("all");

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

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      active: 0,
      scheduled: 0,
      expired: 0,
      inactive: 0,
      all: items?.length ?? 0,
    };
    (items ?? []).forEach((x) => {
      c[getStatus(x).key]++;
    });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      const st = getStatus(c).key;
      if (tab !== "all" && st !== tab) return false;
      if (typeFilter !== "all" && c.discount_type !== typeFilter) return false;
      if (
        q &&
        !c.code.toLowerCase().includes(q) &&
        !(c.note ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, tab, search, typeFilter]);

  const copy = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(code);
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
    const { error } = await supabase
      .from("promo_coupons")
      .update({ active: !c.active })
      .eq("id", c.id);
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

  const kpis = useMemo(() => {
    const list = items ?? [];
    const totalUses = list.reduce((s, c) => s + (c.uses || 0), 0);
    const withLimit = list.filter((c) => c.max_uses != null && c.max_uses > 0);
    const avgUsage = withLimit.length
      ? Math.round(
          (withLimit.reduce(
            (s, c) => s + Math.min(1, (c.uses || 0) / (c.max_uses as number)),
            0,
          ) /
            withLimit.length) *
            100,
        )
      : null;
    const bestCoupon = [...list]
      .sort((a, b) => (b.uses || 0) - (a.uses || 0))
      .find((c) => c.uses > 0);
    return {
      active: counts.active,
      scheduled: counts.scheduled,
      totalUses,
      avgUsage,
      bestCoupon,
    };
  }, [items, counts]);

  return (
    <div className="space-y-5">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neon-yellow/15 via-neon-pink/15 to-neon-purple/15 p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-yellow/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-neon-pink/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon-yellow to-neon-pink text-white shadow-lg shadow-neon-pink/30">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl font-black text-white">
                  Cupons de desconto
                </h3>
                <span className="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neon-cyan">
                  <Sparkles className="mr-1 inline h-2.5 w-2.5" /> Marketing
                </span>
              </div>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-white/60">
                Crie códigos promocionais, agende lançamentos e acompanhe o uso
                em tempo real.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="group flex items-center gap-2 self-start rounded-2xl bg-neon-pink px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-neon-pink/40 transition-transform hover:scale-[1.02] active:scale-95 glow-pink sm:self-auto"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            Novo cupom
          </button>
        </div>

        {/* KPI strip */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiChip
            icon={Flame}
            label="Ativos agora"
            value={kpis.active}
            tone="cyan"
          />
          <KpiChip
            icon={Clock}
            label="Agendados"
            value={kpis.scheduled}
            tone="yellow"
          />
          <KpiChip
            icon={TrendingUp}
            label="Usos totais"
            value={kpis.totalUses}
            tone="pink"
          />
          <KpiChip
            icon={Percent}
            label="Taxa média"
            value={kpis.avgUsage != null ? `${kpis.avgUsage}%` : "—"}
            tone="white"
          />
        </div>

        {kpis.bestCoupon && (
          <div className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-neon-yellow/30 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-neon-yellow" />
            <span className="text-[11px] text-white/70">
              Mais usado:{" "}
              <span className="font-mono font-bold text-neon-yellow">
                {kpis.bestCoupon.code}
              </span>{" "}
              · {kpis.bestCoupon.uses} resgates
            </span>
          </div>
        )}
      </div>

      {/* Tabs + Filters */}
      <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "group flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition",
                tab === t.key
                  ? "bg-gradient-to-r from-neon-pink to-neon-purple text-white shadow-lg shadow-neon-pink/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black",
                  tab === t.key
                    ? "bg-white/25 text-white"
                    : "bg-white/10 text-white/70",
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código ou observação…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "all" | "fixed" | "percent")
            }
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
          >
            <option value="all">Todos os tipos</option>
            <option value="fixed">Valor fixo (R$)</option>
            <option value="percent">Percentual (%)</option>
          </select>
        </div>
      </div>

      {items === null && (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {items && filtered.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,235,59,0.10),transparent_60%)]" />
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-neon-yellow/30 to-neon-pink/30 text-neon-yellow">
            <Ticket className="h-8 w-8" />
          </div>
          <h4 className="relative mt-4 font-display text-xl font-black text-white">
            {items.length === 0 ? "Nenhum cupom ainda" : "Nada por aqui"}
          </h4>
          <p className="relative mx-auto mt-1 max-w-sm text-sm text-white/50">
            {items.length === 0
              ? "Crie códigos promocionais para atrair novos clientes e recompensar os fiéis."
              : "Ajuste os filtros ou tente outra busca."}
          </p>
          {items.length === 0 && (
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="relative mt-5 inline-flex items-center gap-2 rounded-2xl bg-neon-pink px-5 py-3 text-sm font-extrabold text-white glow-pink"
            >
              <Plus className="h-4 w-4" /> Criar primeiro cupom
            </button>
          )}
        </div>
      )}

      {items && filtered.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              onCopy={() => copy(c.code)}
              onEdit={() => {
                setEditing(c);
                setShowForm(true);
              }}
              onToggle={() => toggleActive(c)}
              onDelete={() => remove(c)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CouponForm
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ KpiChip ------------------------------ */

function KpiChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  tone: "pink" | "cyan" | "yellow" | "white";
}) {
  const toneMap = {
    pink: "text-neon-pink border-neon-pink/30 bg-neon-pink/10",
    cyan: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10",
    yellow: "text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10",
    white: "text-white border-white/15 bg-white/5",
  }[tone];
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border ${toneMap} px-3 py-2 backdrop-blur-sm`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-[10px] font-bold uppercase tracking-wider opacity-80">
          {label}
        </div>
        <div className="font-display text-lg font-black leading-none">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ CouponCard --------------------------- */

function CouponCard({
  coupon: c,
  onCopy,
  onEdit,
  onToggle,
  onDelete,
}: {
  coupon: Coupon;
  onCopy: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const status = getStatus(c);
  const usagePct =
    c.max_uses != null && c.max_uses > 0
      ? Math.min(100, (c.uses / c.max_uses) * 100)
      : null;

  const toneRing = {
    active: "border-emerald-500/30 hover:border-emerald-500/50",
    scheduled: "border-amber-500/30 hover:border-amber-500/50",
    expired: "border-red-500/25 opacity-70",
    inactive: "border-white/10 opacity-60",
    all: "border-white/10",
  }[status.key];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-white/[0.03] transition-all hover:bg-white/[0.05]",
        toneRing,
      )}
    >
      {/* perforated left edge — ticket look */}
      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-6 flex-col items-center justify-around">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[oklch(0.11_0.08_305)]"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-6 w-px bg-white/5" />

      <div className="relative pl-8 pr-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          {/* code + status */}
          <div className="min-w-0 flex-1">
            <button
              onClick={onCopy}
              className="group/code inline-flex items-center gap-1.5 rounded-xl bg-neon-yellow/12 px-2.5 py-1.5 font-mono text-sm font-black text-neon-yellow transition hover:bg-neon-yellow/20"
              title="Copiar código"
            >
              <span className="max-w-[160px] truncate">{c.code}</span>
              <Copy className="h-3 w-3 opacity-60 transition group-hover/code:opacity-100" />
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                  status.tone,
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
                {status.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10.5px] font-bold text-white/80">
                {c.discount_type === "fixed" ? (
                  <DollarSign className="h-2.5 w-2.5" />
                ) : (
                  <Percent className="h-2.5 w-2.5" />
                )}
                {c.discount_type === "fixed"
                  ? brl(c.discount_value)
                  : `${c.discount_value}% OFF`}
              </span>
            </div>
          </div>

          {/* discount badge */}
          <div className="grid shrink-0 place-items-center rounded-2xl border border-neon-pink/40 bg-gradient-to-br from-neon-pink/25 to-neon-purple/20 px-3 py-2 backdrop-blur-sm">
            <div className="font-display text-xl font-black leading-none text-white">
              {c.discount_type === "percent"
                ? `${c.discount_value}%`
                : brl(c.discount_value).replace("R$", "").trim()}
            </div>
            <div className="mt-0.5 text-[8.5px] font-black uppercase tracking-wider text-white/70">
              {c.discount_type === "percent" ? "off" : "reais"}
            </div>
          </div>
        </div>

        {/* meta grid */}
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/60">
          {c.min_order > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-white/30" />
              Mín: <b className="text-white/85">{brl(c.min_order)}</b>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 opacity-60" />
            {c.per_user_limit}× por cliente
          </span>
          {c.starts_at && (
            <span className="inline-flex items-center gap-1 text-amber-300/85">
              <CalendarClock className="h-3 w-3" />
              {new Date(c.starts_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          )}
          {c.expires_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 opacity-60" />
              Até {new Date(c.expires_at).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>

        {/* usage */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-white/50">
            <span>Uso</span>
            <span className="text-white/80">
              {c.uses}
              {c.max_uses != null ? ` / ${c.max_uses}` : " · ilimitado"}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            {usagePct != null ? (
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePct >= 100
                    ? "bg-red-400"
                    : usagePct >= 80
                      ? "bg-gradient-to-r from-neon-yellow to-red-400"
                      : "bg-gradient-to-r from-neon-pink to-neon-yellow",
                )}
                style={{ width: `${Math.max(4, usagePct)}%` }}
              />
            ) : (
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan/40 via-neon-pink/40 to-neon-purple/40"
                style={{ width: "100%", opacity: 0.5 }}
              />
            )}
          </div>
        </div>

        {c.note && (
          <div className="mt-3 rounded-xl border border-white/5 bg-black/20 px-2.5 py-1.5 text-[11px] italic text-white/50">
            "{c.note}"
          </div>
        )}
      </div>

      {/* action bar */}
      <div className="relative mt-3 flex gap-1 border-t border-white/5 bg-black/20 px-3 py-2 pl-8">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 py-1.5 text-xs font-bold text-white/85 transition hover:bg-white/12"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          onClick={onToggle}
          title={c.active ? "Desativar" : "Ativar"}
          className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white/80 transition hover:bg-white/12"
        >
          {c.active ? (
            <Power className="h-3.5 w-3.5" />
          ) : (
            <PowerOff className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={onDelete}
          title="Excluir"
          className="grid h-8 w-8 place-items-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CouponForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Coupon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [code, setCode] = useState(initial?.code ?? "");
  const [codeAutoGenerated, setCodeAutoGenerated] = useState(!isEdit);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    initial?.discount_type ?? "fixed",
  );
  const [discountValue, setDiscountValue] = useState(
    initial ? String(initial.discount_value) : "10",
  );
  const [minOrder, setMinOrder] = useState(
    initial ? String(initial.min_order) : "0",
  );
  const [maxUses, setMaxUses] = useState(
    initial?.max_uses != null ? String(initial.max_uses) : "",
  );
  const [perUserLimit, setPerUserLimit] = useState(
    initial ? String(initial.per_user_limit) : "1",
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at ?? null));
  const [expiresAt, setExpiresAt] = useState(
    toLocalInput(initial?.expires_at ?? null),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);

  // Ao criar, gera um código único via DB antes de exibir ao usuário.
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    setGeneratingCode(true);
    generateUniqueCode()
      .then((c) => {
        if (!cancelled) {
          setCode(c);
          setCodeAutoGenerated(true);
        }
      })
      .finally(() => {
        if (!cancelled) setGeneratingCode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  const regenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const c = await generateUniqueCode();
      setCode(c);
      setCodeAutoGenerated(true);
    } finally {
      setGeneratingCode(false);
    }
  };

  const save = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return toast.error("Informe um código");
    if (!/^[A-Z0-9-]{3,32}$/.test(cleanCode))
      return toast.error("Código inválido: use letras, números e hífen (3-32)");
    const val = parseFloat(discountValue.replace(",", "."));
    if (!val || val <= 0) return toast.error("Informe o valor do desconto");
    if (discountType === "percent" && val > 100)
      return toast.error("Percentual máximo 100%");
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt))
      return toast.error("A data de início deve ser antes da expiração");

    const payload = {
      code: cleanCode,
      discount_type: discountType,
      discount_value: val,
      min_order: parseFloat(minOrder.replace(",", ".")) || 0,
      max_uses: maxUses.trim() ? parseInt(maxUses, 10) : null,
      per_user_limit: parseInt(perUserLimit, 10) || 1,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      note: note.trim() || null,
    };

    setSaving(true);

    // Pré-checagem de colisão (apenas na criação e quando o código foi editado
    // manualmente — se veio de generateUniqueCode a checagem já foi feita, mas
    // reforçamos para cobrir a janela de corrida). A unique constraint (23505)
    // continua sendo a garantia final no servidor.
    if (!isEdit) {
      let finalCode = cleanCode;
      const { data: existing } = await supabase
        .from("promo_coupons")
        .select("id")
        .eq("code", finalCode)
        .maybeSingle();
      if (existing) {
        if (codeAutoGenerated) {
          // Colisão em código auto-gerado → gera outro silenciosamente.
          try {
            finalCode = await generateUniqueCode();
            payload.code = finalCode;
            setCode(finalCode);
          } catch {
            setSaving(false);
            toast.error("Não foi possível gerar um código único. Tente novamente.");
            return;
          }
        } else {
          setSaving(false);
          toast.error("Já existe um cupom com esse código");
          return;
        }
      }
    }

    const { error } = isEdit
      ? await supabase.from("promo_coupons").update(payload).eq("id", initial!.id)
      : await supabase.from("promo_coupons").insert({ ...payload, active: true });
    setSaving(false);
    if (error) {
      if (error.code === "23505")
        toast.error("Já existe um cupom com esse código");
      else toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(isEdit ? "Cupom atualizado!" : "Cupom criado!");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[oklch(0.14_0.09_305)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-lg font-black">
            {isEdit ? `Editar ${initial!.code}` : "Novo cupom"}
          </h4>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
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
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCodeAutoGenerated(false);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-neon-pink disabled:opacity-60"
                placeholder={generatingCode ? "Gerando…" : "EX: PROMO10"}
                disabled={isEdit || generatingCode}
              />
              {!isEdit && (
                <button
                  onClick={regenerateCode}
                  disabled={generatingCode}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                  type="button"
                >
                  {generatingCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Gerar
                </button>
              )}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Tipo
              </span>
              <select
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as "fixed" | "percent")
                }
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Agendar início
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
              />
              <span className="mt-1 block text-[10px] text-white/40">
                Deixe vazio para ativar imediatamente.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                Expira em
              </span>
              <input
                type="datetime-local"
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
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isEdit ? "Salvar" : "Criar cupom"}
          </button>
        </div>
      </div>
    </div>
  );
}
