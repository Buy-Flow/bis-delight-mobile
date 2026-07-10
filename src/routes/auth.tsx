import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { notifyCRM } from "@/lib/crm";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  Cake,

  Eye,
  EyeOff,
  Award,
  Heart,
  ClipboardList,
} from "lucide-react";
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
  const [birthday, setBirthday] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
            data: { full_name: fullName, phone, birthday: birthday || null },
          },
        });
        if (error) throw error;

        notifyCRM("contact_created", {
          email,
          full_name: fullName,
          phone,
          birthday: birthday || null,
        });

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
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, oklch(0.42 0.22 320) 0%, oklch(0.24 0.18 305) 45%, oklch(0.08 0.06 300) 100%)",
      }}
    >
      {/* Decorative glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "oklch(0.70 0.28 355 / 0.35)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "oklch(0.85 0.18 200 / 0.28)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao cardápio
        </Link>

        {/* Card */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[oklch(0.14_0.09_305)]/85 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* Top glow strip */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, oklch(0.85 0.18 200 / 0.7), transparent)",
            }}
          />

          {/* Mode tabs */}
          <div className="flex gap-1 p-3">
            <TabButton active={mode === "signin"} onClick={() => setMode("signin")}>
              Entrar
            </TabButton>
            <TabButton active={mode === "signup"} onClick={() => setMode("signup")}>
              Criar conta
            </TabButton>
          </div>

          <div className="px-6 pb-6 pt-2">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-neon-yellow/15 text-neon-yellow ring-1 ring-neon-yellow/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h1
                  className="font-display text-2xl font-black uppercase leading-none text-white"
                  style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                >
                  {mode === "signin" ? "Bem-vindo de volta" : "Vamos começar!"}
                </h1>
                <p className="mt-1 text-xs text-white/60">
                  {mode === "signin"
                    ? "Entre para acessar seus pedidos e recompensas."
                    : "Crie sua conta e ganhe selos a cada pedido."}
                </p>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={google}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg shadow-black/20 transition hover:-translate-y-[1px] hover:bg-white active:translate-y-0 disabled:opacity-60"
            >
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Continuar com Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <div className="h-px flex-1 bg-white/10" /> ou com e-mail <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={submit} className="space-y-3" autoComplete="on">
              {mode === "signup" && (
                <>
                  <Field icon={UserIcon}>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                    />
                  </Field>
                  <Field icon={Phone}>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Telefone (WhatsApp)"
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                    />
                  </Field>
                  <Field icon={Cake}>
                    <input
                      type="date"
                      required
                      autoComplete="bday"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      placeholder="Data de aniversário"
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none [color-scheme:dark]"
                    />
                  </Field>
                </>

              )}
              <Field icon={Mail}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                />
              </Field>
              <Field icon={Lock}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha (mín. 6 caracteres)"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="text-white/50 transition hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-neon-pink px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white glow-pink transition active:scale-[.98] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Entrar agora" : "Criar minha conta"}
              </button>
            </form>

            {/* Perks */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <Perk icon={Award} label="Recompensas" />
              <Perk icon={ClipboardList} label="Pedidos" />
              <Perk icon={Heart} label="Favoritos" />
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
              Ao continuar, você concorda com nossos termos e política de privacidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 rounded-2xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition " +
        (active
          ? "bg-white/10 text-white shadow-inner ring-1 ring-white/15"
          : "text-white/50 hover:text-white/80")
      }
    >
      {children}
    </button>
  );
}

function Field({
  icon: Icon,
  children,
}: {
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 transition focus-within:border-neon-cyan focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-neon-cyan/20">
      <Icon className="h-4 w-4 shrink-0 text-white/40" />
      {children}
    </label>
  );
}

function Perk({ icon: Icon, label }: { icon: typeof Award; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/5 bg-white/[0.03] px-2 py-3 text-center">
      <Icon className="h-4 w-4 text-neon-cyan" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</span>
    </div>
  );
}
