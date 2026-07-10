import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import {
  pushSupported,
  iosStandaloneRequired,
  isStandaloneApp,
  currentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { toast } from "sonner";

const DISMISS_KEY = "qb_push_dismissed_v1";

export function PushOptInCard() {
  const [visible, setVisible] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosBlock, setIosBlock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) return;
      if (typeof Notification === "undefined") return;
      const dismissed = localStorage.getItem(DISMISS_KEY);
      const sub = await currentSubscription();
      if (cancelled) return;
      setSubscribed(!!sub);
      if (sub) return; // already subscribed — hide card
      if (Notification.permission === "denied") return;
      if (dismissed && !isStandaloneApp()) return;
      if (iosStandaloneRequired()) {
        setIosBlock(true);
      }
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    setBusy(true);
    const res = await subscribeToPush({ forceNew: isStandaloneApp() });
    setBusy(false);
    if (res.ok) {
      setSubscribed(true);
      setVisible(false);
      toast.success("Notificações ativadas! Você receberá nossas novidades.");
    } else if (res.reason === "denied") {
      toast.error("Você bloqueou as notificações. Ative nas configurações do navegador.");
      setVisible(false);
    } else if (res.reason === "ios-install-required") {
      toast.info("No iPhone, instale o app na tela inicial primeiro para receber notificações.");
    } else if (res.reason === "unsupported") {
      toast.error("Seu navegador não suporta notificações.");
      setVisible(false);
    } else {
      toast.error("Não foi possível ativar. Tente de novo.");
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="mx-4 my-3 rounded-2xl border border-neon-cyan/40 bg-gradient-to-br from-acai-800/90 to-acai-900/90 p-4 shadow-lg backdrop-blur-sm animate-rise-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neon-pink/20 text-neon-pink">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-neon-yellow">
            Receba novidades e promoções
          </h3>
          <p className="mt-1 text-xs text-foreground/80">
            {iosBlock
              ? "Para receber no iPhone, instale o Quero Bis na tela inicial primeiro."
              : "Ative as notificações e seja o primeiro a saber de sabores novos e cupons."}
          </p>
          {!iosBlock && (
            <button
              type="button"
              disabled={busy}
              onClick={handleEnable}
              className="mt-3 rounded-full bg-neon-pink px-4 py-1.5 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Ativando..." : "Ativar notificações"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-foreground/50 transition hover:text-foreground"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Small toggle for the account page.
export function PushToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const sub = await currentSubscription();
      setSubscribed(!!sub);
      setReady(true);
    })();
  }, []);

  if (!ready || !pushSupported()) return null;

  async function toggle() {
    setBusy(true);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success("Notificações desativadas.");
    } else {
      const res = await subscribeToPush({ forceNew: isStandaloneApp() });
      if (res.ok) {
        setSubscribed(true);
        toast.success("Notificações ativadas!");
      } else {
        toast.error("Não foi possível ativar.");
      }
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
    >
      {subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {subscribed ? "Desativar notificações" : "Ativar notificações"}
    </button>
  );
}
