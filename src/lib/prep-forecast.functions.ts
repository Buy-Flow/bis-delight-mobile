import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pre-preparação inteligente: prevê pedidos das próximas N horas (default 3h)
 * e sugere quantos lotes/unidades pré-montar por produto.
 *
 * Pipeline:
 *  1. Autoriza admin/manager/kitchen.
 *  2. Lê settings (horizon, safety, boosts, filtros).
 *  3. Lê histórico de order_items × orders (últimos N dias).
 *  4. Agrega volume por (produto, dow, hour).
 *  5. Constrói baseline (dow atual) e envia amostra compacta para IA.
 *  6. IA devolve multiplicador dinâmico (clima, promo, evento) + insights.
 *  7. Combina baseline + IA + safety stock → sugestão de lotes por produto.
 */

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export type PrepPlanRow = {
  productId: string;
  productName: string;
  category: string | null;
  imageUrl: string | null;
  paused: boolean;
  historicalUnits: number;      // média nas próximas N horas do mesmo dow histórico
  expectedUnits: number;         // após IA + safety
  yieldPerBatch: number;
  prepTimeMin: number;
  shelfLifeMin: number;
  suggestedBatches: number;
  suggestedUnits: number;
  confidence: number;            // 0..1
  priority: number;              // 1..5
  rush: "calmo" | "normal" | "movimentado" | "pico";
  reason: string;                // frase curta gerada
  startAt: string;               // quando começar a preparar
  peakAt: string;                // hora esperada de pico dentro da janela
};

export type PrepPlan = {
  generatedAt: string;
  horizonHours: number;
  now: string;
  totalExpectedOrders: number;
  totalPrepUnits: number;
  totalPrepBatches: number;
  totalPrepMinutes: number;
  overallConfidence: number;
  perHour: Array<{
    hour: number;
    label: string;
    expectedOrders: number;
    rush: "calmo" | "normal" | "movimentado" | "pico";
  }>;
  rows: PrepPlanRow[];
  aiInsights: string[];
  aiRecommendations: string[];
  aiMultiplier: number;
  aiReasoning: string;
  aiError?: string;
  historyDays: number;
  historySamples: number;
};

