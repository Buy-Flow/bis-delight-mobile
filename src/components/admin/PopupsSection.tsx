import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  X,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  ImageOff,
  Package,
  Pencil,
  Calendar,
  Users,
  Clock,
  Sun,
  CalendarRange,
  Bookmark,
  Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirm";
import { uploadProductImage } from "@/lib/menu-data";
import { ImageAdjustPanel } from "@/components/admin/ImageAdjustPanel";
import { ProductPicker } from "@/components/admin/ProductPicker";
import {
  AUDIENCE_LABELS,
  WEEKDAY_LABELS,
  makeDefaultPopup,
  promoteTemplateToToday,
  promoteTemplateToWeekly,
  type PopupAudience,
  type PopupFrequency,
  type PopupKind,
  type SitePopup,
} from "@/lib/popups";

type Draft = Omit<SitePopup, "created_at" | "updated_at">;

const TAB_META: Record<PopupKind, { label: string; hint: string; icon: typeof Sun }> = {
  today: { label: "Hoje", hint: "Publicados só para o dia de hoje", icon: Sun },
  weekly: { label: "Programados", hint: "Rodam em dias fixos da semana", icon: CalendarRange },
  template: { label: "Modelos salvos", hint: "Rascunhos prontos pra publicar depois", icon: Bookmark },
};

