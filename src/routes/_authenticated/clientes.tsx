import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/menu-data";
import { ClientsListSkeleton, ClientDetailSkeleton } from "@/components/ui/skeletons";

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
      <Toaster position="bottom-center" theme="dark" closeButton />

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
          <AdminNavMenu />
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

  const ALL_FIELDS = [
    { key: "full_name", label: "Nome" },
    { key: "phone", label: "Telefone" },
    { key: "email", label: "E-mail" },
    { key: "birthday", label: "Aniversário" },
    { key: "address", label: "Endereço" },
    { key: "reference", label: "Referência" },
    { key: "orders_count", label: "Pedidos" },
    { key: "total_spent", label: "Total gasto" },
    { key: "paid_spent", label: "Total pago" },
    { key: "last_order_at", label: "Último pedido" },
    { key: "created_at", label: "Cadastrado em" },
  ] as const;
  type FieldKey = (typeof ALL_FIELDS)[number]["key"];

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState<Set<FieldKey>>(
    () => new Set(ALL_FIELDS.map((f) => f.key)),
  );

  const applyPreset = (preset: "all" | "name_phone" | "phone" | "email" | "address" | "birthday") => {
    const map: Record<typeof preset, FieldKey[]> = {
      all: ALL_FIELDS.map((f) => f.key),
      name_phone: ["full_name", "phone"],
      phone: ["phone"],
      email: ["email"],
      address: ["full_name", "phone", "address", "reference"],
      birthday: ["full_name", "phone", "birthday"],
    };
    setExportFields(new Set(map[preset]));
  };

  const toggleField = (k: FieldKey) => {
    setExportFields((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum cliente para exportar");
      return;
    }
    const selected = ALL_FIELDS.filter((f) => exportFields.has(f.key));
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um campo");
      return;
    }
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const valueFor = (r: (typeof filtered)[number], k: FieldKey): string => {
      switch (k) {
        case "full_name": return r.full_name ?? "";
        case "phone": return formatPhone(r.phone);
        case "email": return (r as { email?: string | null }).email ?? "";
        case "birthday": return formatBirthday(r.birthday) ?? "";
        case "address": return r.address ?? "";
        case "reference": return r.reference ?? "";
        case "orders_count": return String(r.orders_count);
        case "total_spent": return r.total_spent.toFixed(2).replace(".", ",");
        case "paid_spent": return r.paid_spent.toFixed(2).replace(".", ",");
        case "last_order_at": return r.last_order_at ? new Date(r.last_order_at).toLocaleString("pt-BR") : "";
        case "created_at": return new Date(r.created_at).toLocaleString("pt-BR");
      }
    };
    const lines = [
      selected.map((f) => f.label).join(","),
      ...filtered.map((r) => selected.map((f) => escape(valueFor(r, f.key))).join(",")),
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
    setExportOpen(false);
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
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110"
                >
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 rounded-2xl border-purple-800/60 bg-purple-950/95 p-3 text-white backdrop-blur-xl"
              >
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Predefinições
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {[
                    { k: "all", l: "Tudo" },
                    { k: "name_phone", l: "Nome + telefone" },
                    { k: "phone", l: "Só telefone" },
                    { k: "email", l: "Só e-mail" },
                    { k: "address", l: "Só endereço" },
                    { k: "birthday", l: "Só aniversário" },
                  ].map((p) => (
                    <button
                      key={p.k}
                      onClick={() => applyPreset(p.k as Parameters<typeof applyPreset>[0])}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-neon-pink/20 hover:text-white"
                    >
                      {p.l}
                    </button>
                  ))}
                </div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Campos
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {ALL_FIELDS.map((f) => {
                    const active = exportFields.has(f.key);
                    return (
                      <label
                        key={f.key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleField(f.key)}
                          className="h-3.5 w-3.5 accent-neon-pink"
                        />
                        <span className={active ? "text-white" : "text-white/60"}>{f.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <span className="text-[11px] text-white/50">
                    {exportFields.size} campo(s) · {filtered.length} cliente(s)
                  </span>
                  <button
                    onClick={exportCsv}
                    className="inline-flex items-center gap-1 rounded-full bg-neon-pink px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110"
                  >
                    <Download className="h-3 w-3" /> Baixar
                  </button>
                </div>
              </PopoverContent>
            </Popover>
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
          <ClientsListSkeleton count={6} />
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
            onClick={(e) => e.stopPropagation()}
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
  icon: import("lucide-react").LucideIcon;
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

// ============================================================
// Detalhes do cliente
// ============================================================

type OrderFull = {
  id: string;
  mode: string | null;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  note: string | null;
  coupon_code: string | null;
  created_at: string;
  order_items: Array<{
    id: string;
    name: string;
    size: string | null;
    flavor: string | null;
    quantity: number;
    unit_price: number;
    note: string | null;
    extras: unknown;
    removed: unknown;
  }>;
};

type LoyaltyRow = {
  stamps: number;
  total_redeemed: number;
  last_birthday_bonus: string | null;
};

type CouponRow = {
  id: string;
  code: string;
  used_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
  entregue: "Entregue",
};

const STATUS_TINT: Record<string, string> = {
  pendente: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  pago: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cancelado: "bg-red-500/20 text-red-300 border-red-500/30",
  entregue: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

function ClientDetailDialog({
  client,
  onClose,
}: {
  client: ClientRow | null;
  onClose: () => void;
}) {
  const open = !!client;
  const userId = client?.id ?? null;

  const { data, isLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["client-detail", userId],
    queryFn: async () => {
      const [ordersRes, loyaltyRes, couponsRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, mode, status, subtotal, delivery_fee, total, note, coupon_code, created_at, order_items(id, name, size, flavor, quantity, unit_price, note, extras, removed)",
          )
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("loyalty")
          .select("stamps, total_redeemed, last_birthday_bonus")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("loyalty_coupons")
          .select("id, code, used_at, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (loyaltyRes.error) throw loyaltyRes.error;
      if (couponsRes.error) throw couponsRes.error;
      return {
        orders: (ordersRes.data ?? []) as OrderFull[],
        loyalty: (loyaltyRes.data ?? null) as LoyaltyRow | null,
        coupons: (couponsRes.data ?? []) as CouponRow[],
      };
    },
    staleTime: 15_000,
  });

  const stats = useMemo(() => {
    const orders = data?.orders ?? [];
    const paid = orders.filter((o) => o.status === "pago");
    const paidTotal = paid.reduce((a, o) => a + Number(o.total ?? 0), 0);
    const avg = paid.length ? paidTotal / paid.length : 0;

    // Modo preferido
    const modeCount = new Map<string, number>();
    for (const o of orders) {
      const m = o.mode ?? "—";
      modeCount.set(m, (modeCount.get(m) ?? 0) + 1);
    }
    const topMode =
      [...modeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Produto mais pedido (somente pedidos pagos)
    const prodCount = new Map<string, number>();
    for (const o of paid) {
      for (const it of o.order_items ?? []) {
        prodCount.set(it.name, (prodCount.get(it.name) ?? 0) + (it.quantity ?? 1));
      }
    }
    const topProducts = [...prodCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Histórico visível: apenas entregues e cancelados
    const historyOrders = orders.filter(
      (o) => o.status === "entregue" || o.status === "cancelado",
    );

    return { paidCount: paid.length, avg, topMode, topProducts, historyOrders };
  }, [data]);

  const waNumber = onlyDigits(client?.phone);
  const waHref = waNumber.length >= 10 ? `https://wa.me/55${waNumber}` : null;

  const stamps = data?.loyalty?.stamps ?? 0;
  const totalRedeemed = data?.loyalty?.total_redeemed ?? 0;
  const stampsToNext = Math.max(0, 10 - stamps);
  const stampProgress = Math.min(100, (stamps / 10) * 100);
  const activeCoupons = (data?.coupons ?? []).filter((c) => !c.used_at);
  const usedCoupons = (data?.coupons ?? []).filter((c) => !!c.used_at);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-purple-800/60 bg-[oklch(0.12_0.08_300)] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span
              className="truncate text-2xl font-black text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              {client?.full_name?.trim() || "Sem nome"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!client ? null : (
          <div className="space-y-5">
            {/* Contato */}
            <div className="rounded-2xl border border-purple-800/50 bg-purple-950/40 p-4">
              <div className="grid grid-cols-1 gap-2 text-sm text-white/80 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-neon-cyan" />
                  <span>{formatPhone(client.phone)}</span>
                </div>
                {client.birthday && (
                  <div className="flex items-center gap-2">
                    <Cake className="h-4 w-4 text-neon-pink" />
                    <span>{formatBirthday(client.birthday)}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-white/60" />
                    <span>
                      {client.address}
                      {client.reference ? ` — ${client.reference}` : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-white/50 sm:col-span-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Cadastrado em{" "}
                  {new Date(client.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
                </a>
              )}
            </div>

            {isLoading ? (
              <ClientDetailSkeleton />
            ) : (
              <>
                {/* KPIs pessoais */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat
                    icon={ShoppingBag}
                    label="Pedidos"
                    value={String(client.orders_count)}
                    tint="text-neon-yellow"
                  />
                  <MiniStat
                    icon={Sparkles}
                    label="Total pago"
                    value={BRL(client.paid_spent)}
                    tint="text-emerald-300"
                  />
                  <MiniStat
                    icon={TrendingUp}
                    label="Ticket médio"
                    value={BRL(stats.avg)}
                    tint="text-neon-cyan"
                  />
                  <MiniStat
                    icon={Package}
                    label="Modo preferido"
                    value={stats.topMode ?? "—"}
                    tint="text-neon-pink"
                  />
                </div>

                {/* Fidelidade */}
                <div className="rounded-2xl border border-purple-800/50 bg-purple-950/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-neon-yellow" />
                      <p
                        className="text-lg font-black uppercase text-neon-yellow"
                        style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                      >
                        Fidelidade Bis
                      </p>
                    </div>
                    <p className="text-xs text-white/60">
                      {stamps}/10 selos
                    </p>
                  </div>

                  <div className="mb-3 h-3 overflow-hidden rounded-full bg-purple-900/60">
                    <div
                      className="h-full bg-gradient-to-r from-neon-pink to-neon-yellow transition-all"
                      style={{ width: `${stampProgress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-black text-neon-yellow">
                        {stamps}
                      </p>
                      <p className="text-[11px] text-white/50">Selos atuais</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-neon-pink">
                        {stampsToNext}
                      </p>
                      <p className="text-[11px] text-white/50">
                        Faltam para o próximo
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-emerald-300">
                        {totalRedeemed}
                      </p>
                      <p className="text-[11px] text-white/50">
                        Recompensas ganhas
                      </p>
                    </div>
                  </div>

                  {(activeCoupons.length > 0 || usedCoupons.length > 0) && (
                    <div className="mt-4 space-y-2">
                      {activeCoupons.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-white/70">
                            Cupons ativos ({activeCoupons.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeCoupons.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 rounded-full bg-neon-yellow/20 px-2.5 py-1 text-[11px] font-bold text-neon-yellow"
                              >
                                <Ticket className="h-3 w-3" /> {c.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {usedCoupons.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-white/70">
                            Cupons usados ({usedCoupons.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {usedCoupons.slice(0, 8).map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/40 line-through"
                              >
                                <Ticket className="h-3 w-3" /> {c.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Top produtos */}
                {stats.topProducts.length > 0 && (
                  <div className="rounded-2xl border border-purple-800/50 bg-purple-950/40 p-4">
                    <p
                      className="mb-3 text-lg font-black uppercase text-neon-cyan"
                      style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                    >
                      Produtos favoritos
                    </p>
                    <ul className="space-y-2">
                      {stats.topProducts.map(([name, count], i) => (
                        <li
                          key={name}
                          className="flex items-center justify-between rounded-xl border border-purple-800/40 bg-purple-900/30 px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neon-pink/20 text-xs font-black text-neon-pink">
                              {i + 1}
                            </span>
                            <span className="text-white">{name}</span>
                          </span>
                          <span className="text-xs font-bold text-white/70">
                            {count}×
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Histórico de pedidos */}
                <div className="rounded-2xl border border-purple-800/50 bg-purple-950/40 p-4">
                  <p
                    className="mb-3 text-lg font-black uppercase text-neon-yellow"
                    style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                  >
                    Histórico de pedidos ({stats.historyOrders.length})
                  </p>
                  {stats.historyOrders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/50">
                      Nenhum pedido entregue ou cancelado ainda.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {stats.historyOrders.map((o) => (
                        <OrderCard key={o.id} order={o} />
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderCard({ order }: { order: OrderFull }) {
  const [open, setOpen] = useState(false);
  const statusClass =
    STATUS_TINT[order.status] ?? "bg-white/10 text-white/70 border-white/20";
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;

  return (
    <li className="rounded-xl border border-purple-800/40 bg-purple-900/20">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-purple-900/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">
              {BRL(Number(order.total ?? 0))}
            </span>
            <span
              className={
                "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase " +
                statusClass
              }
            >
              {statusLabel}
            </span>
            {order.mode && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/60">
                {order.mode}
              </span>
            )}
            {order.coupon_code && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon-yellow/20 px-2 py-0.5 text-[10px] font-bold text-neon-yellow">
                <Ticket className="h-2.5 w-2.5" /> {order.coupon_code}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-white/50">
            {new Date(order.created_at).toLocaleString("pt-BR")} ·{" "}
            {order.order_items?.length ?? 0} item(ns)
          </p>
        </div>
        <span className="text-xs text-white/50">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-purple-800/40 px-3 py-2.5">
          <ul className="space-y-1.5">
            {order.order_items?.map((it) => (
              <li
                key={it.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white">
                    <span className="font-bold text-neon-pink">
                      {it.quantity}×
                    </span>{" "}
                    {it.name}
                    {it.size ? ` · ${it.size}` : ""}
                    {it.flavor ? ` · ${it.flavor}` : ""}
                  </p>
                  {it.note && (
                    <p className="text-[11px] italic text-white/50">
                      Obs: {it.note}
                    </p>
                  )}
                </div>
                <p className="whitespace-nowrap text-white/70">
                  {BRL(Number(it.unit_price ?? 0) * (it.quantity ?? 1))}
                </p>
              </li>
            ))}
          </ul>
          {order.note && (
            <p className="mt-2 rounded-lg bg-purple-950/40 px-2 py-1.5 text-[11px] italic text-white/60">
              Observação do pedido: {order.note}
            </p>
          )}
          <div className="mt-2 flex justify-between border-t border-purple-800/40 pt-2 text-[11px] text-white/60">
            <span>
              Subtotal: {BRL(Number(order.subtotal ?? 0))}
              {Number(order.delivery_fee ?? 0) > 0 &&
                ` · Entrega: ${BRL(Number(order.delivery_fee))}`}
            </span>
            <span className="font-bold text-white">
              Total: {BRL(Number(order.total ?? 0))}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: import("lucide-react").LucideIcon;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-purple-800/50 bg-purple-950/40 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={"h-3.5 w-3.5 " + tint} />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
          {label}
        </p>
      </div>
      <p className={"mt-1 truncate text-lg font-black " + tint}>{value}</p>
    </div>
  );
}

