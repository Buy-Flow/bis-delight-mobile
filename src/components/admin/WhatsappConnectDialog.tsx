import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Smartphone, X, CheckCircle2, PowerOff, Radio, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
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

  const [state, setState] = useState<string>("loading");
  const [qr, setQr] = useState<{ base64: string | null; code: string | null; pairingCode: string | null } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (!open) return;
    refreshState();
    // Auto-load QR se não estiver conectado
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      </div>
    </div>
  );
}
