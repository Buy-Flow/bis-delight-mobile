import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { updateSkeletonSettings } from "@/lib/skeleton.functions";
import {
  applySkeletonSettings,
  DEFAULT_SKELETON_SETTINGS,
  type SkeletonSettings,
} from "@/components/skeleton";
import {
  KpiRowSkeleton,
  ListSkeleton,
  TableSkeleton,
  ChartSkeleton,
  CardGridSkeleton,
  FormSkeleton,
  AdminPageSkeleton,
} from "@/components/skeleton";

import {
  Save,
  RotateCcw,
  Loader2,
  Sparkles,
  Info,
  Eye,
  Zap,
  Palette,
  Layers,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/skeleton-loading")({
  component: SkeletonAdmin,
  head: () => ({
    meta: [
      { title: "Skeleton Loading — Quero Bis" },
      {
        name: "description",
        content: "Personalize os esqueletos de carregamento em cardápio, pedidos e painel.",
      },
    ],
  }),
});

const VARIANTS: { id: SkeletonSettings["variant"]; label: string; desc: string }[] = [
  { id: "shimmer", label: "Brilho (shimmer)", desc: "Faixa de luz varrendo. Padrão moderno." },
  { id: "wave", label: "Onda", desc: "Gradiente suave. Elegante em fundos claros." },
  { id: "pulse", label: "Pulso", desc: "Fade in/out. Melhor para movimento sutil." },
  { id: "static", label: "Estático", desc: "Sem animação. Máximo desempenho." },
];