export function PopupsSection() {
  const [items, setItems] = useState<SitePopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<PopupKind>("today");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_popups")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar pop-ups");
    }
    setItems((data ?? []) as unknown as SitePopup[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<PopupKind, number> = { today: 0, weekly: 0, template: 0 };
    for (const p of items) c[p.kind] = (c[p.kind] ?? 0) + 1;
    return c;
  }, [items]);

  const visible = useMemo(() => items.filter((p) => p.kind === tab), [items, tab]);

  const startNew = () => {
    setEditing({ id: crypto.randomUUID(), ...makeDefaultPopup(tab) });
  };

  const startEdit = (p: SitePopup) => {
    const { created_at: _c, updated_at: _u, ...rest } = p;
    setEditing({ ...rest });
  };

  const toggleActive = async (p: SitePopup) => {
    if (p.kind === "template") {
      toast.error("Modelos ficam inativos. Use 'Publicar' pra ativar.");
      return;
    }
    const { error } = await supabase
      .from("site_popups")
      .update({ active: !p.active })
      .eq("id", p.id);
    if (error) toast.error("Erro ao atualizar");
    else {
      toast.success(!p.active ? "Pop-up ativado" : "Pop-up pausado");
      await load();
    }
  };

  const duplicate = async (p: SitePopup, targetKind?: PopupKind) => {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = p;
    let payload: Omit<SitePopup, "id" | "created_at" | "updated_at"> = {
      ...rest,
      name: `${p.name} (cópia)`,
      active: false,
    };
    if (targetKind === "today") payload = { ...promoteTemplateToToday(payload), name: p.name };
    else if (targetKind === "weekly") payload = { ...promoteTemplateToWeekly(payload), name: p.name };
    const { error } = await supabase.from("site_popups").insert(payload);
    if (error) toast.error("Erro ao publicar");
    else {
      toast.success(
        targetKind === "today"
          ? "Publicado como pop-up de hoje"
          : targetKind === "weekly"
            ? "Publicado como programado"
            : "Pop-up duplicado",
      );
      if (targetKind) setTab(targetKind);
      await load();
    }
  };

  const remove = async (p: SitePopup) => {
    const ok = await confirmDialog({
      title: "Excluir pop-up?",
      message: `"${p.name}" será removido permanentemente.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("site_popups").delete().eq("id", p.id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Pop-up excluído");
      await load();
    }
  };

  const save = async (overrides?: Partial<Draft>) => {
    if (!editing) return;
    const payloadDraft = overrides ? { ...editing, ...overrides } : editing;
    setSaving(true);
    const { id, ...payload } = payloadDraft;
    const { error } = await supabase.from("site_popups").upsert({ id, ...payload });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Salvo");
    setTab(payloadDraft.kind);
    setEditing(null);
    await load();
  };

  const saveAsTemplate = () => save({ kind: "template", active: false });

  if (editing) {
    return (
      <PopupEditor
        draft={editing}
        onChange={setEditing}
        onCancel={() => setEditing(null)}
        onSave={() => save()}
        onSaveAsTemplate={saveAsTemplate}
        saving={saving}
      />
    );
  }

  const activeMeta = TAB_META[tab];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-black">Pop-ups</h3>
          <p className="text-xs text-white/50">{activeMeta.hint}</p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-neon-yellow px-3 py-2 text-xs font-black text-[oklch(0.15_0.10_305)] shadow hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          {tab === "today" ? "Novo pop-up de hoje" : tab === "weekly" ? "Novo programado" : "Novo modelo"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-1.5">
        {(Object.keys(TAB_META) as PopupKind[]).map((k) => {
          const meta = TAB_META[k];
          const Icon = meta.icon;
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition",
                active
                  ? "bg-neon-yellow text-[oklch(0.15_0.10_305)] shadow"
                  : "text-white/70 hover:bg-white/5",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{meta.label}</span>
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px]",
                  active ? "bg-black/20 text-[oklch(0.15_0.10_305)]" : "bg-white/10 text-white/60",
                )}
              >
                {counts[k]}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-8 text-center text-sm text-white/60">
          {tab === "today"
            ? "Nenhum pop-up de hoje. Crie um ou publique um modelo salvo."
            : tab === "weekly"
              ? "Nenhum pop-up programado. Crie um pra rodar em dias fixos da semana."
              : "Nenhum modelo salvo ainda. Modelos ficam guardados pra você publicar depois."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <PopupRow
              key={p.id}
              popup={p}
              onEdit={() => startEdit(p)}
              onToggle={() => toggleActive(p)}
              onDuplicate={() => duplicate(p)}
              onDelete={() => remove(p)}
              onPublishToday={() => duplicate(p, "today")}
              onPublishWeekly={() => duplicate(p, "weekly")}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function PopupRow({
  popup,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
  onPublishToday,
  onPublishWeekly,
}: {
  popup: SitePopup;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPublishToday: () => void;
  onPublishWeekly: () => void;
}) {
  const days = popup.days_of_week ?? [];
  const isTemplate = popup.kind === "template";
  const daysLabel =
    days.length === 7
      ? "Todo dia"
      : days.length === 0
        ? popup.kind === "today"
          ? "Só hoje"
          : "Nenhum dia"
        : days
            .slice()
            .sort()
            .map((d) => WEEKDAY_LABELS[d])
            .join(" · ");
  const hourLabel =
    popup.start_hour != null || popup.end_hour != null
      ? `${(popup.start_hour ?? 0).toString().padStart(2, "0")}h–${(popup.end_hour ?? 23)
          .toString()
          .padStart(2, "0")}h`
      : "24h";
  const audLabel = AUDIENCE_LABELS[popup.audience]?.label ?? popup.audience;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        isTemplate
          ? "border-neon-cyan/20 bg-neon-cyan/5"
          : popup.active
            ? "border-white/10 bg-white/5"
            : "border-white/5 bg-black/30 opacity-70",
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {popup.image_url ? (
          <img src={popup.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-[9px] text-white/40">Sem foto</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-bold text-white">
            {popup.name || popup.title || "Sem título"}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
              isTemplate
                ? "bg-neon-cyan/20 text-neon-cyan"
                : popup.active
                  ? "bg-neon-yellow/20 text-neon-yellow"
                  : "bg-white/10 text-white/50",
            )}
          >
            {isTemplate ? "Modelo" : popup.active ? "Ativo" : "Pausado"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/50">
          {!isTemplate && (
            <>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {daysLabel}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {hourLabel}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {audLabel}
          </span>
          {popup.priority > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">
              prioridade {popup.priority}
            </span>
          )}
          {isTemplate && (
            <span className="text-[10px] italic text-white/40">não exibido — publique pra ativar</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isTemplate ? (
          <>
            <button
              type="button"
              onClick={onPublishToday}
              className="inline-flex items-center gap-1 rounded-lg border border-neon-yellow/50 bg-neon-yellow/10 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-neon-yellow hover:bg-neon-yellow/20"
              title="Publicar como pop-up de hoje"
            >
              <Rocket className="h-3 w-3" /> Hoje
            </button>
            <button
              type="button"
              onClick={onPublishWeekly}
              className="inline-flex items-center gap-1 rounded-lg border border-neon-cyan/50 bg-neon-cyan/10 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-neon-cyan hover:bg-neon-cyan/20"
              title="Publicar na programação semanal"
            >
              <CalendarRange className="h-3 w-3" /> Semana
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10"
            aria-label={popup.active ? "Pausar" : "Ativar"}
            title={popup.active ? "Pausar" : "Ativar"}
          >
            {popup.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onDuplicate}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10"
          aria-label="Duplicar"
          title="Duplicar"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="grid h-8 w-8 place-items-center rounded-lg border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20"
          aria-label="Editar"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          aria-label="Excluir"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ==================== EDITOR ==================== */

const AUDIENCE_ORDER: PopupAudience[] = [
  "all",
  "new_customer",
  "returning",
  "birthday",
  "dormant",
  "guest",
  "near_reward",
];

const FREQ_OPTIONS: { value: PopupFrequency; label: string; hint: string }[] = [
  { value: "session", label: "Uma vez por visita", hint: "Some ao fechar a aba" },
  { value: "daily", label: "Uma vez por dia", hint: "Volta no dia seguinte" },
  { value: "always", label: "Sempre", hint: "Toda vez que abrir" },
];

const PAGE_PRESETS = [
  { value: "/", label: "Início" },
  { value: "/carrinho", label: "Carrinho" },
  { value: "/recompensas", label: "Recompensas" },
  { value: "/baixar-app", label: "Baixar app" },
  { value: "/conta", label: "Minha conta" },
];

function PopupEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  onSaveAsTemplate,
  saving,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  onSaveAsTemplate?: () => void;
  saving: boolean;
}) {
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      update({ image_url: await uploadProductImage(file) });
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setBusy(false);
    }
  };

  const linkRaw = (draft.link ?? "").trim();
  const isExternal = /^https?:\/\//i.test(linkRaw);
  const isProduct = /^\/produto\//i.test(linkRaw);
  const linkType: "none" | "product" | "page" | "external" = !linkRaw
    ? "none"
    : isProduct
      ? "product"
      : isExternal
        ? "external"
        : "page";
  const productId = isProduct ? linkRaw.replace(/^\/produto\//i, "").split(/[?#]/)[0] : "";

  const toggleDay = (d: number) => {
    const set = new Set(draft.days_of_week ?? []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    update({ days_of_week: Array.from(set).sort() });
  };

  const audienceNeedsDays = draft.audience === "new_customer" || draft.audience === "dormant";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-black">
            {draft.name || "Novo pop-up"}
          </h3>
          <p className="text-xs text-white/50">
            Configure conteúdo, dias, horário e público-alvo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            Cancelar
          </button>
          {onSaveAsTemplate && draft.kind !== "template" && (
            <button
              type="button"
              onClick={onSaveAsTemplate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-60"
              title="Salvar como modelo (rascunho)"
            >
              <Bookmark className="h-3.5 w-3.5" /> Modelo
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neon-yellow px-3 py-2 text-xs font-black text-[oklch(0.15_0.10_305)] shadow hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </button>
        </div>
      </div>

      {/* Nome + ativo */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">
            Nome interno
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Ex: Sexta Especial"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
          />
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">
              Prioridade
            </label>
            <input
              type="number"
              value={draft.priority}
              onChange={(e) => update({ priority: Number(e.target.value) || 0 })}
              className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
          <button
            type="button"
            onClick={() => update({ active: !draft.active })}
            className={cn(
              "relative h-9 w-16 shrink-0 rounded-full transition",
              draft.active ? "bg-neon-yellow" : "bg-white/15",
            )}
            aria-label={draft.active ? "Desativar" : "Ativar"}
          >
            <span
              className={cn(
                "absolute top-0.5 h-8 w-8 rounded-full bg-white shadow transition-all",
                draft.active ? "left-[calc(100%-2.125rem)]" : "left-0.5",
              )}
            />
          </button>
        </div>
      </div>

      {/* Preview */}
      {draft.image_url ? (
        <ImageAdjustPanel
          values={{ posX: draft.image_pos_x, posY: draft.image_pos_y, scale: draft.image_scale }}
          onChange={(p) =>
            update({
              ...(p.posX !== undefined ? { image_pos_x: p.posX } : {}),
              ...(p.posY !== undefined ? { image_pos_y: p.posY } : {}),
              ...(p.scale !== undefined ? { image_scale: p.scale } : {}),
            })
          }
          defaults={{ posX: 0, posY: 0, scale: 1 }}
          previewMaxWidth={260}
          previewLabel="Preview (como o cliente vê) — arraste a imagem pra posicionar"
          previewHint="Arraste dentro do celular · use o zoom abaixo"
          renderPreview={(v) => (
            <div className="relative mx-auto aspect-story w-full overflow-hidden rounded-3xl border border-white/15 bg-[url('https://lcntjixsisawwblcgwry.supabase.co/storage/v1/object/public/product-images/hero-bg-preview.png')] bg-cover bg-center">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
              <div className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white shadow">
                <X className="h-3.5 w-3.5" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                <img
                  src={draft.image_url}
                  alt=""
                  draggable={false}
                  className="max-h-[55%] max-w-full select-none object-contain"
                  style={{
                    transform: `translate(${v.posX}%, ${v.posY}%) scale(${v.scale})`,
                    transformOrigin: "center center",
                  }}
                />
                {(draft.title || draft.body) && (
                  <div className="w-full space-y-1 text-center">
                    {draft.title && (
                      <div className="font-display text-sm font-black leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                        {draft.title}
                      </div>
                    )}
                    {draft.body && (
                      <div className="line-clamp-2 whitespace-pre-line text-[10px] text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        {draft.body}
                      </div>
                    )}
                  </div>
                )}
                {draft.cta && linkRaw && (
                  <div className="mt-1 rounded-2xl bg-neon-yellow px-4 py-1.5 text-[10px] font-black text-[oklch(0.15_0.10_305)] shadow-lg">
                    {draft.cta}
                  </div>
                )}
              </div>
            </div>
          )}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-6 text-center text-xs text-white/50">
          Envie uma imagem abaixo pra ver o preview.
        </div>
      )}

      {/* Texto */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">
            Título
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Ex: Promoção da semana!"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">
            Botão (CTA)
          </label>
          <input
            type="text"
            value={draft.cta}
            onChange={(e) => update({ cta: e.target.value })}
            placeholder="Ver agora"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">
          Mensagem
        </label>
        <textarea
          value={draft.body}
          onChange={(e) => update({ body: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
        />
      </div>

      {/* Imagem */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-extrabold text-white">Imagem</div>
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {draft.image_url ? (
              <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[10px] text-white/40">Sem imagem</div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <label
              htmlFor="popup-editor-upload"
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10",
                busy && "opacity-60",
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Enviar imagem
            </label>
            <input
              id="popup-editor-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <input
              type="text"
              value={draft.image_url}
              onChange={(e) => update({ image_url: e.target.value })}
              placeholder="Ou cole a URL da imagem"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-neon-cyan"
            />
            {draft.image_url && (
              <button
                type="button"
                onClick={() => update({ image_url: "" })}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/50 hover:text-white"
              >
                <ImageOff className="h-3 w-3" /> Remover imagem
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Link */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60">
          Link ao clicar no botão
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { v: "none", label: "Nenhum" },
            { v: "product", label: "Produto" },
            { v: "page", label: "Página" },
            { v: "external", label: "URL externa" },
          ].map((opt) => {
            const active = linkType === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  if (opt.v === "none") update({ link: "" });
                  else if (opt.v === "page") update({ link: "/" });
                  else if (opt.v === "product") update({ link: "" });
                  else if (opt.v === "external") update({ link: "https://" });
                }}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-bold transition",
                  active
                    ? "border-neon-yellow bg-neon-yellow/10 text-neon-yellow"
                    : "border-white/10 bg-black/30 text-white/70 hover:border-white/30",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {linkType === "product" && (
          <div className="space-y-2">
            {productId ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
                <Package className="h-4 w-4 shrink-0 text-neon-pink" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Produto</div>
                  <div className="truncate font-mono text-[11px] text-white/80">{productId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/10"
                >
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={() => update({ link: "" })}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 px-3 py-3 text-xs font-bold text-white/80 hover:border-neon-pink/60 hover:text-white"
              >
                <Package className="h-4 w-4" /> Escolher produto
              </button>
            )}
          </div>
        )}

        {linkType === "page" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PAGE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update({ link: p.value })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                    linkRaw === p.value
                      ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"
                      : "border-white/10 bg-black/20 text-white/70 hover:border-white/30",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={linkRaw}
              onChange={(e) => update({ link: e.target.value })}
              placeholder="/carrinho"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
        )}

        {linkType === "external" && (
          <input
            type="text"
            value={linkRaw}
            onChange={(e) => update({ link: e.target.value })}
            placeholder="https://..."
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
          />
        )}
      </div>

      {picking && (
        <ProductPicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            update({ link: `/produto/${id}` });
            setPicking(false);
          }}
        />
      )}

      {/* Dias da semana */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Calendar className="h-4 w-4 text-neon-cyan" /> Dias da semana
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label, d) => {
            const active = (draft.days_of_week ?? []).includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-[11px] font-bold transition",
                  active
                    ? "border-neon-yellow bg-neon-yellow/10 text-neon-yellow"
                    : "border-white/10 bg-black/30 text-white/60 hover:border-white/30",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ days_of_week: [0, 1, 2, 3, 4, 5, 6] })}
            className="text-[10px] text-white/50 underline hover:text-white"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => update({ days_of_week: [1, 2, 3, 4, 5] })}
            className="text-[10px] text-white/50 underline hover:text-white"
          >
            Só dias úteis
          </button>
          <button
            type="button"
            onClick={() => update({ days_of_week: [0, 6] })}
            className="text-[10px] text-white/50 underline hover:text-white"
          >
            Só fim de semana
          </button>
        </div>
      </div>

      {/* Horário e vigência */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Clock className="h-4 w-4 text-neon-cyan" /> Horário e vigência (opcional)
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
              A partir de (hora)
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={draft.start_hour ?? ""}
              onChange={(e) =>
                update({ start_hour: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="0"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
              Até (hora)
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={draft.end_hour ?? ""}
              onChange={(e) =>
                update({ end_hour: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="23"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
              Começar em
            </label>
            <input
              type="datetime-local"
              value={draft.starts_at ? draft.starts_at.slice(0, 16) : ""}
              onChange={(e) =>
                update({ starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
              Terminar em
            </label>
            <input
              type="datetime-local"
              value={draft.ends_at ? draft.ends_at.slice(0, 16) : ""}
              onChange={(e) =>
                update({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
        </div>
      </div>

      {/* Público */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Users className="h-4 w-4 text-neon-cyan" /> Público-alvo
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {AUDIENCE_ORDER.map((aud) => {
            const active = draft.audience === aud;
            const info = AUDIENCE_LABELS[aud];
            return (
              <button
                key={aud}
                type="button"
                onClick={() => update({ audience: aud })}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  active
                    ? "border-neon-yellow bg-neon-yellow/10"
                    : "border-white/10 bg-black/20 hover:border-white/30",
                )}
              >
                <div className={cn("text-sm font-bold", active ? "text-neon-yellow" : "text-white")}>
                  {info.label}
                </div>
                <div className="mt-0.5 text-[10px] text-white/50">{info.hint}</div>
              </button>
            );
          })}
        </div>
        {audienceNeedsDays && (
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
              {draft.audience === "new_customer"
                ? "Conta criada nos últimos (dias)"
                : "Sem compra há (dias)"}
            </label>
            <input
              type="number"
              min={1}
              value={draft.audience_days ?? ""}
              onChange={(e) =>
                update({ audience_days: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder={draft.audience === "new_customer" ? "7" : "30"}
              className="w-40 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
            />
          </div>
        )}
      </div>

      {/* Frequência */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-extrabold text-white">Com que frequência mostrar</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {FREQ_OPTIONS.map((opt) => {
            const active = draft.frequency === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update({ frequency: opt.value })}
                className={cn(
                  "rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-neon-yellow bg-neon-yellow/10"
                    : "border-white/10 bg-black/20 hover:border-white/30",
                )}
              >
                <div className={cn("text-sm font-bold", active ? "text-neon-yellow" : "text-white")}>
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[11px] text-white/50">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-neon-yellow px-4 py-2 text-sm font-black text-[oklch(0.15_0.10_305)] shadow hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar pop-up
        </button>
      </div>
    </div>
  );
}
