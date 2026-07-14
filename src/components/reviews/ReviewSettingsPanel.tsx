import { useEffect, useState } from "react";
import { Loader2, Save, Eye, EyeOff, Gift, Camera, MessageSquare, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Settings = {
  enabled: boolean;
  show_on_product_page: boolean;
  require_purchase: boolean;
  auto_approve_min_rating: number;
  auto_hide_below_rating: number;
  photo_required_for_reward: boolean;
  reward_coupon_code: string | null;
  reward_message: string | null;
  incentive_enabled: boolean;
  min_photos_for_featured: number;
  gallery_style: "grid" | "carousel" | "masonry";
  default_sort: "helpful" | "recent" | "rating_high" | "rating_low" | "photos_first";
  show_reviewer_name: boolean;
  mask_reviewer_name: boolean;
  show_verified_badge: boolean;
  show_reply: boolean;
  min_reviews_to_display: number;
  photos_per_review_limit: number;
  cta_title: string | null;
  cta_subtitle: string | null;
  empty_state_text: string | null;
};

export function ReviewSettingsPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("review_settings").select("*").maybeSingle();
      setS(data);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("review_settings")
      .update({ ...s, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Configurações salvas ✨");
  };

  if (loading || !s)
    return <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  return (
    <div className="space-y-6">
      {/* Visibilidade */}
      <Section title="Visibilidade" icon={<Eye className="h-4 w-4 text-neon-cyan" />}>
        <Toggle label="Sistema de avaliações ativo" hint="Desliga completamente o módulo" checked={s.enabled} onChange={(v) => upd("enabled", v)} />
        <Toggle label="Mostrar na página do produto" hint="Exibe avaliações + galeria de fotos no modal do produto" checked={s.show_on_product_page} onChange={(v) => upd("show_on_product_page", v)} />
        <Toggle label="Só quem comprou pode avaliar" hint="Bloqueia avaliação sem pedido vinculado" checked={s.require_purchase} onChange={(v) => upd("require_purchase", v)} />
        <NumberField label="Mínimo de avaliações para exibir a seção" hint="Esconde o bloco enquanto o produto tem poucas reviews" value={s.min_reviews_to_display} min={0} max={20} onChange={(v) => upd("min_reviews_to_display", v)} />
      </Section>

      {/* Moderação */}
      <Section title="Moderação automática" icon={<Star className="h-4 w-4 text-yellow-400" />}>
        <NumberField label="Auto-publicar avaliações com nota ≥" hint="Notas abaixo entram como 'pendente'" value={s.auto_approve_min_rating} min={1} max={5} onChange={(v) => upd("auto_approve_min_rating", v)} />
        <NumberField label="Ocultar automaticamente notas ≤" hint="0 = nunca ocultar automaticamente" value={s.auto_hide_below_rating} min={0} max={5} onChange={(v) => upd("auto_hide_below_rating", v)} />
        <NumberField label="Mínimo de fotos para virar 'Destaque'" value={s.min_photos_for_featured} min={0} max={5} onChange={(v) => upd("min_photos_for_featured", v)} />
        <NumberField label="Limite de fotos por avaliação" value={s.photos_per_review_limit} min={1} max={10} onChange={(v) => upd("photos_per_review_limit", v)} />
      </Section>

      {/* Incentivo */}
      <Section title="Incentivo com foto" icon={<Gift className="h-4 w-4 text-neon-pink" />}>
        <Toggle label="Oferecer recompensa por avaliar" checked={s.incentive_enabled} onChange={(v) => upd("incentive_enabled", v)} />
        <Toggle label="Recompensa só com foto" hint="Cupom liberado apenas se anexar pelo menos 1 foto" checked={s.photo_required_for_reward} onChange={(v) => upd("photo_required_for_reward", v)} />
        <TextField label="Cupom concedido" placeholder="OBRIGADO10" value={s.reward_coupon_code ?? ""} onChange={(v) => upd("reward_coupon_code", v || null)} />
        <TextArea label="Mensagem exibida ao cliente" rows={2} value={s.reward_message ?? ""} onChange={(v) => upd("reward_message", v || null)} />
      </Section>

      {/* Exibição */}
      <Section title="Exibição na página do produto" icon={<Camera className="h-4 w-4 text-neon-cyan" />}>
        <SelectField label="Estilo da galeria de fotos" value={s.gallery_style} onChange={(v) => upd("gallery_style", v as any)} options={[["grid","Grid"],["carousel","Carrossel"],["masonry","Mosaico"]]} />
        <SelectField label="Ordenação padrão" value={s.default_sort} onChange={(v) => upd("default_sort", v as any)} options={[["helpful","Mais úteis"],["recent","Mais recentes"],["rating_high","Melhor nota"],["rating_low","Pior nota"],["photos_first","Com foto primeiro"]]} />
        <Toggle label="Mostrar nome do cliente" checked={s.show_reviewer_name} onChange={(v) => upd("show_reviewer_name", v)} />
        <Toggle label="Mascarar sobrenome (João S.)" checked={s.mask_reviewer_name} onChange={(v) => upd("mask_reviewer_name", v)} />
        <Toggle label="Mostrar badge 'Compra verificada'" checked={s.show_verified_badge} onChange={(v) => upd("show_verified_badge", v)} />
        <Toggle label="Mostrar respostas da loja" checked={s.show_reply} onChange={(v) => upd("show_reply", v)} />
      </Section>

      {/* Textos */}
      <Section title="Textos da seção" icon={<MessageSquare className="h-4 w-4 text-emerald-400" />}>
        <TextField label="Título" value={s.cta_title ?? ""} onChange={(v) => upd("cta_title", v || null)} />
        <TextField label="Subtítulo" value={s.cta_subtitle ?? ""} onChange={(v) => upd("cta_subtitle", v || null)} />
        <TextArea label="Mensagem quando ainda não há avaliações" rows={2} value={s.empty_state_text ?? ""} onChange={(v) => upd("empty_state_text", v || null)} />
      </Section>

      <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-white/10 bg-[#0e0a1a]/95 px-6 py-4 backdrop-blur">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-pink to-fuchsia-500 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white/85">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-white/50">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-neon-pink" : "bg-white/15"
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
          checked ? "left-[22px]" : "left-0.5"
        )} />
      </button>
    </label>
  );
}

function NumberField({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <label className="mb-1.5 block text-sm font-semibold text-white">{label}</label>
      {hint && <div className="mb-1.5 text-xs text-white/50">{hint}</div>}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
      />
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <label className="mb-1.5 block text-sm font-semibold text-white">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
      />
    </div>
  );
}

function TextArea({ label, value, rows, onChange }: { label: string; value: string; rows?: number; onChange: (v: string) => void }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <label className="mb-1.5 block text-sm font-semibold text-white">{label}</label>
      <textarea
        rows={rows ?? 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <label className="mb-1.5 block text-sm font-semibold text-white">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-[#0e0a1a]">{l}</option>
        ))}
      </select>
    </div>
  );
}
