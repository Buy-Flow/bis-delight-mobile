import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PWA_SETTINGS,
  type PwaSettings,
  fetchPwaSettings,
  usePwaSettings,
  unregisterAppServiceWorkers,
  forceServiceWorkerUpdate,
  clearAppCaches,
  readCacheStats,
  prefetchMenuForOffline,
} from "@/lib/pwa-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WifiOff,
  Save,
  RotateCcw,
  RefreshCw,
  Trash2,
  Power,
  Download,
  ShieldAlert,
  HardDrive,
  Layers,
  Palette,
  Wrench,
  Activity,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pwa-offline")({
  component: PwaOfflineAdmin,
  head: () => ({
    meta: [
      { title: "PWA & Offline — Quero Bis" },
      {
        name: "description",
        content: "Configure o modo offline-first: cache do cardápio, banner, kill switch e ferramentas.",
      },
    ],
  }),
});

type Draft = Omit<PwaSettings, "updated_at">;

function toDraft(s: PwaSettings): Draft {
  const { updated_at: _u, ...rest } = s;
  void _u;
  return rest;
}

type TabId = "geral" | "banner" | "cache" | "ferramentas" | "stats";

function PwaOfflineAdmin() {
  const { settings, refresh } = usePwaSettings();
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT_PWA_SETTINGS));
  const [initial, setInitial] = useState<Draft>(toDraft(DEFAULT_PWA_SETTINGS));
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabId>("geral");

  useEffect(() => {
    fetchPwaSettings().then((s) => {
      setDraft(toDraft(s));
      setInitial(toDraft(s));
    });
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pwa_settings" as never)
        .update(draft as never)
        .eq("id", true);
      if (error) throw error;
      setInitial(draft);
      await refresh();
      toast.success("Configurações salvas — visitantes online serão atualizados.");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setDraft(initial);
  const bumpCacheVersion = () => update("cache_version", draft.cache_version + 1);

  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "geral", label: "Geral", icon: <Power className="h-4 w-4" /> },
    { id: "banner", label: "Banner", icon: <Palette className="h-4 w-4" /> },
    { id: "cache", label: "Cache", icon: <Layers className="h-4 w-4" /> },
    { id: "ferramentas", label: "Ferramentas", icon: <Wrench className="h-4 w-4" /> },
    { id: "stats", label: "Diagnóstico", icon: <Activity className="h-4 w-4" /> },
  ];

  const statusLabel = settings.kill_switch
    ? "Kill switch ativo"
    : settings.enabled
      ? "Offline ativo"
      : "Offline pausado";
  const statusColor = settings.kill_switch
    ? "bg-destructive/15 text-destructive"
    : settings.enabled
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : "bg-amber-500/15 text-amber-600 dark:text-amber-400";

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6 pb-32">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
              <WifiOff className="h-7 w-7 text-primary" />
              PWA & Modo Offline
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Controle o cardápio offline-first: o app instala um service worker que salva cardápio,
              imagens e páginas visitadas — quando o cliente ficar sem internet, ele ainda vê o que já
              carregou. Você pode pausar, forçar atualização ou desligar tudo daqui.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <span className={cn("px-2.5 py-1 rounded-full font-medium", statusColor)}>{statusLabel}</span>
            <span className="text-muted-foreground">
              Cache v{settings.cache_version} · Atualizado {new Date(settings.updated_at).toLocaleString("pt-BR")}
            </span>
          </div>
        </header>

        {!swSupported && (
          <InfoBox tone="destructive" icon={<ShieldAlert className="h-4 w-4" />} title="Navegador sem suporte">
            Este navegador não suporta service workers — as mudanças salvas serão aplicadas em outros
            dispositivos.
          </InfoBox>
        )}
        {swSupported && !online && (
          <InfoBox tone="warning" icon={<WifiOff className="h-4 w-4" />}>
            Você está offline — o painel funciona, mas salvar exige conexão.
          </InfoBox>
        )}

        <div className="flex gap-1 p-1 rounded-lg bg-muted/60 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition",
                tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "geral" && (
          <div className="space-y-4">
            <Panel
              title="Modo offline-first"
              description="Liga o service worker que guarda cardápio e imagens no dispositivo."
            >
              <Row
                label="Ativar offline-first"
                hint="Quando desligado, o service worker é removido do navegador dos visitantes."
              >
                <Toggle checked={draft.enabled} onChange={(v) => update("enabled", v)} />
              </Row>
              <Row
                label="Atualização automática"
                hint="Quando sair um novo build, aplicar sem pedir confirmação ao cliente."
              >
                <Toggle checked={draft.auto_update} onChange={(v) => update("auto_update", v)} />
              </Row>
              <Row
                label="Mostrar botão 'Instalar app'"
                hint="Convite para instalar no dispositivo (Android/desktop)."
              >
                <Toggle
                  checked={draft.show_install_prompt}
                  onChange={(v) => update("show_install_prompt", v)}
                />
              </Row>
            </Panel>

            <Panel
              title={
                <span className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" /> Kill switch
                </span>
              }
              description="Emergência: força TODOS os navegadores instalados a desregistrar o service worker na próxima visita. Use se algo estiver quebrado por causa do cache."
              tone="destructive"
            >
              <Row
                label="Ativar kill switch"
                hint="Depois que os clientes atualizarem, desligue o kill switch para reativar o offline."
              >
                <Toggle checked={draft.kill_switch} onChange={(v) => update("kill_switch", v)} />
              </Row>
            </Panel>
          </div>
        )}

        {tab === "banner" && (
          <div className="space-y-4">
            <Panel
              title="Banner de status"
              description="Aparece no topo quando o cliente perde ou recupera a conexão."
            >
              <Row label="Mostrar banner de conexão">
                <Toggle
                  checked={draft.offline_banner_enabled}
                  onChange={(v) => update("offline_banner_enabled", v)}
                />
              </Row>
              <Field label="Texto quando offline">
                <Input
                  value={draft.offline_banner_text}
                  onChange={(e) => update("offline_banner_text", e.target.value)}
                  maxLength={140}
                />
              </Field>
              <Field label="Texto quando reconectar">
                <Input
                  value={draft.online_restored_text}
                  onChange={(e) => update("online_restored_text", e.target.value)}
                  maxLength={140}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <PreviewBanner tone="offline" text={draft.offline_banner_text} />
                <PreviewBanner tone="online" text={draft.online_restored_text} />
              </div>
            </Panel>

            <Panel
              title="Página de fallback"
              description={
                <>
                  Exibida em{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">/offline</code> quando o cliente
                  tenta abrir uma página que ainda não foi salva.
                </>
              }
            >
              <Field label="Título">
                <Input
                  value={draft.offline_fallback_title}
                  onChange={(e) => update("offline_fallback_title", e.target.value)}
                />
              </Field>
              <Field label="Mensagem">
                <textarea
                  value={draft.offline_fallback_message}
                  onChange={(e) => update("offline_fallback_message", e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Texto do botão">
                <Input
                  value={draft.offline_fallback_cta}
                  onChange={(e) => update("offline_fallback_cta", e.target.value)}
                />
              </Field>
              <div className="rounded-lg border bg-muted/30 p-4 mt-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Prévia</div>
                <div className="text-center space-y-2 py-4">
                  <WifiOff className="h-8 w-8 mx-auto text-amber-500" />
                  <div className="font-semibold">{draft.offline_fallback_title}</div>
                  <div className="text-sm text-muted-foreground">{draft.offline_fallback_message}</div>
                  <Button size="sm" className="mt-2">
                    {draft.offline_fallback_cta}
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {tab === "cache" && (
          <div className="space-y-4">
            <Panel
              title="Pré-carregamento"
              description="O que salvar automaticamente na primeira visita para o offline funcionar."
            >
              <Row
                label="Pré-carregar cardápio ao abrir"
                hint="Guarda produtos e categorias no primeiro acesso."
              >
                <Toggle
                  checked={draft.prefetch_menu_on_load}
                  onChange={(v) => update("prefetch_menu_on_load", v)}
                />
              </Row>
              <Row
                label="Guardar imagens dos produtos"
                hint="Sem isso, offline mostra placeholders no lugar das fotos."
              >
                <Toggle
                  checked={draft.prefetch_images}
                  onChange={(v) => update("prefetch_images", v)}
                />
              </Row>
              <Field
                label={
                  <span className="flex justify-between w-full">
                    <span>Limite de imagens em cache</span>
                    <span className="font-mono text-muted-foreground">{draft.max_image_cache_entries}</span>
                  </span>
                }
              >
                <input
                  type="range"
                  min={20}
                  max={2000}
                  step={20}
                  value={draft.max_image_cache_entries}
                  onChange={(e) => update("max_image_cache_entries", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Imagens antigas são removidas automaticamente quando o limite é atingido.
                </p>
              </Field>
            </Panel>

            <Panel
              title="Versão do cache"
              description="Aumente para forçar TODOS os navegadores a re-baixarem cardápio, imagens e páginas."
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Versão atual (rascunho)</div>
                  <div className="text-2xl font-bold font-mono">v{draft.cache_version}</div>
                </div>
                <Button variant="outline" onClick={bumpCacheVersion}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Aumentar versão
                </Button>
              </div>
            </Panel>
          </div>
        )}

        {tab === "ferramentas" && <ToolsPanel />}
        {tab === "stats" && <DiagnosticsPanel />}
      </div>

      {dirty && (
        <div className="fixed bottom-4 inset-x-4 md:left-auto md:right-6 md:w-[420px] z-50">
          <div className="rounded-2xl border bg-background/95 backdrop-blur shadow-xl p-3 flex items-center gap-2">
            <div className="text-sm flex-1">
              <div className="font-medium">Alterações não salvas</div>
              <div className="text-xs text-muted-foreground">Salvar aplica em tempo real para todos.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              <RotateCcw className="mr-1 h-4 w-4" /> Descartar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Panel({
  title,
  description,
  children,
  tone,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  tone?: "destructive";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-5 space-y-4",
        tone === "destructive" && "border-destructive/40",
      )}
    >
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function InfoBox({
  tone = "info",
  icon,
  title,
  children,
}: {
  tone?: "info" | "warning" | "destructive";
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    info: "bg-muted/50 border-border",
    warning: "bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200",
    destructive: "bg-destructive/10 border-destructive/40 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm flex gap-2", toneClass)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>
        {title && <div className="font-semibold">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

function PreviewBanner({ tone, text }: { tone: "offline" | "online"; text: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white",
        tone === "offline" ? "bg-amber-600" : "bg-emerald-600",
      )}
    >
      <WifiOff className={cn("h-4 w-4", tone === "online" && "hidden")} />
      <span className="truncate">{text || "—"}</span>
    </div>
  );
}

function ToolsPanel() {
  const [busy, setBusy] = useState<string | null>(null);

  const runForceUpdate = async () => {
    setBusy("update");
    try {
      await forceServiceWorkerUpdate();
      toast.success("Atualização enviada ao service worker deste navegador.");
    } finally {
      setBusy(null);
    }
  };
  const runClearCache = async () => {
    setBusy("clear");
    try {
      const { deleted } = await clearAppCaches();
      toast.success(`${deleted.length} caches limpos.`);
    } finally {
      setBusy(null);
    }
  };
  const runUnregister = async () => {
    setBusy("unregister");
    try {
      const n = await unregisterAppServiceWorkers();
      toast.success(`${n} service worker(s) removido(s). Recarregue a página.`);
    } finally {
      setBusy(null);
    }
  };
  const runPrefetch = async () => {
    setBusy("prefetch");
    try {
      const urls = [window.location.origin + "/", window.location.origin + "/offline"];
      const { ok, failed } = await prefetchMenuForOffline(urls);
      toast.success(`Pré-carregado: ${ok} · falhou: ${failed}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <InfoBox tone="info" icon={<Info className="h-4 w-4" />}>
        Estas ações rodam no <b>seu navegador atual</b>. Para propagar mudanças a todos os visitantes,
        use "Aumentar versão do cache" na aba <b>Cache</b> ou o <b>Kill switch</b> na aba Geral, e salve.
      </InfoBox>

      <div className="grid gap-3 md:grid-cols-2">
        <ActionCard
          icon={<RefreshCw className="h-5 w-5" />}
          title="Forçar atualização do SW"
          desc="Pede ao service worker para checar por novos assets agora."
          onClick={runForceUpdate}
          loading={busy === "update"}
        />
        <ActionCard
          icon={<Trash2 className="h-5 w-5" />}
          title="Limpar caches locais"
          desc="Apaga todos os caches do app (cardápio, imagens, páginas). Push notifications não são afetadas."
          onClick={runClearCache}
          loading={busy === "clear"}
          destructive
        />
        <ActionCard
          icon={<Power className="h-5 w-5" />}
          title="Desregistrar SW neste navegador"
          desc="Remove o service worker. Útil para testar como um visitante novo veria o site."
          onClick={runUnregister}
          loading={busy === "unregister"}
          destructive
        />
        <ActionCard
          icon={<Download className="h-5 w-5" />}
          title="Pré-carregar cardápio agora"
          desc="Faz o SW baixar as páginas principais para uso offline imediato."
          onClick={runPrefetch}
          loading={busy === "prefetch"}
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
  loading,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="text-sm text-muted-foreground flex-1">{desc}</p>
      <Button
        size="sm"
        variant={destructive ? "destructive" : "outline"}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Executar
      </Button>
    </div>
  );
}

function DiagnosticsPanel() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof readCacheStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [swInfo, setSwInfo] = useState<{ scriptURL: string; state?: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const s = await readCacheStats();
      setStats(s);
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        setSwInfo(
          regs.map((r) => ({
            scriptURL: r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "?",
            state: r.active?.state || r.installing?.state || r.waiting?.state,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Recarregar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi
          icon={<HardDrive className="h-4 w-4" />}
          label="Uso de armazenamento"
          value={stats?.storageUsageMb != null ? `${stats.storageUsageMb} MB` : "—"}
          sub={stats?.storageQuotaMb ? `de ${stats.storageQuotaMb} MB disponíveis` : undefined}
        />
        <Kpi
          icon={<Layers className="h-4 w-4" />}
          label="Entradas em cache"
          value={String(stats?.totalEntries ?? 0)}
          sub={`${stats?.caches.length ?? 0} bucket(s)`}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="Service workers"
          value={String(swInfo.length)}
          sub={swInfo[0]?.state ?? "nenhum ativo"}
        />
      </div>

      <Panel title="Buckets de cache">
        {(stats?.caches ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cache criado neste navegador ainda.</p>
        ) : (
          <ul className="text-sm space-y-1 font-mono">
            {stats?.caches.map((c) => (
              <li key={c.name} className="flex justify-between">
                <span className="truncate">{c.name}</span>
                <span className="text-muted-foreground">{c.count} itens</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Service workers registrados">
        {swInfo.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum SW registrado neste navegador. Em ambiente de preview isso é normal.
          </p>
        ) : (
          <ul className="text-sm space-y-1 font-mono">
            {swInfo.map((s, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate">{s.scriptURL}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted shrink-0">{s.state || "?"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
