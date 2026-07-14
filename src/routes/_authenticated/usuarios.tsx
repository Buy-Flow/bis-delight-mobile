import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ShieldCheck,
  Search,
  Users,
  Crown,
  Briefcase,
  UtensilsCrossed,
  Bike,
  User as UserIcon,
  UserCog,
  Plus,
  Minus,
  Download,
  History,
  X,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Wallet,
  AlertTriangle,
  Copy,
  CheckCircle2,
  Clock,
  UserPlus,
  Trash2,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { assignUserRole } from "@/lib/users.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e permissões — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersPage,
});

type Role = "admin" | "manager" | "staff" | "kitchen" | "delivery" | "user";

const ALL_ROLES: Role[] = ["admin", "manager", "staff", "kitchen", "delivery", "user"];

const ROLE_META: Record<Role, {
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  ring: string;
  chip: string;
  desc: string;
  perms: string[];
}> = {
  admin: {
    label: "Administrador",
    short: "Admin",
    icon: Crown,
    color: "from-amber-500 to-yellow-600",
    ring: "ring-amber-400/40",
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    desc: "Acesso irrestrito ao painel, financeiro e permissões.",
    perms: ["Tudo do painel", "Financeiro", "Gerenciar usuários", "Configurações"],
  },
  manager: {
    label: "Gerente",
    short: "Gerente",
    icon: UserCog,
    color: "from-indigo-500 to-violet-600",
    ring: "ring-indigo-400/40",
    chip: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
    desc: "Opera loja, promoções, estoque e vê relatórios.",
    perms: ["Cardápio", "Promoções", "Estoque", "Relatórios", "PDV"],
  },
  staff: {
    label: "Atendente",
    short: "Atendente",
    icon: Briefcase,
    color: "from-sky-500 to-cyan-600",
    ring: "ring-sky-400/40",
    chip: "bg-sky-500/15 text-sky-300 border-sky-400/30",
    desc: "Operação de balcão, PDV e atendimento no salão.",
    perms: ["PDV", "Mesas", "Pedidos", "Rush"],
  },
  kitchen: {
    label: "Cozinha",
    short: "Cozinha",
    icon: UtensilsCrossed,
    color: "from-orange-500 to-red-600",
    ring: "ring-orange-400/40",
    chip: "bg-orange-500/15 text-orange-300 border-orange-400/30",
    desc: "Visualiza pedidos em preparo e atualiza status.",
    perms: ["KDS/Rush", "Impressão", "Ficha técnica"],
  },
  delivery: {
    label: "Entregador",
    short: "Entrega",
    icon: Bike,
    color: "from-emerald-500 to-teal-600",
    ring: "ring-emerald-400/40",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    desc: "Vê rotas, entregas ativas e atualiza status.",
    perms: ["Entregas", "Rotas"],
  },
  user: {
    label: "Cliente",
    short: "Cliente",
    icon: UserIcon,
    color: "from-slate-500 to-slate-700",
    ring: "ring-slate-400/40",
    chip: "bg-slate-500/15 text-slate-300 border-slate-400/30",
    desc: "Cliente final. Faz pedidos e acumula fidelidade.",
    perms: ["Comprar", "Fidelidade", "Perfil"],
  },
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  cpf: string;
  birthday: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: Role[];
  orders_count: number;
  total_spent: number;
};

type AuditRow = {
  id: string;
  actor_email: string;
  actor_name: string;
  target_email: string;
  target_name: string;
  action: "grant" | "revoke";
  role: Role;
  note: string | null;
  created_at: string;
};

type PendingRow = {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
  note: string | null;
  granted_by_email: string | null;
  created_at: string;
};


const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString("pt-BR");
}

