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
} from "lucide-react";
import { useSiteSettings, useUpdateSettings, DEFAULT_URGENCY } from "@/lib/menu-data";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-neon-pink";

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
        hint: "Marque \"Ativar banner\" para exibir no topo da home.",
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-neon-pink/20 text-neon-pink">
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-black text-white">Timer de urgência</h2>
          <p className="text-[12px] text-white/50">
            Banner com contagem regressiva que aparece no topo da home para pressionar decisão de compra.
          </p>
        </div>
      </div>

      {/* Explainer */}
      <div className="rounded-2xl border border-neon-pink/20 bg-neon-pink/[0.06] p-3 text-[12px] text-white/70">
        <div className="mb-1 font-bold text-white">Para que serve</div>
        Cria um senso de urgência (“acaba em 02h 15m”) no topo da home. Bom para promoções relâmpago, sextas especiais, feriados. Some sozinho quando expira — não precisa desativar depois. Se quiser, pode juntar um <span className="font-mono text-neon-yellow">cupom</span> para o cliente aplicar no checkout.
      </div>

      {/* Status card */}
      <div
        className={`flex items-start gap-3 rounded-2xl border p-3 ${
          status.tone === "on"
            ? "border-emerald-500/40 bg-emerald-500/10"
            : status.tone === "warn"
              ? "border-amber-500/40 bg-amber-500/10"
              : status.tone === "expired"
                ? "border-red-500/40 bg-red-500/10"
                : "border-white/10 bg-white/5"
        }`}
      >
        {status.tone === "on" ? (
          <Eye className="mt-0.5 h-4 w-4 text-emerald-400" />
        ) : status.tone === "warn" || status.tone === "expired" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
        ) : (
          <Clock className="mt-0.5 h-4 w-4 text-white/50" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wider text-white/80">
            Status: {status.label}
          </div>
          <div className="text-[12px] text-white/70">{status.hint}</div>
          {status.tone === "on" && (
            <div className="mt-1 font-mono text-[13px] text-white">
              Termina em {h}:{m}:{s}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-neon-pink"
            checked={state.active}
            onChange={(e) => setState({ ...state, active: e.target.checked })}
          />
          <span className="text-sm font-semibold text-white">Ativar banner</span>
        </label>

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
            Aparece no banner para o cliente copiar. Deixe vazio se não usar cupom.
          </div>
        </label>

        {/* Preview */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
            <Eye className="h-3.5 w-3.5" /> Prévia
          </div>
          {willShowPreview ? (
            <div className="relative overflow-hidden rounded-3xl border border-neon-pink/40 bg-gradient-to-r from-neon-pink/20 via-neon-purple/20 to-neon-cyan/15 p-3 shadow-[0_0_40px_-10px_rgba(255,0,150,0.4)]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-neon-pink/30 blur-2xl" />
              <div className="relative flex flex-wrap items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neon-pink/25 text-neon-pink">
                  <Flame className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-yellow">
                    Promoção relâmpago
                  </div>
                  <div className="truncate font-display text-[15px] font-extrabold text-white">
                    {state.text || "Sexta Especial acaba em"}
                  </div>
                </div>
                <div className="flex items-center gap-1 font-mono text-[13px] font-black text-white">
                  {[h, m, s].map((v, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center rounded-md bg-black/40 px-1.5 py-0.5 leading-none"
                    >
                      <span className="text-[13px]">{v}</span>
                      <span className="text-[8px] text-white/60">
                        {["h", "m", "s"][i]}
                      </span>
                    </div>
                  ))}
                </div>
                {state.couponCode && (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white ring-1 ring-white/20">
                    <Copy className="h-3.5 w-3.5" />
                    {state.couponCode}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-[12px] text-white/40">
              {!state.active
                ? "Marque \"Ativar banner\" para pré-visualizar."
                : !state.endsAt
                  ? "Defina uma data/hora de término para pré-visualizar."
                  : "A data já passou. Escolha um horário no futuro."}
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={update.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink disabled:opacity-40"
        >
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar timer
        </button>

        {(status.tone === "warn" || status.tone === "expired") && state.active && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Dica: use os botões rápidos (+1h, +3h, Fim de hoje) para preencher a data em 1 clique.
          </div>
        )}
      </div>
    </div>
  );
}