const TONES: { id: SkeletonSettings["tone"]; label: string }[] = [
  { id: "auto", label: "Automático (segue tema)" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
  { id: "brand", label: "Marca (roxo)" },
];

const TINTS: { id: SkeletonSettings["tint"]; label: string; sample: string }[] = [
  { id: "neutral", label: "Neutro", sample: "oklch(0.9 0.02 300)" },
  { id: "brand", label: "Marca", sample: "oklch(0.85 0.08 305)" },
  { id: "warm", label: "Quente", sample: "oklch(0.92 0.05 60)" },
  { id: "cool", label: "Frio", sample: "oklch(0.92 0.04 240)" },
];

function SkeletonAdmin() {
  const qc = useQueryClient();
  const _upd = useServerFn(updateSkeletonSettings);

  const settingsQ = useQuery<SkeletonSettings>({
    queryKey: ["skeleton-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skeleton_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as SkeletonSettings) ?? DEFAULT_SKELETON_SETTINGS;
    },
  });

  const [draft, setDraft] = useState<SkeletonSettings>({ ...DEFAULT_SKELETON_SETTINGS });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (settingsQ.data && !hydrated) {
      setDraft(settingsQ.data);
      setHydrated(true);
    }
  }, [settingsQ.data, hydrated]);

  // Live preview — apply draft to :root as user tweaks, revert on unmount.
  useEffect(() => {
    applySkeletonSettings(draft);
    return () => {
      if (settingsQ.data) applySkeletonSettings(settingsQ.data);
    };
     
  }, [draft]);

  const [preview, setPreview] = useState<"cards" | "list" | "table" | "chart" | "form" | "full">("cards");

  const mut = useMutation({
    mutationFn: (patch: Partial<SkeletonSettings>) => _upd({ data: patch }),
    onSuccess: (row) => {
      qc.setQueryData(["skeleton-settings"], row);
      toast.success("Configurações aplicadas ao site inteiro");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDefaults = () => {
    setDraft({ ...DEFAULT_SKELETON_SETTINGS });
  };


  const set = (patch: Partial<SkeletonSettings>) => setDraft({ ...draft, ...patch });
  const dirty = settingsQ.data && JSON.stringify(draft) !== JSON.stringify(settingsQ.data);

  return (
    <AdminShell>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-32">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" /> Skeleton Loading
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Substitui spinners brancos por placeholders com o mesmo formato do conteúdo real
              — o usuário percebe a página como mais rápida e o layout não pula quando os
              dados chegam.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none px-4 py-2 rounded-full bg-muted hover:bg-muted/80">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                set({ enabled });
                mut.mutate({ enabled });
              }}
            />
            <span className="text-sm font-medium">{draft.enabled ? "Ativado" : "Desativado"}</span>
            <span
              className={`h-2 w-2 rounded-full ${draft.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
            />
          </label>
        </div>

        {/* Status */}
        <div className="flex items-start gap-2 text-sm p-3 rounded-xl bg-primary/5 border border-primary/20">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            Qualquer mudança abaixo aparece em <strong>tempo real</strong> na prévia à direita.
            Salvar aplica em todo o site — inclusive para clientes que estiverem navegando agora.
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Controls */}
          <div className="space-y-6">
            {/* Variant */}
            <Card icon={<Zap className="h-4 w-4" />} title="Estilo de animação">
              <div className="grid grid-cols-2 gap-2">
                {VARIANTS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => set({ variant: v.id })}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      draft.variant === v.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium text-sm">{v.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Sliders */}
            <Card icon={<Sliders className="h-4 w-4" />} title="Ajustes finos">
              <SliderRow
                label="Velocidade da animação"
                value={draft.speed_ms}
                min={400}
                max={4000}
                step={100}
                unit="ms"
                onChange={(v) => set({ speed_ms: v })}
                hint={`${draft.speed_ms < 900 ? "Rápido" : draft.speed_ms > 2500 ? "Devagar" : "Equilibrado"}`}
              />
              <SliderRow
                label="Cantos arredondados"
                value={draft.radius_px}
                min={0}
                max={32}
                step={1}
                unit="px"
                onChange={(v) => set({ radius_px: v })}
              />
              <SliderRow
                label="Intensidade do contraste"
                value={Math.round(draft.intensity * 100)}
                min={2}
                max={40}
                step={1}
                unit="%"
                onChange={(v) => set({ intensity: v / 100 })}
                hint="Quanto mais alto, mais visível o esqueleto."
              />
              <SliderRow
                label="Atraso entre itens (stagger)"
                value={draft.stagger_ms}
                min={0}
                max={200}
                step={10}
                unit="ms"
                onChange={(v) => set({ stagger_ms: v })}
                hint="Cria o efeito cascata em listas."
              />
            </Card>

            {/* Tone / tint */}
            <Card icon={<Palette className="h-4 w-4" />} title="Cor e tema">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Tom</div>
                <div className="grid grid-cols-2 gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => set({ tone: t.id })}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        draft.tone === t.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="text-xs text-muted-foreground">Matiz</div>
                <div className="grid grid-cols-4 gap-2">
                  {TINTS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => set({ tint: t.id })}
                      className={`p-2 rounded-lg text-xs border transition-colors flex flex-col items-center gap-1 ${
                        draft.tint === t.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <span
                        className="h-6 w-full rounded-md"
                        style={{ background: t.sample }}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Surface toggles */}
            <Card icon={<Layers className="h-4 w-4" />} title="Onde aplicar">
              <div className="space-y-1.5">
                {[
                  { key: "on_menu" as const, label: "Cardápio (produtos)" },
                  { key: "on_orders" as const, label: "Meus pedidos" },
                  { key: "on_admin" as const, label: "Painel administrativo" },
                  { key: "on_lists" as const, label: "Listas em geral (clientes, motoboys…)" },
                  { key: "on_forms" as const, label: "Formulários" },
                ].map((s) => (
                  <label
                    key={s.key}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40 cursor-pointer"
                  >
                    <span className="text-sm">{s.label}</span>
                    <input
                      type="checkbox"
                      checked={draft[s.key]}
                      onChange={(e) => set({ [s.key]: e.target.checked } as any)}
                    />
                  </label>
                ))}
              </div>

              <label className="flex items-center justify-between p-2.5 mt-2 rounded-lg bg-muted/30 cursor-pointer">
                <div>
                  <div className="text-sm font-medium">Respeitar “reduzir movimento”</div>
                  <div className="text-xs text-muted-foreground">
                    Desliga animação para quem ativou preferência de acessibilidade.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.reduce_motion_respect}
                  onChange={(e) => set({ reduce_motion_respect: e.target.checked })}
                />
              </label>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:sticky lg:top-4 self-start space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Prévia ao vivo:</span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["cards", "Cardápio"],
                    ["list", "Lista"],
                    ["table", "Tabela"],
                    ["chart", "Gráfico"],
                    ["form", "Formulário"],
                    ["full", "Página cheia"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPreview(id)}
                    className={`px-2.5 py-1 rounded-full text-xs ${
                      preview === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-4 bg-background overflow-auto max-h-[520px]">
              {preview === "cards" && <CardGridSkeleton count={6} aspect="aspect-square" />}
              {preview === "list" && <ListSkeleton rows={5} />}
              {preview === "table" && <TableSkeleton rows={6} cols={4} />}
              {preview === "chart" && (
                <div className="space-y-3">
                  <KpiRowSkeleton count={3} />
                  <ChartSkeleton height={220} bars={14} />
                </div>
              )}
              {preview === "form" && <FormSkeleton fields={4} />}
              {preview === "full" && (
                <div className="scale-[0.6] origin-top-left w-[166%] -mb-[40%]">
                  <AdminPageSkeleton />
                </div>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground text-center">
              Ajustes acima aparecem aqui instantaneamente. Clique <strong>Salvar</strong> para
              aplicar em todo o site.
            </div>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-background/95 backdrop-blur border shadow-xl rounded-full pl-4 pr-2 py-2">
          <span className="text-xs text-muted-foreground">
            {dirty ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <button
            onClick={resetDefaults}
            className="px-3 py-1.5 rounded-full text-sm hover:bg-muted flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Padrão
          </button>
          <button
            onClick={() => draft && mut.mutate(draft)}
            disabled={mut.isPending || !dirty}
            className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm flex items-center gap-1 disabled:opacity-50"
          >
            {mut.isPending ? (
              <Loader2 className="animate-spin h-3 w-3" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Salvar
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-4 bg-card/50 space-y-3">
      <div className="flex items-center gap-2 font-medium">
        <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
