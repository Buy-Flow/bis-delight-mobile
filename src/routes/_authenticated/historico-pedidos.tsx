import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { toast } from "sonner";
import {
  History,
  Search,
  RefreshCcw,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User2,
  Clock,
  CreditCard,
  QrCode,
  Wallet,
  Bike,
  Store,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Package,
  Copy,
  ExternalLink,
  Ticket,
  Hash,
  Calendar,
  DollarSign,
  ShoppingBag,
  Star,
  FileText,
  TrendingUp,
} from "lucide-react";
import { brl } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/historico-pedidos")({
  head: () => ({
    meta: [
      { title: "Histórico de pedidos — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoricoPedidosPage,
});

type OrderRow = {
  id: string;
  user_id: string | null;
  mode: string | null;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  reference: string | null;
  note: string | null;
  subtotal: number | null;
  delivery_fee: number | null;
  service_fee: number | null;
  coupon_discount: number | null;
  coupon_code: string | null;
  total: number | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  preparing_at: string | null;
  dispatched_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  distance_km: number | null;
  eta_minutes: number | null;
  people_count: number | null;
  courier_id: string | null;
  waiter_id: string | null;
  table_id: string | null;
  customer_rating: number | null;
  courier_rating: number | null;
  tracking_token: string | null;
  asaas_payment_id: string | null;
  asaas_status: string | null;
  payment_method: string | null;
  pix_expires_at: string | null;
  card_last4: string | null;
  card_brand: string | null;
  invoice_url: string | null;
  delivery_photo_url: string | null;
  delivery_signature_url: string | null;
  delivery_proof_notes: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  name: string;
  size: string | null;
  flavor: string | null;
  extras: { label: string; price: number }[] | null;
  removed: string[] | null;
  note: string | null;
  quantity: number;
  unit_price: number;
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pendente: { label: "Aguardando pagamento", tone: "amber" },
  pago: { label: "Pago", tone: "emerald" },
  preparando: { label: "Preparando", tone: "cyan" },
  saiu_para_entrega: { label: "Saiu p/ entrega", tone: "blue" },
  entregue: { label: "Entregue", tone: "emerald" },
  cancelado: { label: "Cancelado", tone: "rose" },
};

const TONE_CLASS: Record<string, string> = {
  amber: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  emerald: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  cyan: "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
  blue: "bg-blue-500/15 text-blue-200 border-blue-400/30",
  rose: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  slate: "bg-white/10 text-white/80 border-white/20",
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "slate" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        TONE_CLASS[meta.tone],
      )}
    >
      {meta.label}
    </span>
  );
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function periodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 86400000);
    case "30d":
      return new Date(now.getTime() - 30 * 86400000);
    case "90d":
      return new Date(now.getTime() - 90 * 86400000);
    case "365d":
      return new Date(now.getTime() - 365 * 86400000);
    case "all":
    default:
      return null;
  }
}

function paymentLabel(o: OrderRow): string {
  if (o.payment_method === "pix") return "PIX";
  if (o.payment_method === "credit_card") return "Cartão";
  if (o.payment_method === "cash") return "Dinheiro";
  if (o.payment_method === "boleto") return "Boleto";
  if (o.payment_method) return o.payment_method;
  return "—";
}

