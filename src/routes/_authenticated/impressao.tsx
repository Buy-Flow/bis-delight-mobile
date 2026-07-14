import { useEffect, useMemo, useRef, useState } from "react";
import { confirmDialog } from "@/lib/confirm";
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
  silent_mode: boolean;
  auto_delay_ms: number;
  max_retries: number;
  beep_volume: number;
  beep_repeat: number;
  only_paid_orders: boolean;
};

type Printer = {
  id: string;
  name: string;
  kinds: string[];
  target: "browser" | "bridge" | "escpos";
  bridge_url: string | null;
  copies: number;
  paper_width: number | null;
  active: boolean;
  is_default: boolean;
  sort_index: number;
  last_ok_at: string | null;
  last_error: string | null;
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
  const [printers, setPrinters] = useState<Printer[]>([]);
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
    const [ps, ss, ord, jb, pr] = await Promise.all([
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
      supabase
        .from("print_printers")
        .select("*")
        .order("sort_index", { ascending: true }),
    ]);
    if (ps.data) setSettings(ps.data as PrintSettings);
    if (pr.data) setPrinters(pr.data as Printer[]);
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

  // Dispatch a print kind to every matching active printer
  const dispatchKind = async (
    kind: "cliente" | "cozinha" | "entrega",
    order: OrderRow,
    its: OrderItemRow[],
  ) => {
    if (!settings) return;
    const targets = printers.filter((p) => p.active && p.kinds.includes(kind));
    if (targets.length === 0) {
      // Fallback: browser dialog with default settings
      openPrintWindow(renderReceipt(kind, order, its, settings, site), settings);
      logJob(order.id, kind, "ok", null);
      return;
    }
    for (const p of targets) {
      const localSettings: PrintSettings = {
        ...settings,
        copies: p.copies || settings.copies,
        paper_width: p.paper_width ?? settings.paper_width,
      };
      const html = renderReceipt(kind, order, its, localSettings, site);
      try {
        if (p.target === "bridge" && p.bridge_url) {
          const r = await fetch(p.bridge_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              printer: p.name,
              kind,
              copies: p.copies,
              paper_width: localSettings.paper_width,
              order_id: order.id,
              html,
            }),
          });
          if (!r.ok) throw new Error(`bridge ${r.status}`);
          await supabase
            .from("print_printers")
            .update({ last_ok_at: new Date().toISOString(), last_error: null })
            .eq("id", p.id);
        } else {
          openPrintWindow(html, localSettings);
        }
        logJob(order.id, kind, "ok", p.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("print_printers")
          .update({ last_error: msg })
          .eq("id", p.id);
        logJob(order.id, kind, "erro", p.id);
        toast.error(`Falha em ${p.name}: ${msg}`);
      }
    }
  };

  // Auto-print realtime subscription
  useEffect(() => {
    if (!settings?.auto_print_new_orders) return;
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
          if (settings.only_paid_orders && order.status !== "pago" && order.status !== "confirmado") return;
          if (settings.beep_on_new) beep();
          if (settings.auto_delay_ms > 0) {
            await new Promise((r) => setTimeout(r, settings.auto_delay_ms));
          }
          const { data } = await supabase
            .from("order_items")
            .select("id,order_id,name,quantity,unit_price,extras")
            .eq("order_id", order.id);
          const its = (data ?? []) as OrderItemRow[];
          if (settings.print_customer_copy) await dispatchKind("cliente", order, its);
          if (settings.print_kitchen_copy) await dispatchKind("cozinha", order, its);
          if (settings.print_delivery_label && order.mode === "entrega")
            await dispatchKind("entrega", order, its);
          toast.success(`Novo pedido de ${order.customer_name || "cliente"} impresso`);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, orders, site, printers]);

  const beep = () => {
    if (!settings) return;
    const repeats = Math.max(1, settings.beep_repeat);
    const vol = Math.min(1, Math.max(0, settings.beep_volume / 100));
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current ||= new AC();
      const ctx = audioCtxRef.current;
      for (let i = 0; i < repeats; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.75;
        gain.gain.setValueAtTime(vol * 0.4, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        osc.start(t0);
        osc.stop(t0 + 0.6);
      }
    } catch { /* noop */ }
  };

  const logJob = async (
    orderId: string | null,
    kind: string,
    status: "ok" | "erro",
    printerId: string | null = null,
  ) => {
    await supabase.from("print_jobs").insert({ order_id: orderId, kind, status, printer_id: printerId });
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
    void dispatchKind(kind, selectedOrder, selectedItems);
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

  const addPrinter = async () => {
    const { data, error } = await supabase
      .from("print_printers")
      .insert({
        name: `Impressora ${printers.length + 1}`,
        kinds: ["cliente", "cozinha", "entrega"],
        target: "browser",
        copies: 1,
        active: true,
        sort_index: printers.length,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setPrinters([...printers, data as Printer]);
  };

  const updatePrinter = async (id: string, patch: Partial<Printer>) => {
    setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("print_printers").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deletePrinter = async (id: string) => {
    if (!(await confirmDialog({ message: "Remover impressora?" }))) return;
    const { error } = await supabase.from("print_printers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  };

  const testPrinter = async (p: Printer) => {
    if (!settings) return;
    const html = renderTest({ ...settings, paper_width: p.paper_width ?? settings.paper_width, copies: p.copies }, site);
    try {
      if (p.target === "bridge" && p.bridge_url) {
        const r = await fetch(p.bridge_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ printer: p.name, kind: "teste", copies: p.copies, html }),
        });
        if (!r.ok) throw new Error(`bridge ${r.status}`);
        await updatePrinter(p.id, { last_ok_at: new Date().toISOString(), last_error: null });
        toast.success(`Teste enviado para ${p.name}`);
      } else {
        openPrintWindow(html, { ...settings, copies: p.copies });
      }
      logJob(null, "teste", "ok", p.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updatePrinter(p.id, { last_error: msg });
      logJob(null, "teste", "erro", p.id);
      toast.error(msg);
    }
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

            {/* Impressoras cadastradas */}
            <Section title="Impressoras cadastradas" icon={Printer}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-white/60">
                  Cada impressora recebe automaticamente os tipos marcados. Use "bridge" para
                  falar com um agente local que envia direto ao ESC/POS sem diálogo do navegador.
                </p>
                <button
                  onClick={addPrinter}
                  className="rounded-lg bg-neon-pink px-3 py-1.5 text-xs font-bold hover:brightness-110"
                >
                  + Adicionar
                </button>
              </div>
              {printers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
                  Nenhuma impressora cadastrada. Adicione ao menos uma.
                </div>
              ) : (
                <div className="space-y-2">
                  {printers.map((p) => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={p.name}
                              onChange={(e) => updatePrinter(p.id, { name: e.target.value })}
                              className={cn(inputCls, "max-w-[240px] py-1.5 text-sm font-bold")}
                            />
                            <select
                              value={p.target}
                              onChange={(e) => updatePrinter(p.id, { target: e.target.value as Printer["target"] })}
                              className={cn(inputCls, "max-w-[160px] py-1.5 text-xs")}
                            >
                              <option value="browser">Navegador</option>
                              <option value="bridge">Bridge (HTTP)</option>
                              <option value="escpos">ESC/POS</option>
                            </select>
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                              <input
                                type="checkbox"
                                checked={p.active}
                                onChange={(e) => updatePrinter(p.id, { active: e.target.checked })}
                                className="accent-neon-pink"
                              />
                              Ativa
                            </label>
                            {p.last_error && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                                <XCircle className="h-3 w-3" /> {p.last_error.slice(0, 40)}
                              </span>
                            )}
                            {p.last_ok_at && !p.last_error && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            )}
                          </div>
                          {p.target === "bridge" && (
                            <input
                              value={p.bridge_url ?? ""}
                              placeholder="http://localhost:9100/print"
                              onChange={(e) => updatePrinter(p.id, { bridge_url: e.target.value })}
                              className={cn(inputCls, "py-1.5 text-xs")}
                            />
                          )}
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Cópias</span>
                              <input
                                type="number" min={1} max={9}
                                value={p.copies}
                                onChange={(e) => updatePrinter(p.id, { copies: Number(e.target.value) })}
                                className={cn(inputCls, "w-16 py-1.5 text-xs")}
                              />
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Papel</span>
                              <select
                                value={String(p.paper_width ?? "")}
                                onChange={(e) => updatePrinter(p.id, { paper_width: e.target.value ? Number(e.target.value) : null })}
                                className={cn(inputCls, "max-w-[110px] py-1.5 text-xs")}
                              >
                                <option value="">Padrão</option>
                                <option value="58">58mm</option>
                                <option value="80">80mm</option>
                              </select>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {(["cliente", "cozinha", "entrega"] as const).map((k) => {
                                const on = p.kinds.includes(k);
                                const Icon = KIND_ICON[k];
                                return (
                                  <button
                                    key={k}
                                    onClick={() => {
                                      const next = on ? p.kinds.filter((x) => x !== k) : [...p.kinds, k];
                                      updatePrinter(p.id, { kinds: next });
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest transition",
                                      on
                                        ? "border-neon-pink/50 bg-neon-pink/15 text-neon-pink"
                                        : "border-white/10 bg-white/5 text-white/50 hover:text-white",
                                    )}
                                  >
                                    <Icon className="h-3 w-3" /> {k}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => testPrinter(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold hover:bg-white/10"
                          >
                            <Play className="h-3 w-3" /> Testar
                          </button>
                          <button
                            onClick={() => deletePrinter(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                          >
                            <XCircle className="h-3 w-3" /> Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Automação */}
            <Section title="Automação de novos pedidos" icon={Zap}>
              <div className="grid gap-2 md:grid-cols-2">
                <Toggle
                  label="Imprimir automaticamente ao entrar pedido"
                  hint="Assim que o pedido é criado, dispara para todas as impressoras ativas."
                  checked={S.auto_print_new_orders}
                  onChange={(v) => setSettings({ ...S, auto_print_new_orders: v })}
                  icon={S.auto_print_new_orders ? Zap : ZapOff}
                />
                <Toggle
                  label="Somente pedidos pagos/confirmados"
                  hint="Ignora pedidos ainda pendentes de pagamento."
                  checked={S.only_paid_orders}
                  onChange={(v) => setSettings({ ...S, only_paid_orders: v })}
                />
                <Toggle
                  label="Modo silencioso (kiosk)"
                  hint="Requer Chrome com --kiosk-printing. Pula o diálogo do navegador."
                  checked={S.silent_mode}
                  onChange={(v) => setSettings({ ...S, silent_mode: v })}
                />
                <Toggle
                  label="Bipe em novo pedido"
                  checked={S.beep_on_new}
                  onChange={(v) => setSettings({ ...S, beep_on_new: v })}
                  icon={S.beep_on_new ? Volume2 : VolumeX}
                />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Atraso antes de imprimir (ms)">
                  <input
                    type="number" min={0} max={30000} step={100}
                    value={S.auto_delay_ms}
                    onChange={(e) => setSettings({ ...S, auto_delay_ms: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Máx. tentativas em erro">
                  <input
                    type="number" min={0} max={5}
                    value={S.max_retries}
                    onChange={(e) => setSettings({ ...S, max_retries: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Volume do bipe (%)">
                  <input
                    type="number" min={0} max={100}
                    value={S.beep_volume}
                    onChange={(e) => setSettings({ ...S, beep_volume: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Repetições do bipe">
                  <input
                    type="number" min={1} max={5}
                    value={S.beep_repeat}
                    onChange={(e) => setSettings({ ...S, beep_repeat: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/80">
                Deixe esta página aberta em um computador do estabelecimento para receber e imprimir os pedidos em tempo real.
                Para impressão silenciosa, abra o Chrome com <code className="rounded bg-black/40 px-1">--kiosk-printing</code> ou use uma impressora com "target = bridge" apontando para um agente local (QZ Tray, node-thermal-printer, etc.).
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
  const storeName = (site?.name || "Quero Bis").toUpperCase();
  const address = [site?.address, site?.city].filter(Boolean).join(" — ");
  const d = new Date(order.created_at);
  const dateStr = d.toLocaleDateString("pt-BR");
  const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const shortId = order.id.slice(0, 6).toUpperCase();
  const dashed = "- - - - - - - - - - - - - - - -";
  const solid = "════════════════════════════════";
  const wave = "~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~";
  const totalItems = its.reduce((a, b) => a + b.quantity, 0);
  const modeLabel: Record<string, string> = {
    entrega: "🛵  DELIVERY",
    retirada: "🏪  RETIRADA",
    mesa: "🍽️  MESA",
    balcao: "🧾  BALCÃO",
  };
  const modeTxt = modeLabel[order.mode || ""] || (order.mode || "—").toUpperCase();

  if (kind === "entrega") {
    return `
      <div style="text-align:center;font-weight:900;font-size:1.5em;letter-spacing:2px;">✦ ENTREGA ✦</div>
      <div style="text-align:center;font-size:0.85em;margin-bottom:2px;">${escapeHtml(storeName)}</div>
      <div style="text-align:center;">${solid}</div>
      <div style="text-align:center;font-size:1.6em;font-weight:900;margin:4px 0;">#${shortId}</div>
      <div style="text-align:center;">${dashed}</div>
      <div style="font-size:0.85em;color:#333;margin-top:6px;">📞 CLIENTE</div>
      <div style="font-size:1.2em;font-weight:900;">${escapeHtml(order.customer_name || "Cliente")}</div>
      <div style="font-size:1.05em;">${escapeHtml(order.phone || "—")}</div>
      <div style="font-size:0.85em;color:#333;margin-top:8px;">📍 ENDEREÇO</div>
      <div style="font-size:1.1em;line-height:1.35;font-weight:700;">${escapeHtml(order.address || "—")}</div>
      <div style="text-align:center;margin-top:8px;">${dashed}</div>
      <div style="display:flex;justify-content:space-between;"><span>📅 ${escapeHtml(dateStr)}</span><span>⏰ ${escapeHtml(timeStr)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Itens</span><span><b>${totalItems}</b></span></div>
      <div style="display:flex;justify-content:space-between;font-size:1.15em;"><span>Total</span><span><b>${BRL(Number(order.total ?? 0))}</b></span></div>
      <div>Pagto: <b>${escapeHtml(order.status || "—")}</b></div>
      <div style="text-align:center;margin-top:8px;">${solid}</div>
      <div style="text-align:center;font-weight:900;">Feito com ♥ por ${escapeHtml(storeName)}</div>
      <div style="text-align:center;font-size:0.9em;">${escapeHtml(site?.whatsapp_display || site?.whatsapp || "")}</div>
    `;
  }

  if (kind === "cozinha") {
    const rows = its
      .map((it, i) => {
        const extras = extrasSummary(it.extras);
        return `
          <div style="margin:6px 0;padding:4px 0;border-bottom:1px dashed #999;">
            <div style="display:flex;gap:6px;align-items:baseline;">
              <div style="font-size:1.6em;font-weight:900;min-width:1.8em;">${it.quantity}×</div>
              <div style="flex:1;font-size:1.2em;font-weight:900;text-transform:uppercase;">${escapeHtml(it.name)}</div>
            </div>
            ${extras ? `<div style="padding-left:2em;font-size:1em;font-weight:700;">↳ ${escapeHtml(extras)}</div>` : ""}
            <div style="text-align:right;font-size:0.75em;color:#666;">item ${i + 1}/${its.length}</div>
          </div>
        `;
      })
      .join("");
    return `
      <div style="text-align:center;font-weight:900;font-size:1.5em;letter-spacing:3px;">👨‍🍳 COZINHA</div>
      <div style="text-align:center;">${solid}</div>
      <div style="display:flex;justify-content:space-between;font-size:1.1em;">
        <span><b>#${shortId}</b></span>
        <span>${escapeHtml(timeStr)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.9em;">
        <span>${escapeHtml(order.customer_name || "Cliente")}</span>
        <span><b>${modeTxt}</b></span>
      </div>
      <div style="text-align:center;">${dashed}</div>
      ${rows || `<div style="text-align:center;color:#666;">Sem itens</div>`}
      <div style="text-align:center;margin-top:4px;">${solid}</div>
      <div style="text-align:center;font-size:1.25em;font-weight:900;">TOTAL: ${totalItems} ITENS</div>
      <div style="text-align:center;font-size:0.85em;margin-top:4px;">Bora fazer com carinho ♥</div>
    `;
  }

  // cliente — recibo personalizado Quero Bis
  const rows = its
    .map((it) => {
      const extras = extrasSummary(it.extras);
      const sub = it.quantity * Number(it.unit_price);
      return `
        <div style="margin:3px 0;">
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <div style="flex:1;font-weight:700;">★ ${it.quantity}x ${escapeHtml(it.name)}</div>
            <div style="white-space:nowrap;font-weight:700;">${BRL(sub)}</div>
          </div>
          ${extras ? `<div style="padding-left:1.3em;font-size:0.88em;color:#333;">↳ ${escapeHtml(extras)}</div>` : ""}
          <div style="padding-left:1.3em;font-size:0.8em;color:#666;">${it.quantity} × ${BRL(Number(it.unit_price))}</div>
        </div>
      `;
    })
    .join("");

  const totalNum = Number(order.total ?? 0);
  return `
    ${S.show_logo && site?.logo_url ? `<div style="text-align:center;margin-bottom:2px;"><img src="${escapeHtml(site.logo_url)}" style="max-height:56px;"/></div>` : ""}
    <div style="text-align:center;font-weight:900;font-size:1.55em;letter-spacing:2px;">${escapeHtml(storeName)}</div>
    <div style="text-align:center;font-size:0.85em;font-style:italic;color:#444;">— shakes feitos com amor —</div>
    ${address ? `<div style="text-align:center;font-size:0.85em;margin-top:2px;">📍 ${escapeHtml(address)}</div>` : ""}
    ${site?.whatsapp_display || site?.whatsapp ? `<div style="text-align:center;font-size:0.85em;">📱 ${escapeHtml(site.whatsapp_display || site.whatsapp || "")}</div>` : ""}
    ${S.show_cnpj && S.cnpj ? `<div style="text-align:center;font-size:0.78em;color:#555;">CNPJ ${escapeHtml(S.cnpj)}</div>` : ""}
    ${S.header_text ? `<div style="text-align:center;margin-top:4px;font-size:0.9em;">${escapeHtml(S.header_text)}</div>` : ""}
    <div style="text-align:center;margin-top:4px;">${wave}</div>
    <div style="text-align:center;font-weight:900;letter-spacing:2px;font-size:1.05em;">RECIBO</div>
    <div style="text-align:center;">${wave}</div>

    <div style="margin-top:4px;display:flex;justify-content:space-between;">
      <span>Pedido</span><span><b>#${shortId}</b></span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Data</span><span>${escapeHtml(dateStr)} · ${escapeHtml(timeStr)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Modo</span><span><b>${modeTxt}</b></span>
    </div>

    <div style="margin-top:6px;padding:4px 6px;border:1px dashed #000;">
      <div style="font-size:0.8em;color:#333;">Olá,</div>
      <div style="font-size:1.15em;font-weight:900;">${escapeHtml(order.customer_name || "Cliente")} 👋</div>
      ${order.phone ? `<div style="font-size:0.85em;">${escapeHtml(order.phone)}</div>` : ""}
      ${order.address ? `<div style="font-size:0.85em;margin-top:2px;">📍 ${escapeHtml(order.address)}</div>` : ""}
    </div>

    <div style="text-align:center;margin-top:6px;">${dashed}</div>
    <div style="text-align:center;font-weight:900;letter-spacing:2px;">✦ SEU PEDIDO ✦</div>
    <div style="text-align:center;">${dashed}</div>
    ${rows || `<div style="text-align:center;color:#666;">Sem itens</div>`}
    <div style="text-align:center;">${dashed}</div>

    <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${BRL(Number(order.subtotal ?? 0))}</span></div>
    ${Number(order.delivery_fee ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Taxa de entrega</span><span>${BRL(Number(order.delivery_fee))}</span></div>` : ""}
    ${order.coupon_code ? `<div style="display:flex;justify-content:space-between;color:#0a7;"><span>🎟️ Cupom ${escapeHtml(order.coupon_code)}</span><span>aplicado</span></div>` : ""}
    <div style="margin-top:4px;padding:4px 6px;background:#000;color:#fff;display:flex;justify-content:space-between;font-size:1.3em;font-weight:900;">
      <span>TOTAL</span><span>${BRL(totalNum)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">
      <span>Pagamento</span><span><b>${escapeHtml((order.status || "—").toUpperCase())}</b></span>
    </div>

    ${S.show_pix && site?.pix_key ? `
      <div style="margin-top:6px;padding:4px 6px;border:1px dashed #000;text-align:center;">
        <div style="font-weight:900;">PIX</div>
        <div style="font-size:0.9em;word-break:break-all;">${escapeHtml(site.pix_key)}</div>
      </div>
    ` : ""}
    ${S.show_qr ? `
      <div style="text-align:center;margin-top:8px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://querobis.lovable.app/pedido/${order.id}`)}" style="width:118px;height:118px;"/>
        <div style="font-size:0.8em;color:#333;">Acompanhe seu pedido</div>
      </div>
    ` : ""}

    <div style="text-align:center;margin-top:8px;">${wave}</div>
    <div style="text-align:center;font-weight:900;font-size:1.05em;">Obrigado pelo carinho! ♥</div>
    <div style="text-align:center;font-size:0.9em;">Volte sempre — a gente ama te ver por aqui.</div>
    <div style="text-align:center;font-size:0.85em;margin-top:2px;">#QueroBis · @querobis</div>
    ${S.footer_text ? `<div style="text-align:center;margin-top:4px;font-size:0.85em;font-style:italic;">${escapeHtml(S.footer_text)}</div>` : ""}
    ${S.tax_note ? `<div style="text-align:center;margin-top:4px;font-size:0.75em;color:#666;">${escapeHtml(S.tax_note)}</div>` : ""}
    <div style="text-align:center;margin-top:4px;">${wave}</div>
    <div style="text-align:center;font-size:0.7em;color:#666;margin-top:2px;">${escapeHtml(shortId)} · ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</div>
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
      body { font-family:'Courier New', ui-monospace, monospace; font-size:${S.font_size}pt; color:#000; width:${width}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .receipt { padding: 2mm; line-height:1.35; }
      .receipt img { max-width:100%; }
      .receipt * { box-sizing:border-box; }
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
