// Client-callable server functions for the Cash Close feature.
// UI reads settings, generates an on-demand aggregate preview, and triggers manual runs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SettingsPatch = z.object({
  enabled: z.boolean().optional(),
  send_hour: z.number().int().min(0).max(23).optional(),
  send_minute: z.number().int().min(0).max(59).optional(),
  timezone: z.string().min(2).max(64).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  whatsapp_numbers: z.array(z.string().max(30)).max(10).optional(),
  send_pdf: z.boolean().optional(),
  send_text_summary: z.boolean().optional(),
  include_pending: z.boolean().optional(),
  include_canceled: z.boolean().optional(),
  auto_close_session: z.boolean().optional(),
  custom_header: z.string().max(500).optional(),
  custom_footer: z.string().max(500).optional(),
  logo_url: z.string().url().nullable().optional(),
  email_backup: z.array(z.string().email()).max(10).optional(),
});


export const getCashCloseSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
    if (!isAdmin && !isMgr) throw new Error("Sem permissão.");

    const { data, error } = await supabase.from("cash_close_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateCashCloseSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SettingsPatch.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem alterar as configurações.");

    const { data: row, error } = await supabase
      .from("cash_close_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const previewCashClose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      include_pending: z.boolean().optional(),
      include_canceled: z.boolean().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
    if (!isAdmin && !isMgr) throw new Error("Sem permissão.");

    const { data: agg, error } = await supabase.rpc("get_cash_close_aggregate", {
      _date: data.date,
      _include_pending: data.include_pending ?? false,
      _include_canceled: data.include_canceled ?? false,
    });
    if (error) throw new Error(error.message);

    const { buildTextSummary } = await import("./cash-close.server");
    const { data: s } = await supabase.from("cash_close_settings").select("custom_header,custom_footer").eq("id", 1).single();
    const summary = buildTextSummary(
      agg as never,
      s?.custom_header ?? "",
      s?.custom_footer ?? "",
    );
    return { aggregate: agg, summary };
  });

export const runCashCloseNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem gerar o fechamento.");
    void supabase;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runCashClose } = await import("./cash-close.server");
    return await runCashClose({
      supabaseAdmin: supabaseAdmin as never,
      reportDate: data.date,
      triggeredBy: "manual",
      triggeredUser: userId,
    });
  });

export const listCashCloseReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
    if (!isAdmin && !isMgr) throw new Error("Sem permissão.");
    const { data: rows, error } = await supabase
      .from("cash_close_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows;
  });

export const getCashCloseReportUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ report_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
    if (!isAdmin && !isMgr) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("cash_close_reports")
      .select("pdf_path")
      .eq("id", data.report_id)
      .single();
    if (error || !row?.pdf_path) throw new Error("Relatório sem PDF.");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("cash-reports")
      .createSignedUrl(row.pdf_path, 600);
    if (sErr || !signed) throw new Error(sErr?.message ?? "URL indisponível.");
    return { url: signed.signedUrl };
  });

export const resendCashCloseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      report_id: z.string().uuid(),
      numbers: z.array(z.string().min(8)).max(10).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    void supabase;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsappText, sendWhatsappPdf, buildTextSummary } = await import("./cash-close.server");

    const { data: rep, error } = await supabaseAdmin
      .from("cash_close_reports")
      .select("*")
      .eq("id", data.report_id)
      .single();
    if (error || !rep) throw new Error("Relatório não encontrado.");

    const { data: s } = await supabaseAdmin.from("cash_close_settings").select("*").eq("id", 1).single();
    const settings = s as never as { whatsapp_numbers: string[]; custom_header: string; custom_footer: string; send_pdf: boolean; send_text_summary: boolean };
    const numbers = data.numbers?.length ? data.numbers : settings.whatsapp_numbers;
    const summary = buildTextSummary(rep.totals as never, settings.custom_header ?? "", settings.custom_footer ?? "");
    const dateBr = new Date(rep.report_date + "T12:00:00-03:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    let pdfBytes: Uint8Array | null = null;
    if (settings.send_pdf && rep.pdf_path) {
      const dl = await supabaseAdmin.storage.from("cash-reports").download(rep.pdf_path);
      if (!dl.error && dl.data) pdfBytes = new Uint8Array(await dl.data.arrayBuffer());
    }

    const ok: string[] = [];
    const failed: string[] = [];
    const errs: string[] = [];
    for (const n of numbers) {
      let good = true;
      if (settings.send_text_summary) {
        const r = await sendWhatsappText(n, summary);
        if (!r.ok) { good = false; errs.push(`${n}: ${r.error}`); }
      }
      if (pdfBytes) {
        const r = await sendWhatsappPdf(n, pdfBytes, `Fechamento-${rep.report_date}.pdf`, `Fechamento de caixa · ${dateBr}`);
        if (!r.ok) { good = false; errs.push(`${n}: ${r.error}`); }
      }
      if (good) ok.push(n); else failed.push(n);
    }

    await supabaseAdmin
      .from("cash_close_reports")
      .update({
        whatsapp_status: failed.length ? (ok.length ? "partial" : "failed") : "sent",
        whatsapp_error: errs.length ? errs.join(" | ") : null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", data.report_id);

    return { ok, failed, errors: errs };
  });
