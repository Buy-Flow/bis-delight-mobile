import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReferralCode } from "@/lib/referral";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2, MessageCircle, Gift, Users, Trophy, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/indique")({
  head: () => ({ meta: [{ title: "Indique um amigo — Quero Bis" }] }),
  component: IndiquePage,
});

type Referral = {
  id: string;
  referee_email: string | null;
  referee_name: string | null;
  status: string;
  created_at: string;
  rewarded_at: string | null;
  referrer_coupon_code: string | null;
};

type Settings = {
  enabled: boolean;
  referrer_discount_type: "fixed" | "percent";
  referrer_discount_value: number;
  referrer_min_order: number;
  referee_discount_type: "fixed" | "percent";
  referee_discount_value: number;
  referee_min_order: number;
  expires_days: number;
  share_message: string;
};

const statusLabel: Record<string, { label: string; tone: string }> = {
  signed_up: { label: "Cadastrou", tone: "bg-blue-500/20 text-blue-200" },
  first_order_paid: { label: "Pediu", tone: "bg-amber-500/20 text-amber-200" },
  rewarded: { label: "Recompensado ✓", tone: "bg-emerald-500/20 text-emerald-200" },
  expired: { label: "Expirado", tone: "bg-white/10 text-white/60" },
};

function IndiquePage() {
  const [code, setCode] = useState<string | null>(null);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, r, s] = await Promise.all([
        getMyReferralCode(),
        // @ts-expect-error rpc
        supabase.rpc("get_my_referrals"),
        supabase.from("referral_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      setCode(c);
      setRefs(((r.data as Referral[]) ?? []).filter(Boolean));
      setSettings(s.data as Settings | null);
      setLoading(false);
    })();
  }, []);

  const link = useMemo(() => {
    if (!code) return "";
    return `${window.location.origin}/r/${code}`;
  }, [code]);

  const rewardedCount = refs.filter((r) => r.status === "rewarded").length;
  const pendingCount = refs.filter((r) => r.status === "signed_up").length;

  const format = (t: "fixed" | "percent", v: number) =>
    t === "percent" ? `${v}%` : `R$ ${Number(v).toFixed(2)}`;

  const shareText = useMemo(() => {
    const base = settings?.share_message ?? "Peço na Quero Bis 🍨";
    return `${base} ${link}`;
  }, [settings, link]);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };
  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Quero Bis", text: shareText, url: link });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  };
  const whatsapp = () => {
    if (!link) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="p-6 text-white/60">Carregando...</div>
    );
  }

  if (settings && !settings.enabled) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-white/70">
        <Gift className="h-12 w-12 mx-auto text-white/30 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Programa indisponível</h1>
        <p>O programa "Indique um amigo" está desativado no momento. Volte em breve!</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <header className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-200 text-xs mb-3">
          <Sparkles className="h-3.5 w-3.5" /> Ganhe cupons indicando amigos
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white">Indique &amp; Ganhe 🎁</h1>
        <p className="text-white/70 mt-2 max-w-xl mx-auto">
          Seu amigo ganha{" "}
          <b className="text-fuchsia-300">
            {settings ? format(settings.referee_discount_type, settings.referee_discount_value) : "—"}
          </b>{" "}
          no 1º pedido. Quando ele pedir, você ganha{" "}
          <b className="text-emerald-300">
            {settings ? format(settings.referrer_discount_type, settings.referrer_discount_value) : "—"}
          </b>{" "}
          de cupom.
        </p>
      </header>

      <Card className="bg-gradient-to-br from-fuchsia-500/20 to-purple-600/10 border-fuchsia-500/30 p-6 space-y-4">
        <div className="text-xs uppercase tracking-wide text-fuchsia-200/80">Seu link</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input readOnly value={link} className="bg-white/10 border-white/20 text-white font-mono" />
          <Button onClick={copy} className="bg-white/15 hover:bg-white/25 text-white gap-2">
            <Copy className="h-4 w-4" /> Copiar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={whatsapp} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button onClick={share} variant="outline" className="border-white/20 text-white gap-2 bg-white/5">
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
        </div>
        <p className="text-xs text-white/50">
          Código: <span className="font-mono text-fuchsia-200">{code}</span> • cupons expiram em{" "}
          {settings?.expires_days ?? 60} dias
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-white/5 border-white/10 p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-white/60 mb-1" />
          <div className="text-2xl font-bold text-white">{refs.length}</div>
          <div className="text-xs text-white/60">Indicados</div>
        </Card>
        <Card className="bg-white/5 border-white/10 p-4 text-center">
          <Gift className="h-5 w-5 mx-auto text-amber-300 mb-1" />
          <div className="text-2xl font-bold text-white">{pendingCount}</div>
          <div className="text-xs text-white/60">Aguardando pedido</div>
        </Card>
        <Card className="bg-white/5 border-white/10 p-4 text-center">
          <Trophy className="h-5 w-5 mx-auto text-emerald-300 mb-1" />
          <div className="text-2xl font-bold text-white">{rewardedCount}</div>
          <div className="text-xs text-white/60">Recompensas</div>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 p-4">
        <h2 className="text-white font-semibold mb-3">Suas indicações</h2>
        {refs.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            Nenhuma indicação ainda. Compartilhe seu link!
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {refs.map((r) => {
              const s = statusLabel[r.status] ?? statusLabel.signed_up;
              return (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {r.referee_name || r.referee_email || "Amigo"}
                    </div>
                    <div className="text-xs text-white/50">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      {r.referrer_coupon_code && (
                        <>
                          {" • "}
                          <span className="font-mono text-emerald-300">{r.referrer_coupon_code}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge className={`${s.tone} border-0`}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="bg-white/5 border-white/10 p-4 text-sm text-white/70">
        <h3 className="text-white font-semibold mb-2">Como funciona</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Compartilhe seu link com quem ainda não tem cadastro.</li>
          <li>
            Ao criar a conta, seu amigo ganha{" "}
            <b>
              {settings ? format(settings.referee_discount_type, settings.referee_discount_value) : "—"}
            </b>{" "}
            (pedido mínimo R$ {settings?.referee_min_order.toFixed(2) ?? "—"}).
          </li>
          <li>
            Quando ele pagar o 1º pedido, você recebe{" "}
            <b>
              {settings ? format(settings.referrer_discount_type, settings.referrer_discount_value) : "—"}
            </b>{" "}
            de cupom automaticamente.
          </li>
        </ol>
      </Card>
    </div>
  );
}
