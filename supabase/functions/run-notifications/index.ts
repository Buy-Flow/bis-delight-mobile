// Cron-driven worker. Runs every 5 minutes.
//   1) Fires push_campaigns with status='scheduled' AND scheduled_for <= now()
//   2) Runs every ACTIVE push_automation (multiple per kind allowed):
//        - birthday       config: { hour?: 0-23, days_offset?: int }  (negative = before)
//        - dormant        config: { days: int, repeat_weekly?: bool }
//        - welcome        config: { delay_minutes?: int }
//        - after_order    config: { delay_minutes?: int, only_first?: bool }
//        - abandoned_cart config: { delay_minutes?: int }
//      filters (optional, applied AFTER kind resolution):
//        { min_orders?, max_orders?, ordered_within_days?, not_ordered_within_days?, min_spent_total? }

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
  const now = new Date();
  // Brazil local time (America/Sao_Paulo, UTC-3, no DST since 2019) for hour/dow scheduling.
  const brtNow = new Date(now.getTime() - 3 * 3600 * 1000);
  const brtHour = brtNow.getUTCHours();
  const brtDow = brtNow.getUTCDay();

  try {
    // 1) Scheduled campaigns due now
    const { data: due } = await admin
      .from("push_campaigns")
      .select("id, title")
      .eq("status", "scheduled")
      .lte("scheduled_for", now.toISOString());
    const dueList = due ?? [];
    if (dueList.length) {
      await admin.from("push_campaigns").update({ status: "sending" }).in(
        "id",
        dueList.map((d: any) => d.id),
      );
      for (const d of dueList) await callSendPush({ campaignId: d.id });
    }
    results.scheduledFired = dueList.length;

    // 2) Automations
    const { data: autos } = await admin.from("push_automations").select("*").eq("active", true);
    const runReport: Array<Record<string, unknown>> = [];

    for (const a of autos ?? []) {
      const kind = (a as any).kind as string;
      const cfg = ((a as any).config ?? {}) as Record<string, any>;
      const filters = ((a as any).filters ?? {}) as Record<string, any>;

      let eligibleUserIds: string[] = [];
      let runKey = now.toISOString().slice(0, 10); // default: per day
      let payloadPerUser: Map<string, Record<string, any>> | null = null;

      if (kind === "birthday") {
        const hour = Number(cfg.hour ?? 9);
        // Only run once per day, only after configured hour (Brazil time)
        if (brtHour < hour) {
          runReport.push({ id: a.id, kind, skipped: `before_hour_${hour}_brt` });
          continue;
        }
        const daysOffset = Number(cfg.days_offset ?? 0);
        // Target birthday = today - daysOffset  (so days_offset=-3 means "3 days before birthday")
        const target = new Date(now.getTime() - daysOffset * 24 * 3600 * 1000);
        const mm = String(target.getMonth() + 1).padStart(2, "0");
        const dd = String(target.getDate()).padStart(2, "0");
        const { data: profs } = await admin
          .from("profiles")
          .select("id, birthday")
          .not("birthday", "is", null);
        eligibleUserIds = (profs ?? [])
          .filter((p: any) => p.birthday && p.birthday.slice(5, 7) === mm && p.birthday.slice(8, 10) === dd)
          .map((p: any) => p.id);
      } else if (kind === "dormant") {
        const days = Number(cfg.days ?? 60);
        const repeatDays = Number(cfg.repeat_days ?? 0); // 0 = single-shot
        // Fetch all orders per user to compute last order date
        const { data: allOrders } = await admin
          .from("orders")
          .select("user_id, created_at")
          .not("user_id", "is", null);
        const lastByUser = new Map<string, string>();
        for (const o of (allOrders ?? []) as any[]) {
          const prev = lastByUser.get(o.user_id);
          if (!prev || o.created_at > prev) lastByUser.set(o.user_id, o.created_at);
        }
        payloadPerUser = new Map();
        for (const [uid, lastAt] of lastByUser.entries()) {
          const daysSince = Math.floor((now.getTime() - new Date(lastAt).getTime()) / (24 * 3600 * 1000));
          if (daysSince < days) continue;
          let cycle = 0;
          if (repeatDays > 0) cycle = Math.floor((daysSince - days) / repeatDays);
          const rk = repeatDays > 0
            ? `d${days}-r${repeatDays}-c${cycle}`
            : (cfg.repeat_weekly ? `w-${weekKey(now)}-d${days}` : `d${days}`);
          payloadPerUser.set(uid, { runKey: rk });
        }
        eligibleUserIds = Array.from(payloadPerUser.keys());
      } else if (kind === "welcome") {
        const delay = Number(cfg.delay_minutes ?? 0);
        const upper = new Date(now.getTime() - delay * 60 * 1000).toISOString();
        const lower = new Date(now.getTime() - (delay + 30) * 60 * 1000).toISOString();
        const { data: recent } = await admin
          .from("orders")
          .select("user_id, id, created_at")
          .gte("created_at", lower)
          .lte("created_at", upper)
          .not("user_id", "is", null);
        // Keep users whose total non-cancelled order count is exactly 1
        const candidates = Array.from(new Set((recent ?? []).map((o: any) => o.user_id))) as string[];
        const kept: string[] = [];
        for (const uid of candidates) {
          const { count } = await admin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .neq("status", "cancelado");
          if ((count ?? 0) === 1) kept.push(uid);
        }
        eligibleUserIds = kept;
        runKey = `first-order`;
      } else if (kind === "after_order") {
        const delay = Number(cfg.delay_minutes ?? 60);
        const onlyFirst = Boolean(cfg.only_first);
        const upper = new Date(now.getTime() - delay * 60 * 1000).toISOString();
        const lower = new Date(now.getTime() - (delay + 30) * 60 * 1000).toISOString();
        const { data: recent } = await admin
          .from("orders")
          .select("id, user_id, created_at, status")
          .gte("created_at", lower)
          .lte("created_at", upper)
          .not("user_id", "is", null);
        const list = (recent ?? []).filter((o: any) => o.status !== "cancelado");
        // Use order id as run_key so each order triggers once
        payloadPerUser = new Map();
        for (const o of list) {
          if (onlyFirst) {
            const { count } = await admin
              .from("orders")
              .select("id", { count: "exact", head: true })
              .eq("user_id", o.user_id)
              .lte("created_at", o.created_at);
            if ((count ?? 0) !== 1) continue;
          }
          payloadPerUser.set(o.user_id, { runKey: `o-${o.id}` });
        }
        eligibleUserIds = Array.from(payloadPerUser.keys());
      } else if (kind === "abandoned_cart") {
        const delay = Number(cfg.delay_minutes ?? 15);
        const upper = new Date(now.getTime() - delay * 60 * 1000).toISOString();
        const lower = new Date(now.getTime() - (delay + 30) * 60 * 1000).toISOString();
        const { data: carts } = await admin
          .from("abandoned_carts")
          .select("id, user_id, updated_at, recovered_at")
          .gte("updated_at", lower)
          .lte("updated_at", upper)
          .is("recovered_at", null)
          .not("user_id", "is", null);
        payloadPerUser = new Map();
        for (const c of carts ?? []) payloadPerUser.set((c as any).user_id, { runKey: `c-${(c as any).id}` });
        eligibleUserIds = Array.from(payloadPerUser.keys());
      } else if (kind === "payment_pending") {
        // Orders still in 'pendente' after N minutes (payment reminder)
        const delay = Number(cfg.delay_minutes ?? 20);
        const upper = new Date(now.getTime() - delay * 60 * 1000).toISOString();
        const lower = new Date(now.getTime() - (delay + 30) * 60 * 1000).toISOString();
        const { data: pend } = await admin
          .from("orders")
          .select("id, user_id, status, created_at")
          .gte("created_at", lower)
          .lte("created_at", upper)
          .eq("status", "pendente")
          .not("user_id", "is", null);
        payloadPerUser = new Map();
        for (const o of pend ?? []) payloadPerUser.set((o as any).user_id, { runKey: `p-${(o as any).id}` });
        eligibleUserIds = Array.from(payloadPerUser.keys());
      } else if (kind === "feedback_request") {
        // Ask for feedback N hours after order marked 'entregue'
        const delayH = Number(cfg.delay_hours ?? 24);
        const upper = new Date(now.getTime() - delayH * 3600 * 1000).toISOString();
        const lower = new Date(now.getTime() - (delayH * 3600 + 1800) * 1000).toISOString();
        const { data: done } = await admin
          .from("orders")
          .select("id, user_id, status, updated_at")
          .gte("updated_at", lower)
          .lte("updated_at", upper)
          .eq("status", "entregue")
          .not("user_id", "is", null);
        payloadPerUser = new Map();
        for (const o of done ?? []) payloadPerUser.set((o as any).user_id, { runKey: `fb-${(o as any).id}` });
        eligibleUserIds = Array.from(payloadPerUser.keys());
      } else if (kind === "loyalty_close") {
        // Users close to earning a loyalty reward (stamps >= threshold, no unused coupon yet)
        const minStamps = Number(cfg.min_stamps ?? 7);
        const { data: rows } = await admin
          .from("loyalty")
          .select("user_id, stamps")
          .gte("stamps", minStamps);
        eligibleUserIds = (rows ?? []).map((r: any) => r.user_id).filter(Boolean);
        runKey = cfg.repeat_weekly ? `w-${weekKey(now)}-s${minStamps}` : `s${minStamps}`;
      } else if (kind === "weekly_promo") {
        // Recurring weekly at chosen weekday+hour. dow: 0=Sun..6=Sat
        const dow = Number(cfg.dow ?? 5);
        const hour = Number(cfg.hour ?? 18);
        if (now.getDay() !== dow || now.getHours() < hour) {
          runReport.push({ id: a.id, kind, skipped: `wait_dow${dow}_h${hour}` });
          continue;
        }
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("user_id")
          .not("user_id", "is", null);
        eligibleUserIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id))) as string[];
        runKey = `w-${weekKey(now)}`;
      } else {
        runReport.push({ id: a.id, kind, skipped: "unknown-kind" });
        continue;
      }

      // Apply combined filters
      if (eligibleUserIds.length && Object.keys(filters).length) {
        eligibleUserIds = await applyFilters(admin, eligibleUserIds, filters, now);
      }

      if (eligibleUserIds.length === 0) {
        runReport.push({ id: a.id, kind, eligible: 0 });
        continue;
      }

      // Dedupe against automation_runs
      const keysToCheck = payloadPerUser
        ? Array.from(new Set(Array.from(payloadPerUser.values()).map((v) => v.runKey)))
        : [runKey];
      const { data: alreadyRuns } = await admin
        .from("automation_runs")
        .select("user_id, run_key")
        .eq("automation_id", (a as any).id)
        .in("run_key", keysToCheck)
        .in("user_id", eligibleUserIds);
      const alreadySet = new Set((alreadyRuns ?? []).map((r: any) => `${r.user_id}::${r.run_key}`));

      const perUserRunKey = (uid: string) => (payloadPerUser?.get(uid)?.runKey ?? runKey);
      const toNotify = eligibleUserIds.filter((uid) => !alreadySet.has(`${uid}::${perUserRunKey(uid)}`));
      if (toNotify.length === 0) {
        runReport.push({ id: a.id, kind, eligible: eligibleUserIds.length, skipped: "all-notified" });
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
          sent_at: now.toISOString(),
        } as any)
        .select("id")
        .single();

      if (camp?.id) {
        await admin.from("automation_runs").insert(
          toNotify.map((uid) => ({
            automation_id: (a as any).id,
            user_id: uid,
            run_key: perUserRunKey(uid),
          })),
        );
        await callSendPush({ campaignId: camp.id, userIds: toNotify });
        await admin.from("push_automations").update({ last_run_at: now.toISOString() }).eq("id", (a as any).id);
        runReport.push({ id: a.id, kind, notified: toNotify.length });
      }
    }

    results.automations = runReport;
    return json(results);
  } catch (e) {
    console.error("run-notifications error", e);
    return json({ error: String(e) }, 500);
  }
});

