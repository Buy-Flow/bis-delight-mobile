import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, Flame } from "lucide-react";
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

export function UrgencySection() {
  const { data: settings } = useSiteSettings();
  const update = useUpdateSettings();
  const [state, setState] = useState(DEFAULT_URGENCY);

  useEffect(() => {
    if (settings?.urgency) setState(settings.urgency);
  }, [settings?.urgency]);

  const save = async () => {
    if (!settings) return;
    try {
      await update.mutateAsync({ ...settings, urgency: state });
      toast.success("Timer atualizado!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-neon-pink/20 text-neon-pink">
          <Flame className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-black text-white">Timer de urgência</h2>
          <p className="text-[12px] text-white/50">
            Banner com contagem regressiva no topo da home. Suma sozinho quando expira.
          </p>
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
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Texto</div>
          <input
            className={inputCls}
            value={state.text}
            onChange={(e) => setState({ ...state, text: e.target.value })}
            placeholder="Sexta Especial acaba em"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Termina em</div>
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
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Código do cupom (opcional)</div>
          <input
            className={`${inputCls} font-mono uppercase`}
            value={state.couponCode}
            onChange={(e) => setState({ ...state, couponCode: e.target.value.toUpperCase() })}
            placeholder="SEXTA20"
          />
          <div className="mt-1 text-[11px] text-white/40">
            Aparece no banner para o cliente copiar.
          </div>
        </label>

        <button
          onClick={save}
          disabled={update.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink disabled:opacity-40"
        >
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar timer
        </button>
      </div>
    </div>
  );
}
