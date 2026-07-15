import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Flame,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  Clock,
  ChevronDown,
  Settings2,
  Power,
} from "lucide-react";
import { useSiteSettings, useUpdateSettings, DEFAULT_URGENCY } from "@/lib/menu-data";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function fmt(ms: number) {
  if (ms <= 0) return { h: "00", m: "00", s: "00" };
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

function Accordion({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] open:bg-white/[0.04]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-white">{title}</div>
          {subtitle && (
            <div className="truncate text-[11px] text-white/50">{subtitle}</div>
          )}
        </div>
        {right}
        <ChevronDown className="h-4 w-4 text-white/40 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/5 px-4 py-4">{children}</div>
    </details>
  );
}

export function UrgencySection() {
  const { data: settings } = useSiteSettings();
  const update = useUpdateSettings();
  const [state, setState] = useState(DEFAULT_URGENCY);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (settings?.urgency) setState(settings.urgency);
  }, [settings?.urgency]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const endsAtMs = state.endsAt ? new Date(state.endsAt).getTime() : 0;
  const remaining = endsAtMs - now;
  const { h, m, s } = fmt(remaining);

  const status = useMemo<{
    tone: "on" | "off" | "warn" | "expired";
    label: string;
    hint: string;
  }>(() => {
    if (!state.active)
      return {
        tone: "off",
        label: "Desativado",
        hint: 'Marque "Ativar banner" para exibir no topo da home.',
      };
    if (!state.endsAt)
      return {
        tone: "warn",
        label: "Sem data de término",
        hint: "Defina uma data/hora de término. Sem isso o banner não aparece.",
      };
    if (remaining <= 0)
      return {
        tone: "expired",
        label: "Expirado",
        hint: "A data já passou. Escolha uma nova data no futuro.",
      };
    return {
      tone: "on",
      label: "No ar",
      hint: "Está aparecendo no topo da home agora.",
    };
  }, [state.active, state.endsAt, remaining]);

  const setEndsInMinutes = (mins: number) => {
    const iso = new Date(Date.now() + mins * 60000).toISOString();
    setState((prev) => ({ ...prev, endsAt: iso }));
  };
  const setEndOfToday = () => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    setState((prev) => ({ ...prev, endsAt: d.toISOString() }));
  };

  const save = async () => {
    if (!settings) return;
    try {
      await update.mutateAsync({ ...settings, urgency: state });
      toast.success("Timer atualizado!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const willShowPreview = state.active && endsAtMs > 0 && remaining > 0;

  const statusChip = (
    <span
      className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider sm:inline-block ${
        status.tone === "on"
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          : status.tone === "warn"
            ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
            : status.tone === "expired"
              ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
              : "bg-white/5 text-white/50 ring-1 ring-white/10"
      }`}
    >
      {status.label}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80">
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-black text-white">
            Timer de urgência
          </h2>
          <p className="text-[12px] text-white/50">
            Banner de contagem regressiva no topo da home.
          </p>
        </div>
        {statusChip}
      </div>

      {/* Status card (compacto e neutro) */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        {status.tone === "on" ? (
          <Eye className="mt-0.5 h-4 w-4 text-emerald-400" />
        ) : status.tone === "warn" || status.tone === "expired" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
        ) : (
          <Clock className="mt-0.5 h-4 w-4 text-white/40" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wider text-white/70">
            {status.label}
          </div>
          <div className="text-[12px] text-white/60">{status.hint}</div>
          {status.tone === "on" && (
            <div className="mt-1 font-mono text-[13px] text-white/90">
              Termina em {h}:{m}:{s}
            </div>
          )}
        </div>
      </div>

      {/* Sanfonas */}
      <Accordion
        icon={<Power className="h-4 w-4" />}
        title="Ativação"
        subtitle={state.active ? "Banner ligado" : "Banner desligado"}
        defaultOpen
        right={
          <label
            onClick={(e) => e.stopPropagation()}
            className="mr-1 inline-flex cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-white/80"
              checked={state.active}
              onChange={(e) => setState({ ...state, active: e.target.checked })}
            />
          </label>
        }
      >
        <p className="text-[12px] text-white/60">
          Cria senso de urgência ("acaba em 02h 15m") no topo da home. Some
          sozinho quando expira. Se quiser, junte um cupom para o cliente
          aplicar no checkout.
        </p>
      </Accordion>

      <Accordion
        icon={<Settings2 className="h-4 w-4" />}
        title="Configuração"
        subtitle="Texto, término e cupom"
        defaultOpen
      >
        <div className="space-y-4">
          <label className="block">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">
              Texto
            </div>
            <input
              className={inputCls}
              value={state.text}
              onChange={(e) => setState({ ...state, text: e.target.value })}
              placeholder="Sexta Especial acaba em"
            />
          </label>

          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">
              Termina em
            </div>
            <input
              type="datetime-local"
              className={inputCls}
              value={toLocalInput(state.endsAt)}
              onChange={(e) => {
                const v = e.target.value;
                setState({
                  ...state,
                  endsAt: v ? new Date(v).toISOString() : null,
                });
              }}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { l: "+1h", m: 60 },
                { l: "+3h", m: 180 },
                { l: "+6h", m: 360 },
                { l: "+24h", m: 1440 },
              ].map((p) => (
                <button
                  key={p.l}
                  type="button"
                  onClick={() => setEndsInMinutes(p.m)}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
                >
                  {p.l}
                </button>
              ))}
              <button
                type="button"
                onClick={setEndOfToday}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Fim de hoje
              </button>
            </div>
          </div>

          <label className="block">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">
              Código do cupom (opcional)
            </div>
            <input
              className={`${inputCls} font-mono uppercase`}
              value={state.couponCode}
              onChange={(e) =>
                setState({ ...state, couponCode: e.target.value.toUpperCase() })
              }
              placeholder="SEXTA20"
            />
            <div className="mt-1 text-[11px] text-white/40">
              Aparece no banner para o cliente copiar. Deixe vazio se não usar
              cupom.
            </div>
          </label>
        </div>
      </Accordion>

      <Accordion
        icon={<Eye className="h-4 w-4" />}
        title="Prévia"
        subtitle="Como aparece no topo da home"
      >
        {willShowPreview ? (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/80">
                <Flame className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
                  Promoção relâmpago
                </div>
                <div className="truncate font-display text-[14px] font-extrabold text-white">
                  {state.text || "Sexta Especial acaba em"}
                </div>
              </div>
              <div className="flex items-center gap-1 font-mono text-[13px] font-black text-white">
                {[h, m, s].map((v, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 leading-none"
                  >
                    <span className="text-[13px]">{v}</span>
                    <span className="text-[8px] text-white/50">
                      {["h", "m", "s"][i]}
                    </span>
                  </div>
                ))}
              </div>
              {state.couponCode && (
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white/90">
                  <Copy className="h-3.5 w-3.5" />
                  {state.couponCode}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-[12px] text-white/40">
            {!state.active
              ? 'Marque "Ativar banner" para pré-visualizar.'
              : !state.endsAt
                ? "Defina uma data/hora de término para pré-visualizar."
                : "A data já passou. Escolha um horário no futuro."}
          </div>
        )}
      </Accordion>

      {(status.tone === "warn" || status.tone === "expired") && state.active && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5 text-[11px] text-amber-200/90">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Dica: use os botões rápidos (+1h, +3h, Fim de hoje) para preencher a
          data em 1 clique.
        </div>
      )}

      {/* Save (sticky-feel, sem brilho) */}
      <button
        onClick={save}
        disabled={update.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-extrabold text-white hover:bg-white/15 disabled:opacity-40"
      >
        {update.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar timer
      </button>
    </div>
  );
}