async function applyFilters(
  admin: any,
  userIds: string[],
  filters: Record<string, any>,
  now: Date,
): Promise<string[]> {
  if (!userIds.length) return userIds;
  const { data: orders } = await admin
    .from("orders")
    .select("user_id, total, created_at, status")
    .in("user_id", userIds);
  const stats = new Map<string, { count: number; lastAt: string | null; total: number }>();
  for (const uid of userIds) stats.set(uid, { count: 0, lastAt: null, total: 0 });
  for (const o of (orders ?? []) as any[]) {
    if (o.status === "cancelado") continue;
    const s = stats.get(o.user_id)!;
    s.count += 1;
    s.total += Number(o.total ?? 0);
    if (!s.lastAt || o.created_at > s.lastAt) s.lastAt = o.created_at;
  }
  const minO = Number(filters.min_orders ?? -1);
  const maxO = filters.max_orders != null ? Number(filters.max_orders) : Infinity;
  const withinD = filters.ordered_within_days != null ? Number(filters.ordered_within_days) : null;
  const notWithinD = filters.not_ordered_within_days != null ? Number(filters.not_ordered_within_days) : null;
  const minSpent = Number(filters.min_spent_total ?? 0);
  return userIds.filter((uid) => {
    const s = stats.get(uid)!;
    if (s.count < minO) return false;
    if (s.count > maxO) return false;
    if (s.total < minSpent) return false;
    if (withinD != null) {
      const cutoff = new Date(now.getTime() - withinD * 24 * 3600 * 1000).toISOString();
      if (!s.lastAt || s.lastAt < cutoff) return false;
    }
    if (notWithinD != null) {
      const cutoff = new Date(now.getTime() - notWithinD * 24 * 3600 * 1000).toISOString();
      if (s.lastAt && s.lastAt >= cutoff) return false;
    }
    return true;
  });
}

async function callSendPush(body: { campaignId: string; userIds?: string[] }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${NOTIFY_TOKEN}` },
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
