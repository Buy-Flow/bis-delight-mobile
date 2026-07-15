import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase recovery links land here with #access_token=...&type=recovery — the
  // client parses the hash automatically into a session. We just need to wait
  // for that session to be present before allowing password update.
  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      // Also accept the case where the user is already signed in (they may
      // reach this page manually to change their password).
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecovery = hash.includes("type=recovery") || !!data.session;
      setValidLink(isRecovery);
      setReady(true);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setValidLink(true);
        setReady(true);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw1.length < 6) {
      setError("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (pw1 !== pw2) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate({ to: "/conta" }), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error("Não foi possível redefinir a senha", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, oklch(0.42 0.22 320) 0%, oklch(0.24 0.18 305) 45%, oklch(0.08 0.06 300) 100%)",
      }}
    >
      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/auth"
          className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
        </Link>

        <div className="rounded-3xl border border-white/10 bg-[oklch(0.14_0.09_305)]/85 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <h1
            className="font-display text-2xl font-black uppercase leading-none text-white"
            style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
          >
            Redefinir senha
          </h1>
          <p className="mt-2 text-xs text-white/60">
            Escolha uma nova senha para acessar sua conta.
          </p>

          {!ready ? (
            <div className="mt-6 flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          ) : !validLink ? (
            <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-sm">
                  <p className="font-bold">Link inválido ou expirado.</p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Volte para o login e clique novamente em "Esqueci minha senha" para receber um novo e-mail.
                  </p>
                </div>
              </div>
              <Link
                to="/auth"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-neon-pink px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white glow-pink"
              >
                Voltar ao login
              </Link>
            </div>
          ) : done ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center text-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-300" />
              <p className="text-sm font-bold">Senha atualizada!</p>
              <p className="text-xs text-emerald-200/80">Redirecionando para sua conta…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 transition focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/20">
                <Lock className="h-4 w-4 shrink-0 text-white/40" />
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  className="text-white/50 transition hover:text-white"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>
              <label className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 transition focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/20">
                <Lock className="h-4 w-4 shrink-0 text-white/40" />
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                />
              </label>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-100"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <p className="text-xs">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-pink px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white glow-pink transition active:scale-[.98] disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar nova senha
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
