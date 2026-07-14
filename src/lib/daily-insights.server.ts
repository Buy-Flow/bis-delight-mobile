// Proactive Copilot — daily business insights.
// Runs a set of deterministic analytics against real order/review/cart data,
// then asks Lovable AI Gateway to turn each signal into a human-readable
// insight with a suggested action. Persists results in daily_insights and
// (optionally) delivers a summary via WhatsApp.

import { sendWhatsappText } from "./cash-close.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbAdmin = any;

export interface DailyInsightSettings {
  enabled: boolean;
  timezone: string;
  send_hour: number;
  send_minute: number;
  weekdays: number[];
  min_severity: "info" | "warning" | "critical";
  compare_window_days: number;
  category_drop_threshold: number;
  product_drop_threshold: number;
  revenue_drop_threshold: number;
  rating_drop_threshold: number;
  cart_abandon_threshold: number;
  monitor_categories: boolean;
  monitor_products: boolean;
  monitor_revenue: boolean;
  monitor_reviews: boolean;
  monitor_carts: boolean;
  monitor_new_customers: boolean;
  send_whatsapp: boolean;
  whatsapp_target: string | null;
  send_push: boolean;
  ai_tone: "coach" | "direto" | "descontraido" | "executivo";
  ai_model: string;
  max_insights_per_run: number;
}

type Signal = {
  kind: string;
  severity: "info" | "warning" | "critical";
  hint: string;            // short factual hint for the AI
  finding: string;         // fact rendered in Portuguese
  metrics: Record<string, unknown>;
  action_kind?: "coupon" | "push" | "popup" | "product" | "none";
  action_payload?: Record<string, unknown>;
};

const DAY = 86_400_000;
const BRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function severityFrom(dropPct: number, warnAt: number): "info" | "warning" | "critical" {
  const abs = Math.abs(dropPct);
  if (abs >= warnAt * 2) return "critical";
  if (abs >= warnAt) return "warning";
  return "info";
}

