import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
  IdCard,
  Eye,
  EyeOff,
  Award,
  Heart,
  ClipboardList,
  AlertCircle,
  X as XIcon,
} from "lucide-react";
import { z } from "zod";
import { formatCpf, isValidCpf } from "@/lib/cpf";

const searchSchema = z.object({
  next: z.string().optional(),
  ref: z.string().optional(),
  mode: z.string().optional(),
});

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

/** Máscara DD/MM/AAAA enquanto o usuário digita. */
function maskBirthday(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  const dd = d.slice(0, 2);
  const mm = d.slice(2, 4);
  const yy = d.slice(4, 8);
  let out = dd;
  if (mm) out += "/" + mm;
  if (yy) out += "/" + yy;
  return out;
}

/** Converte DD/MM/AAAA → AAAA-MM-DD (ISO). Retorna null se inválida. */
function birthdayToIso(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  const today = new Date();
  if (dt > today) return null;
  if (yyyy < 1900) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}


function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const next = safeNext(search.next);

  const [mode, setMode] = useState<"signin" | "signup">(
    search.mode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [cpf, setCpf] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const sendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!forgotEmail || !/^\S+@\S+\.\S+$/.test(forgotEmail)) {
      setForgotError("Informe um e-mail válido.");
      return;
    }
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setForgotSent(true);
      toast.success("E-mail de recuperação enviado!", {
        description: "Verifique sua caixa de entrada e a pasta de spam.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setForgotError(msg);
      toast.error("Não foi possível enviar o e-mail", { description: msg });
    } finally {
      setForgotSending(false);
    }
  };


  // Store referral code if present in URL
  useEffect(() => {
    if (search.ref) {
      import("@/lib/referral").then((m) => m.storeReferralCode(search.ref!));
    }
  }, [search.ref]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        import("@/lib/referral").then((m) => m.tryConsumeStoredReferralCode());
        navigate({ to: next });
      }
    });
  }, [navigate, next]);

  const showError = (title: string, detail?: string) => {
    setErrorMsg(title);
    setErrorDetail(detail ?? null);
    toast.error(title, detail ? { description: detail } : undefined);
  };

  const translateAuthError = (raw: string): { title: string; detail?: string } => {
    const s = raw.toLowerCase();
    if (/profiles_cpf_unique|duplicate key.*cpf/.test(s))
      return { title: "Este CPF já está cadastrado.", detail: "Faça login ou use outro CPF." };
    if (/database error saving new user/.test(s))
      return {
        title: "Não foi possível criar a conta.",
        detail: "O CPF ou e-mail já pode estar cadastrado. Tente entrar ou use outro CPF/e-mail.",
      };
    if (/user already registered|already exists/.test(s))
      return { title: "E-mail já cadastrado.", detail: "Tente fazer login com esse e-mail." };
    if (/invalid login credentials/.test(s))
      return { title: "E-mail ou senha incorretos.", detail: "Confira os dados e tente novamente." };
    if (/email not confirmed/.test(s))
      return { title: "Confirme seu e-mail.", detail: "Enviamos um link de confirmação para sua caixa de entrada." };
    if (/password should be at least/.test(s))
      return { title: "Senha muito curta.", detail: "Use no mínimo 6 caracteres." };
    if (/rate limit|too many/.test(s))
      return { title: "Muitas tentativas.", detail: "Aguarde um instante e tente novamente." };
    if (/network|failed to fetch/.test(s))
      return { title: "Sem conexão.", detail: "Verifique sua internet e tente novamente." };
    return { title: "Erro ao autenticar.", detail: raw };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorDetail(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        // 1) Validação algorítmica do CPF (dígitos verificadores)
        const cpfDigits = cpf.replace(/\D/g, "");
        if (!isValidCpf(cpfDigits)) {
          showError("CPF inválido.", "Confira os números digitados.");
          setLoading(false);
          return;
        }

        // 2) Validação da data de aniversário (DD/MM/AAAA)
        let birthdayIso: string | null = null;
        if (birthday) {
          birthdayIso = birthdayToIso(birthday);
          if (!birthdayIso) {
            showError("Data de aniversário inválida.", "Use o formato DD/MM/AAAA.");
            setLoading(false);
            return;
          }
        }

        // 3) Unicidade: 1 conta por CPF (via RPC security-definer, bypassa RLS)
        const { data: exists, error: checkErr } = await supabase.rpc("cpf_exists", {
          _cpf: cpfDigits,
        });
        if (checkErr) {
          console.error("[auth] cpf_exists error:", checkErr);
          // não bloqueia — o índice único ainda protege no servidor
        }
        if (exists === true) {
          showError("Este CPF já está cadastrado.", "Faça login para continuar.");
          setMode("signin");
          setLoading(false);
          return;
        }

        // 4) Validação de senha mínima
        if (password.length < 6) {
          showError("Senha muito curta.", "Use no mínimo 6 caracteres.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + next,
            data: {
              full_name: fullName,
              phone,
              birthday: birthdayIso,
              cpf: cpfDigits,
            },
          },
        });
        if (error) throw error;

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          toast.success("Conta criada! Confirme seu e-mail e entre.");
          setMode("signin");
          return;
        }
        toast.success("Bem-vindo à Quero Bis!");
        const { tryConsumeStoredReferralCode } = await import("@/lib/referral");
        await tryConsumeStoredReferralCode();
        navigate({ to: next });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        const { tryConsumeStoredReferralCode } = await import("@/lib/referral");
        await tryConsumeStoredReferralCode();
        navigate({ to: next });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[auth] error:", err);
      const t = translateAuthError(msg);
      showError(t.title, t.detail);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setErrorMsg(null);
    setErrorDetail(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + next,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: next });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[auth] google error:", err);
      showError("Erro no login com Google", msg);
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

      <div className="relative z-10 grid w-full max-w-md items-center gap-10 lg:max-w-6xl lg:grid-cols-[1.05fr_minmax(0,420px)] lg:gap-14">
        {/* Brand storytelling panel — só aparece em desktop, preenche o vazio à esquerda */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-6 lg:pr-4">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao cardápio
          </Link>
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-neon-yellow/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-neon-yellow ring-1 ring-neon-yellow/40">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-yellow shadow-[0_0_8px_rgba(255,215,60,0.9)]" />
              Sorveteria Quero Bis
            </div>
            <h2 className="font-display text-[52px] font-black leading-[0.95] text-white">
              O sabor que <span className="bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan bg-clip-text text-transparent">transforma</span> o seu dia.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
              Entre para acompanhar seus pedidos, acumular selos do <span className="font-semibold text-neon-yellow">Bis Recompensa</span>, salvar favoritos e receber cupons exclusivos.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-white/80">
            {[
              { t: "Pedidos com 1 toque", d: "Endereço, cartão e histórico salvos com segurança." },
              { t: "Fidelidade Bis", d: "Selos automáticos, cupons de aniversário e níveis VIP." },
              { t: "Push em tempo real", d: "Saiba quando o entregador saiu — sem abrir o app." },
            ].map((f) => (
              <li key={f.t} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-pink/30 to-neon-cyan/30 text-neon-yellow ring-1 ring-white/15">
                  <span className="text-sm font-black">✦</span>
                </span>
                <div className="min-w-0">
                  <div className="font-extrabold text-white">{f.t}</div>
                  <div className="text-[13px] text-white/60">{f.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="w-full">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao cardápio
          </Link>

        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.14_0.09_305)]/85 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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

            {errorMsg && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-left text-rose-100 backdrop-blur"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight">{errorMsg}</p>
                  {errorDetail && (
                    <p className="mt-0.5 text-xs text-rose-200/80 break-words">{errorDetail}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setErrorDetail(null);
                  }}
                  aria-label="Fechar aviso"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-rose-200/70 transition hover:bg-white/10 hover:text-white"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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
                  <Field icon={IdCard}>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="CPF (000.000.000-00)"
                      maxLength={14}
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                    />
                  </Field>
                  <Field icon={Cake}>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="bday"
                      value={birthday}
                      onChange={(e) => setBirthday(maskBirthday(e.target.value))}
                      placeholder="Aniversário (DD/MM/AAAA)"
                      maxLength={10}
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
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

              {mode === "signin" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotSent(false);
                      setForgotError(null);
                      setForgotOpen(true);
                    }}
                    className="text-xs font-semibold text-neon-cyan transition hover:text-white"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

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
