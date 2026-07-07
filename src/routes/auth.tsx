import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function safeNext(next: string | undefined): string {
  if (!next) return "/conta";
  // only allow same-origin relative paths
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/conta";
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const next = safeNext(search.next);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: next });
    });
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + next,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;

        // If email confirmation is on, session may be null; try direct sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          toast.success("Conta criada! Confirme seu e-mail e entre.");
          setMode("signin");
          return;
        }
        toast.success("Bem-vindo à Quero Bis!");
        navigate({ to: next });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: next });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + next,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no login com Google");
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, oklch(0.42 0.22 320) 0%, oklch(0.24 0.18 305) 45%, oklch(0.10 0.08 300) 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar ao cardápio
        </Link>

        <div className="rounded-3xl border border-white/10 bg-[oklch(0.14_0.09_305)]/85 p-6 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-neon-yellow" />
            <h1
              className="font-display text-2xl font-black uppercase text-white"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-white/60">
            {mode === "signin"
              ? "Acesse seus pedidos, favoritos e cupons Bis Recompensa."
              : "Cadastre-se para acumular selos e ganhar açaí grátis 🍧"}
          </p>

          <button
            onClick={google}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white/95 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5L18.7 5C17 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-2H12z" />
            </svg>
            Continuar com Google
          </button>

          <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
            <div className="h-px flex-1 bg-white/10" /> ou <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-3" autoComplete="on">
            {mode === "signup" && (
              <>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
                />
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefone (WhatsApp)"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
                />
              </>
            )}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha (mín. 6 caracteres)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-neon-cyan"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold text-white glow-pink active:scale-[.98] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-white/60 hover:text-white"
          >
            {mode === "signin" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
