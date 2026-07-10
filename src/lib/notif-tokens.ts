import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export type NotifVars = {
  nome: string;
  primeiro_nome: string;
  selos: string;
};

const FALLBACK = "amigo(a)";

function firstName(full: string | null | undefined) {
  if (!full) return "";
  return String(full).trim().split(/\s+/)[0] ?? "";
}

export function applyNotifTokens(text: string | null | undefined, vars: NotifVars): string {
  if (!text) return "";
  return String(text)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, vars.primeiro_nome || FALLBACK)
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome || FALLBACK)
    .replace(/\{\{\s*selos\s*\}\}/gi, vars.selos ?? "0");
}

export function useNotifVars(): NotifVars {
  const { user } = useAuth();
  const [vars, setVars] = useState<NotifVars>({ nome: "", primeiro_nome: "", selos: "0" });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user) {
        setVars({ nome: "", primeiro_nome: "", selos: "0" });
        return;
      }
      const metaName =
        (user.user_metadata as { full_name?: string; name?: string } | null)?.full_name ||
        (user.user_metadata as { full_name?: string; name?: string } | null)?.name ||
        "";
      const [{ data: profile }, { data: loy }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("loyalty").select("stamps").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const full = (profile?.full_name || metaName || "").trim();
      const stamps = (loy?.stamps ?? 0) % 10;
      setVars({
        nome: full,
        primeiro_nome: firstName(full),
        selos: String(stamps),
      });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return vars;
}
