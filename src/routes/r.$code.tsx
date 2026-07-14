import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { storeReferralCode, tryConsumeStoredReferralCode } from "@/lib/referral";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Loader2 } from "lucide-react";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "Você foi convidado — Quero Bis 🍨" },
      {
        name: "description",
        content:
          "Ganhe um cupom de boas-vindas na Quero Bis usando o link de indicação de um amigo.",
      },
      { property: "og:title", content: "Você foi convidado — Quero Bis 🍨" },
      {
        property: "og:description",
        content: "Ativei um cupom pra você. Peça agora e economize no primeiro pedido!",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralCapture,
});

function ReferralCapture() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      storeReferralCode(code);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await tryConsumeStoredReferralCode();
        navigate({ to: "/", replace: true });
      } else {
        // Send to signup with referral context. auth.tsx reads the stored code after signup.
        navigate({
          to: "/auth",
          search: { mode: "signup", ref: code } as never,
          replace: true,
        });
      }
    })();
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c031f] text-white p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
          <Gift className="h-8 w-8 text-fuchsia-300" />
        </div>
        <h1 className="text-2xl font-bold">Convite recebido! 🎉</h1>
        <p className="text-white/70">
          Um amigo indicou você na Quero Bis. Estamos preparando seu cupom de boas-vindas...
        </p>
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-fuchsia-300" />
      </div>
    </div>
  );
}
