// Server-only helpers for the automated cash-close routine.
// Generates a PDF report from the daily aggregate, uploads to Storage,
// sends a text summary + PDF attachment via Evolution WhatsApp API,
// and records the outcome in `cash_close_reports`.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evolutionConfig,
  fetchEvolutionWithTimeout,
  normalizeWhatsappPhone,
} from "./whatsapp-evolution.server";

// ---------- Types ----------

export interface CashCloseSettings {
  id: number;
  enabled: boolean;
  send_hour: number;
  send_minute: number;
  timezone: string;
  weekdays: number[];
  whatsapp_numbers: string[];
  send_pdf: boolean;
  send_text_summary: boolean;
  include_pending: boolean;
  include_canceled: boolean;
  auto_close_session: boolean;
  custom_header: string;
  custom_footer: string;
  logo_url: string | null;
  email_backup: string[];
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
}

export interface Aggregate {
  date: string;
  window_start: string;
  window_end: string;
  orders: { orders_count: number; revenue: number; subtotal: number; delivery_fees: number; service_fees: number; avg_ticket: number };
  by_mode: { mode: string; count: number; revenue: number }[];
  by_status: { status: string; count: number; revenue: number }[];
  payments: { method: string; count: number; amount: number }[];
  sessions: { id: string; operator_name: string | null; terminal: string; opened_at: string; closed_at: string | null; status: string; opening_amount: number; counted_amount: number | null; expected_amount: number | null; difference: number | null }[];
  movements: Record<string, { count: number; amount: number }>;
  top_products: { product_name: string; qty: number; revenue: number }[];
  hourly: { hour: number; revenue: number; count: number }[];
}

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

const MODE_LABEL: Record<string, string> = {
  entrega: "Delivery",
  retirada: "Retirada",
  mesa: "Mesa",
  balcao: "Balcão",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  novo: "Novo",
  pago: "Pago",
  preparando: "Preparando",
  saiu_para_entrega: "Saiu p/ entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  voucher: "Voucher",
  outro: "Outro",
};
const MOV_LABEL: Record<string, string> = {
  sale: "Vendas (PDV)",
  sangria: "Sangria",
  reforco: "Reforço",
  suprimento: "Suprimento",
  troco: "Troco",
  estorno: "Estorno",
  ajuste: "Ajuste",
};

// ---------- Text summary (used both in preview & WhatsApp) ----------