function HistoricoPedidosPage() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("30d");
  const [statusSel, setStatusSel] = useState<Set<string>>(new Set());
  const [modeSel, setModeSel] = useState<string>("all");
  const [paySel, setPaySel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "old" | "high" | "low">("recent");

  const load = async () => {
    setLoading(true);
    const start = periodStart(period);
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (start) query = query.gte("created_at", start.toISOString());
    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as OrderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    const ch = supabase
      .channel("history-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!itemsByOrder[id]) {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id);
      if (!error && data) {
        setItemsByOrder((prev) => ({ ...prev, [id]: data as OrderItem[] }));
      }
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    let out = rows.filter((o) => {
      if (statusSel.size > 0 && !statusSel.has(o.status)) return false;
      if (modeSel !== "all" && o.mode !== modeSel) return false;
      if (paySel !== "all") {
        if (paySel === "none" && o.payment_method) return false;
        if (paySel !== "none" && o.payment_method !== paySel) return false;
      }
      if (term) {
        const hay = [
          o.id,
          o.customer_name,
          o.phone,
          o.address,
          o.coupon_code,
          o.asaas_payment_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sortBy === "recent") return b.created_at.localeCompare(a.created_at);
      if (sortBy === "old") return a.created_at.localeCompare(b.created_at);
      if (sortBy === "high") return (b.total ?? 0) - (a.total ?? 0);
      if (sortBy === "low") return (a.total ?? 0) - (b.total ?? 0);
      return 0;
    });
    return out;
  }, [rows, q, statusSel, modeSel, paySel, sortBy]);

  const stats = useMemo(() => {
    const base = filtered;
    const paidLike = base.filter((o) =>
      ["pago", "preparando", "saiu_para_entrega", "entregue"].includes(o.status),
    );
    const revenue = paidLike.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const pending = base.filter((o) => o.status === "pendente").length;
    const canceled = base.filter((o) => o.status === "cancelado").length;
    const delivered = base.filter((o) => o.status === "entregue").length;
    const avg = paidLike.length ? revenue / paidLike.length : 0;
    return {
      total: base.length,
      revenue,
      pending,
      canceled,
      delivered,
      avg,
    };
  }, [filtered]);

  const exportCsv = () => {
    const cols = [
      "id",
      "created_at",
      "status",
      "mode",
      "customer_name",
      "phone",
      "total",
      "subtotal",
      "delivery_fee",
      "coupon_discount",
      "coupon_code",
      "payment_method",
      "asaas_status",
      "paid_at",
      "delivered_at",
      "canceled_at",
      "address",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [
      cols.join(","),
      ...filtered.map((o) => cols.map((c) => esc((o as any)[c])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const toggleStatus = (s: string) => {
    setStatusSel((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <AdminShell>
      <div className="min-h-screen bg-background p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-fuchsia-300">
                <History className="h-3.5 w-3.5" /> Histórico de pedidos
              </div>
              <h1 className="mt-1 text-2xl font-black text-white">
                Todos os pedidos, tudo o que aconteceu.
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-white/60">
                Confirmados, aguardando pagamento, cancelados e entregues. Filtre por período,
                status, forma de pagamento e cliente. Clique em cada card para ver a timeline
                completa, itens e dados de pagamento.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="today">Hoje</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
                <option value="90d">90 dias</option>
                <option value="365d">1 ano</option>
                <option value="all">Tudo</option>
              </select>
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 py-2 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-500/25"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Kpi label="Pedidos" value={stats.total} icon={ShoppingBag} tone="cyan" />
            <Kpi label="Receita" value={brl(stats.revenue)} icon={DollarSign} tone="emerald" />
            <Kpi label="Ticket médio" value={brl(stats.avg)} icon={TrendingUp} tone="fuchsia" />
            <Kpi label="Aguardando" value={stats.pending} icon={Timer} tone="amber" />
            <Kpi label="Entregues" value={stats.delivered} icon={CheckCircle2} tone="emerald" />
            <Kpi label="Cancelados" value={stats.canceled} icon={XCircle} tone="rose" />
          </div>

          {/* Filters */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar nome, telefone, endereço, ID, cupom..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-fuchsia-400/40 focus:outline-none"
                />
              </div>
              <select
                value={modeSel}
                onChange={(e) => setModeSel(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="all">Todos os modos</option>
                <option value="entrega">Entrega</option>
                <option value="retirada">Retirada</option>
                <option value="mesa">Mesa</option>
              </select>
              <select
                value={paySel}
                onChange={(e) => setPaySel(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="all">Todo pagamento</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão</option>
                <option value="cash">Dinheiro</option>
                <option value="boleto">Boleto</option>
                <option value="none">Sem método</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="recent">Mais recentes</option>
                <option value="old">Mais antigos</option>
                <option value="high">Maior valor</option>
                <option value="low">Menor valor</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_META).map(([k, v]) => {
                const active = statusSel.has(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleStatus(k)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition",
                      active
                        ? TONE_CLASS[v.tone]
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                    )}
                  >
                    {v.label}
                  </button>
                );
              })}
              {statusSel.size > 0 && (
                <button
                  onClick={() => setStatusSel(new Set())}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {rows === null ? (
              <div className="py-16 text-center text-white/50">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center text-white/50">
                Nenhum pedido encontrado com esses filtros.
              </div>
            ) : (
              filtered.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  expanded={expanded === o.id}
                  items={itemsByOrder[o.id]}
                  onToggle={() => toggleExpand(o.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: any;
  tone: "cyan" | "emerald" | "fuchsia" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-400/20 text-cyan-200",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/20 text-emerald-200",
    fuchsia: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-400/20 text-fuchsia-200",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-400/20 text-amber-200",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-400/20 text-rose-200",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-3",
        tones[tone],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
          {label}
        </span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
    </div>
  );
}


function OrderCard({
  order: o,
  expanded,
  items,
  onToggle,
}: {
  order: OrderRow;
  expanded: boolean;
  items?: OrderItem[];
  onToggle: () => void;
}) {
  const meta = STATUS_META[o.status] ?? { label: o.status, tone: "slate" };
  const modeIcon = o.mode === "entrega" ? Bike : o.mode === "retirada" ? Store : Package;
  const ModeIcon = modeIcon;
  const shortId = o.id.slice(0, 8).toUpperCase();

  return (
    <div
      className={cn(
        "rounded-2xl border transition",
        expanded ? "border-fuchsia-400/40 bg-white/[0.04]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            TONE_CLASS[meta.tone],
          )}
        >
          <ModeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} />
            <span className="font-mono text-[11px] text-white/40">#{shortId}</span>
            <span className="text-[11px] text-white/50">{fmtDateTime(o.created_at)}</span>
          </div>
          <div className="mt-1 truncate text-sm font-bold text-white">
            {o.customer_name || "Sem nome"}
            {o.phone && <span className="ml-2 text-white/50">· {o.phone}</span>}
          </div>
          {o.address && (
            <div className="mt-0.5 truncate text-[11px] text-white/50">
              <MapPin className="mr-1 inline h-3 w-3" />
              {o.address}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-base font-black text-white">{brl(Number(o.total ?? 0))}</div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">
            {paymentLabel(o)}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/10 p-4">
          {/* Timeline */}
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/50">
              Linha do tempo
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Milestone label="Criado" at={o.created_at} />
              <Milestone label="Pago" at={o.paid_at} />
              <Milestone label="Preparando" at={o.preparing_at} />
              <Milestone label="Saiu p/ entrega" at={o.dispatched_at} />
              <Milestone label="Retirado pelo motoboy" at={o.picked_up_at} />
              <Milestone label="Entregue" at={o.delivered_at} />
              <Milestone label="Cancelado" at={o.canceled_at} tone="rose" />
            </div>
          </div>

          {/* Cliente + Entrega */}
          <div className="grid gap-3 md:grid-cols-2">
            <InfoBlock title="Cliente">
              <InfoRow icon={User2} label="Nome" value={o.customer_name || "—"} />
              <InfoRow icon={Phone} label="Telefone" value={o.phone || "—"} />
              <InfoRow icon={Hash} label="ID interno" value={o.id} mono />
              {o.user_id && <InfoRow icon={User2} label="Usuário" value={o.user_id} mono />}
            </InfoBlock>
            <InfoBlock title={o.mode === "retirada" ? "Retirada" : "Entrega"}>
              <InfoRow icon={ModeIcon} label="Modo" value={o.mode || "—"} />
              {o.address && <InfoRow icon={MapPin} label="Endereço" value={o.address} />}
              {o.reference && <InfoRow icon={MapPin} label="Referência" value={o.reference} />}
              {typeof o.distance_km === "number" && (
                <InfoRow icon={MapPin} label="Distância" value={`${o.distance_km.toFixed(2)} km`} />
              )}
              {typeof o.eta_minutes === "number" && (
                <InfoRow icon={Timer} label="ETA" value={`${o.eta_minutes} min`} />
              )}
              {o.tracking_token && (
                <InfoRow
                  icon={ExternalLink}
                  label="Rastreio"
                  value={
                    <Link
                      to="/rastrear/$token"
                      params={{ token: o.tracking_token }}
                      className="text-fuchsia-300 underline hover:text-fuchsia-200"
                    >
                      Abrir página pública
                    </Link>
                  }
                />
              )}
            </InfoBlock>
          </div>

          {/* Pagamento */}
          <InfoBlock title="Pagamento">
            <div className="grid gap-2 md:grid-cols-2">
              <InfoRow icon={Wallet} label="Método" value={paymentLabel(o)} />
              <InfoRow
                icon={CreditCard}
                label="Status Asaas"
                value={o.asaas_status || "—"}
              />
              {o.asaas_payment_id && (
                <InfoRow
                  icon={Hash}
                  label="ID Asaas"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <span className="font-mono">{o.asaas_payment_id}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(o.asaas_payment_id!);
                          toast.success("ID copiado");
                        }}
                        className="text-white/50 hover:text-white"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </span>
                  }
                />
              )}
              {o.card_brand && (
                <InfoRow
                  icon={CreditCard}
                  label="Cartão"
                  value={`${o.card_brand.toUpperCase()} •••• ${o.card_last4 ?? ""}`}
                />
              )}
              {o.pix_expires_at && (
                <InfoRow icon={QrCode} label="PIX expira" value={fmtDateTime(o.pix_expires_at)} />
              )}
              {o.invoice_url && (
                <InfoRow
                  icon={ExternalLink}
                  label="Fatura"
                  value={
                    <a
                      href={o.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fuchsia-300 underline hover:text-fuchsia-200"
                    >
                      Abrir no Asaas
                    </a>
                  }
                />
              )}
            </div>
          </InfoBlock>

          {/* Itens */}
          <InfoBlock title={`Itens${items ? ` (${items.reduce((s, i) => s + i.quantity, 0)})` : ""}`}>
            {!items ? (
              <div className="text-xs text-white/50">Carregando itens...</div>
            ) : items.length === 0 ? (
              <div className="text-xs text-white/50">Sem itens.</div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">
                          {it.quantity}× {it.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/50">
                          {[it.size, it.flavor].filter(Boolean).join(" · ") || "—"}
                        </div>
                        {it.extras && it.extras.length > 0 && (
                          <div className="mt-1 text-[11px] text-white/60">
                            + {it.extras.map((e) => e.label).join(", ")}
                          </div>
                        )}
                        {it.removed && it.removed.length > 0 && (
                          <div className="mt-1 text-[11px] text-rose-200/80">
                            − {it.removed.join(", ")}
                          </div>
                        )}
                        {it.note && (
                          <div className="mt-1 text-[11px] italic text-white/60">
                            "{it.note}"
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm font-black text-white">
                        {brl(Number(it.unit_price) * it.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoBlock>

          {/* Totais */}
          <InfoBlock title="Totais">
            <div className="space-y-1 text-sm">
              <TotalLine label="Subtotal" value={Number(o.subtotal ?? 0)} />
              {Number(o.delivery_fee ?? 0) > 0 && (
                <TotalLine label="Entrega" value={Number(o.delivery_fee)} />
              )}
              {Number(o.service_fee ?? 0) > 0 && (
                <TotalLine label="Taxa de serviço" value={Number(o.service_fee)} />
              )}
              {Number(o.coupon_discount ?? 0) > 0 && (
                <TotalLine
                  label={`Desconto${o.coupon_code ? ` (${o.coupon_code})` : ""}`}
                  value={-Number(o.coupon_discount)}
                  accent="emerald"
                />
              )}
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-xs font-black uppercase tracking-widest text-white/60">
                  Total
                </span>
                <span className="text-lg font-black text-white">{brl(Number(o.total ?? 0))}</span>
              </div>
            </div>
          </InfoBlock>

          {/* Avaliação / Notas / Prova */}
          {(o.note ||
            o.customer_rating ||
            o.courier_rating ||
            o.delivery_photo_url ||
            o.delivery_proof_notes) && (
            <InfoBlock title="Extras">
              {o.note && (
                <InfoRow icon={FileText} label="Observação" value={o.note} />
              )}
              {o.customer_rating != null && (
                <InfoRow icon={Star} label="Avaliação loja" value={`${o.customer_rating}/5`} />
              )}
              {o.courier_rating != null && (
                <InfoRow icon={Star} label="Avaliação motoboy" value={`${o.courier_rating}/5`} />
              )}
              {o.delivery_photo_url && (
                <InfoRow
                  icon={ExternalLink}
                  label="Foto de entrega"
                  value={
                    <a
                      href={o.delivery_photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fuchsia-300 underline hover:text-fuchsia-200"
                    >
                      Abrir
                    </a>
                  }
                />
              )}
              {o.delivery_proof_notes && (
                <InfoRow icon={FileText} label="Notas de entrega" value={o.delivery_proof_notes} />
              )}
            </InfoBlock>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              to="/rush"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" /> Abrir na Cozinha
            </Link>
            {o.status === "pendente" && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: "Confirmar pagamento?",
                    description: `Marcar o pedido #${(o.id || "").slice(0, 8)} como pago manualmente. Esta ação envia o pedido para preparo.`,
                    confirmLabel: "Sim, confirmar",
                    cancelLabel: "Cancelar",
                    tone: "primary",
                  });
                  if (!ok) return;
                  const { error } = await supabase
                    .from("orders")
                    .update({ status: "confirmado", payment_status: "paid", paid_at: new Date().toISOString() })
                    .eq("id", o.id);
                  if (error) toast.error("Falha ao confirmar", { description: error.message });
                  else toast.success("Pagamento confirmado");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25"
              >
                <Timer className="h-3.5 w-3.5" /> Confirmar pagamento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Milestone({
  label,
  at,
  tone = "cyan",
}: {
  label: string;
  at: string | null;
  tone?: "cyan" | "rose";
}) {
  const done = !!at;
  return (
    <div
      className={cn(
        "rounded-xl border p-2",
        done
          ? tone === "rose"
            ? "border-rose-400/30 bg-rose-500/10"
            : "border-cyan-400/30 bg-cyan-500/10"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="text-[10px] font-black uppercase tracking-widest text-white/60">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[11px]",
          done ? "text-white" : "text-white/40",
        )}
      >
        {at ? fmtDateTime(at) : "—"}
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/50">
        {title}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
      <span className="w-28 shrink-0 text-white/50">{label}</span>
      <span className={cn("min-w-0 flex-1 break-words text-white/90", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    </div>
  );
}

function TotalLine({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      <span className={cn("font-bold", accent === "emerald" ? "text-emerald-300" : "text-white")}>
        {brl(value)}
      </span>
    </div>
  );
}
