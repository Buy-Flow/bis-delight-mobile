import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Printer,
  Save,
  ChefHat,
  Receipt,
  Truck,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  History,
  CheckCircle2,
  XCircle,
  Cog,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/impressao")({
  head: () => ({
    meta: [
      { title: "Impressão — Quero Bis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintCenterPage,
});

type PrintSettings = {
  id: number;
  paper_width: number;
  font_size: number;
  header_text: string;
  footer_text: string;
  show_logo: boolean;
  show_qr: boolean;
  show_pix: boolean;
  show_cnpj: boolean;
  cnpj: string;
  tax_note: string;
  print_customer_copy: boolean;
  print_kitchen_copy: boolean;
  print_delivery_label: boolean;
  auto_print_new_orders: boolean;
  copies: number;
  cut_after: boolean;
  beep_on_new: boolean;
  kitchen_group_by_category: boolean;
};

type SiteSettings = {
  name: string;
  address: string;
  city: string;
  whatsapp: string;
  whatsapp_display: string;
  logo_url: string | null;
  pix_key: string;
};

type OrderRow = {
  id: string;
  customer_name: string | null;
  phone: string | null;
  mode: string | null;
  status: string;
  total: number | null;
  subtotal: number | null;
  delivery_fee: number | null;
  address: string | null;
  created_at: string;
  coupon_code: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  extras: unknown;
};

type PrintJob = {
  id: string;
  order_id: string | null;
  kind: string;
  status: string;
  created_at: string;
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const KIND_LABEL: Record<string, string> = {
  cliente: "Recibo cliente",
  cozinha: "Ficha cozinha",
  entrega: "Etiqueta entrega",
  teste: "Impressão de teste",
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cliente: Receipt,
  cozinha: ChefHat,
  entrega: Truck,
  teste: Play,
};

function PrintCenterPage() {
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, OrderItemRow[]>>({});
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [preview, setPreview] = useState<"cliente" | "cozinha" | "entrega">(
    "cliente",
  );
  const seenOrdersRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const load = async () => {
    setLoading(true);
    const [ps, ss, ord, jb] = await Promise.all([
      supabase.from("print_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("site_settings")
        .select("name,address,city,whatsapp,whatsapp_display,logo_url")
        .maybeSingle(),
      supabase
        .from("orders")
        .select(
          "id,customer_name,phone,mode,status,total,subtotal,delivery_fee,address,created_at,coupon_code",
        )
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("print_jobs")
        .select("id,order_id,kind,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (ps.data) setSettings(ps.data as PrintSettings);
    if (ss.data) {
      // Load admin-only pix_key via RPC and merge in
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pk } = await (supabase.rpc as any)("get_pix_key");
      setSite({ ...(ss.data as SiteSettings), pix_key: (pk as string) ?? "" } as SiteSettings);
    }
    if (ord.data) {
      const orderRows = ord.data as OrderRow[];
      setOrders(orderRows);
      if (orderRows.length > 0 && !selectedOrderId) {
        setSelectedOrderId(orderRows[0].id);
      }
      const ids = orderRows.map((o) => o.id);
      if (ids.length > 0) {
        const it = await supabase
          .from("order_items")
          .select("id,order_id,name,quantity,unit_price,extras")
          .in("order_id", ids);
        if (it.data) {
          const grouped: Record<string, OrderItemRow[]> = {};
          for (const r of it.data as OrderItemRow[]) {
            (grouped[r.order_id] ||= []).push(r);
          }
          setItems(grouped);
        }
      }
    }
    if (jb.data) setJobs(jb.data as PrintJob[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const selectedItems = useMemo(
    () => (selectedOrderId ? items[selectedOrderId] ?? [] : []),
    [items, selectedOrderId],
  );

  // Auto-print realtime subscription
  useEffect(() => {
    if (!settings?.auto_print_new_orders) return;
    // Seed with current orders
    for (const o of orders) seenOrdersRef.current.add(o.id);
    const ch = supabase
      .channel("print-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const order = payload.new as OrderRow;
          if (seenOrdersRef.current.has(order.id)) return;
          seenOrdersRef.current.add(order.id);
          if (settings.beep_on_new) beep();
          // Fetch items and auto-print
          const { data } = await supabase
            .from("order_items")
            .select("id,order_id,name,quantity,unit_price,extras")
            .eq("order_id", order.id);
          const its = (data ?? []) as OrderItemRow[];
          if (settings.print_customer_copy)
            openPrintWindow(renderReceipt("cliente", order, its, settings, site), settings);
          if (settings.print_kitchen_copy)
            openPrintWindow(renderReceipt("cozinha", order, its, settings, site), settings);
          if (settings.print_delivery_label && order.mode === "entrega")
            openPrintWindow(renderReceipt("entrega", order, its, settings, site), settings);
          logJob(order.id, "cliente", "ok");
          toast.success(`Novo pedido de ${order.customer_name || "cliente"} impresso`);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [settings, orders, site]);

  const beep = () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current ||= new AC();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* noop */ }
  };

  const logJob = async (orderId: string | null, kind: string, status: "ok" | "erro") => {
    await supabase.from("print_jobs").insert({ order_id: orderId, kind, status });
    load();
  };

  const printKind = (kind: "cliente" | "cozinha" | "entrega" | "teste") => {
    if (!settings) return;
    if (kind === "teste") {
      openPrintWindow(renderTest(settings, site), settings);
      logJob(null, "teste", "ok");
      return;
    }
    if (!selectedOrder) return toast.error("Selecione um pedido");
    openPrintWindow(
      renderReceipt(kind, selectedOrder, selectedItems, settings, site),
      settings,
    );
    logJob(selectedOrder.id, kind, "ok");
  };

  const printAll = () => {
    if (!settings || !selectedOrder) return;
    if (settings.print_customer_copy) printKind("cliente");
    if (settings.print_kitchen_copy) printKind("cozinha");
    if (settings.print_delivery_label && selectedOrder.mode === "entrega")
      printKind("entrega");
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...rest } = settings;
    void id;
    const { error } = await supabase.from("print_settings").update(rest).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  };

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayJobs = jobs.filter((j) => new Date(j.created_at) >= today);
    const ok = todayJobs.filter((j) => j.status === "ok").length;
    const err = todayJobs.filter((j) => j.status === "erro").length;
    const successRate = todayJobs.length > 0 ? (ok / todayJobs.length) * 100 : 100;
    const byKind: Record<string, number> = {};
    for (const j of todayJobs) byKind[j.kind] = (byKind[j.kind] || 0) + 1;
    const topKind = Object.entries(byKind).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return {
      today: todayJobs.length,
      ok,
      err,
      successRate,
      topKind,
    };
  }, [jobs]);

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-[#0c031f] p-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const S = settings;

  return (
    <div className="min-h-screen bg-[#0c031f] text-white">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neon-yellow">
              <Printer className="h-4 w-4" /> Centro de impressão
            </div>
            <h1 className="mt-1 text-2xl font-black md:text-3xl">Impressão</h1>
            <p className="mt-1 text-sm text-white/50">
              Configure recibos, cozinha e etiquetas. Reimprima pedidos e ative impressão
              automática de novos pedidos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setSettings({ ...S, auto_print_new_orders: !S.auto_print_new_orders })
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-widest transition",
                S.auto_print_new_orders
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
              )}
              title="Impressão automática de novos pedidos"
            >
              {S.auto_print_new_orders ? (
                <Zap className="h-3.5 w-3.5" />
              ) : (
                <ZapOff className="h-3.5 w-3.5" />
              )}
              Auto-print {S.auto_print_new_orders ? "ligado" : "desligado"}
            </button>
            <button
              onClick={() => printKind("teste")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Play className="h-3.5 w-3.5" /> Imprimir teste
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-neon-pink px-4 py-2 text-xs font-bold text-white shadow-lg shadow-neon-pink/20 hover:brightness-110 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI
            label="Impressos hoje"
            value={String(kpis.today)}
            hint={`${kpis.ok} ok / ${kpis.err} erro`}
            icon={Printer}
            accent="pink"
          />
          <KPI
            label="Taxa de sucesso"
            value={`${kpis.successRate.toFixed(0)}%`}
            hint="24h"
            icon={CheckCircle2}
            accent="green"
          />
          <KPI
            label="Tipo mais comum"
            value={KIND_LABEL[kpis.topKind] ?? "—"}
            hint="hoje"
            icon={FileText}
            accent="yellow"
          />
          <KPI
            label="Papel"
            value={`${S.paper_width}mm`}
            hint={`${S.copies} cópia(s), fonte ${S.font_size}pt`}
            icon={Cog}
            accent="violet"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left: settings */}
          <div className="space-y-4">
            {/* Papel & Layout */}
            <Section title="Papel & Layout" icon={Cog}>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Largura do papel">
                  <div className="inline-flex overflow-hidden rounded-lg border border-white/10 bg-white/5 text-xs">
                    {[58, 80].map((w) => (
                      <button
                        key={w}
                        onClick={() => setSettings({ ...S, paper_width: w })}
                        className={cn(
                          "px-3 py-2 font-bold",
                          S.paper_width === w
                            ? "bg-neon-pink text-white"
                            : "text-white/60 hover:text-white",
                        )}
                      >
                        {w}mm
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Tamanho da fonte (pt)">
                  <input
                    type="number"
                    min={9}
                    max={16}
                    value={S.font_size}
                    onChange={(e) =>
                      setSettings({ ...S, font_size: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Cópias por impressão">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={S.copies}
                    onChange={(e) =>
                      setSettings({ ...S, copies: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Toggle
                  label="Corte automático (guilhotina)"
                  hint="Inclui o comando ESC/POS no final da impressão"
                  checked={S.cut_after}
                  onChange={(v) => setSettings({ ...S, cut_after: v })}
                />
                <Toggle
                  label="Bipe em novo pedido"
                  hint="Toca alerta sonoro quando entra pedido"
                  checked={S.beep_on_new}
                  onChange={(v) => setSettings({ ...S, beep_on_new: v })}
                  icon={S.beep_on_new ? Volume2 : VolumeX}
                />
              </div>
            </Section>

            {/* Cabeçalho */}
            <Section title="Cabeçalho & Rodapé" icon={FileText}>
              <div className="grid gap-3">
                <Field label="Cabeçalho extra (aparece após o nome da loja)">
                  <textarea
                    rows={2}
                    value={S.header_text}
                    onChange={(e) => setSettings({ ...S, header_text: e.target.value })}
                    placeholder="Ex. Delivery aberto das 18h às 23h"
                    className={inputCls}
                  />
                </Field>
                <Field label="Rodapé (mensagem final)">
                  <textarea
                    rows={2}
                    value={S.footer_text}
                    onChange={(e) => setSettings({ ...S, footer_text: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <div className="grid gap-2 md:grid-cols-2">
                  <Toggle
                    label="Mostrar logo"
                    checked={S.show_logo}
                    onChange={(v) => setSettings({ ...S, show_logo: v })}
                  />
                  <Toggle
                    label="Mostrar chave PIX"
                    checked={S.show_pix}
                    onChange={(v) => setSettings({ ...S, show_pix: v })}
                  />
                  <Toggle
                    label="Mostrar QR de rastreio"
                    checked={S.show_qr}
                    onChange={(v) => setSettings({ ...S, show_qr: v })}
                  />
                  <Toggle
                    label="Mostrar CNPJ"
                    checked={S.show_cnpj}
                    onChange={(v) => setSettings({ ...S, show_cnpj: v })}
                  />
                </div>
                {S.show_cnpj && (
                  <Field label="CNPJ">
                    <input
                      value={S.cnpj}
                      onChange={(e) => setSettings({ ...S, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      className={inputCls}
                    />
                  </Field>
                )}
                <Field label="Aviso fiscal (rodapé)">
                  <input
                    value={S.tax_note}
                    onChange={(e) => setSettings({ ...S, tax_note: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
            </Section>

            {/* Cópias automáticas */}
            <Section title="Cópias automáticas" icon={Printer}>
              <div className="grid gap-2 md:grid-cols-3">
                <Toggle
                  label="Recibo do cliente"
                  hint="Imprime resumo do pedido"
                  checked={S.print_customer_copy}
                  onChange={(v) => setSettings({ ...S, print_customer_copy: v })}
                  icon={Receipt}
                />
                <Toggle
                  label="Ficha da cozinha"
                  hint="Somente itens, sem preços"
                  checked={S.print_kitchen_copy}
                  onChange={(v) => setSettings({ ...S, print_kitchen_copy: v })}
                  icon={ChefHat}
                />
                <Toggle
                  label="Etiqueta de entrega"
                  hint="Endereço + cliente"
                  checked={S.print_delivery_label}
                  onChange={(v) => setSettings({ ...S, print_delivery_label: v })}
                  icon={Truck}
                />
              </div>
              <div className="mt-3">
                <Toggle
                  label="Agrupar cozinha por categoria"
                  hint="Separa a ficha por seções"
                  checked={S.kitchen_group_by_category}
                  onChange={(v) => setSettings({ ...S, kitchen_group_by_category: v })}
                />
              </div>
            </Section>

            {/* Reimprimir */}
            <Section title="Reimprimir pedido" icon={RefreshCw}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Field label="Pedido">
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecione…</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {new Date(o.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {o.customer_name || "Cliente"}
                        {" · "}
                        {BRL(Number(o.total ?? 0))}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end">
                  <button
                    onClick={printAll}
                    disabled={!selectedOrder}
                    className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-neon-pink px-4 text-xs font-bold text-white shadow-lg shadow-neon-pink/20 hover:brightness-110 disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" /> Imprimir tudo
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <PrintBtn kind="cliente" onClick={() => printKind("cliente")} disabled={!selectedOrder} />
                <PrintBtn kind="cozinha" onClick={() => printKind("cozinha")} disabled={!selectedOrder} />
                <PrintBtn
                  kind="entrega"
                  onClick={() => printKind("entrega")}
                  disabled={!selectedOrder || selectedOrder.mode !== "entrega"}
                />
              </div>
            </Section>

            {/* Histórico */}
            <Section title="Histórico" icon={History}>
              {jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
                  Nenhuma impressão registrada ainda.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Pedido</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 15).map((j) => {
                        const Icon = KIND_ICON[j.kind] ?? FileText;
                        return (
                          <tr key={j.id} className="border-t border-white/5">
                            <td className="px-3 py-2 text-white/70">
                              {new Date(j.created_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5 text-neon-yellow" />
                                {KIND_LABEL[j.kind] ?? j.kind}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] text-white/50">
                              {j.order_id ? j.order_id.slice(0, 8) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {j.status === "ok" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                                  <XCircle className="h-3 w-3" /> Erro
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          {/* Right: preview */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Pré-visualização
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-white/10 bg-white/5 text-[10px]">
                  {(["cliente", "cozinha", "entrega"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setPreview(k)}
                      className={cn(
                        "px-2 py-1 font-bold uppercase tracking-wider",
                        preview === k
                          ? "bg-neon-pink text-white"
                          : "text-white/60 hover:text-white",
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="mx-auto rounded-lg bg-white p-3 text-black shadow-2xl"
                style={{
                  width: S.paper_width === 58 ? "220px" : "302px",
                  fontFamily: "'Courier New', monospace",
                  fontSize: `${Math.max(9, S.font_size - 2)}px`,
                  lineHeight: 1.35,
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedOrder
                      ? bodyHtml(preview, selectedOrder, selectedItems, S, site)
                      : bodyHtml(preview, mockOrder(), mockItems(), S, site),
                  }}
                />
              </div>
              <p className="mt-2 text-center text-[10px] text-white/40">
                {selectedOrder
                  ? `Pedido de ${selectedOrder.customer_name || "cliente"}`
                  : "Exemplo — selecione um pedido para pré-visualizar dados reais"}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- UI parts -------------------------------- */

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-neon-yellow" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white/80">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
        {label}
      </div>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition",
        checked
          ? "border-neon-pink/40 bg-neon-pink/10"
          : "border-white/10 bg-white/[0.02] hover:bg-white/5",
      )}
    >
      {Icon && (
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", checked ? "text-neon-pink" : "text-white/50")}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold">{label}</div>
        {hint && <div className="mt-0.5 text-[10px] text-white/50">{hint}</div>}
      </div>
      <div
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-neon-pink" : "bg-white/15",
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </div>
    </button>
  );
}

function KPI({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "pink" | "yellow" | "green" | "violet";
}) {
  const map = {
    pink: "from-neon-pink/25 text-neon-pink",
    yellow: "from-neon-yellow/25 text-neon-yellow",
    green: "from-emerald-500/25 text-emerald-400",
    violet: "from-violet-500/25 text-violet-300",
  }[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-60", map)} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            {label}
          </span>
          <Icon className={cn("h-4 w-4", map.split(" ").pop())} />
        </div>
        <div className="mt-2 text-xl font-black tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-white/45">{hint}</div>}
      </div>
    </div>
  );
}

function PrintBtn({
  kind,
  onClick,
  disabled,
}: {
  kind: "cliente" | "cozinha" | "entrega";
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" /> {KIND_LABEL[kind]}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-pink/50";

/* ------------------------------- Print templates ---------------------------- */

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c),
  );
}

function extrasSummary(x: unknown): string {
  if (!x) return "";
  const arr = Array.isArray(x) ? x : [];
  const names = arr
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object" && "name" in e) return String((e as { name: unknown }).name);
      return "";
    })
    .filter(Boolean);
  return names.join(", ");
}

function bodyHtml(
  kind: "cliente" | "cozinha" | "entrega",
  order: OrderRow,
  its: OrderItemRow[],
  S: PrintSettings,
  site: SiteSettings | null,
) {
  const storeName = site?.name || "Quero Bis";
  const address = [site?.address, site?.city].filter(Boolean).join(" — ");
  const dateStr = new Date(order.created_at).toLocaleString("pt-BR");
  const line = "--------------------------------";

  if (kind === "entrega") {
    return `
      <div style="text-align:center;font-weight:900;font-size:1.35em;">ENTREGA</div>
      <div style="text-align:center;">${line}</div>
      <div style="font-size:1.15em;"><b>${escapeHtml(order.customer_name || "Cliente")}</b></div>
      <div>${escapeHtml(order.phone || "")}</div>
      <div style="margin-top:6px;font-size:1.05em;line-height:1.4;"><b>${escapeHtml(order.address || "—")}</b></div>
      <div style="text-align:center;margin-top:8px;">${line}</div>
      <div>Pedido: <b>#${order.id.slice(0, 6).toUpperCase()}</b></div>
      <div>Data: ${escapeHtml(dateStr)}</div>
      <div>Itens: ${its.reduce((a, b) => a + b.quantity, 0)}</div>
      <div>Total: <b>${BRL(Number(order.total ?? 0))}</b></div>
      <div>Pgto: ${escapeHtml(order.status || "—")}</div>
      <div style="text-align:center;margin-top:6px;">${line}</div>
      <div style="text-align:center;">${escapeHtml(storeName)}</div>
      <div style="text-align:center;">${escapeHtml(site?.whatsapp_display || site?.whatsapp || "")}</div>
    `;
  }

  if (kind === "cozinha") {
    const rows = its
      .map((it) => {
        const extras = extrasSummary(it.extras);
        return `
          <div style="margin:4px 0;">
            <div style="font-size:1.15em;font-weight:900;">${it.quantity}x  ${escapeHtml(it.name)}</div>
            ${extras ? `<div style="padding-left:1.5em;">+ ${escapeHtml(extras)}</div>` : ""}
          </div>
        `;
      })
      .join("");
    return `
      <div style="text-align:center;font-weight:900;font-size:1.35em;">COZINHA</div>
      <div style="text-align:center;">${line}</div>
      <div><b>#${order.id.slice(0, 6).toUpperCase()}</b> — ${escapeHtml(dateStr)}</div>
      <div>${escapeHtml(order.customer_name || "Cliente")} · ${escapeHtml(order.mode || "—")}</div>
      <div style="text-align:center;">${line}</div>
      ${rows || `<div style="text-align:center;color:#666;">Sem itens</div>`}
      <div style="text-align:center;">${line}</div>
      <div style="text-align:center;font-weight:900;">TOTAL DE ITENS: ${its.reduce((a, b) => a + b.quantity, 0)}</div>
    `;
  }

  // cliente
  const rows = its
    .map((it) => {
      const extras = extrasSummary(it.extras);
      const sub = it.quantity * Number(it.unit_price);
      return `
        <div style="display:flex;justify-content:space-between;gap:8px;margin:2px 0;">
          <div style="flex:1;">
            <div>${it.quantity}x ${escapeHtml(it.name)}</div>
            ${extras ? `<div style="padding-left:1em;font-size:0.9em;color:#333;">+ ${escapeHtml(extras)}</div>` : ""}
          </div>
          <div style="white-space:nowrap;">${BRL(sub)}</div>
        </div>
      `;
    })
    .join("");
  return `
    ${S.show_logo && site?.logo_url ? `<div style="text-align:center;margin-bottom:4px;"><img src="${escapeHtml(site.logo_url)}" style="max-height:48px;"/></div>` : ""}
    <div style="text-align:center;font-weight:900;font-size:1.2em;">${escapeHtml(storeName)}</div>
    ${address ? `<div style="text-align:center;font-size:0.9em;">${escapeHtml(address)}</div>` : ""}
    ${site?.whatsapp_display || site?.whatsapp ? `<div style="text-align:center;font-size:0.9em;">${escapeHtml(site.whatsapp_display || site.whatsapp || "")}</div>` : ""}
    ${S.show_cnpj && S.cnpj ? `<div style="text-align:center;font-size:0.85em;">CNPJ ${escapeHtml(S.cnpj)}</div>` : ""}
    ${S.header_text ? `<div style="text-align:center;margin-top:4px;">${escapeHtml(S.header_text)}</div>` : ""}
    <div style="text-align:center;">${line}</div>
    <div>Pedido: <b>#${order.id.slice(0, 6).toUpperCase()}</b></div>
    <div>Data: ${escapeHtml(dateStr)}</div>
    <div>Cliente: ${escapeHtml(order.customer_name || "—")}</div>
    ${order.phone ? `<div>Tel: ${escapeHtml(order.phone)}</div>` : ""}
    <div>Modo: ${escapeHtml(order.mode || "—")}</div>
    ${order.address ? `<div>End: ${escapeHtml(order.address)}</div>` : ""}
    <div style="text-align:center;">${line}</div>
    ${rows || `<div style="text-align:center;color:#666;">Sem itens</div>`}
    <div style="text-align:center;">${line}</div>
    <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${BRL(Number(order.subtotal ?? 0))}</span></div>
    ${Number(order.delivery_fee ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Entrega</span><span>${BRL(Number(order.delivery_fee))}</span></div>` : ""}
    ${order.coupon_code ? `<div style="display:flex;justify-content:space-between;"><span>Cupom ${escapeHtml(order.coupon_code)}</span><span></span></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-size:1.2em;font-weight:900;"><span>TOTAL</span><span>${BRL(Number(order.total ?? 0))}</span></div>
    <div>Pagamento: <b>${escapeHtml(order.status || "—")}</b></div>
    ${S.show_pix && site?.pix_key ? `<div style="text-align:center;margin-top:4px;">PIX: ${escapeHtml(site.pix_key)}</div>` : ""}
    ${S.show_qr ? `<div style="text-align:center;margin-top:6px;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://querobis.lovable.app/pedido/${order.id}`)}" style="width:110px;height:110px;"/></div>` : ""}
    <div style="text-align:center;margin-top:6px;">${line}</div>
    ${S.footer_text ? `<div style="text-align:center;margin-top:4px;">${escapeHtml(S.footer_text)}</div>` : ""}
    ${S.tax_note ? `<div style="text-align:center;margin-top:4px;font-size:0.8em;color:#666;">${escapeHtml(S.tax_note)}</div>` : ""}
  `;
}

function renderReceipt(
  kind: "cliente" | "cozinha" | "entrega",
  order: OrderRow,
  its: OrderItemRow[],
  S: PrintSettings,
  site: SiteSettings | null,
) {
  const width = `${S.paper_width}mm`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${KIND_LABEL[kind] ?? "Impressão"}</title>
    <style>
      @page { size: ${width} auto; margin: 3mm; }
      html,body { margin:0; padding:0; }
      body { font-family:'Courier New', monospace; font-size:${S.font_size}pt; color:#000; width:${width}; }
      .receipt { padding: 2mm; }
      .receipt img { max-width:100%; }
    </style></head><body><div class="receipt">${bodyHtml(kind, order, its, S, site)}</div>
    <script>window.addEventListener('load', () => { for (let i=0;i<${S.copies};i++) window.print(); });</script>
    </body></html>`;
}

function renderTest(S: PrintSettings, site: SiteSettings | null) {
  const width = `${S.paper_width}mm`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Teste</title>
    <style>
      @page { size: ${width} auto; margin: 3mm; }
      body { font-family:'Courier New', monospace; font-size:${S.font_size}pt; color:#000; width:${width}; margin:0; padding:2mm; }
    </style></head><body>
    <div style="text-align:center;font-weight:900;font-size:1.35em;">${escapeHtml(site?.name || "Quero Bis")}</div>
    <div style="text-align:center;">--------------------------------</div>
    <div style="text-align:center;font-weight:900;">IMPRESSÃO DE TESTE</div>
    <div style="text-align:center;">--------------------------------</div>
    <div>Data: ${new Date().toLocaleString("pt-BR")}</div>
    <div>Papel: ${S.paper_width}mm</div>
    <div>Fonte: ${S.font_size}pt</div>
    <div>Cópias: ${S.copies}</div>
    <div style="text-align:center;margin-top:6px;">--------------------------------</div>
    <div>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
    <div>abcdefghijklmnopqrstuvwxyz</div>
    <div>0123456789 ç ã õ é í ó ú</div>
    <div style="font-weight:900;">NEGRITO — R$ 1.234,56</div>
    <div style="text-align:center;margin-top:6px;">--------------------------------</div>
    <div style="text-align:center;">${escapeHtml(S.footer_text || "OK")}</div>
    <script>window.addEventListener('load', () => window.print());</script>
    </body></html>`;
}

function openPrintWindow(html: string, _S: PrintSettings) {
  void _S;
  const w = window.open("", "_blank", "width=420,height=680");
  if (!w) {
    toast.error("Habilite pop-ups para imprimir");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function mockOrder(): OrderRow {
  return {
    id: "0000000000ab1234cd",
    customer_name: "Cliente Exemplo",
    phone: "+55 11 90000-0000",
    mode: "entrega",
    status: "pago",
    total: 47.9,
    subtotal: 42.9,
    delivery_fee: 5,
    address: "Rua Exemplo, 123 — Apto 45",
    created_at: new Date().toISOString(),
    coupon_code: null,
  };
}
function mockItems(): OrderItemRow[] {
  return [
    { id: "1", order_id: "x", name: "Milkshake Ovomaltine", quantity: 2, unit_price: 18.9, extras: null },
    { id: "2", order_id: "x", name: "Shake Nutella", quantity: 1, unit_price: 21.9, extras: [{ name: "Chantilly extra" }] },
  ];
}
