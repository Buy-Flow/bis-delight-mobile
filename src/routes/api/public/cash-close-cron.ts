// Cron endpoint invoked by pg_cron every ~5 min.
// Checks whether the current time (in the configured timezone) matches the
// configured schedule and no report has run for that report_date yet, then
// triggers runCashClose for the previous day.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cash-close-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require the private CRON_SHARED_SECRET (server-only). The publishable
        // anon key is NOT a secret, so we cannot use it to authenticate callers.
        const expected = process.env.CRON_SHARED_SECRET;
        const provided = request.headers.get("x-cron-secret") ?? request.headers.get("x-cron-key");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runCashClose } = await import("@/lib/cash-close.server");

        const { data: s, error } = await supabaseAdmin
          .from("cash_close_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (error || !s) {
          return Response.json({ ok: false, reason: "no-settings" }, { status: 200 });
        }
        if (!s.enabled) return Response.json({ ok: true, skipped: "disabled" });

        // Current time in the configured timezone.
        const tz = s.timezone || "America/Sao_Paulo";
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
        }).formatToParts(now).reduce<Record<string, string>>((acc, p) => {
          acc[p.type] = p.value; return acc;
        }, {});
        const hour = parseInt(parts.hour ?? "0", 10);
        const minute = parseInt(parts.minute ?? "0", 10);
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const weekday = weekdayMap[parts.weekday ?? "Mon"] ?? 1;
        const todayLocal = `${parts.year}-${parts.month}-${parts.day}`;

        const weekdays: number[] = Array.isArray(s.weekdays) ? s.weekdays : [1, 2, 3, 4, 5, 6, 0];
        if (!weekdays.includes(weekday)) {
          return Response.json({ ok: true, skipped: "weekday", weekday });
        }

        // Window: fire when current time >= configured, up to 30min later.
        const targetMinutes = (s.send_hour ?? 23) * 60 + (s.send_minute ?? 30);
        const nowMinutes = hour * 60 + minute;
        if (nowMinutes < targetMinutes || nowMinutes > targetMinutes + 30) {
          return Response.json({ ok: true, skipped: "outside-window", nowMinutes, targetMinutes });
        }

        // Report date = todayLocal (fechamento do dia corrente).
        const reportDate = todayLocal;

        // Already ran today?
        const { data: existing } = await supabaseAdmin
          .from("cash_close_reports")
          .select("id")
          .eq("report_date", reportDate)
          .eq("triggered_by", "cron")
          .maybeSingle();
        if (existing) return Response.json({ ok: true, skipped: "already-ran", reportDate });

        try {
          const outcome = await runCashClose({
            supabaseAdmin: supabaseAdmin as never,
            reportDate,
            triggeredBy: "cron",
            triggeredUser: null,
          });
          return Response.json({ ok: true, outcome });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("cash_close_settings").update({
            last_run_at: new Date().toISOString(),
            last_run_status: "failed",
            last_run_error: msg,
          }).eq("id", 1);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to trigger" }),
    },
  },
});