export function buildTextSummary(agg: Aggregate, header: string, footer: string): string {
  const lines: string[] = [];
  const dateStr = new Date(agg.date + "T12:00:00-03:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  if (header.trim()) lines.push(header.trim());
  lines.push(`*📊 Fechamento de Caixa*`);
  lines.push(`_${dateStr}_`);
  lines.push("");
  lines.push(`*Resumo do dia*`);
  lines.push(`• Pedidos: *${agg.orders.orders_count}*`);
  lines.push(`• Faturamento: *${BRL(agg.orders.revenue)}*`);
  lines.push(`• Ticket médio: ${BRL(agg.orders.avg_ticket)}`);
  if (agg.orders.delivery_fees) lines.push(`• Taxa de entrega: ${BRL(agg.orders.delivery_fees)}`);
  if (agg.orders.service_fees) lines.push(`• Taxa de serviço: ${BRL(agg.orders.service_fees)}`);
  lines.push("");

  if (agg.payments.length) {
    lines.push(`*Formas de pagamento (PDV)*`);
    for (const p of agg.payments) {
      lines.push(`• ${METHOD_LABEL[p.method] ?? p.method}: ${BRL(p.amount)} (${p.count})`);
    }
    lines.push("");
  }

  if (agg.by_mode.length) {
    lines.push(`*Por canal*`);
    for (const m of agg.by_mode) lines.push(`• ${MODE_LABEL[m.mode] ?? m.mode}: ${BRL(m.revenue)} (${m.count})`);
    lines.push("");
  }

  const mov = agg.movements ?? {};
  const sangria = mov.sangria?.amount ?? 0;
  const reforco = mov.reforco?.amount ?? 0;
  const estorno = mov.estorno?.amount ?? 0;
  if (sangria || reforco || estorno) {
    lines.push(`*Movimentos de caixa*`);
    if (reforco) lines.push(`• Reforço: ${BRL(reforco)} (${mov.reforco?.count ?? 0})`);
    if (sangria) lines.push(`• Sangria: ${BRL(sangria)} (${mov.sangria?.count ?? 0})`);
    if (estorno) lines.push(`• Estornos: ${BRL(estorno)} (${mov.estorno?.count ?? 0})`);
    lines.push("");
  }

  if (agg.sessions.length) {
    lines.push(`*Sessões do PDV*`);
    for (const s of agg.sessions) {
      const label = s.operator_name ? `${s.operator_name}` : s.terminal;
      const diff = s.difference != null ? ` — diferença ${BRL(s.difference)}` : "";
      lines.push(`• ${label}: ${s.status === "closed" ? "Fechada" : "Aberta"}${diff}`);
    }
    lines.push("");
  }

  if (agg.top_products.length) {
    lines.push(`*Top 5 produtos*`);
    agg.top_products.slice(0, 5).forEach((p, i) =>
      lines.push(`${i + 1}. ${p.product_name} — ${p.qty}× · ${BRL(p.revenue)}`),
    );
    lines.push("");
  }

  if (footer.trim()) {
    lines.push("—");
    lines.push(footer.trim());
  }
  return lines.join("\n");
}

// ---------- PDF ----------

function sanitize(s: string) {
  // pdf-lib WinAnsi encoder doesn't support all UTF-8 glyphs (emojis) — strip them.
  return s.replace(/[^\x00-\xff]/g, "");
}

export async function buildPdf(agg: Aggregate, settings: CashCloseSettings): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]); // A4
  const marginX = 40;
  let y = 800;

  const purple = rgb(0.42, 0.16, 0.78);
  const gray = rgb(0.4, 0.42, 0.5);

  // Header
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: purple });
  drawText("Fechamento de Caixa", marginX, 808, 20, bold, rgb(1, 1, 1));
  const dateStr = new Date(agg.date + "T12:00:00-03:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  drawText(dateStr, marginX, 795, 10, font, rgb(0.94, 0.94, 1));

  y = 770;

  if (settings.custom_header.trim()) {
    drawText(settings.custom_header, marginX, y, 10, font, gray);
    y -= 18;
  }

  // ---- KPI grid ----
  const kpi = (label: string, value: string, x: number, yPos: number) => {
    page.drawRectangle({ x, y: yPos - 42, width: 165, height: 46, borderColor: rgb(0.9, 0.9, 0.94), borderWidth: 1, color: rgb(0.98, 0.98, 0.99) });
    drawText(label, x + 10, yPos - 12, 8, font, gray);
    drawText(value, x + 10, yPos - 32, 14, bold);
  };
  kpi("PEDIDOS", String(agg.orders.orders_count), marginX, y);
  kpi("FATURAMENTO", BRL(agg.orders.revenue), marginX + 175, y);
  kpi("TICKET MÉDIO", BRL(agg.orders.avg_ticket), marginX + 350, y);
  y -= 60;

  const section = (title: string) => {
    y -= 6;
    drawText(title.toUpperCase(), marginX, y, 10, bold, purple);
    y -= 6;
    page.drawLine({ start: { x: marginX, y }, end: { x: 555, y }, thickness: 0.7, color: purple });
    y -= 14;
  };

  const row = (left: string, right: string, size = 10, weight: "n" | "b" = "n") => {
    if (y < 60) return; // skip if overflow (single page keeps it clean)
    drawText(left, marginX + 4, y, size, weight === "b" ? bold : font);
    drawText(right, 555 - font.widthOfTextAtSize(right, size), y, size, weight === "b" ? bold : font);
    y -= 15;
  };

  // Payments
  if (agg.payments.length) {
    section("Formas de pagamento (PDV)");
    for (const p of agg.payments) row(`${METHOD_LABEL[p.method] ?? p.method}  (${p.count})`, BRL(p.amount));
  }

  // Modes
  if (agg.by_mode.length) {
    section("Por canal");
    for (const m of agg.by_mode) row(`${MODE_LABEL[m.mode] ?? m.mode}  (${m.count})`, BRL(m.revenue));
  }

  // Cash movements
  const movKeys = Object.keys(agg.movements ?? {});
  if (movKeys.length) {
    section("Movimentos de caixa");
    for (const k of movKeys) {
      const m = agg.movements[k];
      row(`${MOV_LABEL[k] ?? k}  (${m.count})`, BRL(m.amount));
    }
  }

  // Sessions
  if (agg.sessions.length) {
    section("Sessões do PDV");
    for (const s of agg.sessions) {
      const label = `${s.operator_name ?? s.terminal} — ${s.status === "closed" ? "Fechada" : "Aberta"}`;
      const right = s.difference != null ? `Dif ${BRL(s.difference)}` : s.status === "closed" ? "-" : "aberta";
      row(label, right);
    }
  }

  // Top products
  if (agg.top_products.length) {
    section("Top produtos");
    agg.top_products.slice(0, 8).forEach((p, i) => row(`${i + 1}. ${p.product_name}  (${p.qty}x)`, BRL(p.revenue)));
  }

  // Footer
  drawText(settings.custom_footer || "Relatório gerado automaticamente pelo Quero Bis.", marginX, 40, 8, font, gray);
  drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, marginX, 28, 7, font, gray);

  return await pdf.save();
}

