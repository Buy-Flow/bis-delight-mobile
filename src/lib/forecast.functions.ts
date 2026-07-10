import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Demand forecast server function.
 *
 * 1. Verifies caller is admin (has_role).
 * 2. Pulls last N days of orders (excluding cancelled).
 * 3. Aggregates by day-of-week × hour, plus daily trend.
 * 4. Sends a compact JSON summary to Lovable AI (Gemini Flash) asking for
 *    a next-24h hourly forecast with insights and operational advice.
 * 5. Returns everything so the UI can render chart + heatmap + AI advice.
 */

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

type HourStat = { orders: number; revenue: number; samples: number };

export type DemandForecast = {
  generatedAt: string;
  historyDays: number;
  totalOrders: number;
  totalRevenue: number;
  // heatmap[dow][hour] = { orders, revenue, samples }
  heatmap: HourStat[][];
  // Per-hour average across all days-of-week (baseline)
  hourlyAvg: number[]; // length 24
  // Target: forecast for the coming 24 hours starting from "now"
  target: {
    startISO: string;
    hours: Array<{
      hourStart: string; // ISO
      dow: number; // 0..6
      hour: number; // 0..23
      label: string; // "Sáb 20h"
      expectedOrders: number;
      expectedRevenue: number;
      rushLevel: "calmo" | "normal" | "movimentado" | "pico";
      confidence: number; // 0..1
      note?: string;
    }>;
    peakHour: string;
    calmHour: string;
    totalExpectedOrders: number;
    totalExpectedRevenue: number;
    overallConfidence: number;
  };
  insights: string[];
  recommendations: string[];
  aiError?: string;
};