async function detectSignals(sb: SbAdmin, s: DailyInsightSettings): Promise<Signal[]> {
  const signals: Signal[] = [];
  const now = new Date();
  const win = s.compare_window_days;
  const cutA = new Date(now.getTime() - win * DAY).toISOString();
  const cutB = new Date(now.getTime() - 2 * win * DAY).toISOString();

  // Fetch orders in the last 2 windows (paid or delivered).
  const { data: orders } = await sb
    .from("orders")
    .select("id,user_id,total,status,created_at")
    .gte("created_at", cutB)
    .not("status", "in", "(cancelled,cancelado,canceled)")
    .limit(5000);

  const rows = (orders ?? []) as Array<{
    id: string; user_id: string | null; total: number | string; status: string; created_at: string;
  }>;
  const cur = rows.filter((r) => r.created_at >= cutA);
  const prev = rows.filter((r) => r.created_at < cutA);
  const sum = (arr: typeof rows) => arr.reduce((a, r) => a + Number(r.total || 0), 0);
  const revCur = sum(cur);
  const revPrev = sum(prev);
  const ordCur = cur.length;
  const ordPrev = prev.length;

  // --- Global revenue trend ---
  if (s.monitor_revenue && revPrev > 0) {
    const delta = ((revCur - revPrev) / revPrev) * 100;
    if (delta <= -s.revenue_drop_threshold) {
      signals.push({
        kind: "revenue_drop",
        severity: severityFrom(delta, s.revenue_drop_threshold),
        hint: `Receita caiu ${delta.toFixed(1)}% em ${win}d`,
        finding: `Receita dos últimos ${win} dias: ${BRL(revCur)} (${pct(delta)} vs. ${win}d anteriores ${BRL(revPrev)}).`,
        metrics: { revCur, revPrev, delta, ordCur, ordPrev, window_days: win },
        action_kind: "popup",
        action_payload: { suggestion: "Anúncio de recuperação com desconto flash" },
      });
    } else if (delta >= s.revenue_drop_threshold) {
      signals.push({
        kind: "revenue_rise",
        severity: "info",
        hint: `Receita subiu ${delta.toFixed(1)}% em ${win}d`,
        finding: `Boas notícias: receita cresceu ${pct(delta)} nos últimos ${win} dias (${BRL(revCur)} vs ${BRL(revPrev)}).`,
        metrics: { revCur, revPrev, delta },
        action_kind: "none",
      });
    }
  }

  // --- Per-category comparison ---
  if (s.monitor_categories || s.monitor_products) {
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { data: items } = await sb
        .from("order_items")
        .select("order_id,product_id,quantity,price,name")
        .in("order_id", ids)
        .limit(20000);
      const { data: prods } = await sb
        .from("products")
        .select("id,name,category_id,active,paused_until")
        .limit(2000);
      const { data: cats } = await sb.from("categories").select("id,name").limit(200);

      const catById = new Map<string, string>((cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
      const prodInfo = new Map<string, { name: string; catId: string | null; paused: string | null }>(
        (prods ?? []).map((p: { id: string; name: string; category_id: string | null; paused_until: string | null }) => [
          p.id,
          { name: p.name, catId: p.category_id, paused: p.paused_until },
        ]),
      );
      const orderTime = new Map(rows.map((r) => [r.id, r.created_at]));

      type Bucket = { cur: number; prev: number; curQty: number; prevQty: number };
      const catBuckets = new Map<string, Bucket>();
      const prodBuckets = new Map<string, Bucket>();

      for (const it of (items ?? []) as Array<{
        order_id: string; product_id: string | null; quantity: number; price: number | string; name: string;
      }>) {
        const t = orderTime.get(it.order_id);
        if (!t) continue;
        const isCur = t >= cutA;
        const revenue = Number(it.price || 0) * Number(it.quantity || 1);
        const qty = Number(it.quantity || 1);

        const info = it.product_id ? prodInfo.get(it.product_id) : null;
        const catName = info?.catId ? catById.get(info.catId) ?? "Outros" : "Outros";
        const catB = catBuckets.get(catName) ?? { cur: 0, prev: 0, curQty: 0, prevQty: 0 };
        if (isCur) { catB.cur += revenue; catB.curQty += qty; } else { catB.prev += revenue; catB.prevQty += qty; }
        catBuckets.set(catName, catB);

        const prodKey = it.product_id ?? `name:${it.name}`;
        const prodName = info?.name ?? it.name;
        const pb = prodBuckets.get(prodKey) ?? { cur: 0, prev: 0, curQty: 0, prevQty: 0 };
        if (isCur) { pb.cur += revenue; pb.curQty += qty; } else { pb.prev += revenue; pb.prevQty += qty; }
        prodBuckets.set(prodKey, pb);
        (pb as Bucket & { name?: string }).name = prodName;
      }

      if (s.monitor_categories) {
        for (const [cat, b] of catBuckets.entries()) {
          if (b.prev < 50) continue; // skip tiny baselines
          const delta = ((b.cur - b.prev) / b.prev) * 100;
          if (delta <= -s.category_drop_threshold) {
            signals.push({
              kind: "category_drop",
              severity: severityFrom(delta, s.category_drop_threshold),
              hint: `Categoria "${cat}" caiu ${delta.toFixed(1)}% em ${win}d`,
              finding: `Vendas de ${cat} caíram ${pct(delta)} nos últimos ${win} dias (${BRL(b.cur)} vs ${BRL(b.prev)}, ${b.curQty} vs ${b.prevQty} itens).`,
              metrics: { category: cat, ...b, delta, window_days: win },
              action_kind: "coupon",
              action_payload: { note: `Promoção relâmpago para categoria ${cat}`, suggested_discount: 15 },
            });
          }
        }
      }

      if (s.monitor_products) {
        const prodArr = Array.from(prodBuckets.entries()) as Array<[
          string,
          Bucket & { name?: string },
        ]>;
        // Falling products
        for (const [key, b] of prodArr) {
          if (b.prev < 40) continue;
          const delta = ((b.cur - b.prev) / b.prev) * 100;
          if (delta <= -s.product_drop_threshold) {
            signals.push({
              kind: "product_drop",
              severity: severityFrom(delta, s.product_drop_threshold),
              hint: `Produto "${b.name}" caiu ${delta.toFixed(1)}%`,
              finding: `${b.name}: vendeu ${b.curQty} un (${BRL(b.cur)}) — queda de ${pct(delta)} vs janela anterior.`,
              metrics: { product_key: key, product_name: b.name, ...b, delta },
              action_kind: "push",
              action_payload: { audience: "todos", note: `Push relâmpago destacando ${b.name}` },
            });
          }
        }
        // Rising stars — surface the biggest riser
        const risers = prodArr
          .filter(([, b]) => b.prev >= 20 && ((b.cur - b.prev) / b.prev) * 100 >= 40)
          .sort((a, b) => (b[1].cur - b[1].prev) - (a[1].cur - a[1].prev));
        const top = risers[0];
        if (top) {
          const b = top[1];
          const delta = ((b.cur - b.prev) / b.prev) * 100;
          signals.push({
            kind: "product_rise",
            severity: "info",
            hint: `Produto "${b.name}" subiu ${delta.toFixed(1)}%`,
            finding: `${b.name} disparou: ${pct(delta)} nas vendas (${b.curQty} vs ${b.prevQty} un).`,
            metrics: { product_name: b.name, ...b, delta },
            action_kind: "popup",
            action_payload: { note: `Destacar ${b.name} no hero / criar combo` },
          });
        }
      }
    }
  }

  // --- Reviews trend ---
  if (s.monitor_reviews) {
    const { data: reviews } = await sb
      .from("reviews")
      .select("rating,created_at")
      .gte("created_at", cutB)
      .limit(2000);
    const list = (reviews ?? []) as Array<{ rating: number; created_at: string }>;
    if (list.length > 4) {
      const curR = list.filter((r) => r.created_at >= cutA);
      const prevR = list.filter((r) => r.created_at < cutA);
      const avg = (arr: typeof list) => arr.length ? arr.reduce((a, r) => a + Number(r.rating || 0), 0) / arr.length : 0;
      const a = avg(curR); const b = avg(prevR);
      if (b > 0 && a > 0 && (b - a) >= s.rating_drop_threshold) {
        signals.push({
          kind: "rating_drop",
          severity: (b - a) >= s.rating_drop_threshold * 2 ? "critical" : "warning",
          hint: `Média de avaliações caiu de ${b.toFixed(2)} para ${a.toFixed(2)}`,
          finding: `Nota média caiu de ${b.toFixed(2)}★ para ${a.toFixed(2)}★ nos últimos ${win} dias (${curR.length} avaliações).`,
          metrics: { avgCur: a, avgPrev: b, window_days: win, sample: curR.length },
          action_kind: "none",
        });
      }
    }
  }

  // --- Abandoned carts ---
  if (s.monitor_carts) {
    const { count: abandoned } = await sb
      .from("abandoned_carts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutA);
    const total = ordCur + Number(abandoned ?? 0);
    if (total > 5 && abandoned) {
      const rate = (Number(abandoned) / total) * 100;
      if (rate >= s.cart_abandon_threshold) {
        signals.push({
          kind: "cart_abandon",
          severity: rate >= s.cart_abandon_threshold * 1.5 ? "critical" : "warning",
          hint: `${rate.toFixed(0)}% de carrinhos abandonados`,
          finding: `${abandoned} carrinhos abandonados nos últimos ${win} dias (${rate.toFixed(1)}% dos checkouts iniciados).`,
          metrics: { abandoned, total, rate, window_days: win },
          action_kind: "coupon",
          action_payload: { note: "Cupom de recuperação para carrinhos abandonados", suggested_discount: 10 },
        });
      }
    }
  }

  // --- New customers ---
  if (s.monitor_new_customers) {
    const uCur = new Set(cur.map((r) => r.user_id).filter(Boolean)).size;
    const uPrev = new Set(prev.map((r) => r.user_id).filter(Boolean)).size;
    if (uPrev > 3) {
      const delta = ((uCur - uPrev) / uPrev) * 100;
      if (delta <= -25) {
        signals.push({
          kind: "new_customers_drop",
          severity: delta <= -50 ? "critical" : "warning",
          hint: `Novos clientes caíram ${delta.toFixed(1)}%`,
          finding: `Apenas ${uCur} clientes únicos compraram nos últimos ${win} dias (${pct(delta)} vs janela anterior).`,
          metrics: { uCur, uPrev, delta },
          action_kind: "popup",
          action_payload: { note: "Campanha de primeiro pedido — cupom de boas-vindas" },
        });
      }
    }
  }

  return signals;
}

function tonePrompt(t: DailyInsightSettings["ai_tone"]): string {
  switch (t) {
    case "direto": return "Fale direto ao ponto, curto, sem enfeite.";
    case "descontraido": return "Fale de forma leve e amigável, 1 emoji no máximo.";
    case "executivo": return "Tom executivo, com números, sem gírias.";
    default: return "Tom de coach: motivador, claro, com CTA no fim.";
  }
}

async function enrichWithAI(
  signals: Signal[],
  s: DailyInsightSettings,
): Promise<Array<Signal & { title: string; hypothesis: string; suggested_action: string; ai_error?: string }>> {
  const key = process.env.LOVABLE_API_KEY;
  const fallbackTitle = (sig: Signal) => sig.hint.slice(0, 80);
  if (!signals.length) return [];
  if (!key) {
    return signals.map((sig) => ({
      ...sig,
      title: fallbackTitle(sig),
      hypothesis: "IA indisponível — análise automática desativada.",
      suggested_action: sig.hint,
      ai_error: "LOVABLE_API_KEY ausente no servidor.",
    }));
  }
  try {
    const briefing = signals.map((sig, i) => ({
      i,
      kind: sig.kind,
      severity: sig.severity,
      fact: sig.finding,
      metrics: sig.metrics,
      action_kind_hint: sig.action_kind ?? "none",
    }));
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: s.ai_model || "google/gemini-2.5-flash",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é o Copiloto Proativo da loja Quero Bis (açaí premium no Brasil).
Recebe sinais reais extraídos do banco de dados e devolve, para cada sinal, um insight acionável em português.
${tonePrompt(s.ai_tone)}
Para cada item devolva:
- title: manchete curta (máx 70 chars), começando com emoji contextual.
- hypothesis: 1 frase com a causa mais provável (baseie-se nos números).
- suggested_action: 1 frase de ação concreta (ex: "Criar cupom SHAKE15 por 48h", "Enviar push para fãs de shake com foto do novo sabor").
Responda apenas JSON válido no formato { "items": [ { "i": 0, "title": "...", "hypothesis": "...", "suggested_action": "..." } ] }`,
          },
          { role: "user", content: `Sinais: ${JSON.stringify(briefing)}` },
        ],
      }),
    });
    if (!resp.ok) {
      const errMsg = resp.status === 429
        ? "Muitas requisições agora. Tente de novo em instantes."
        : resp.status === 402
          ? "Créditos de IA esgotados. Adicione créditos ao workspace."
          : `IA indisponível (${resp.status}).`;
      return signals.map((sig) => ({
        ...sig,
        title: fallbackTitle(sig),
        hypothesis: "",
        suggested_action: sig.hint,
        ai_error: errMsg,
      }));
    }
    const payload = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      items?: Array<{ i: number; title: string; hypothesis: string; suggested_action: string }>;
    };
    const byIdx = new Map((parsed.items ?? []).map((it) => [it.i, it]));
    return signals.map((sig, i) => {
      const ai = byIdx.get(i);
      return {
        ...sig,
        title: ai?.title?.slice(0, 100) ?? fallbackTitle(sig),
        hypothesis: ai?.hypothesis?.slice(0, 400) ?? "",
        suggested_action: ai?.suggested_action?.slice(0, 400) ?? sig.hint,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return signals.map((sig) => ({
      ...sig,
      title: fallbackTitle(sig),
      hypothesis: "",
      suggested_action: sig.hint,
      ai_error: `Falha ao consultar IA: ${msg}`,
    }));
  }
}

export interface RunDailyInsightsParams {
  supabaseAdmin: SbAdmin;
  triggeredBy: "cron" | "manual";
  dryRun?: boolean;
}

export interface DailyInsightsOutcome {
  ok: boolean;
  generated: number;
  delivered_whatsapp: boolean;
  dryRun: boolean;
  errors: string[];
  aiError?: string;
  preview: Array<{ kind: string; title: string; severity: string; suggested_action: string }>;
}

const SEVERITY_ORDER = { info: 0, warning: 1, critical: 2 } as const;

export async function runDailyInsights(params: RunDailyInsightsParams): Promise<DailyInsightsOutcome> {
  const { supabaseAdmin, triggeredBy, dryRun } = params;

  const { data: sRaw, error: sErr } = await supabaseAdmin
    .from("daily_insight_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (sErr || !sRaw) throw new Error(sErr?.message ?? "Configurações não encontradas.");
  const s = { ...(sRaw as DailyInsightSettings), weekdays: Array.isArray(sRaw.weekdays) ? sRaw.weekdays : [1, 2, 3, 4, 5, 6] };

  const errors: string[] = [];
  const startedAt = new Date();
  let aiError: string | undefined;

  let signals: Signal[] = [];
  try {
    signals = await detectSignals(supabaseAdmin, s);
  } catch (e) {
    errors.push(`Falha ao coletar sinais: ${e instanceof Error ? e.message : String(e)}`);
  }

  // filter by min_severity + cap
  const minRank = SEVERITY_ORDER[s.min_severity];
  signals = signals
    .filter((sig) => SEVERITY_ORDER[sig.severity] >= minRank)
    .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
    .slice(0, Math.max(1, Math.min(20, s.max_insights_per_run)));

  const enriched = await enrichWithAI(signals, s);
  const firstErr = enriched.find((e) => e.ai_error)?.ai_error;
  if (firstErr) aiError = firstErr;

  const outcome: DailyInsightsOutcome = {
    ok: true,
    generated: 0,
    delivered_whatsapp: false,
    dryRun: !!dryRun,
    errors,
    aiError,
    preview: enriched.map((e) => ({
      kind: e.kind, title: e.title, severity: e.severity, suggested_action: e.suggested_action,
    })),
  };

  if (dryRun) return outcome;

  // Persist
  for (const it of enriched) {
    const { error } = await supabaseAdmin.from("daily_insights").insert({
      kind: it.kind,
      severity: it.severity,
      title: it.title,
      finding: it.finding,
      hypothesis: it.hypothesis || null,
      suggested_action: it.suggested_action || null,
      action_kind: it.action_kind ?? "none",
      action_payload: it.action_payload ?? null,
      metrics: it.metrics ?? null,
      triggered_by: triggeredBy,
    });
    if (error) errors.push(error.message);
    else outcome.generated++;
  }

  // WhatsApp digest
  if (s.send_whatsapp && s.whatsapp_target && enriched.length) {
    const lines = enriched.map((e, i) => `${i + 1}. ${e.title}\n   → ${e.suggested_action}`);
    const digest = `🤖 *Copiloto Proativo — insights de hoje*\n\n${lines.join("\n\n")}\n\nAbra o painel para aplicar as sugestões.`;
    const r = await sendWhatsappText(s.whatsapp_target, digest);
    if (r.ok) {
      outcome.delivered_whatsapp = true;
      await supabaseAdmin.from("daily_insights").update({ delivered_whatsapp: true })
        .gte("created_at", startedAt.toISOString());
    } else if (r.error) {
      errors.push(`WhatsApp: ${r.error}`);
    }
  }

  await supabaseAdmin.from("daily_insight_settings").update({
    last_run_at: startedAt.toISOString(),
    last_run_status: errors.length && outcome.generated === 0 ? "failed" : "ok",
    last_run_error: errors.slice(0, 3).join(" | ") || null,
    last_run_count: outcome.generated,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  return outcome;
}
