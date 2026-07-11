import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNavMenu } from "@/components/admin/AdminNavMenu";
import { Toaster, toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
  X,
  Award,
  Ticket,
  TrendingUp,
  Package,
  Calendar,
  Crown,
  Trophy,
  Medal,
  ArrowUpDown,
  AlertTriangle,
  UserPlus,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Pencil,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  paid_count: number;
  total_spent: number;
  paid_spent: number;
  last_order_at: string | null;
  first_order_at: string | null;
  avg_ticket: number;
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

const daysSince = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
};

const relative = (iso: string | null | undefined): string => {
  const d = daysSince(iso);
  if (d === null) return "—";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d}d`;
  if (d < 365) return `há ${Math.floor(d / 30)}m`;
  return `há ${Math.floor(d / 365)}a`;
};

// -----------------------------------------------------------------------------
// RFM segmentation
// -----------------------------------------------------------------------------

type Segment =
  | "campeao"
  | "fiel"
  | "novo"
  | "em_risco"
  | "inativo"
  | "curioso"
  | "regular";

type SegmentInfo = {
  key: Segment;
  label: string;
  short: string;
  tint: string; // Tailwind classes for chip
};

const SEGMENTS: Record<Segment, SegmentInfo> = {
  campeao:   { key: "campeao",  label: "Campeão VIP",  short: "VIP",       tint: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40" },
  fiel:      { key: "fiel",     label: "Cliente Fiel", short: "Fiel",      tint: "bg-neon-pink/20 text-neon-pink border-neon-pink/40" },
  novo:      { key: "novo",     label: "Novo",         short: "Novo",      tint: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40" },
  em_risco:  { key: "em_risco", label: "Em risco",     short: "Risco",     tint: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  inativo:   { key: "inativo",  label: "Inativo",      short: "Inativo",   tint: "bg-red-500/15 text-red-300 border-red-500/30" },
  curioso:   { key: "curioso",  label: "Curioso",      short: "Curioso",   tint: "bg-white/5 text-white/60 border-white/15" },
  regular:   { key: "regular",  label: "Regular",      short: "Regular",   tint: "bg-purple-500/15 text-purple-200 border-purple-500/30" },
};

function segmentOf(r: ClientRow, ltvThreshold: number): Segment {
  const rec = daysSince(r.last_order_at);
  const age = daysSince(r.created_at) ?? 0;

  if (r.orders_count === 0) {
    return age <= 30 ? "novo" : "curioso";
  }
  if (r.paid_spent >= ltvThreshold && r.paid_count >= 2) return "campeao";
  if (rec !== null && rec > 90) return "inativo";
  if (rec !== null && rec > 30 && r.orders_count >= 2) return "em_risco";
  if (r.orders_count >= 3) return "fiel";
  if (age <= 30) return "novo";
  return "regular";
}

// -----------------------------------------------------------------------------

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


      <main className="mx-auto max-w-6xl px-4 py-8">
        <ClientesDashboard />
      </main>
    </div>
  );
}

type FilterKey =
  | "all"
  | "vip"
  | "fiel"
  | "novo"
  | "em_risco"
  | "inativo"
  | "buyers"
  | "birthday"
  | "with_address"
  | "no_orders";

type SortKey = "ltv" | "orders" | "recent" | "created" | "name";

function ClientesDashboard() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("ltv");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [showPodium, setShowPodium] = useState(true);

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
        {
          count: number;
          paidCount: number;
          total: number;
          paid: number;
          last: string | null;
          first: string | null;
        }
      >();
      for (const o of orders) {
        const cur = byUser.get(o.user_id) ?? {
          count: 0,
          paidCount: 0,
          total: 0,
          paid: 0,
          last: null as string | null,
          first: null as string | null,
        };
        cur.count += 1;
        cur.total += Number(o.total ?? 0);
        if (o.status === "pago") {
          cur.paid += Number(o.total ?? 0);
          cur.paidCount += 1;
        }
        if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
        if (!cur.first || o.created_at < cur.first) cur.first = o.created_at;
        byUser.set(o.user_id, cur);
      }

      return profiles.map((p) => {
        const s = byUser.get(p.id);
        const paidCount = s?.paidCount ?? 0;
        const paidTotal = s?.paid ?? 0;
        return {
          ...p,
          orders_count: s?.count ?? 0,
          paid_count: paidCount,
          total_spent: s?.total ?? 0,
          paid_spent: paidTotal,
          last_order_at: s?.last ?? null,
          first_order_at: s?.first ?? null,
          avg_ticket: paidCount > 0 ? paidTotal / paidCount : 0,
        };
      });
    },
    staleTime: 30_000,
  });

  const rows = data ?? [];
  const currentMonth = new Date().getMonth() + 1;

  // VIP podium (top 20 by LTV/paid_spent, must have at least 1 paid order)
  const vipRanking = useMemo(() => {
    return [...rows]
      .filter((r) => r.paid_spent > 0)
      .sort((a, b) => b.paid_spent - a.paid_spent)
      .slice(0, 20);
  }, [rows]);

  const ltvThreshold = useMemo(() => {
    if (vipRanking.length === 0) return Infinity;
    // Threshold = top 20 lowest LTV (or minimum to be VIP)
    return vipRanking[vipRanking.length - 1].paid_spent;
  }, [vipRanking]);

  // Annotate segments
  const rowsWithSegment = useMemo(
    () => rows.map((r) => ({ ...r, segment: segmentOf(r, ltvThreshold) })),
    [rows, ltvThreshold],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rowsWithSegment.filter((r) => {
      if (filter === "buyers" && r.orders_count === 0) return false;
      if (filter === "no_orders" && r.orders_count > 0) return false;
      if (filter === "birthday" && monthOf(r.birthday) !== currentMonth) return false;
      if (filter === "with_address" && !r.address) return false;
      if (filter === "vip" && r.segment !== "campeao") return false;
      if (filter === "fiel" && r.segment !== "fiel") return false;
      if (filter === "novo" && r.segment !== "novo") return false;
      if (filter === "em_risco" && r.segment !== "em_risco") return false;
      if (filter === "inativo" && r.segment !== "inativo") return false;
      if (!term) return true;
      const hay = `${r.full_name ?? ""} ${r.phone ?? ""} ${r.address ?? ""}`.toLowerCase();
      return hay.includes(term);
    });

    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "ltv":
          return b.paid_spent - a.paid_spent;
        case "orders":
          return b.orders_count - a.orders_count;
        case "recent": {
          const ax = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
          const bx = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
          return bx - ax;
        }
        case "created":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "name":
          return (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR");
      }
    });
    return sorted;
  }, [rowsWithSegment, q, filter, currentMonth, sort]);

  // KPIs enriched
  const kpis = useMemo(() => {
    const buyers = rows.filter((r) => r.orders_count > 0);
    const bdays = rows.filter((r) => monthOf(r.birthday) === currentMonth).length;
    const revenue = rows.reduce((acc, r) => acc + r.paid_spent, 0);
    const ltvAvg = buyers.length
      ? buyers.reduce((a, r) => a + r.paid_spent, 0) / buyers.length
      : 0;
    const top20Revenue = vipRanking.reduce((a, r) => a + r.paid_spent, 0);
    const top20Share = revenue > 0 ? (top20Revenue / revenue) * 100 : 0;
    const new30 = rows.filter((r) => (daysSince(r.created_at) ?? 999) <= 30).length;
    const atRisk = rowsWithSegment.filter(
      (r) => r.segment === "em_risco" || r.segment === "inativo",
    ).length;
    const segCounts = {
      vip: rowsWithSegment.filter((r) => r.segment === "campeao").length,
      fiel: rowsWithSegment.filter((r) => r.segment === "fiel").length,
      novo: rowsWithSegment.filter((r) => r.segment === "novo").length,
      em_risco: rowsWithSegment.filter((r) => r.segment === "em_risco").length,
      inativo: rowsWithSegment.filter((r) => r.segment === "inativo").length,
    };
    return {
      total: rows.length,
      buyers: buyers.length,
      bdays,
      revenue,
      ltvAvg,
      top20Share,
      new30,
      atRisk,
      segCounts,
    };
  }, [rows, rowsWithSegment, currentMonth, vipRanking]);

  const ALL_FIELDS = [
    { key: "full_name", label: "Nome" },
    { key: "phone", label: "Telefone" },
    { key: "email", label: "E-mail" },
    { key: "birthday", label: "Aniversário" },
    { key: "address", label: "Endereço" },
    { key: "reference", label: "Referência" },
    { key: "orders_count", label: "Pedidos" },
    { key: "total_spent", label: "Total gasto" },
    { key: "paid_spent", label: "Total pago (LTV)" },
    { key: "avg_ticket", label: "Ticket médio" },
    { key: "segment", label: "Segmento" },
    { key: "last_order_at", label: "Último pedido" },
    { key: "created_at", label: "Cadastrado em" },
  ] as const;
  type FieldKey = (typeof ALL_FIELDS)[number]["key"];

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState<Set<FieldKey>>(
    () => new Set(ALL_FIELDS.map((f) => f.key)),
  );

  const applyPreset = (
    preset: "all" | "name_phone" | "phone" | "email" | "address" | "birthday" | "vip",
  ) => {
    const map: Record<typeof preset, FieldKey[]> = {
      all: ALL_FIELDS.map((f) => f.key),
      name_phone: ["full_name", "phone"],
      phone: ["phone"],
      email: ["email"],
      address: ["full_name", "phone", "address", "reference"],
      birthday: ["full_name", "phone", "birthday"],
      vip: ["full_name", "phone", "paid_spent", "orders_count", "avg_ticket", "segment"],
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
    const scope = selection.size > 0 ? filtered.filter((r) => selection.has(r.id)) : filtered;
    if (scope.length === 0) {
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
    const valueFor = (r: (typeof scope)[number], k: FieldKey): string => {
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
        case "avg_ticket": return r.avg_ticket.toFixed(2).replace(".", ",");
        case "segment": return SEGMENTS[r.segment].label;
        case "last_order_at": return r.last_order_at ? new Date(r.last_order_at).toLocaleString("pt-BR") : "";
        case "created_at": return new Date(r.created_at).toLocaleString("pt-BR");
      }
    };
    const lines = [
      selected.map((f) => f.label).join(","),
      ...scope.map((r) => selected.map((f) => escape(valueFor(r, f.key))).join(",")),
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
    toast.success(`${scope.length} cliente(s) exportado(s)`);
  };

  const scopeForActions = () =>
    selection.size > 0 ? filtered.filter((r) => selection.has(r.id)) : filtered;

  const copyPhones = async () => {
    const scope = scopeForActions();
    const phones = scope
      .map((r) => onlyDigits(r.phone))
      .filter((p) => p.length >= 10);
    if (phones.length === 0) {
      toast.error("Nenhum telefone válido");
      return;
    }
    await navigator.clipboard.writeText(phones.join("\n"));
    toast.success(`${phones.length} telefone(s) copiado(s)`);
  };

  const toggleSelect = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllFiltered = () => {
    setSelection(new Set(filtered.map((r) => r.id)));
  };
  const clearSelection = () => setSelection(new Set());

  return (
    <div className="space-y-6">
      {/* KPIs — 8 métricas em grid denso */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Users} label="Total de clientes" value={String(kpis.total)} tint="text-neon-cyan" />
        <KpiCard icon={ShoppingBag} label="Compradores" value={String(kpis.buyers)} tint="text-neon-yellow" />
        <KpiCard icon={Sparkles} label="Receita paga" value={BRL(kpis.revenue)} tint="text-emerald-300" />
        <KpiCard icon={TrendingUp} label="LTV médio" value={BRL(kpis.ltvAvg)} tint="text-neon-pink" />
        <KpiCard icon={Crown} label="Top 20 % receita" value={`${kpis.top20Share.toFixed(0)}%`} tint="text-neon-yellow" />
        <KpiCard icon={UserPlus} label="Novos (30d)" value={String(kpis.new30)} tint="text-neon-cyan" />
        <KpiCard icon={AlertTriangle} label="Em risco/inativos" value={String(kpis.atRisk)} tint="text-amber-300" />
        <KpiCard icon={Cake} label="Aniversariantes" value={String(kpis.bdays)} tint="text-neon-pink" />
      </div>

      {/* Ranking VIP — pódio */}
      <div className="overflow-hidden rounded-3xl border border-neon-yellow/30 bg-gradient-to-br from-purple-950/60 via-purple-900/40 to-neon-pink/10 backdrop-blur-md">
        <button
          onClick={() => setShowPodium((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
        >
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-yellow" />
            <span
              className="text-xl font-black uppercase text-neon-yellow"
              style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
            >
              Ranking VIP · Top 20
            </span>
            <span className="rounded-full border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase text-neon-yellow">
              LTV
            </span>
          </div>
          {showPodium ? (
            <ChevronUp className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/60" />
          )}
        </button>

        {showPodium && (
          <div className="border-t border-neon-yellow/20 px-4 py-4">
            {vipRanking.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">
                Nenhum cliente com pedido pago ainda.
              </p>
            ) : (
              <>
                {/* Podium top 3 */}
                <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
                  {[1, 0, 2].map((idx) => {
                    const r = vipRanking[idx];
                    if (!r) return <div key={idx} />;
                    return (
                      <PodiumCard
                        key={r.id}
                        rank={idx + 1}
                        client={r}
                        onOpen={() => setSelectedId(r.id)}
                      />
                    );
                  })}
                </div>

                {/* Rest 4-20 */}
                {vipRanking.length > 3 && (
                  <ul className="space-y-1.5">
                    {vipRanking.slice(3).map((r, i) => (
                      <li
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.05]"
                      >
                        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-black text-white/70">
                          {i + 4}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {r.full_name?.trim() || "Sem nome"}
                          </p>
                          <p className="text-[11px] text-white/50">
                            {r.paid_count} pedido(s) pago(s) · Últ. {relative(r.last_order_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-300">
                            {BRL(r.paid_spent)}
                          </p>
                          <p className="text-[10px] text-white/40">
                            Ticket {BRL(r.avg_ticket)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Toolbar: busca + sort + exportar */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone ou endereço…"
              className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-neon-pink focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SortMenu sort={sort} setSort={setSort} />
            <button
              onClick={copyPhones}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" /> Copiar telefones
            </button>
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 rounded-full bg-neon-pink px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-neon-pink/30 transition hover:brightness-110">
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 rounded-2xl border-white/10 bg-[oklch(0.14_0.08_300)]/95 p-3 text-white backdrop-blur-xl"
              >
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Predefinições
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {[
                    { k: "all", l: "Tudo" },
                    { k: "vip", l: "Perfil VIP" },
                    { k: "name_phone", l: "Nome + tel" },
                    { k: "phone", l: "Só telefone" },
                    { k: "email", l: "Só e-mail" },
                    { k: "address", l: "Só endereço" },
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
                    {exportFields.size} campo(s) ·{" "}
                    {selection.size > 0 ? selection.size : filtered.length} cli.
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

        {/* Segment chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            Todos ({rows.length})
          </Chip>
          <Chip active={filter === "vip"} onClick={() => setFilter("vip")} tone="gold">
            <Crown className="mr-1 inline h-3 w-3" /> VIP ({kpis.segCounts.vip})
          </Chip>
          <Chip active={filter === "fiel"} onClick={() => setFilter("fiel")} tone="pink">
            Fiéis ({kpis.segCounts.fiel})
          </Chip>
          <Chip active={filter === "novo"} onClick={() => setFilter("novo")} tone="cyan">
            Novos ({kpis.segCounts.novo})
          </Chip>
          <Chip active={filter === "em_risco"} onClick={() => setFilter("em_risco")} tone="amber">
            Em risco ({kpis.segCounts.em_risco})
          </Chip>
          <Chip active={filter === "inativo"} onClick={() => setFilter("inativo")} tone="red">
            Inativos ({kpis.segCounts.inativo})
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

      {/* Bulk selection bar */}
      {selection.size > 0 && (
        <div className="sticky top-[60px] z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neon-pink/40 bg-neon-pink/15 px-4 py-2.5 backdrop-blur-md">
          <p className="text-sm font-bold text-white">
            {selection.size} selecionado(s)
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyPhones}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/20"
            >
              <Phone className="h-3 w-3" /> Copiar tels
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/20"
            >
              <Download className="h-3 w-3" /> Exportar
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/20"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={selection.size === filtered.length && filtered.length > 0 ? clearSelection : selectAllFiltered}
              className="text-white/50 transition hover:text-white"
              title="Selecionar todos"
            >
              {selection.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-neon-pink" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
            <p className="text-sm font-semibold text-white/80">
              {filtered.length} cliente(s)
            </p>
          </div>
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
          <ul className="divide-y divide-white/5">
            {filtered.map((r) => (
              <ClientRowItem
                key={r.id}
                row={r}
                currentMonth={currentMonth}
                selected={selection.has(r.id)}
                onToggle={() => toggleSelect(r.id)}
                onOpen={() => setSelectedId(r.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <ClientDetailDialog
        client={rows.find((r) => r.id === selectedId) ?? null}
        segment={
          rowsWithSegment.find((r) => r.id === selectedId)?.segment ?? "regular"
        }
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------

function SortMenu({
  sort,
  setSort,
}: {
  sort: SortKey;
  setSort: (s: SortKey) => void;
}) {
  const labels: Record<SortKey, string> = {
    ltv: "LTV (maior)",
    orders: "Mais pedidos",
    recent: "Mais recente",
    created: "Cadastrados",
    name: "Nome (A-Z)",
  };
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">
          <ArrowUpDown className="h-3.5 w-3.5" />
          {labels[sort]}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-52 rounded-2xl border-white/10 bg-[oklch(0.14_0.08_300)]/95 p-1.5 text-white backdrop-blur-xl"
      >
        {(Object.keys(labels) as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setSort(k);
              setOpen(false);
            }}
            className={
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition " +
              (sort === k
                ? "bg-neon-pink/20 font-bold text-neon-pink"
                : "hover:bg-white/5 text-white/80")
            }
          >
            {labels[k]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// -----------------------------------------------------------------------------

function PodiumCard({
  rank,
  client,
  onOpen,
}: {
  rank: number;
  client: ClientRow;
  onOpen: () => void;
}) {
  const styles =
    rank === 1
      ? {
          border: "border-neon-yellow/60",
          bg: "from-neon-yellow/20 to-neon-yellow/5",
          text: "text-neon-yellow",
          icon: <Crown className="h-5 w-5 text-neon-yellow" />,
          height: "sm:pt-2",
        }
      : rank === 2
        ? {
            border: "border-white/30",
            bg: "from-white/15 to-white/5",
            text: "text-white",
            icon: <Trophy className="h-5 w-5 text-white/80" />,
            height: "sm:pt-6",
          }
        : {
            border: "border-amber-700/50",
            bg: "from-amber-700/20 to-amber-900/5",
            text: "text-amber-400",
            icon: <Medal className="h-5 w-5 text-amber-400" />,
            height: "sm:pt-8",
          };

  return (
    <div className={styles.height}>
      <button
        onClick={onOpen}
        className={`group relative w-full overflow-hidden rounded-2xl border ${styles.border} bg-gradient-to-b ${styles.bg} p-3 text-left transition hover:brightness-110`}
      >
        <div className="flex items-center justify-between">
          {styles.icon}
          <span className={`text-3xl font-black ${styles.text}`}>#{rank}</span>
        </div>
        <p className="mt-2 truncate text-sm font-bold text-white">
          {client.full_name?.trim() || "Sem nome"}
        </p>
        <p className={`mt-1 text-lg font-black ${styles.text}`}>
          {BRL(client.paid_spent)}
        </p>
        <p className="text-[10px] text-white/50">
          {client.paid_count} pedido(s) · Ticket {BRL(client.avg_ticket)}
        </p>
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------

type ClientRowWithSeg = ClientRow & { segment: Segment };

function ClientRowItem({
  row,
  currentMonth,
  selected,
  onToggle,
  onOpen,
}: {
  row: ClientRowWithSeg;
  currentMonth: number;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const bday = formatBirthday(row.birthday);
  const isBdayMonth = monthOf(row.birthday) === currentMonth;
  const waNumber = onlyDigits(row.phone);
  const waHref = waNumber.length >= 10 ? `https://wa.me/55${waNumber}` : null;
  const seg = SEGMENTS[row.segment];

  return (
    <li
      onClick={onOpen}
      className={
        "grid cursor-pointer grid-cols-[auto_1fr] gap-3 px-4 py-4 transition hover:bg-white/[0.02] md:grid-cols-[auto_1.4fr_1fr_1fr_auto] md:items-center " +
        (selected ? "bg-neon-pink/5" : "")
      }
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-white/50 transition hover:text-white"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-neon-pink" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-white">
            {row.full_name?.trim() || <span className="italic text-white/40">Sem nome</span>}
          </p>
          <span
            className={
              "flex-shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider " +
              seg.tint
            }
          >
            {row.segment === "campeao" && <Crown className="mr-0.5 inline h-2.5 w-2.5" />}
            {seg.short}
          </span>
        </div>
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
            Últ. pedido {relative(row.last_order_at)}
          </p>
        )}
      </div>

      <div className="text-xs">
        <p className="text-white/50">LTV</p>
        <p className="font-bold text-emerald-300">{BRL(row.paid_spent)}</p>
        {row.avg_ticket > 0 && (
          <p className="text-[11px] text-white/40">
            Ticket {BRL(row.avg_ticket)}
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
  tone = "pink",
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: "pink" | "gold" | "cyan" | "amber" | "red";
}) {
  const activeStyle: Record<typeof tone, string> = {
    pink: "bg-neon-pink text-white shadow-lg shadow-neon-pink/30",
    gold: "bg-neon-yellow text-purple-950 shadow-lg shadow-neon-yellow/30",
    cyan: "bg-neon-cyan text-purple-950 shadow-lg shadow-neon-cyan/30",
    amber: "bg-amber-400 text-purple-950 shadow-lg shadow-amber-400/30",
    red: "bg-red-500 text-white shadow-lg shadow-red-500/30",
  };
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
        (active
          ? activeStyle[tone]
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
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
  segment,
  onClose,
}: {
  client: ClientRow | null;
  segment: Segment;
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

    const modeCount = new Map<string, number>();
    for (const o of orders) {
      const m = o.mode ?? "—";
      modeCount.set(m, (modeCount.get(m) ?? 0) + 1);
    }
    const topMode =
      [...modeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const prodCount = new Map<string, number>();
    for (const o of paid) {
      for (const it of o.order_items ?? []) {
        prodCount.set(it.name, (prodCount.get(it.name) ?? 0) + (it.quantity ?? 1));
      }
    }
    const topProducts = [...prodCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const historyOrders = orders.filter(
      (o) => o.status === "entregue" || o.status === "cancelado",
    );

    // Monthly spending (last 6 months, paid orders)
    const monthly: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.push({
        key,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        total: 0,
      });
    }
    for (const o of paid) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = monthly.find((m) => m.key === key);
      if (b) b.total += Number(o.total ?? 0);
    }
    const maxMonthly = Math.max(1, ...monthly.map((m) => m.total));

    // Days between orders (cadence)
    let cadence: number | null = null;
    if (paid.length >= 2) {
      const sorted = [...paid].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      let sum = 0;
      for (let i = 1; i < sorted.length; i++) {
        sum +=
          (new Date(sorted[i].created_at).getTime() -
            new Date(sorted[i - 1].created_at).getTime()) /
          86400000;
      }
      cadence = Math.round(sum / (sorted.length - 1));
    }

    return {
      paidCount: paid.length,
      avg,
      topMode,
      topProducts,
      historyOrders,
      monthly,
      maxMonthly,
      cadence,
    };
  }, [data]);

  const waNumber = onlyDigits(client?.phone);
  const waHref = waNumber.length >= 10 ? `https://wa.me/55${waNumber}` : null;

  const stamps = data?.loyalty?.stamps ?? 0;
  const totalRedeemed = data?.loyalty?.total_redeemed ?? 0;
  const stampsToNext = Math.max(0, 10 - stamps);
  const stampProgress = Math.min(100, (stamps / 10) * 100);
  const activeCoupons = (data?.coupons ?? []).filter((c) => !c.used_at);
  const usedCoupons = (data?.coupons ?? []).filter((c) => !!c.used_at);

  const segInfo = SEGMENTS[segment];
  const recency = daysSince(client?.last_order_at);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-[oklch(0.12_0.08_300)] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="truncate text-2xl font-black text-neon-yellow"
                style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
              >
                {client?.full_name?.trim() || "Sem nome"}
              </span>
              <span
                className={
                  "flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase " +
                  segInfo.tint
                }
              >
                {segment === "campeao" && <Crown className="mr-0.5 inline h-3 w-3" />}
                {segInfo.label}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {!client ? null : (
          <div className="space-y-5">
            {/* Contato */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                  Cadastrado{" "}
                  {relative(client.created_at)} ·{" "}
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
                    label="Pedidos pagos"
                    value={String(stats.paidCount)}
                    tint="text-neon-yellow"
                  />
                  <MiniStat
                    icon={Sparkles}
                    label="LTV"
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
                  <MiniStat
                    icon={Calendar}
                    label="Última compra"
                    value={recency !== null ? `há ${recency}d` : "—"}
                    tint={
                      recency === null
                        ? "text-white/50"
                        : recency <= 30
                          ? "text-emerald-300"
                          : recency <= 60
                            ? "text-amber-300"
                            : "text-red-300"
                    }
                  />
                  <MiniStat
                    icon={ArrowUpDown}
                    label="Cadência"
                    value={stats.cadence ? `${stats.cadence}d` : "—"}
                    tint="text-neon-cyan"
                  />
                  <MiniStat
                    icon={Award}
                    label="Recompensas"
                    value={String(totalRedeemed)}
                    tint="text-neon-yellow"
                  />
                  <MiniStat
                    icon={Ticket}
                    label="Cupons ativos"
                    value={String(activeCoupons.length)}
                    tint="text-neon-pink"
                  />
                </div>

                {/* Gastos por mês */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-neon-cyan" />
                    <p
                      className="text-lg font-black uppercase text-neon-cyan"
                      style={{ fontFamily: "'Barlow Condensed', 'Poppins', sans-serif" }}
                    >
                      Gastos nos últimos 6 meses
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    {stats.monthly.map((m) => {
                      const h = m.total > 0 ? Math.max(6, (m.total / stats.maxMonthly) * 100) : 3;
                      return (
                        <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                          <div className="relative flex h-32 w-full items-end">
                            <div
                              className="w-full rounded-t-md bg-gradient-to-t from-neon-pink to-neon-yellow transition-all"
                              style={{ height: `${h}%` }}
                              title={BRL(m.total)}
                            />
                          </div>
                          <p className="text-[10px] font-bold text-white/70">
                            {m.label}
                          </p>
                          <p className="text-[9px] text-white/40">
                            {m.total > 0 ? BRL(m.total) : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fidelidade */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                    <p className="text-xs text-white/60">{stamps}/10 selos</p>
                  </div>

                  <div className="mb-3 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-neon-pink to-neon-yellow transition-all"
                      style={{ width: `${stampProgress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-black text-neon-yellow">{stamps}</p>
                      <p className="text-[11px] text-white/50">Selos atuais</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-neon-pink">{stampsToNext}</p>
                      <p className="text-[11px] text-white/50">Faltam para o próximo</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-emerald-300">{totalRedeemed}</p>
                      <p className="text-[11px] text-white/50">Recompensas ganhas</p>
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
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
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

                {/* Histórico */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
    <li className="rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
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
        <div className="border-t border-white/10 px-3 py-2.5">
          <ul className="space-y-1.5">
            {order.order_items?.map((it) => (
              <li
                key={it.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white">
                    <span className="font-bold text-neon-pink">{it.quantity}×</span>{" "}
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
            <p className="mt-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px] italic text-white/60">
              Observação do pedido: {order.note}
            </p>
          )}
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-[11px] text-white/60">
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
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
