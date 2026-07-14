// Cron endpoint invoked by pg_cron every ~15 min.
// Fires runDailyInsights when local time matches the configured schedule.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/daily-insights-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") ?? request.headers.get("x-cron-key");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runDailyInsights } = await import("@/lib/daily-insights.server");

        const { data: s } = await supabaseAdmin
          .from("daily_insight_settings")
          .select("*").eq("id", 1).maybeSingle();
        if (!s) return Response.json({ ok: false, reason: "no-settings" });
        if (!s.enabled) return Response.json({ ok: true, skipped: "disabled" });

        const tz = s.timezone || "America/Sao_Paulo";
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
        }).formatToParts(now).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
        const hour = parseInt(parts.hour ?? "0", 10);
        const minute = parseInt(parts.minute ?? "0", 10);
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const weekday = weekdayMap[parts.weekday ?? "Mon"] ?? 1;

        const weekdays: number[] = Array.isArray(s.weekdays) ? (s.weekdays as unknown[]).map((v) => Number(v)) : [1, 2, 3, 4, 5, 6];
        if (!weekdays.includes(weekday)) return Response.json({ ok: true, skipped: "weekday" });

        const targetMinutes = (s.send_hour ?? 9) * 60 + (s.send_minute ?? 0);
        const nowMinutes = hour * 60 + minute;
        if (nowMinutes < targetMinutes || nowMinutes > targetMinutes + 20) {
          return Response.json({ ok: true, skipped: "outside-window", nowMinutes, targetMinutes });
        }
        if (s.last_run_at && Date.now() - new Date(s.last_run_at).getTime() < 30 * 60_000) {
          return Response.json({ ok: true, skipped: "recent-run" });
        }

        try {
          const outcome = await runDailyInsights({
            supabaseAdmin: supabaseAdmin as never,
            triggeredBy: "cron",
          });
          return Response.json({ ok: true, outcome });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("daily_insight_settings").update({
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
