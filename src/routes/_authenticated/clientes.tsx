import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  LogOut,
  Loader2,
  Users,
  Search,
  Download,
  Phone,
  Cake,
  MapPin,
  ShoppingBag,
  MessageCircle,
  Sparkles,
  ClipboardList,
  X,
  Award,
  Ticket,
  TrendingUp,
  Package,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/menu-data";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Painel Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientesPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  birthday: string | null;
  address: string | null;
  reference: string | null;
  created_at: string;
};

type OrderLite = {
  user_id: string;
  total: number;
  status: string;
  created_at: string;
};

type ClientRow = Profile & {
  orders_count: number;
  total_spent: number;
  paid_spent: number;
  last_order_at: string | null;
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

const formatPhone = (s: string | null | undefined) => {
  const d = onlyDigits(s);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s ?? "—";
};

const formatBirthday = (b: string | null) => {
  if (!b) return null;
  const [y, m, d] = b.split("-");
  if (!y || !m || !d) return b;
  return `${d}/${m}/${y}`;
};

const monthOf = (b: string | null) => {
  if (!b) return null;
  return Number(b.split("-")[1]);
};

function ClientesPage() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useIsAdmin();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.10_0.08_300)] px-4 text-white">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-black">Acesso negado</h1>
          <p className="mt-2 text-sm text-white/60">
            Sua conta não tem permissão de administrador.
          </p>
          <button
            onClick={signOut}
            className="mt-6 rounded-2xl bg-neon-pink px-4 py-2 text-sm font-bold text-white"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.08_300)] text-white">
      <Toaster position="top-center" theme="dark" />

      <header className="sticky top-0 z-30 border-b border-purple-900/50 bg-[oklch(0.10_0.08_300)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Users className="h-5 w-5 text-neon-yellow" />
            <span
              className="text-xl font-black uppercase text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Clientes
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              Painel
            </Link>
            <Link
              to="/pedidos"
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-purple-800/50 hover:text-white"
            >
              <ClipboardList className="h-3.5 w-3.5" /> Pedidos
            </Link>
            <Link
              to="/"
              className="hidden items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white sm:inline-flex"
            >
              <Home className="h-3.5 w-3.5" /> Ver site
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <ClientesDashboard />
      </main>
    </div>
  );
}

type FilterKey = "all" | "buyers" | "birthday" | "with_address" | "no_orders";

