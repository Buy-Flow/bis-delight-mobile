// Cron endpoint invoked by pg_cron every ~15 min.
// Fires runWinback when local time matches the configured schedule.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/winback-cron")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runWinback } = await import("@/lib/winback.server");

        const { data: s } = await supabaseAdmin
          .from("winback_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (!s) return Response.json({ ok: false, reason: "no-settings" });
        if (!s.enabled) return Response.json({ ok: true, skipped: "disabled" });

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

        const weekdays: number[] = Array.isArray(s.weekdays) ? s.weekdays : [1, 2, 3, 4, 5];
        if (!weekdays.includes(weekday)) {
          return Response.json({ ok: true, skipped: "weekday", weekday });
        }

        const targetMinutes = (s.send_hour ?? 10) * 60 + (s.send_minute ?? 0);
        const nowMinutes = hour * 60 + minute;
        // 20-minute window to accommodate 15-min cron cadence.
        if (nowMinutes < targetMinutes || nowMinutes > targetMinutes + 20) {
          return Response.json({ ok: true, skipped: "outside-window", nowMinutes, targetMinutes });
        }

        // Prevent double-run within the window: check last_run_at.
        if (s.last_run_at) {
          const last = new Date(s.last_run_at).getTime();
          if (Date.now() - last < 30 * 60_000) {
            return Response.json({ ok: true, skipped: "recent-run", last_run_at: s.last_run_at });
          }
        }

        try {
          const outcome = await runWinback({
            supabaseAdmin: supabaseAdmin as never,
            triggeredBy: "cron",
            triggeredUser: null,
          });
          return Response.json({ ok: true, outcome });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("winback_settings").update({
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