// ---------- WhatsApp send ----------

export async function sendWhatsappText(number: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const { base, key, instance } = evolutionConfig();
  if (!base || !key || !instance) return { ok: false, error: "Evolution API não configurada" };
  const normalized = normalizeWhatsappPhone(number);
  if (!normalized || normalized.length < 10) return { ok: false, error: `Número inválido: ${number}` };

  try {
    const resp = await fetchEvolutionWithTimeout(
      `${base}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({ number: normalized, text, delay: 0, linkPreview: false }),
      },
    );
    const body = await resp.text();
    if (!resp.ok) return { ok: false, error: `Evolution ${resp.status}: ${body.slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendWhatsappPdf(number: string, pdfBytes: Uint8Array, filename: string, caption: string): Promise<{ ok: boolean; error?: string }> {
  const { base, key, instance } = evolutionConfig();
  if (!base || !key || !instance) return { ok: false, error: "Evolution API não configurada" };
  const normalized = normalizeWhatsappPhone(number);
  if (!normalized || normalized.length < 10) return { ok: false, error: `Número inválido: ${number}` };

  // base64 encode
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < pdfBytes.length; i += chunk) {
    binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);

  try {
    const resp = await fetchEvolutionWithTimeout(
      `${base}/message/sendMedia/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({
          number: normalized,
          mediatype: "document",
          mimetype: "application/pdf",
          media: b64,
          fileName: filename,
          caption,
          delay: 0,
        }),
      },
      60_000,
    );
    const body = await resp.text();
    if (!resp.ok) return { ok: false, error: `Evolution ${resp.status}: ${body.slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Orchestration ----------

export interface RunOutcome {
  report_id: string;
  pdf_path: string | null;
  whatsapp_status: "sent" | "failed" | "skipped" | "partial";
  whatsapp_error: string | null;
  targets_ok: string[];
  targets_failed: string[];
  summary_text: string;
}

/**
 * Fetches the daily aggregate, builds a PDF, uploads it to Storage,
 * sends WhatsApp message(s) to configured numbers, and inserts a row in
 * `cash_close_reports`. Called by both manual UI trigger and the cron endpoint.
 *
 * Uses supabaseAdmin (service role) so it works from an unauthenticated cron.
 */
export async function runCashClose(params: {
  supabaseAdmin: SupabaseClient;
  reportDate: string; // YYYY-MM-DD
  triggeredBy: "manual" | "cron";
  triggeredUser?: string | null;
}): Promise<RunOutcome> {
  const { supabaseAdmin, reportDate, triggeredBy, triggeredUser } = params;

  // Load settings
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("cash_close_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (sErr) throw new Error("Falha ao ler configurações: " + sErr.message);
  if (!settings) throw new Error("Configurações não encontradas.");
  const s = settings as CashCloseSettings;

  // Aggregate
  const { data: agg, error: aErr } = await supabaseAdmin.rpc("get_cash_close_aggregate", {
    _date: reportDate,
    _include_pending: s.include_pending,
    _include_canceled: s.include_canceled,
  });
  if (aErr) throw new Error("Falha na agregação: " + aErr.message);
  const aggregate = agg as unknown as Aggregate;

  // Build PDF & upload
  let pdfPath: string | null = null;
  let pdfBytes: Uint8Array | null = null;
  if (s.send_pdf) {
    pdfBytes = await buildPdf(aggregate, s);
    const key = `${reportDate}/fechamento-${reportDate}-${Date.now()}.pdf`;
    const up = await supabaseAdmin.storage
      .from("cash-reports")
      .upload(key, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error("Falha ao salvar PDF: " + up.error.message);
    pdfPath = key;
  }

  const summary = buildTextSummary(aggregate, s.custom_header, s.custom_footer);
  const dateBr = new Date(reportDate + "T12:00:00-03:00").toLocaleDateString("pt-BR");
  const filename = `Fechamento-${reportDate}.pdf`;

  const targetsOk: string[] = [];
  const targetsFailed: string[] = [];
  const errors: string[] = [];

  const numbers = (s.whatsapp_numbers ?? []).filter((n) => n && n.trim().length >= 8);
  for (const n of numbers) {
    let ok = true;
    if (s.send_text_summary) {
      const r = await sendWhatsappText(n, summary);
      if (!r.ok) { ok = false; errors.push(`${n}: ${r.error}`); }
    }
    if (s.send_pdf && pdfBytes) {
      const r = await sendWhatsappPdf(n, pdfBytes, filename, `Fechamento de caixa · ${dateBr}`);
      if (!r.ok) { ok = false; errors.push(`${n}: ${r.error}`); }
    }
    if (ok) targetsOk.push(n); else targetsFailed.push(n);
  }

  let status: RunOutcome["whatsapp_status"] = "sent";
  if (!numbers.length) status = "skipped";
  else if (targetsFailed.length && targetsOk.length) status = "partial";
  else if (targetsFailed.length && !targetsOk.length) status = "failed";

  // Auto-close still-open sessions if requested
  if (s.auto_close_session) {
    const { error } = await supabaseAdmin
      .from("cash_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString(), closing_note: "Auto-fechado pelo fechamento diário" })
      .eq("status", "open");
    if (error) errors.push("Auto-close sessão: " + error.message);
  }

  // Persist report row
  const { data: rep, error: repErr } = await supabaseAdmin
    .from("cash_close_reports")
    .insert({
      report_date: reportDate,
      triggered_by: triggeredBy,
      triggered_user: triggeredUser ?? null,
      totals: aggregate as unknown as Record<string, unknown>,
      pdf_path: pdfPath,
      whatsapp_status: status,
      whatsapp_error: errors.length ? errors.join(" | ") : null,
      whatsapp_targets: numbers,
      sent_at: status === "sent" || status === "partial" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (repErr) throw new Error("Falha ao salvar relatório: " + repErr.message);

  await supabaseAdmin
    .from("cash_close_settings")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_error: errors.length ? errors.join(" | ") : null,
    })
    .eq("id", 1);

  return {
    report_id: rep.id as string,
    pdf_path: pdfPath,
    whatsapp_status: status,
    whatsapp_error: errors.length ? errors.join(" | ") : null,
    targets_ok: targetsOk,
    targets_failed: targetsFailed,
    summary_text: summary,
  };
}
