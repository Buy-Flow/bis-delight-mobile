import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// slider: usamos input[type=range] nativo (não há shadcn slider no projeto)
import { toast } from "sonner";
import {
  DEFAULT_ADMIN_THEME,
  loadAdminTheme,
  resetAdminTheme,
  saveAdminTheme,
  type AdminTheme,
} from "@/lib/admin-theme";
import {
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Type as TypeIcon,
  Ruler,
  PanelLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/personalizar-painel")({
  head: () => ({
    meta: [
      { title: "Personalizar painel — Quero Bis" },
      { name: "description", content: "Ajuste cores, tipografia e densidade do painel administrativo." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PersonalizarPainelPage,
});

type Preset = { name: string; theme: Partial<AdminTheme> };

const PRESETS: Preset[] = [
  {
    name: "Neon Bis (padrão)",
    theme: {
      background: "#0b0512",
      surface: "#170826",
      border: "#ffffff1a",
      primary: "#ff2e93",
      accent: "#f5e14a",
      text: "#ffffff",
      mutedText: "#ffffffb3",
    },
  },
  {
    name: "Meia-noite Indigo",
    theme: {
      background: "#0a0a1a",
      surface: "#141432",
      border: "#ffffff14",
      primary: "#4f46e5",
      accent: "#7dd3fc",
      text: "#ffffff",
      mutedText: "#c7d2fe",
    },
  },
  {
    name: "Carvão & Brasa",
    theme: {
      background: "#141414",
      surface: "#1f1f1f",
      border: "#ffffff10",
      primary: "#e85d3a",
      accent: "#f7c548",
      text: "#f5f5f5",
      mutedText: "#c9c9c9",
    },
  },
  {
    name: "Noir & Ouro",
    theme: {
      background: "#0d0d0d",
      surface: "#181818",
      border: "#ffffff14",
      primary: "#c9a84c",
      accent: "#f0d78c",
      text: "#f5f0e0",
      mutedText: "#d4c98a",
    },
  },
  {
    name: "Menta Neon",
    theme: {
      background: "#0d1b2a",
      surface: "#132a3a",
      border: "#ffffff14",
      primary: "#2dd4a8",
      accent: "#73ffb8",
      text: "#ecfeff",
      mutedText: "#a7f3d0",
    },
  },
  {
    name: "Claro editorial",
    theme: {
      background: "#f5f3ee",
      surface: "#ffffff",
      border: "#0a0a0a14",
      primary: "#0d0d0d",
      accent: "#e85d3a",
      text: "#0d0d0d",
      mutedText: "#3d3d3d",
    },
  },
];

const FONT_LABEL: Record<AdminTheme["fontFamily"], string> = {
  system: "Sistema (padrão)",
  inter: "Inter",
  "space-grotesk": "Space Grotesk",
  sora: "Sora",
  "jetbrains-mono": "JetBrains Mono",
};

function PersonalizarPainelPage() {
  const [theme, setTheme] = useState<AdminTheme>(DEFAULT_ADMIN_THEME);
  const [dirty, setDirty] = useState(false);
  const [live, setLive] = useState(true);

  useEffect(() => {
    setTheme(loadAdminTheme());
  }, []);

  // live preview: aplica em tempo real sem persistir
  useEffect(() => {
    if (!live) return;
    // reutiliza saveAdminTheme como broadcaster local em modo "preview"
    // porém sem escrever no localStorage. Emitimos o CustomEvent manualmente.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qb:admin-theme:change", { detail: theme }));
    }
  }, [theme, live]);

  const patch = <K extends keyof AdminTheme>(k: K, v: AdminTheme[K]) => {
    setTheme((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const applyPreset = (preset: Preset) => {
    setTheme((prev) => ({ ...prev, ...preset.theme }));
    setDirty(true);
    toast.success(`Preset "${preset.name}" aplicado`);
  };

  const onSave = () => {
    saveAdminTheme(theme);
    setDirty(false);
    toast.success("Personalização salva com sucesso");
  };

  const onReset = () => {
    resetAdminTheme();
    setTheme(DEFAULT_ADMIN_THEME);
    setDirty(false);
    toast.success("Voltamos ao padrão original");
  };

  const swatches = useMemo(
    () => [
      { key: "background" as const, label: "Fundo do painel", hint: "Cor principal do plano de fundo" },
      { key: "surface" as const, label: "Superfícies / Cards", hint: "Sidebar, cards e menus" },
      { key: "primary" as const, label: "Cor primária", hint: "Botões, foco e destaques principais" },
      { key: "accent" as const, label: "Cor de acento", hint: "Selo neon, títulos vibrantes e badges" },
      { key: "text" as const, label: "Texto principal", hint: "Textos e títulos" },
      { key: "mutedText" as const, label: "Texto secundário", hint: "Descrições e labels" },
      { key: "border" as const, label: "Bordas", hint: "Contornos sutis e divisórias" },
    ],
    [],
  );

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-6">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-black">
              <Palette className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3 w-3" /> Personalização
              </div>
              <h1 className="mt-1 text-2xl font-black text-white">Deixe o painel com a sua cara</h1>
              <p className="text-sm text-white/70">
                Cores, tipografia, arredondamento e sidebar — tudo salvo neste dispositivo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Pré-visualização ao vivo
            </label>
            <Button variant="outline" onClick={onReset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </Button>
            <Button onClick={onSave} disabled={!dirty} className="gap-2 bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4" /> Salvar personalização
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Formulário */}
          <div className="space-y-6">
            {/* Presets */}
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white/80">Presets prontos</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/25 hover:bg-white/10"
                  >
                    <div className="flex h-14 items-center gap-1 overflow-hidden rounded-lg">
                      {(["background", "surface", "primary", "accent"] as const).map((k) => (
                        <span
                          key={k}
                          className="h-full flex-1"
                          style={{ backgroundColor: p.theme[k] as string }}
                        />
                      ))}
                    </div>
                    <div className="text-xs font-bold text-white">{p.name}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Identidade */}
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white/80">Identidade</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="brandKicker">Kicker (linha pequena)</Label>
                  <Input
                    id="brandKicker"
                    value={theme.brandKicker}
                    onChange={(e) => patch("brandKicker", e.target.value)}
                    placeholder="Painel"
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label htmlFor="brandName">Nome da marca</Label>
                  <Input
                    id="brandName"
                    value={theme.brandName}
                    onChange={(e) => patch("brandName", e.target.value)}
                    placeholder="Quero Bis"
                    maxLength={40}
                  />
                  <p className="mt-1 text-[11px] text-white/50">
                    Salvamos no localStorage. Para mostrar no cabeçalho da sidebar, você pode integrar depois.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label>Família tipográfica</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(Object.keys(FONT_LABEL) as AdminTheme["fontFamily"][]).map((f) => (
                      <button
                        key={f}
                        onClick={() => patch("fontFamily", f)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          theme.fontFamily === f
                            ? "border-primary bg-primary/20 text-white"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {FONT_LABEL[f]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Cores */}
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white/80">Cores do painel</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {swatches.map((s) => (
                  <div key={s.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-3">
                      <label
                        className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-white/15"
                        style={{ backgroundColor: theme[s.key] }}
                      >
                        <input
                          type="color"
                          value={hexOnly(theme[s.key])}
                          onChange={(e) => patch(s.key, e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label={s.label}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white">{s.label}</div>
                        <div className="text-[11px] text-white/50">{s.hint}</div>
                      </div>
                      <Input
                        value={theme[s.key]}
                        onChange={(e) => patch(s.key, e.target.value)}
                        className="h-9 w-28 font-mono text-xs"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Formato */}
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white/80">Formato & densidade</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Arredondamento das bordas</Label>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold text-white">
                      {theme.radius}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={28}
                    step={1}
                    value={theme.radius}
                    onChange={(e) => patch("radius", Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-white/40">
                    <span>Reto</span>
                    <span>Bem redondo</span>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <PanelLeft className="h-3.5 w-3.5" /> Largura da sidebar
                    </Label>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold text-white">
                      {theme.sidebarWidth}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={320}
                    step={4}
                    value={theme.sidebarWidth}
                    onChange={(e) => patch("sidebarWidth", Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-white/40">
                    <span>Compacta</span>
                    <span>Espaçosa</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Preview */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-white/60">Prévia</div>
                <div className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
                  {live ? "AO VIVO" : "APENAS AO SALVAR"}
                </div>
              </div>
              <ThemePreview theme={theme} />
              <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                A prévia reflete as cores selecionadas. Clique em <b>Salvar</b> para tornar
                permanente neste navegador.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}

function hexOnly(v: string) {
  // <input type=color> só aceita #rrggbb. Se vier com alpha (#rrggbbaa), corta.
  const m = /^#([0-9a-fA-F]{6})/.exec(v);
  return m ? `#${m[1]}` : "#000000";
}

function ThemePreview({ theme }: { theme: AdminTheme }) {
  return (
    <div
      className="overflow-hidden rounded-xl ring-1 ring-white/10"
      style={{ background: theme.background, color: theme.text, borderRadius: theme.radius }}
    >
      <div
        className="flex items-center gap-2 border-b p-3"
        style={{ background: theme.surface, borderColor: theme.border }}
      >
        <div
          className="grid h-8 w-8 place-items-center text-black"
          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, borderRadius: theme.radius * 0.6 }}
        >
          ★
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accent }}>
            {theme.brandKicker || "Painel"}
          </div>
          <div className="text-sm font-black">{theme.brandName || "Quero Bis"}</div>
        </div>
      </div>
      <div className="grid gap-2 p-3">
        <div
          className="p-3 text-xs"
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: theme.radius * 0.6 }}
        >
          <div className="mb-1 font-black" style={{ color: theme.text }}>Card de exemplo</div>
          <div style={{ color: theme.mutedText }}>Texto secundário do painel.</div>
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1.5 text-xs font-bold text-white"
              style={{ background: theme.primary, borderRadius: theme.radius * 0.5 }}
            >
              Ação primária
            </button>
            <button
              className="px-3 py-1.5 text-xs font-bold"
              style={{ background: theme.accent, color: "#0b0512", borderRadius: theme.radius * 0.5 }}
            >
              Destaque
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["primary", "accent"] as const).map((k) => (
            <div
              key={k}
              className="p-2 text-center text-[10px] font-mono"
              style={{ background: theme[k], color: k === "primary" ? "#fff" : "#0b0512", borderRadius: theme.radius * 0.4 }}
            >
              {theme[k]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
