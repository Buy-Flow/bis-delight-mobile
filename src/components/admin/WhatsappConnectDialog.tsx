import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Smartphone, X, CheckCircle2, PowerOff, Radio, Copy, AlertTriangle, Activity, CheckCircle, MinusCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getWhatsappConnectionState,
  getWhatsappQrCode,
  disconnectWhatsapp,
  getWhatsappWebhookInfo,
  configureWhatsappWebhook,
} from "@/lib/whatsapp.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;
};

export function WhatsappConnectDialog({ open, onClose, onConnected }: Props) {
  const getState = useServerFn(getWhatsappConnectionState);
  const getQr = useServerFn(getWhatsappQrCode);
  const logout = useServerFn(disconnectWhatsapp);
  const getWebhook = useServerFn(getWhatsappWebhookInfo);
  const setWebhook = useServerFn(configureWhatsappWebhook);

  const [state, setState] = useState<string>("loading");
  const [qr, setQr] = useState<{ base64: string | null; code: string | null; pairingCode: string | null } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [webhook, setWebhookState] = useState<{ url: string; currentUrl: string | null; configured: boolean; hasToken: boolean } | null>(null);
  const [wbSaving, setWbSaving] = useState(false);
  const [diag, setDiag] = useState<{
    ok: number; skipped: number; error: number; total: number;
    lastEventAt: string | null; lastSyncAt: string | null; lastErrorAt: string | null; lastError: string | null;
  } | null>(null);
  const pollRef = useRef<number | null>(null);
  const diagRef = useRef<number | null>(null);
  const wasConnectedRef = useRef(false);

  async function refreshState() {
    try {
      const s = await getState();
      setState(s.state);
      if (s.state === "open") {
        setQr(null);
        if (!wasConnectedRef.current) {
          wasConnectedRef.current = true;
          toast.success("WhatsApp conectado!");
          onConnected?.();
        }
      } else {
        wasConnectedRef.current = false;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar estado");
      setState("error");
    }
  }

  async function fetchQr() {
    setLoadingQr(true);
    try {
      const r = await getQr();
      setQr(r);
      await refreshState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar QR");
    } finally {
      setLoadingQr(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o WhatsApp? Você precisará escanear o QR novamente.")) return;
    setDisconnecting(true);
    try {
      await logout();
      toast.success("Desconectado");
      setQr(null);
      await refreshState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  async function refreshWebhook() {
    try {
      const w = await getWebhook();
      setWebhookState(w);
    } catch {
      /* noop */
    }
  }

  async function handleConfigureWebhook() {
    setWbSaving(true);
    try {
      const r = await setWebhook();
      toast.success("Webhook configurado! Mensagens agora chegam em tempo real.");
      setWebhookState((prev) => (prev ? { ...prev, currentUrl: r.url, configured: true } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao configurar webhook");
    } finally {
      setWbSaving(false);
    }
  }

  async function refreshDiagnostics() {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [okRes, skipRes, errRes, lastEvt, lastSync, lastErr] = await Promise.all([
        supabase.from("whatsapp_ingest_logs").select("*", { count: "exact", head: true }).eq("status", "ok").gte("created_at", since),
        supabase.from("whatsapp_ingest_logs").select("*", { count: "exact", head: true }).eq("status", "skipped").gte("created_at", since),
        supabase.from("whatsapp_ingest_logs").select("*", { count: "exact", head: true }).eq("status", "error").gte("created_at", since),
        supabase.from("whatsapp_ingest_logs").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("whatsapp_ingest_logs").select("created_at").eq("source", "sync").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("whatsapp_ingest_logs").select("created_at,error").eq("status", "error").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const ok = okRes.count ?? 0;
      const skipped = skipRes.count ?? 0;
      const error = errRes.count ?? 0;
      setDiag({
        ok, skipped, error, total: ok + skipped + error,
        lastEventAt: (lastEvt.data as { created_at: string } | null)?.created_at ?? null,
        lastSyncAt: (lastSync.data as { created_at: string } | null)?.created_at ?? null,
        lastErrorAt: (lastErr.data as { created_at: string; error: string | null } | null)?.created_at ?? null,
        lastError: (lastErr.data as { created_at: string; error: string | null } | null)?.error ?? null,
      });
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    if (!open) return;
    refreshState();
    refreshWebhook();
    refreshDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    diagRef.current = window.setInterval(refreshDiagnostics, 5000);
    return () => {
      if (diagRef.current) window.clearInterval(diagRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Poll estado a cada 3s enquanto o modal está aberto
    pollRef.current = window.setInterval(refreshState, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Renovação automática do QR a cada 40s enquanto aguarda pareamento
  useEffect(() => {
    if (!open) return;
    if (state !== "connecting" && state !== "close" && state !== "not_found") return;
    if (!qr?.base64) return;
    const t = window.setTimeout(fetchQr, 40000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state, qr]);

  if (!open) return null;

  const connected = state === "open";
  const label =
    state === "open" ? "Conectado"
    : state === "connecting" ? "Aguardando pareamento"
    : state === "close" ? "Desconectado"
    : state === "not_found" ? "Instância não criada"
    : state === "loading" ? "Consultando..."
    : state === "unconfigured" ? "Sem configuração"
    : state === "error" ? "Erro"
    : state;

  const dot =
    connected ? "bg-emerald-400"
    : state === "connecting" ? "bg-amber-400 animate-pulse"
    : "bg-white/40";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a0b2e] to-[#0c031f] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-2.5">
            <Smartphone className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400/80">
              Evolution API
            </div>
            <h2 className="text-lg font-black tracking-tight">Conectar WhatsApp</h2>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-white/80">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {label}
          </div>
          <button
            onClick={refreshState}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10"
          >
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        </div>

        {connected ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
            <div className="mt-2 text-sm font-bold text-emerald-100">Telefone conectado</div>
            <p className="mt-1 text-xs text-emerald-100/70">
              As mensagens já estão sendo enviadas e recebidas por esta instância.
            </p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PowerOff className="h-3.5 w-3.5" />}
              Desconectar telefone
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-white p-3">
              {loadingQr ? (
                <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              ) : qr?.base64 ? (
                <img src={qr.base64} alt="QR Code WhatsApp" className="h-full w-full object-contain" />
              ) : (
                <div className="text-center text-xs text-black/50">
                  Clique em "Gerar QR Code" para começar
                </div>
              )}
            </div>

            <ol className="mt-4 space-y-1.5 text-[11px] text-white/70">
              <li>1. Abra o WhatsApp no seu celular</li>
              <li>2. Toque em <b>Configurações → Aparelhos conectados</b></li>
              <li>3. Toque em <b>Conectar um aparelho</b> e escaneie o QR acima</li>
            </ol>

            <button
              onClick={fetchQr}
              disabled={loadingQr}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50"
            >
              {loadingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {qr?.base64 ? "Gerar novo QR" : "Gerar QR Code"}
            </button>

            <p className="mt-2 text-center text-[10px] text-white/40">
              O QR expira em ~40s. Renovamos automaticamente enquanto este modal estiver aberto.
            </p>
          </div>
        )}

        {/* Webhook / Recebimento de mensagens */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${webhook?.configured ? "text-emerald-300" : "text-amber-300"}`} />
            <div className="flex-1">
              <div className="text-xs font-bold text-white">Recepção de mensagens</div>
              <div className="text-[10px] text-white/50">
                {webhook?.configured
                  ? "Webhook ativo — mensagens chegam em tempo real."
                  : "Sem webhook — mensagens recebidas não aparecem na caixa."}
              </div>
            </div>
            {webhook?.configured ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                Ativo
              </span>
            ) : (
              <button
                onClick={handleConfigureWebhook}
                disabled={wbSaving || !webhook?.hasToken}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-black hover:brightness-110 disabled:opacity-50"
              >
                {wbSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}
                Ativar webhook
              </button>
            )}
          </div>
          {webhook?.url && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5 text-[10px] text-white/60">
              <code className="flex-1 truncate">{webhook.url}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhook.url);
                  toast.success("URL copiada");
                }}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Copiar URL"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
          {webhook && !webhook.hasToken && (
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-200/80">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              EVOLUTION_WEBHOOK_TOKEN ausente nos secrets.
            </div>
          )}
        </div>

        {/* Diagnóstico */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-300" />
              <div className="text-xs font-bold text-white">Diagnóstico (últ. 24h)</div>
            </div>
            <button
              onClick={refreshDiagnostics}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/60 hover:bg-white/10"
            >
              <RefreshCw className="h-2.5 w-2.5" /> Atualizar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
              <CheckCircle className="mx-auto mb-0.5 h-3.5 w-3.5 text-emerald-300" />
              <div className="text-base font-black leading-none text-emerald-200">{diag?.ok ?? "—"}</div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-emerald-300/70">Salvos</div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 text-center">
              <MinusCircle className="mx-auto mb-0.5 h-3.5 w-3.5 text-amber-300" />
              <div className="text-base font-black leading-none text-amber-200">{diag?.skipped ?? "—"}</div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-amber-300/70">Ignorados</div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2 text-center">
              <XCircle className="mx-auto mb-0.5 h-3.5 w-3.5 text-red-300" />
              <div className="text-base font-black leading-none text-red-200">{diag?.error ?? "—"}</div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-red-300/70">Erros</div>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-[10.5px]">
            <DiagRow label="Último evento" value={fmtRelative(diag?.lastEventAt)} />
            <DiagRow label="Última sincronização" value={fmtRelative(diag?.lastSyncAt)} />
            <DiagRow
              label="Status do webhook"
              value={webhook?.configured ? "Ativo" : "Inativo"}
              tone={webhook?.configured ? "ok" : "warn"}
            />
          </div>

          {diag?.lastError && (
            <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-200">
                <AlertTriangle className="h-3 w-3" /> Último erro · {fmtRelative(diag.lastErrorAt)}
              </div>
              <div className="mt-1 line-clamp-2 text-[10px] text-red-100/80">{diag.lastError}</div>
            </div>
          )}

          {(diag?.total ?? 0) === 0 && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-white/5 bg-black/20 p-2 text-[10px] text-white/50">
              <Clock className="mt-0.5 h-3 w-3 shrink-0" />
              Nenhum evento nas últimas 24h. Envie ou receba uma mensagem para gerar tráfego.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagRow({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-white/80";
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-2 py-1">
      <span className="text-white/50">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0 || Number.isNaN(diff)) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
