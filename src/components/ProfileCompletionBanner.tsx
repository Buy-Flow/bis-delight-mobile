import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AlertCircle, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidCpf, cpfDigits } from "@/lib/cpf";

const DISMISS_KEY = "profile-completion-banner-dismissed-until";

/**
 * Shows a gentle banner to legacy customers whose profile is missing fields
 * that became required after signup (CPF for now). Dismissible for 24h.
 * Only renders on customer-facing routes (hidden inside /conta and /auth).
 */
export function ProfileCompletionBanner() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [missing, setMissing] = useState<string[]>([]);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (dismissedUntil > Date.now()) return;

        const { data: session } = await supabase.auth.getUser();
        const user = session?.user;
        if (!user) return;

        const { data } = await supabase
          .from("profiles")
          .select("cpf, full_name, phone")
          .eq("id", user.id)
          .maybeSingle();

        const gaps: string[] = [];
        const cpfOk = !!data?.cpf && isValidCpf(cpfDigits(data.cpf));
        if (!cpfOk) gaps.push("CPF");
        if (!data?.full_name?.trim()) gaps.push("nome completo");
        if (!data?.phone?.trim()) gaps.push("telefone");

        if (!cancelled) {
          setMissing(gaps);
          setHidden(gaps.length === 0);
        }
      } catch {
        // silent — banner just doesn't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide on auth and on the account page (user is already there completing it)
  const onAccount = pathname.startsWith("/conta");
  const onAuth = pathname.startsWith("/auth");
  if (hidden || onAccount || onAuth || missing.length === 0) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setHidden(true);
  };

  const missingText =
    missing.length === 1
      ? missing[0]
      : missing.slice(0, -1).join(", ") + " e " + missing[missing.length - 1];

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[70] mx-auto flex max-w-3xl items-center gap-3 border-b border-neon-yellow/30 bg-gradient-to-r from-neon-pink/95 via-neon-purple/95 to-neon-cyan/95 px-4 py-2.5 text-white shadow-lg backdrop-blur"
    >
      <AlertCircle className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-xs sm:text-sm">
        <span className="font-black">Complete seu cadastro</span>
        <span className="ml-1 opacity-90">
          para nota fiscal e fidelidade — falta {missingText}.
        </span>
      </div>
      <Link
        to="/conta"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neon-yellow px-3 py-1.5 text-[11px] font-black text-[oklch(0.15_0.10_305)] shadow hover:brightness-110 sm:text-xs"
      >
        Completar <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar por hoje"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
