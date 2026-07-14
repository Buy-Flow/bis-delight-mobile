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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-black">Cupons de desconto</h3>
          <p className="text-xs text-white/50">
            Crie códigos promocionais, agende lançamentos e acompanhe o uso.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white glow-pink"
        >
          <Plus className="h-3.5 w-3.5" /> Novo cupom
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 min-w-[90px] rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition",
              tab === t.key
                ? "bg-neon-pink text-white shadow-lg shadow-neon-pink/30"
                : "text-white/60 hover:bg-white/5 hover:text-white/90",
            )}
          >
            {t.label}
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                tab === t.key ? "bg-white/20" : "bg-white/10",
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código ou observação…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-neon-pink"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | "fixed" | "percent")
          }
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-pink"
        >
          <option value="all">Todos os tipos</option>
          <option value="fixed">Valor fixo (R$)</option>
          <option value="percent">Percentual (%)</option>
        </select>
      </div>

      {items === null && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      )}

      {items && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
          <Ticket className="mx-auto mb-2 h-8 w-8 text-white/30" />
          {items.length === 0
            ? 'Nenhum cupom criado ainda. Clique em "Novo cupom" pra começar.'
            : "Nenhum cupom encontrado com os filtros atuais."}
        </div>
      )}

      {items && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((c) => {
            const status = getStatus(c);
            const usagePct =
              c.max_uses != null && c.max_uses > 0
                ? Math.min(100, (c.uses / c.max_uses) * 100)
                : null;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-white/20"
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
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        status.tone,
                      )}
                    >
                      {status.label}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
                      {c.discount_type === "fixed"
                        ? brl(c.discount_value)
                        : `${c.discount_value}% OFF`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/60">
                    {c.min_order > 0 && (
                      <span>Mínimo: {brl(c.min_order)}</span>
                    )}
                    <span>
                      Usos: <b className="text-white/90">{c.uses}</b>
                      {c.max_uses != null ? ` / ${c.max_uses}` : " (ilimitado)"}
                    </span>
                    <span>Por cliente: {c.per_user_limit}x</span>
                    {c.starts_at && (
                      <span className="inline-flex items-center gap-1 text-amber-300/80">
                        <CalendarClock className="h-3 w-3" />
                        Inicia:{" "}
                        {new Date(c.starts_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {c.expires_at && (
                      <span>
                        Expira:{" "}
                        {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {usagePct != null && (
                    <div className="mt-1.5 h-1 w-full max-w-[240px] overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-neon-pink to-neon-yellow"
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  )}
                  {c.note && (
                    <div className="mt-1 text-[11px] text-white/40">{c.note}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10"
                    title={c.active ? "Desativar" : "Ativar"}
                  >
                    {c.active ? (
                      <Power className="h-3.5 w-3.5" />
                    ) : (
                      <PowerOff className="h-3.5 w-3.5" />
                    )}
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