function initials(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all" | "team">("all");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const assignRole = useServerFn(assignUserRole);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error("Erro ao carregar usuários", {
        description:
          error.message?.includes("not_authorized") || error.code === "42501"
            ? "Sua conta não tem permissão de administrador."
            : error.message,
      });
      setRows([]);
    } else {
      setRows((data || []) as UserRow[]);
    }
    setLoading(false);
  };

  const loadAudit = async () => {
    const { data, error } = await supabase.rpc("admin_list_role_audit", { _limit: 200 });
    if (!error) setAudit((data || []) as AuditRow[]);
  };

  const loadPending = async () => {
    const { data, error } = await supabase.rpc("admin_list_pending_grants");
    if (!error) setPending((data || []) as PendingRow[]);
  };

  const cancelPending = async (id: string) => {
    const { error } = await supabase.rpc("admin_cancel_pending_grant", { _id: id });
    if (error) {
      toast.error("Falha ao cancelar convite", { description: error.message });
      return;
    }
    toast.success("Convite cancelado");
    await loadPending();
  };

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setMeId(uid);
      if (uid) {
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        setMeIsAdmin(Boolean(isAdmin));
      } else {
        setMeIsAdmin(false);
      }
    })();
    loadUsers();
    loadAudit();
    loadPending();
  }, []);


  const stats = useMemo(() => {
    const teamRoles: Role[] = ["admin", "manager", "staff", "kitchen", "delivery"];
    const total = rows.length;
    const team = rows.filter((r) => r.roles.some((x) => teamRoles.includes(x))).length;
    const admins = rows.filter((r) => r.roles.includes("admin")).length;
    const clients = rows.filter((r) => r.roles.length === 0 || (r.roles.length === 1 && r.roles[0] === "user")).length;
    const unverified = rows.filter((r) => !r.email_confirmed_at).length;
    const active30 = rows.filter((r) => r.last_sign_in_at && (Date.now() - new Date(r.last_sign_in_at).getTime()) < 30 * 86400_000).length;
    return { total, team, admins, clients, unverified, active30 };
  }, [rows]);

  const roleCounts = useMemo(() => {
    const c: Record<Role, number> = { admin: 0, manager: 0, staff: 0, kitchen: 0, delivery: 0, user: 0 };
    rows.forEach((r) => r.roles.forEach((x) => { c[x] = (c[x] || 0) + 1; }));
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter === "team") {
        if (!r.roles.some((x) => x !== "user")) return false;
      } else if (roleFilter !== "all") {
        if (!r.roles.includes(roleFilter)) return false;
      }
      if (!ql) return true;
      return (
        r.email.toLowerCase().includes(ql) ||
        r.full_name.toLowerCase().includes(ql) ||
        r.phone.toLowerCase().includes(ql) ||
        r.cpf.toLowerCase().includes(ql)
      );
    });
  }, [rows, q, roleFilter]);

  const grant = async (userId: string, role: Role) => {
    const { error } = await supabase.rpc("admin_grant_role", { _target: userId, _role: role });
    if (error) {
      toast.error("Falha ao conceder permissão", { description: error.message });
      return;
    }
    toast.success(`Permissão "${ROLE_META[role].label}" concedida`);
    await loadUsers();
    await loadAudit();
    setSelected((prev) => prev && prev.id === userId ? { ...prev, roles: Array.from(new Set([...prev.roles, role])) } : prev);
  };

  const revoke = async (userId: string, role: Role) => {
    if (role === "admin" && userId === meId) {
      toast.error("Você não pode remover seu próprio acesso de administrador.");
      return;
    }
    const { error } = await supabase.rpc("admin_revoke_role", { _target: userId, _role: role });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("cannot_remove_last_admin")) {
        toast.error("Não é possível remover o último administrador.");
      } else if (msg.includes("cannot_remove_own_admin")) {
        toast.error("Você não pode remover seu próprio admin.");
      } else {
        toast.error("Falha ao remover permissão", { description: msg });
      }
      return;
    }
    toast.success(`Permissão "${ROLE_META[role].label}" removida`);
    await loadUsers();
    await loadAudit();
    setSelected((prev) => prev && prev.id === userId ? { ...prev, roles: prev.roles.filter((x) => x !== role) } : prev);
  };

  const exportCsv = () => {
    const headers = ["Nome", "Email", "Telefone", "CPF", "Papéis", "Pedidos", "Total gasto", "Último acesso", "Cadastro"];
    const lines = filtered.map((r) => [
      r.full_name || "",
      r.email,
      r.phone,
      r.cpf,
      r.roles.join("|"),
      String(r.orders_count),
      String(r.total_spent),
      r.last_sign_in_at || "",
      r.created_at,
    ].map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="border-b border-white/5 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Usuários e permissões</h1>
              <p className="text-xs text-white/50 sm:text-sm">
                Controle quem entra, o que vê e o que pode fazer.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110"
            >
              <UserPlus className="h-3.5 w-3.5" /> Adicionar usuário
            </button>
            <button
              onClick={() => setShowAudit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              <History className="h-3.5 w-3.5" /> Histórico
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {meIsAdmin === false && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            Sua conta não tem permissão de administrador. Apenas admins podem
            gerenciar usuários. Peça a outro admin para conceder-lhe o papel
            <span className="font-semibold"> admin</span>.
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Clock className="h-4 w-4" />
                Convites pendentes ({pending.length})
              </div>
              <span className="text-[11px] text-amber-200/70">
                O papel é aplicado automaticamente quando a pessoa criar conta com o email.
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {pending.map((p) => {
                const meta = ROLE_META[p.role];
                const Icon = meta.icon;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {p.full_name || p.email}
                      </div>
                      <div className="truncate text-xs text-white/50">{p.email}</div>
                      {p.note && (
                        <div className="mt-1 truncate text-[11px] text-white/40">{p.note}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <button
                        onClick={() => cancelPending(p.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
                        title="Cancelar convite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi icon={Users} label="Total" value={stats.total} tint="from-slate-500/20 to-slate-500/5" />
          <Kpi icon={UserCog} label="Equipe" value={stats.team} tint="from-indigo-500/20 to-indigo-500/5" />
          <Kpi icon={Crown} label="Admins" value={stats.admins} tint="from-amber-500/20 to-amber-500/5" />
          <Kpi icon={UserIcon} label="Clientes" value={stats.clients} tint="from-emerald-500/20 to-emerald-500/5" />
          <Kpi icon={CheckCircle2} label="Ativos 30d" value={stats.active30} tint="from-sky-500/20 to-sky-500/5" />
          <Kpi icon={AlertTriangle} label="Sem verif." value={stats.unverified} tint="from-rose-500/20 to-rose-500/5" />
        </div>

        {/* Role pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRoleFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              roleFilter === "all"
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:text-white",
            )}
          >
            Todos ({rows.length})
          </button>
          <button
            onClick={() => setRoleFilter("team")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              roleFilter === "team"
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:text-white",
            )}
          >
            Equipe ({stats.team})
          </button>
          {ALL_ROLES.map((r) => {
            const meta = ROLE_META[r];
            const Icon = meta.icon;
            const active = roleFilter === r;
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label} ({roleCounts[r]})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, email, telefone ou CPF…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/40 focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
          />
        </div>

        {/* Role legend cards */}
        {roleFilter === "all" && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLES.filter((r) => r !== "user").map((r) => {
              const m = ROLE_META[r];
              const Icon = m.icon;
              return (
                <div key={r} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white", m.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-white">{m.label}</div>
                    <div className="ml-auto text-xs text-white/50">{roleCounts[r]}</div>
                  </div>
                  <p className="mt-2 text-xs text-white/60">{m.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.perms.map((p) => (
                      <span key={p} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-12 border-b border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
            <div className="col-span-4">Usuário</div>
            <div className="col-span-3">Papéis</div>
            <div className="col-span-2 hidden sm:block">Pedidos</div>
            <div className="col-span-2 hidden sm:block">Último acesso</div>
            <div className="col-span-1 text-right">Ações</div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-white/50">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-2 text-sm text-white/50">Nenhum usuário encontrado.</p>
            </div>
          ) : (
            filtered.map((u) => {
              const isSelf = u.id === meId;
              const topRole: Role = u.roles.includes("admin")
                ? "admin"
                : u.roles.includes("manager")
                ? "manager"
                : (u.roles[0] as Role) || "user";
              const meta = ROLE_META[topRole];
              return (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="grid w-full grid-cols-12 items-center gap-2 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <div className="col-span-4 flex min-w-0 items-center gap-3">
                    <div className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ring-2", meta.color, meta.ring)}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        initials(u.full_name, u.email)
                      )}
                      {!u.email_confirmed_at && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-rose-500 ring-2 ring-slate-950" title="Email não verificado">
                          <AlertTriangle className="h-2 w-2 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                        {u.full_name || u.email.split("@")[0]}
                        {isSelf && (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-white/50">{u.email}</div>
                    </div>
                  </div>
                  <div className="col-span-3 flex flex-wrap gap-1">
                    {u.roles.length === 0 ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                        sem papel
                      </span>
                    ) : (
                      u.roles.slice(0, 3).map((r) => {
                        const m = ROLE_META[r];
                        const Icon = m.icon;
                        return (
                          <span key={r} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", m.chip)}>
                            <Icon className="h-2.5 w-2.5" />
                            {m.short}
                          </span>
                        );
                      })
                    )}
                    {u.roles.length > 3 && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                        +{u.roles.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <div className="text-sm font-semibold text-white">{u.orders_count}</div>
                    <div className="text-[11px] text-white/50">{BRL(u.total_spent)}</div>
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <div className="text-xs text-white/70">{timeAgo(u.last_sign_in_at)}</div>
                    <div className="text-[11px] text-white/40">Cad. {new Date(u.created_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-white/60">Gerenciar</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selected && (
        <UserDrawer
          user={selected}
          isSelf={selected.id === meId}
          onClose={() => setSelected(null)}
          onGrant={(r) => grant(selected.id, r)}
          onRevoke={(r) => revoke(selected.id, r)}
          
        />
      )}

      {showAudit && <AuditDrawer rows={audit} onClose={() => setShowAudit(false)} />}

      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSubmit={async (payload) => {
            try {
              if (!payload.role) throw new Error("Selecione um papel");
              const res = await assignRole({ data: { ...payload, role: payload.role } });
              toast.success(
                res.status === "granted"
                  ? "Papel atribuído ao usuário"
                  : "Papel reservado — será aplicado assim que essa pessoa criar a conta",
              );
              setShowInvite(false);
              await loadUsers();
              await loadAudit();
              await loadPending();

            } catch (e: any) {
              toast.error("Falha ao atribuir papel", { description: e?.message });
            }
          }}
        />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br p-3", tint)}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{value}</div>
    </div>
  );
}

function UserDrawer({
  user,
  isSelf,
  onClose,
  onGrant,
  onRevoke,
}: {
  user: UserRow;
  isSelf: boolean;
  onClose: () => void;
  onGrant: (r: Role) => void;
  onRevoke: (r: Role) => void;
}) {
  const topRole: Role = user.roles.includes("admin") ? "admin" : (user.roles[0] as Role) || "user";
  const meta = ROLE_META[topRole];

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copiado");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("relative bg-gradient-to-br p-6 pb-14", meta.color)}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/20 text-2xl font-bold text-white ring-4 ring-white/20 backdrop-blur">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                initials(user.full_name, user.email)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-white">
                {user.full_name || user.email.split("@")[0]}
              </h2>
              <div className="truncate text-xs text-white/80">{user.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                <meta.icon className="h-3 w-3" /> {meta.label}
              </div>
            </div>
          </div>
        </div>

        <div className="-mt-8 space-y-4 px-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={ShoppingBag} label="Pedidos" value={String(user.orders_count)} />
            <StatCard icon={Wallet} label="Total gasto" value={BRL(user.total_spent)} />
          </div>

          <Section title="Contato">
            <Field icon={Mail} label="Email" value={user.email} onCopy={() => copy(user.email)} />
            {user.phone && (
              <Field icon={Phone} label="Telefone" value={user.phone} onCopy={() => copy(user.phone)} />
            )}
            {user.cpf && (
              <Field icon={UserIcon} label="CPF" value={user.cpf} onCopy={() => copy(user.cpf)} />
            )}
            {user.birthday && (
              <Field
                icon={Calendar}
                label="Aniversário"
                value={new Date(user.birthday).toLocaleDateString("pt-BR")}
              />
            )}
          </Section>

          <Section title="Acessos">
            <Field
              icon={CheckCircle2}
              label="Email verificado"
              value={user.email_confirmed_at ? "Sim" : "Não"}
            />
            <Field icon={Clock} label="Último acesso" value={timeAgo(user.last_sign_in_at)} />
            <Field
              icon={UserPlus}
              label="Cadastro"
              value={new Date(user.created_at).toLocaleDateString("pt-BR")}
            />
          </Section>

          <Section title="Permissões" hint="Ative ou desative papéis para este usuário.">
            <div className="space-y-2">
              {ALL_ROLES.map((r) => {
                const m = ROLE_META[r];
                const Icon = m.icon;
                const has = user.roles.includes(r);
                const disabled = isSelf && r === "admin" && has;
                return (
                  <div
                    key={r}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition",
                      has ? "border-white/20 bg-white/5" : "border-white/5 bg-white/[0.02]",
                    )}
                  >
                    <div className={cn("grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br text-white", m.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">{m.label}</div>
                      <div className="truncate text-[11px] text-white/50">{m.desc}</div>
                    </div>
                    {has ? (
                      <button
                        disabled={disabled}
                        onClick={() => onRevoke(r)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                        title={disabled ? "Você não pode remover seu próprio admin" : undefined}
                      >
                        <Minus className="h-3 w-3" /> Remover
                      </button>
                    ) : (
                      <button
                        onClick={() => onGrant(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Plus className="h-3 w-3" /> Conceder
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-wider text-white/70">{title}</div>
        {hint && <div className="mt-0.5 text-[11px] text-white/50">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onCopy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 py-2 last:border-b-0">
      <Icon className="h-4 w-4 shrink-0 text-white/40" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
        <div className="truncate text-sm text-white">{value}</div>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function AuditDrawer({ rows, onClose }: { rows: AuditRow[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur">
          <History className="h-5 w-5 text-white/60" />
          <h2 className="text-lg font-bold text-white">Histórico de permissões</h2>
          <button
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/50">
              Nenhuma alteração registrada ainda.
            </div>
          ) : (
            <ol className="relative border-l border-white/10">
              {rows.map((r) => {
                const meta = ROLE_META[r.role];
                const Icon = meta.icon;
                const isGrant = r.action === "grant";
                return (
                  <li key={r.id} className="mb-4 ml-4">
                    <span
                      className={cn(
                        "absolute -left-2 grid h-4 w-4 place-items-center rounded-full ring-4 ring-slate-950",
                        isGrant ? "bg-emerald-500" : "bg-rose-500",
                      )}
                    >
                      {isGrant ? (
                        <Plus className="h-2.5 w-2.5 text-white" />
                      ) : (
                        <Minus className="h-2.5 w-2.5 text-white" />
                      )}
                    </span>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.chip)}>
                          <Icon className="h-2.5 w-2.5" /> {meta.short}
                        </span>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          isGrant ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
                        )}>
                          {isGrant ? "Concedido" : "Removido"}
                        </span>
                        <span className="ml-auto text-[10px] text-white/40">
                          {timeAgo(r.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-white/70">
                        <span className="font-semibold text-white">{r.actor_name || r.actor_email || "Sistema"}</span>{" "}
                        {isGrant ? "concedeu" : "removeu"} para{" "}
                        <span className="font-semibold text-white">
                          {r.target_name || r.target_email || "usuário"}
                        </span>
                      </div>
                      {r.note && (
                        <div className="mt-1 text-[11px] italic text-white/50">"{r.note}"</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

type InvitePayload = { email: string; fullName?: string; role?: Role; note?: string };

function InviteDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: InvitePayload) => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        role,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <UserPlus className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Adicionar usuário</h2>
            <p className="text-[11px] text-white/50">Atribui o papel diretamente ao email — sem envio de convite.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">Email *</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="funcionario@exemplo.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">Nome (opcional)</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/60">Papel inicial</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_ROLES.filter((r) => r !== "user").map((r) => {
                const m = ROLE_META[r];
                const Icon = m.icon;
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2.5 text-left transition",
                      active ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <div className={cn("grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-white", m.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">{m.short}</div>
                      <div className="truncate text-[10px] text-white/50">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">Nota (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: contratação do turno da noite"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !email.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Atribuir papel"}
          </button>
        </div>
      </form>
    </div>
  );
}