export const getDemandForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        days: z.number().int().min(14).max(180).default(60),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<DemandForecast> => {
    const { supabase, userId } = context;

    // Admin gate
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("Falha ao verificar permissões");
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const now = new Date();
    const from = new Date(now.getTime() - data.days * 24 * 60 * 60 * 1000);

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id,total,status,created_at,mode")
      .gte("created_at", from.toISOString())
      .lte("created_at", now.toISOString())
      .not("status", "eq", "cancelado")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Build heatmap dow × hour
    const heatmap: HourStat[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ orders: 0, revenue: 0, samples: 0 })),
    );
    // Track distinct (dow,hour,date) samples so averages are per occurrence
    const sampleTracker = new Set<string>();

    for (const o of orders ?? []) {
      const d = new Date(o.created_at as string);
      const dow = d.getDay();
      const h = d.getHours();
      const cell = heatmap[dow][h];
      cell.orders += 1;
      cell.revenue += Number(o.total) || 0;
      const dayKey = `${dow}-${h}-${d.toISOString().slice(0, 10)}`;
      if (!sampleTracker.has(dayKey)) {
        sampleTracker.add(dayKey);
        cell.samples += 1;
      }
    }

    // Convert totals into per-occurrence averages so a hot Friday doesn't
    // get diluted by all Fridays with no activity that we never observed.
    // We approximate exposure = # of that DOW in the window.
    const dowExposure = Array(7).fill(0);
    for (let i = 0; i < data.days; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      dowExposure[d.getDay()] += 1;
    }
    for (let dow = 0; dow < 7; dow++) {
      const exp = Math.max(1, dowExposure[dow]);
      for (let h = 0; h < 24; h++) {
        heatmap[dow][h].orders = heatmap[dow][h].orders / exp;
        heatmap[dow][h].revenue = heatmap[dow][h].revenue / exp;
      }
    }

    // Hourly average across full week
    const hourlyAvg = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      let sum = 0;
      for (let dow = 0; dow < 7; dow++) sum += heatmap[dow][h].orders;
      hourlyAvg[h] = sum / 7;
    }

    const totalOrders = orders?.length ?? 0;
    const totalRevenue =
      orders?.reduce((s, o) => s + (Number(o.total) || 0), 0) ?? 0;

    // Build the next-24h target using historical baseline as a fallback
    const target24 = Array.from({ length: 24 }, (_, i) => {
      const t = new Date(now.getTime() + i * 3600_000);
      const dow = t.getDay();
      const hour = t.getHours();
      const baseline = heatmap[dow][hour];
      return { t, dow, hour, baseline };
    });

    // ---- AI call ----
    const apiKey = process.env.LOVABLE_API_KEY;
    let aiForecast: Array<{
      hour: number;
      dow: number;
      expected_orders: number;
      expected_revenue: number;
      rush_level: "calmo" | "normal" | "movimentado" | "pico";
      confidence: number;
      note?: string;
    }> = [];
    let insights: string[] = [];
    let recommendations: string[] = [];
    let aiError: string | undefined;

    if (!apiKey) {
      aiError = "LOVABLE_API_KEY ausente no servidor.";
    } else if (totalOrders < 10) {
      aiError = `Histórico insuficiente (${totalOrders} pedidos). Colete mais dados antes de prever com precisão.`;
    } else {
      const compactHeatmap = heatmap.map((row) =>
        row.map((c) => ({
          o: Math.round(c.orders * 100) / 100,
          r: Math.round(c.revenue),
        })),
      );

      const targetDesc = target24.map((x) => ({
        dow: x.dow,
        hour: x.hour,
        baseline_orders: Math.round(x.baseline.orders * 100) / 100,
      }));

      const systemPrompt = `Você é um analista sênior de operações de uma loja de açaí no Brasil.
Recebe estatísticas históricas de pedidos por (dia da semana × hora) e produz uma previsão de demanda para as próximas 24 horas.
Considere efeitos típicos: horário de almoço, calor no fim de tarde, sextas/sábados fortes, madrugada fraca, ajuste sazonal razoável.
Nunca invente números fora da ordem de grandeza dos dados históricos. Se um horário nunca teve pedidos, preveja ≈0.
Responda SEMPRE em JSON válido no formato exato solicitado.`;

      const userPrompt = `Loja: Quero Bis (Açaí, delivery + retirada).
Janela histórica: ${data.days} dias.
Pedidos observados: ${totalOrders}. Receita total: R$ ${totalRevenue.toFixed(2)}.

Matriz média (pedidos por hora, por dia da semana). Linhas = dow (0=Dom..6=Sáb), colunas = hora 0..23.
Cada célula: { o: pedidos_médios_por_ocorrência_do_dow, r: receita_média_em_reais }.
${JSON.stringify(compactHeatmap)}

Alvo de previsão (próximas 24h a partir de agora):
${JSON.stringify(targetDesc)}

Devolva EXATAMENTE este JSON (sem markdown, sem comentários):
{
  "hours": [
    { "dow": 0-6, "hour": 0-23, "expected_orders": number, "expected_revenue": number, "rush_level": "calmo"|"normal"|"movimentado"|"pico", "confidence": 0..1, "note": "curta, opcional, em pt-BR" }
  ],
  "insights": ["3 a 5 bullets curtos, pt-BR, revelando padrões (ex: 'Sextas 20h-22h concentram 28% da semana')"],
  "recommendations": ["3 a 5 recomendações acionáveis para a operação: escala, pré-preparo, promo pontual, comunicação"]
}
Regras:
- "hours" tem exatamente 24 entradas, na MESMA ORDEM do alvo enviado.
- "expected_orders" e "expected_revenue" são não-negativos.
- rush_level: calmo <30% do pico, normal 30-60%, movimentado 60-85%, pico >85%.`;

      try {
        const resp = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.4,
            }),
          },
        );

        if (resp.status === 429) {
          aiError = "Muitas requisições agora. Tente de novo em instantes.";
        } else if (resp.status === 402) {
          aiError =
            "Créditos de IA esgotados. Adicione créditos ao workspace para continuar usando previsões automáticas.";
        } else if (!resp.ok) {
          const t = await resp.text();
          aiError = `IA indisponível (${resp.status}): ${t.slice(0, 180)}`;
        } else {
          const payload = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const raw = payload.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(raw) as {
            hours?: typeof aiForecast;
            insights?: string[];
            recommendations?: string[];
          };
          if (Array.isArray(parsed.hours) && parsed.hours.length === 24) {
            aiForecast = parsed.hours.map((h) => ({
              hour: Number(h.hour) || 0,
              dow: Number(h.dow) || 0,
              expected_orders: Math.max(0, Number(h.expected_orders) || 0),
              expected_revenue: Math.max(0, Number(h.expected_revenue) || 0),
              rush_level: (["calmo", "normal", "movimentado", "pico"] as const).includes(
                h.rush_level as never,
              )
                ? (h.rush_level as never)
                : "normal",
              confidence: Math.max(0, Math.min(1, Number(h.confidence) || 0.5)),
              note: typeof h.note === "string" ? h.note.slice(0, 140) : undefined,
            }));
          }
          insights = (parsed.insights ?? []).slice(0, 6).map((s) => String(s));
          recommendations = (parsed.recommendations ?? [])
            .slice(0, 6)
            .map((s) => String(s));
        }
      } catch (e) {
        aiError = `Falha ao consultar IA: ${(e as Error).message}`;
      }
    }

    // Merge AI forecast onto target hours; fallback to baseline for missing.
    const hours = target24.map((x, i) => {
      const ai = aiForecast[i];
      const expected = ai
        ? ai.expected_orders
        : Math.round(x.baseline.orders * 10) / 10;
      const revenue = ai
        ? ai.expected_revenue
        : Math.round(x.baseline.revenue);
      const rush: DemandForecast["target"]["hours"][number]["rushLevel"] =
        ai?.rush_level ??
        (expected >= 4
          ? "pico"
          : expected >= 2
            ? "movimentado"
            : expected >= 0.8
              ? "normal"
              : "calmo");
      return {
        hourStart: x.t.toISOString(),
        dow: x.dow,
        hour: x.hour,
        label: `${DOW_LABELS[x.dow]} ${String(x.hour).padStart(2, "0")}h`,
        expectedOrders: Math.round(expected * 10) / 10,
        expectedRevenue: Math.round(revenue),
        rushLevel: rush,
        confidence: ai?.confidence ?? (totalOrders > 100 ? 0.55 : 0.35),
        note: ai?.note,
      };
    });

    const peak = hours.reduce((a, b) =>
      b.expectedOrders > a.expectedOrders ? b : a,
    );
    const calm = hours.reduce((a, b) =>
      b.expectedOrders < a.expectedOrders ? b : a,
    );
    const totalExpectedOrders = hours.reduce((s, h) => s + h.expectedOrders, 0);
    const totalExpectedRevenue = hours.reduce((s, h) => s + h.expectedRevenue, 0);
    const overallConfidence =
      hours.reduce((s, h) => s + h.confidence, 0) / hours.length;

    return {
      generatedAt: new Date().toISOString(),
      historyDays: data.days,
      totalOrders,
      totalRevenue,
      heatmap,
      hourlyAvg,
      target: {
        startISO: now.toISOString(),
        hours,
        peakHour: peak.label,
        calmHour: calm.label,
        totalExpectedOrders: Math.round(totalExpectedOrders * 10) / 10,
        totalExpectedRevenue: Math.round(totalExpectedRevenue),
        overallConfidence,
      },
      insights,
      recommendations,
      aiError,
    };
  });
