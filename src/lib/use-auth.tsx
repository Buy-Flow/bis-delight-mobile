import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * useAuth — fonte única de verdade para sessão do Supabase.
 *
 * Corrige a race entre `getSession()` e `INITIAL_SESSION`:
 *  - `loading` inicia `true` e vira `false` UMA única vez, no primeiro sinal
 *    resolvido (o que chegar antes: INITIAL_SESSION ou getSession()).
 *  - Depois disso, `loading` nunca mais oscila. Só o `user` muda em resposta
 *    a eventos de identidade (SIGNED_IN / SIGNED_OUT / USER_UPDATED /
 *    TOKEN_REFRESHED com troca real de usuário).
 *  - Eventos "ruidosos" (PASSWORD_RECOVERY sem troca, TOKEN_REFRESHED sem
 *    mudança de user.id) não disparam re-render.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const settledRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const apply = (session: Session | null) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      const nextId = nextUser?.id ?? null;
      // Evita re-render se a identidade não mudou (ignora TOKEN_REFRESHED puro).
      if (nextId !== userIdRef.current) {
        userIdRef.current = nextId;
        setUser(nextUser);
      }
      if (!settledRef.current) {
        settledRef.current = true;
        setLoading(false);
      }
    };

    // 1) Subscrever primeiro — capta INITIAL_SESSION assim que dispara.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });

    // 2) Fallback: se por algum motivo INITIAL_SESSION não chegar (ex.: cliente
    // já hidratado antes do subscribe), garantimos settle via getSession().
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => {
        // Falha de rede/storage: destrava a UI mesmo assim, tratando como
        // "sem sessão" — o listener corrige se a sessão for restaurada depois.
        if (!mounted || settledRef.current) return;
        settledRef.current = true;
        setLoading(false);
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, isAuthenticated: !!user };
}

export async function signOut() {
  await supabase.auth.signOut();
}