export const getPrepPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      horizonHoursOverride: z.number().int().min(1).max(6).optional(),
      contextNote: z.string().max(280).optional(),
    }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<PrepPlan> => {
    const { supabase, userId } = context;

    const roles = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "kitchen" }),
    ]);
    if (!roles.some((r) => r.data === true)) {
      throw new Error("Acesso restrito à cozinha/gestão");
    }

    const { data: settings } = await supabase
      .from("prep_forecast_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!settings) throw new Error("Configuração não encontrada");
    if (!settings.enabled) throw new Error("Sistema de pré-preparo desativado");

    const horizon = data.horizonHoursOverride ?? (settings.horizon_hours ?? 3);
    const historyDays = settings.history_days ?? 60;
    const safetyPct = (settings.safety_stock_pct ?? 20) / 100;
    const weekendBoost = (settings.weekend_boost_pct ?? 10) / 100;
    const includePaused = settings.include_paused ?? false;
    const included = (settings.categories_included as string[] | null) ?? [];
    const excluded = (settings.categories_excluded as string[] | null) ?? [];

    const now = new Date();
    const from = new Date(now.getTime() - historyDays * 86400000);

    // Products with prep_enabled = true
    let pq = supabase
      .from("products")
      .select("id,name,category,image_url,active,paused_until,pause_reason,prep_enabled,prep_yield_per_batch,prep_time_min,shelf_life_min,min_batches,max_batches,prep_priority")
      .eq("prep_enabled", true)
      .eq("active", true);
    const { data: products, error: pErr } = await pq;
    if (pErr) throw new Error(pErr.message);

    let productList = (products ?? []).filter((p) => {
      if (included.length && !included.includes(p.category ?? "")) return false;
      if (excluded.length && excluded.includes(p.category ?? "")) return false;
      const paused = p.paused_until && new Date(p.paused_until as string) > now;
      if (!includePaused && paused) return false;
      return true;
    });

    if (productList.length === 0) {
      return emptyPlan(now, horizon, historyDays, "Nenhum produto com pré-preparo ativado. Marque produtos em Produtos → Preparo.");
    }

    // Historical order items in window
    const { data: hist, error: hErr } = await supabase
      .from("order_items")
      .select("product_id,quantity,created_at,orders!inner(status,created_at)")
      .gte("created_at", from.toISOString())
      .lte("created_at", now.toISOString());
    if (hErr) throw new Error(hErr.message);

    // Aggregate volume per (productId, dow, hour) with exposure count of that dow
    const dowExposure = Array(7).fill(0);
    for (let i = 0; i < historyDays; i++) {
      dowExposure[new Date(now.getTime() - i * 86400000).getDay()] += 1;
    }

    // Map: productId -> dow -> hour -> units
    const bucket: Record<string, number[][]> = {};
    for (const p of productList) {
      bucket[p.id] = Array.from({ length: 7 }, () => Array(24).fill(0));
    }
    let hourlyOrders = Array(24).fill(0);
    const orderKeys = new Set<string>();

    for (const it of (hist ?? []) as any[]) {
      const st = it.orders?.status;
      if (st === "cancelado") continue;
      if (!bucket[it.product_id]) continue;
      const d = new Date(it.created_at);
      const dow = d.getDay();
      const hr = d.getHours();
      const qty = Number(it.quantity) || 0;
      bucket[it.product_id][dow][hr] += qty;
      const key = `${dow}-${hr}-${d.toISOString().slice(0, 10)}`;
      if (!orderKeys.has(key)) {
        orderKeys.add(key);
        hourlyOrders[hr] += 1;
      }
    }
    // Normalize by exposure
    for (const pid of Object.keys(bucket)) {
      for (let dow = 0; dow < 7; dow++) {
        const exp = Math.max(1, dowExposure[dow]);
        for (let h = 0; h < 24; h++) bucket[pid][dow][h] /= exp;
      }
    }
    hourlyOrders = hourlyOrders.map((v) => v / Math.max(1, historyDays / 7));

    // Target window (next N hours)
    const targetHours = Array.from({ length: horizon }, (_, i) => {
      const t = new Date(now.getTime() + i * 3600000);
      return { t, dow: t.getDay(), hour: t.getHours() };
    });
    const isWeekend = targetHours.some((th) => th.dow === 0 || th.dow === 6);

    // Historical per product in target window
    const productSummary = productList.map((p) => {
      const historicalUnits = targetHours.reduce(
        (s, th) => s + bucket[p.id][th.dow][th.hour],
        0,
      );
      // find peak hour
      let peakUnits = -1;
      let peakIdx = 0;
      targetHours.forEach((th, i) => {
        const v = bucket[p.id][th.dow][th.hour];
        if (v > peakUnits) { peakUnits = v; peakIdx = i; }
      });
      return { p, historicalUnits, peakIdx };
    });

    // ---- AI ----
    const apiKey = process.env.LOVABLE_API_KEY;
    let aiMultiplier = 1;
    let aiReasoning = "Baseline histórico.";
    let insights: string[] = [];
    let recommendations: string[] = [];
    let perProductAdj: Record<string, { mult: number; note: string }> = {};
    let aiError: string | undefined;

    const totalHist = productSummary.reduce((s, x) => s + x.historicalUnits, 0);
    if (!apiKey) {
      aiError = "LOVABLE_API_KEY ausente no servidor.";
    } else if (totalHist < 0.5) {
      aiError = "Histórico insuficiente para as próximas horas — usando fallback baseline.";
    } else {
      const compactHours = targetHours.map((th) => ({
        dow: th.dow,
        hour: th.hour,
        base_orders: Math.round(hourlyOrders[th.hour] * 100) / 100,
      }));
      const compactProducts = productSummary
        .slice(0, 30)
        .map((x) => ({
          id: x.p.id,
          name: x.p.name,
          cat: x.p.category,
          base_units: Math.round(x.historicalUnits * 100) / 100,
        }));

      const sys = `Você é um chef-planner de operações de uma loja de açaí no Brasil.
Recebe (1) volume médio esperado por hora, (2) volume médio esperado por produto na janela alvo, (3) contexto opcional do gestor.
Devolve um AJUSTE MULTIPLICADOR global (0.5-2.0), um AJUSTE POR PRODUTO (0.5-2.0), 3-5 insights e 3-5 recomendações operacionais claras (pt-BR).
Nunca invente números fora da ordem de grandeza. Se contexto menciona feriado, chuva, evento local, calor forte, promoção — reflita no multiplicador.
Responda SEMPRE JSON válido.`;

      const user = `Data/hora atual: ${now.toISOString()}
Horizonte: próximas ${horizon}h ${isWeekend ? "(inclui final de semana)" : ""}.
Boost de fim de semana definido pelo gestor: ${Math.round(weekendBoost * 100)}%.
Contexto do gestor: "${data.contextNote ?? settings.ai_context ?? "sem contexto adicional"}"

Volume esperado por hora (baseline histórico):
${JSON.stringify(compactHours)}

Produtos ativos para pré-preparo (baseline histórico na janela):
${JSON.stringify(compactProducts)}

Devolva EXATAMENTE:
{
  "multiplier": 0.5..2.0,
  "reasoning": "1-2 frases pt-BR",
  "products": [{ "id": "uuid", "mult": 0.5..2.0, "note": "curta pt-BR opcional" }],
  "insights": ["3-5 bullets curtos"],
  "recommendations": ["3-5 ações práticas pt-BR"]
}`;

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: settings.ai_model || "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            temperature: Number(settings.ai_temperature) || 0.3,
          }),
        });
        if (resp.status === 429) aiError = "Muitas requisições agora. Tente em instantes.";
        else if (resp.status === 402) aiError = "Créditos de IA esgotados. Adicione créditos ao workspace.";
        else if (!resp.ok) {
          const t = await resp.text();
          aiError = `IA indisponível (${resp.status}): ${t.slice(0, 160)}`;
        } else {
          const payload = (await resp.json()) as any;
          const raw = payload.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(raw);
          aiMultiplier = Math.max(0.5, Math.min(2, Number(parsed.multiplier) || 1));
          aiReasoning = String(parsed.reasoning ?? "").slice(0, 240) || aiReasoning;
          insights = (parsed.insights ?? []).slice(0, 6).map(String);
          recommendations = (parsed.recommendations ?? []).slice(0, 6).map(String);
          for (const it of (parsed.products ?? []) as any[]) {
            if (typeof it?.id !== "string") continue;
            perProductAdj[it.id] = {
              mult: Math.max(0.5, Math.min(2, Number(it.mult) || 1)),
              note: typeof it.note === "string" ? it.note.slice(0, 120) : "",
            };
          }
        }
      } catch (e) {
        aiError = `Falha ao consultar IA: ${(e as Error).message}`;
      }
    }

    // Build final rows
    const weekendMult = isWeekend ? 1 + weekendBoost : 1;
    const rows: PrepPlanRow[] = productSummary.map((x) => {
      const productAdj = perProductAdj[x.p.id]?.mult ?? 1;
      const expected = x.historicalUnits * aiMultiplier * productAdj * weekendMult * (1 + safetyPct);
      const yieldB = Math.max(1, Number(x.p.prep_yield_per_batch) || 5);
      let batches = Math.ceil(expected / yieldB);
      batches = Math.max(Number(x.p.min_batches) || 0, batches);
      batches = Math.min(Number(x.p.max_batches) || 10, batches);
      if (settings.min_batch_hint && batches > 0) {
        batches = Math.max(batches, Number(settings.min_batch_hint));
      }
      const suggestedUnits = batches * yieldB;
      const peakTh = targetHours[x.peakIdx] ?? targetHours[0];
      const startAt = new Date(peakTh.t.getTime() - (Number(x.p.prep_time_min) || 8) * 60000);
      const rush = expected > 8 ? "pico" : expected > 4 ? "movimentado" : expected > 1.5 ? "normal" : "calmo";
      const paused = x.p.paused_until && new Date(x.p.paused_until as string) > now;
      const confidence = Math.min(1, 0.35 + Math.min(x.historicalUnits, 10) / 15 + (perProductAdj[x.p.id] ? 0.1 : 0));
      const reason = perProductAdj[x.p.id]?.note ||
        (rush === "pico" ? "Pico esperado — pré-preparar já." :
          rush === "movimentado" ? "Demanda alta na janela." :
            rush === "normal" ? "Demanda estável." : "Demanda baixa — cautela no volume.");
      return {
        productId: x.p.id,
        productName: x.p.name,
        category: x.p.category ?? null,
        imageUrl: x.p.image_url ?? null,
        paused: !!paused,
        historicalUnits: Math.round(x.historicalUnits * 10) / 10,
        expectedUnits: Math.round(expected * 10) / 10,
        yieldPerBatch: yieldB,
        prepTimeMin: Number(x.p.prep_time_min) || 8,
        shelfLifeMin: Number(x.p.shelf_life_min) || 120,
        suggestedBatches: batches,
        suggestedUnits,
        confidence,
        priority: Number(x.p.prep_priority) || 3,
        rush: rush as PrepPlanRow["rush"],
        reason,
        startAt: startAt.toISOString(),
        peakAt: peakTh.t.toISOString(),
      };
    })
    .sort((a, b) => b.expectedUnits - a.expectedUnits || b.priority - a.priority);

    const perHour = targetHours.map((th, i) => {
      const orders = hourlyOrders[th.hour] * aiMultiplier * weekendMult;
      return {
        hour: th.hour,
        label: `${DOW[th.dow]} ${String(th.hour).padStart(2, "0")}h`,
        expectedOrders: Math.round(orders * 10) / 10,
        rush: (orders > 6 ? "pico" : orders > 3 ? "movimentado" : orders > 1 ? "normal" : "calmo") as PrepPlanRow["rush"],
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      horizonHours: horizon,
      now: now.toISOString(),
      totalExpectedOrders: Math.round(perHour.reduce((s, h) => s + h.expectedOrders, 0) * 10) / 10,
      totalPrepUnits: rows.reduce((s, r) => s + r.suggestedUnits, 0),
      totalPrepBatches: rows.reduce((s, r) => s + r.suggestedBatches, 0),
      totalPrepMinutes: rows.reduce((s, r) => s + r.suggestedBatches * r.prepTimeMin, 0),
      overallConfidence: rows.length ? rows.reduce((s, r) => s + r.confidence, 0) / rows.length : 0,
      perHour,
      rows,
      aiInsights: insights,
      aiRecommendations: recommendations,
      aiMultiplier,
      aiReasoning,
      aiError,
      historyDays,
      historySamples: hist?.length ?? 0,
    };
  });

function emptyPlan(now: Date, horizon: number, historyDays: number, msg: string): PrepPlan {
  return {
    generatedAt: now.toISOString(),
    horizonHours: horizon,
    now: now.toISOString(),
    totalExpectedOrders: 0,
    totalPrepUnits: 0,
    totalPrepBatches: 0,
    totalPrepMinutes: 0,
    overallConfidence: 0,
    perHour: [],
    rows: [],
    aiInsights: [],
    aiRecommendations: [msg],
    aiMultiplier: 1,
    aiReasoning: msg,
    historyDays,
    historySamples: 0,
  };
}