function ClientesDashboard() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);


  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["clientes-admin"],
    queryFn: async (): Promise<ClientRow[]> => {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, birthday, address, reference, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("user_id, total, status, created_at"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const profiles = (profilesRes.data ?? []) as Profile[];
      const orders = (ordersRes.data ?? []) as OrderLite[];

      const byUser = new Map<
        string,
        { count: number; total: number; paid: number; last: string | null }
      >();
      for (const o of orders) {
        const cur = byUser.get(o.user_id) ?? {
          count: 0,
          total: 0,
          paid: 0,
          last: null as string | null,
        };
        cur.count += 1;
        cur.total += Number(o.total ?? 0);
        if (o.status === "pago") cur.paid += Number(o.total ?? 0);
        if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
        byUser.set(o.user_id, cur);
      }

      return profiles.map((p) => {
        const s = byUser.get(p.id);
        return {
          ...p,
          orders_count: s?.count ?? 0,
          total_spent: s?.total ?? 0,
          paid_spent: s?.paid ?? 0,
          last_order_at: s?.last ?? null,
        };
      });
    },
    staleTime: 30_000,
  });

  const rows = data ?? [];
  const currentMonth = new Date().getMonth() + 1;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "buyers" && r.orders_count === 0) return false;
      if (filter === "no_orders" && r.orders_count > 0) return false;
      if (filter === "birthday" && monthOf(r.birthday) !== currentMonth) return false;
      if (filter === "with_address" && !r.address) return false;
      if (!term) return true;
      const hay = `${r.full_name ?? ""} ${r.phone ?? ""} ${r.address ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, filter, currentMonth]);

  const kpis = useMemo(() => {
    const buyers = rows.filter((r) => r.orders_count > 0).length;
    const bdays = rows.filter((r) => monthOf(r.birthday) === currentMonth).length;
    const revenue = rows.reduce((acc, r) => acc + r.paid_spent, 0);
    return { total: rows.length, buyers, bdays, revenue };
  }, [rows, currentMonth]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum cliente para exportar");
      return;
    }
    const header = [
      "Nome",
      "Telefone",
      "Aniversário",
      "Endereço",
      "Referência",
      "Pedidos",
      "Total gasto",
      "Total pago",
      "Último pedido",
      "Cadastrado em",
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.full_name ?? "",
          formatPhone(r.phone),
          formatBirthday(r.birthday) ?? "",
          r.address ?? "",
          r.reference ?? "",
          r.orders_count,
          r.total_spent.toFixed(2).replace(".", ","),
          r.paid_spent.toFixed(2).replace(".", ","),
          r.last_order_at ? new Date(r.last_order_at).toLocaleString("pt-BR") : "",
          new Date(r.created_at).toLocaleString("pt-BR"),
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-quero-bis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} cliente(s) exportado(s)`);
  };

  const copyPhones = async () => {
    const phones = filtered
      .map((r) => onlyDigits(r.phone))
      .filter((p) => p.length >= 10);
    if (phones.length === 0) {
      toast.error("Nenhum telefone válido");
      return;
    }
    await navigator.clipboard.writeText(phones.join("\n"));
    toast.success(`${phones.length} telefone(s) copiado(s)`);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Users} label="Total de clientes" value={String(kpis.total)} tint="text-neon-cyan" />
        <KpiCard icon={ShoppingBag} label="Compradores" value={String(kpis.buyers)} tint="text-neon-yellow" />
        <KpiCard icon={Cake} label="Aniversariantes do mês" value={String(kpis.bdays)} tint="text-neon-pink" />
        <KpiCard icon={Sparkles} label="Receita paga" value={BRL(kpis.revenue)} tint="text-emerald-300" />
      </div>

      {/* Toolbar */}
      <div className="rounded-3xl border border-purple-800/50 bg-purple-950/40 p-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone ou endereço…"
              className="w-full rounded-2xl border border-purple-800/60 bg-purple-950/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-neon-pink focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyPhones}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" /> Copiar telefones
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            Todos ({rows.length})
          </Chip>
          <Chip active={filter === "buyers"} onClick={() => setFilter("buyers")}>
            Compraram ({kpis.buyers})
          </Chip>
          <Chip active={filter === "no_orders"} onClick={() => setFilter("no_orders")}>
            Sem pedidos ({rows.length - kpis.buyers})
          </Chip>
          <Chip active={filter === "birthday"} onClick={() => setFilter("birthday")}>
            Aniversariantes ({kpis.bdays})
          </Chip>
          <Chip active={filter === "with_address"} onClick={() => setFilter("with_address")}>
            Com endereço
          </Chip>
        </div>
      </div>

      {/* Table / list */}
      <div className="rounded-3xl border border-purple-800/50 bg-purple-950/40 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-purple-800/40 px-4 py-3">
          <p className="text-sm font-semibold text-white/80">
            {filtered.length} cliente(s)
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs text-white/50 hover:text-white/80"
          >
            {isFetching ? "Atualizando…" : "Atualizar"}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-white/50">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-purple-900/40">
            {filtered.map((r) => (
              <ClientRowItem
                key={r.id}
                row={r}
                currentMonth={currentMonth}
                onOpen={() => setSelectedId(r.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <ClientDetailDialog
        client={rows.find((r) => r.id === selectedId) ?? null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}


function ClientRowItem({
  row,
  currentMonth,
  onOpen,
}: {
  row: ClientRow;
  currentMonth: number;
  onOpen: () => void;
}) {
  const bday = formatBirthday(row.birthday);
  const isBdayMonth = monthOf(row.birthday) === currentMonth;
  const waNumber = onlyDigits(row.phone);
  const waHref = waNumber.length >= 10 ? `https://wa.me/55${waNumber}` : null;

  return (
    <li
      onClick={onOpen}
      className="grid cursor-pointer grid-cols-1 gap-3 px-4 py-4 transition hover:bg-purple-900/20 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
    >

      <div className="min-w-0">
        <p className="truncate font-semibold text-white">
          {row.full_name?.trim() || <span className="italic text-white/40">Sem nome</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" /> {formatPhone(row.phone)}
          </span>
          {bday && (
            <span
              className={
                "inline-flex items-center gap-1 " +
                (isBdayMonth ? "text-neon-pink" : "")
              }
            >
              <Cake className="h-3 w-3" /> {bday}
              {isBdayMonth && (
                <span className="ml-1 rounded-full bg-neon-pink/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-pink">
                  este mês
                </span>
              )}
            </span>
          )}
        </div>
        {row.address && (
          <p className="mt-1 flex items-start gap-1 text-xs text-white/50">
            <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {row.address}
              {row.reference ? ` — ${row.reference}` : ""}
            </span>
          </p>
        )}
      </div>

      <div className="text-xs text-white/70">
        <div className="flex items-center gap-1">
          <ShoppingBag className="h-3 w-3 text-neon-yellow" />
          <span className="font-bold text-white">{row.orders_count}</span>
          <span className="text-white/50">pedido(s)</span>
        </div>
        {row.last_order_at && (
          <p className="mt-0.5 text-[11px] text-white/40">
            Último: {new Date(row.last_order_at).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <div className="text-xs">
        <p className="text-white/50">Gasto</p>
        <p className="font-bold text-white">{BRL(row.total_spent)}</p>
        {row.paid_spent !== row.total_spent && (
          <p className="text-[11px] text-emerald-300">
            Pago: {BRL(row.paid_spent)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 md:justify-end">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
      </div>
    </li>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
        (active
          ? "bg-neon-pink text-white shadow-lg shadow-neon-pink/30"
          : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-3xl border border-purple-800/50 bg-purple-950/40 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
          {label}
        </p>
        <Icon className={"h-4 w-4 " + tint} />
      </div>
      <p className={"mt-2 text-2xl font-black " + tint}>{value}</p>
    </div>
  );
}
