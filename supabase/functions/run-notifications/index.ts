// Cron-driven worker that:
//   1. Fires push_campaigns where status='scheduled' AND scheduled_for <= now()
//   2. Runs active push_automations (birthday-of-day, dormant, welcome after 1st order)
//
// Auth: shared bearer ORDER_NOTIFY_TOKEN. Called by pg_cron every 5 minutes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_TOKEN = Deno.env.get("ORDER_NOTIFY_TOKEN")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${NOTIFY_TOKEN}`) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: Record<string, unknown> = {};

  try {
    // 1) Scheduled campaigns due now
    const { data: due } = await admin
      .from("push_campaigns")
      .select("id, title")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString());
    const dueList = due ?? [];
    if (dueList.length) {
      // Mark as 'sending' so we don't re-enter
      await admin
        .from("push_campaigns")
        .update({ status: "sending" })
        .in("id", dueList.map((d: any) => d.id));
      for (const d of dueList) {
        await callSendPush({ campaignId: d.id });
      }
    }
    results.scheduledFired = dueList.length;

    // 2) Automations
    const { data: autos } = await admin
      .from("push_automations")
      .select("*")
      .eq("active", true);

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

    const runReport: Array<Record<string, unknown>> = [];

    for (const a of autos ?? []) {
      const kind = (a as any).kind as "birthday" | "dormant" | "welcome";
      let eligibleUserIds: string[] = [];
      let runKey = todayKey;

      if (kind === "birthday") {
        // Users whose birthday MM-DD matches today
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const { data: profs } = await admin
          .from("profiles")
          .select("id, birthday")
          .not("birthday", "is", null);
        eligibleUserIds = (profs ?? [])
          .filter((p: any) => {
            const b: string = p.birthday;
            return b && b.slice(5, 7) === mm && b.slice(8, 10) === dd;
          })
          .map((p: any) => p.id);
      } else if (kind === "dormant") {
        const days = Number(((a as any).config?.days) ?? 60);
        const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
        const { data: recent } = await admin
          .from("orders")
          .select("user_id")
          .gte("created_at", cutoff)
          .not("user_id", "is", null);
        const activeIds = new Set((recent ?? []).map((o: any) => o.user_id));
        // Only users who ordered before cutoff and NOT after
        const { data: allOrderers } = await admin
          .from("orders")
          .select("user_id")
          .not("user_id", "is", null);
        const allIds = Array.from(new Set((allOrderers ?? []).map((o: any) => o.user_id)));
        eligibleUserIds = allIds.filter((id) => !activeIds.has(id));
        // Only re-notify once per week
        runKey = `w-${weekKey(today)}`;
      } else if (kind === "welcome") {
        // Users whose only paid order was placed in last 24h
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data: recent } = await admin
          .from("orders")
          .select("user_id, created_at")
          .gte("created_at", since)
          .not("user_id", "is", null);
        const candidates = Array.from(new Set((recent ?? []).map((o: any) => o.user_id))) as string[];
        // Keep only those whose order count is exactly 1
        const kept: string[] = [];
        for (const uid of candidates) {
          const { count } = await admin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid);
          if ((count ?? 0) === 1) kept.push(uid);
        }
        eligibleUserIds = kept;
        runKey = `first-order`;
      }

      if (eligibleUserIds.length === 0) {
        runReport.push({ kind, eligible: 0 });
        continue;
      }

      // Filter out users already notified for this run_key
      const { data: alreadyRuns } = await admin
        .from("automation_runs")
        .select("user_id")
        .eq("automation_id", (a as any).id)
        .eq("run_key", runKey)
        .in("user_id", eligibleUserIds);
      const alreadySet = new Set((alreadyRuns ?? []).map((r: any) => r.user_id));
      const toNotify = eligibleUserIds.filter((id) => !alreadySet.has(id));
      if (toNotify.length === 0) {
        runReport.push({ kind, eligible: eligibleUserIds.length, skipped: "all-notified" });
        continue;
      }

      // Create a campaign row and dispatch
      const { data: camp } = await admin
        .from("push_campaigns")
        .insert({
          title: (a as any).title,
          body: (a as any).body,
          url: (a as any).url,
          image: (a as any).image,
          audience: `auto:${kind}`,
          status: "sent",
          sent_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();

      if (camp?.id) {
        // Record runs BEFORE sending (idempotency)
        await admin.from("automation_runs").insert(
          toNotify.map((uid) => ({
            automation_id: (a as any).id,
            user_id: uid,
            run_key: runKey,
          })),
        );
        await callSendPush({ campaignId: camp.id, userIds: toNotify });
        await admin
          .from("push_automations")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", (a as any).id);
        runReport.push({ kind, notified: toNotify.length });
      }
    }

    results.automations = runReport;
    return json(results);
  } catch (e) {
    console.error("run-notifications error", e);
    return json({ error: String(e) }, 500);
  }
});

async function callSendPush(body: { campaignId: string; userIds?: string[] }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${NOTIFY_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("send-push call failed", res.status, await res.text().catch(() => ""));
}

function weekKey(d: Date) {
  const jan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan.getTime()) / (24 * 3600 * 1000));
  return `${d.getFullYear()}-${Math.floor((days + jan.getDay()) / 7)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
