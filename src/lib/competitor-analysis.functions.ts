import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ==================== Types ==================== */
export type ExtractedCompetitorItem = {
  name: string;
  description: string;
  category: string;
  price: number;
  size?: string | null;
  badge?: string | null;
  // Enriched by comparison step:
  match_product_id?: string | null;
  match_product_name?: string | null;
  match_our_price?: number | null;
  price_gap_abs?: number | null; // our_price - their_price (positive = we're more expensive)
  price_gap_pct?: number | null;
  positioning?: "cheaper" | "similar" | "expensive" | "no-match" | null;
  ai_suggestion?: string | null;
};

export type AnalysisSummary = {
  total_items: number;
  matched_items: number;
  avg_price_gap_pct: number | null;
  we_cheaper_count: number;
  we_similar_count: number;
  we_expensive_count: number;
  opportunities: Array<{
    kind: "undercut" | "raise" | "gap-in-menu" | "premium-worth-copying";
    text: string;
  }>;
  headline: string;
};

/** ==================== Helpers ==================== */
function normalize(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}
function tokenSet(s: string) {
  return new Set(normalize(s).split(" ").filter((w) => w.length >= 3));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0; a.forEach((t) => b.has(t) && inter++);
  return inter / (a.size + b.size - inter);
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "admin",
  });
  if (!data) throw new Error("Acesso negado");
}

/** ==================== 1. Extract items from photos ==================== */
const RunSchema = z.object({
  competitor_name: z.string().min(1).max(120),
  region: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  images: z.array(z.string().min(20)).min(1).max(8),
  hint: z.string().max(400).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
});

export const runCompetitorAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => RunSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const model = data.model?.trim() || "google/gemini-2.5-pro";

    // 1) Create pending row so we always have a record
    const { data: row, error: insErr } = await context.supabase
      .from("competitor_analyses")
      .insert({
        created_by: context.userId,
        competitor_name: data.competitor_name.trim(),
        region: data.region?.trim() || null,
        notes: data.notes?.trim() || null,
        photo_paths: [],
        status: "processing",
        ai_model: model,
      })
      .select("id").single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Falha ao registrar análise");
    const id = row.id as string;

    try {
      // 2) Call vision AI
      const systemPrompt = `Você é um especialista em analisar cardápios de concorrentes (sorveterias, açaí, lanches, docerias, cafés).
Extraia com precisão OS ITENS visíveis nas imagens e devolva SOMENTE JSON válido no formato:
{"items":[{"name":"","description":"","category":"","price":0.00,"size":"","badge":""}]}
Regras:
- name: nome real do produto como no cardápio
- description: 1 frase; se não houver, gere resumo curto pelo nome
- category: agrupe ("Açaí","Shakes","Bebidas","Combos","Sobremesas","Salgados"). Nunca vazio.
- price: número em reais (float). Se houver múltiplos tamanhos, use o MENOR preço e coloque o rótulo em "size" (ex "300ml" ou "P").
- size: opcional; string curta ou vazia.
- badge: opcional ("Novo","Popular","Promoção") ou vazio.
Ignore cabeçalhos, endereços, telefones. Não invente itens que não aparecem. Se um preço estiver ilegível use 0.
${data.hint ? `Contexto do usuário: ${data.hint}` : ""}
Responda APENAS com o JSON, sem markdown.`;

      const userContent: Array<Record<string, unknown>> = [
        { type: "text", text: "Analise as imagens do cardápio do concorrente e extraia todos os itens com preços." },
        ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
      ];

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });
      if (resp.status === 429) throw new Error("Muitas requisições — aguarde alguns segundos.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      if (!resp.ok) throw new Error(`IA indisponível (${resp.status})`);
      const payload = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = payload.choices?.[0]?.message?.content?.trim() ?? "{}";
      let parsed: { items?: ExtractedCompetitorItem[] } = {};
      try { parsed = JSON.parse(raw); }
      catch { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
      const items: ExtractedCompetitorItem[] = (parsed.items ?? [])
        .map((i) => ({
          name: String(i.name ?? "").slice(0, 140).trim(),
          description: String(i.description ?? "").slice(0, 400).trim(),
          category: String(i.category ?? "Geral").slice(0, 60).trim() || "Geral",
          price: Math.max(0, Number(i.price) || 0),
          size: i.size ? String(i.size).slice(0, 30) : null,
          badge: i.badge ? String(i.badge).slice(0, 30) : null,
        }))
        .filter((i) => i.name.length > 0);

      if (items.length === 0) throw new Error("Nenhum item pôde ser extraído das imagens. Tente fotos mais nítidas.");

      // 3) Fuzzy-match against our own catalog
      const { data: ourProducts } = await context.supabase
        .from("products").select("id,name,category,base_price,active").eq("active", true);
      const our: Array<{ id: string; name: string; category: string | null; base_price: number; tokens: Set<string> }> =
        (ourProducts ?? []).map((p: any) => ({
          id: p.id, name: p.name, category: p.category,
          base_price: Number(p.base_price) || 0, tokens: tokenSet(p.name),
        }));

      for (const item of items) {
        if (item.price <= 0) { item.positioning = "no-match"; continue; }
        const iTok = tokenSet(item.name);
        let best: { p: (typeof our)[number]; score: number } | null = null;
        for (const p of our) {
          const s = jaccard(iTok, p.tokens);
          if (!best || s > best.score) best = { p, score: s };
        }
        if (best && best.score >= 0.35 && best.p.base_price > 0) {
          const ourPrice = best.p.base_price;
          const gapAbs = ourPrice - item.price;
          const gapPct = item.price > 0 ? (gapAbs / item.price) * 100 : 0;
          item.match_product_id = best.p.id;
          item.match_product_name = best.p.name;
          item.match_our_price = ourPrice;
          item.price_gap_abs = Number(gapAbs.toFixed(2));
          item.price_gap_pct = Number(gapPct.toFixed(1));
          if (Math.abs(gapPct) <= 5) item.positioning = "similar";
          else if (gapPct > 5) item.positioning = "expensive";
          else item.positioning = "cheaper";
        } else {
          item.positioning = "no-match";
        }
      }

      // 4) AI generates human-readable suggestions per item + overall summary
      const compact = items.map((i, idx) => ({
        idx, name: i.name, cat: i.category, their_price: i.price,
        our_price: i.match_our_price, gap_pct: i.price_gap_pct,
        positioning: i.positioning, match: i.match_product_name,
      }));

      const analyst = `Você é um consultor de precificação de food/açaí. Dado um cardápio do concorrente já comparado com nosso catálogo, gere sugestões PRÁTICAS.
Retorne SOMENTE JSON no formato:
{
  "suggestions": [{"idx": 0, "text": "..."}],
  "opportunities": [{"kind":"undercut|raise|gap-in-menu|premium-worth-copying", "text":"..."}],
  "headline": "..."
}
Regras:
- suggestions: 1 frase por item (máx 140 chars), acionável ("subir preço em R$X", "criar combo", "manter", "ignorar"). Só emita para itens relevantes.
- opportunities: 2 a 5 achados de alto nível (ex "Concorrente cobra 20% mais em shakes; podemos subir R$3 sem perder competitividade").
- headline: 1 frase resumindo se estamos competitivos.
Português BR, tom direto.`;

      let aiExtras: {
        suggestions?: Array<{ idx: number; text: string }>;
        opportunities?: AnalysisSummary["opportunities"];
        headline?: string;
      } = {};
      try {
        const resp2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: analyst },
              { role: "user", content: `Concorrente: ${data.competitor_name}${data.region ? " (" + data.region + ")" : ""}.\nItens:\n${JSON.stringify(compact)}` },
            ],
            temperature: 0.4,
            response_format: { type: "json_object" },
          }),
        });
        if (resp2.ok) {
          const p2 = (await resp2.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const t = p2.choices?.[0]?.message?.content?.trim() ?? "{}";
          try { aiExtras = JSON.parse(t); }
          catch { const m = t.match(/\{[\s\S]*\}/); if (m) aiExtras = JSON.parse(m[0]); }
        }
      } catch { /* non-fatal */ }

      if (Array.isArray(aiExtras.suggestions)) {
        for (const s of aiExtras.suggestions) {
          if (items[s.idx]) items[s.idx].ai_suggestion = String(s.text ?? "").slice(0, 200);
        }
      }

      const matched = items.filter((i) => i.positioning && i.positioning !== "no-match");
      const gaps = matched.map((i) => i.price_gap_pct ?? 0);
      const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
      const summary: AnalysisSummary = {
        total_items: items.length,
        matched_items: matched.length,
        avg_price_gap_pct: avg === null ? null : Number(avg.toFixed(1)),
        we_cheaper_count: matched.filter((i) => i.positioning === "cheaper").length,
        we_similar_count: matched.filter((i) => i.positioning === "similar").length,
        we_expensive_count: matched.filter((i) => i.positioning === "expensive").length,
        opportunities: (aiExtras.opportunities ?? []).slice(0, 8),
        headline: aiExtras.headline ?? `${items.length} itens analisados no cardápio de ${data.competitor_name}.`,
      };

      // 5) Upload images to storage & finalize row
      const paths: string[] = [];
      for (let i = 0; i < data.images.length; i++) {
        const dataUrl = data.images[i];
        const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (!m) continue;
        const mime = m[1]; const b64 = m[2];
        const bin = Buffer.from(b64, "base64");
        const ext = mime.split("/")[1]?.split("+")[0] || "png";
        const path = `${context.userId}/${id}/${i}.${ext}`;
        const { error: upErr } = await context.supabase.storage
          .from("competitor-menus")
          .upload(path, bin, { contentType: mime, upsert: true });
        if (!upErr) paths.push(path);
      }

      await context.supabase.from("competitor_analyses").update({
        photo_paths: paths, items, summary, status: "done", error_message: null,
      }).eq("id", id);

      return { id, items, summary, photo_paths: paths };
    } catch (err) {
      const msg = (err as Error).message;
      await context.supabase.from("competitor_analyses").update({
        status: "error", error_message: msg.slice(0, 500),
      }).eq("id", id);
      throw err;
    }
  });

/** ==================== 2. List analyses ==================== */
export const listCompetitorAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("competitor_analyses")
      .select("id,competitor_name,region,status,summary,created_at,ai_model,photo_paths")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

/** ==================== 3. Fetch full analysis with signed photo urls ==================== */
export const getCompetitorAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("competitor_analyses").select("*").eq("id", data.id).single();
    if (error || !row) throw new Error(error?.message ?? "Análise não encontrada");
    const paths: string[] = row.photo_paths ?? [];
    const signed: string[] = [];
    for (const p of paths) {
      const { data: s } = await context.supabase.storage
        .from("competitor-menus").createSignedUrl(p, 60 * 60);
      if (s?.signedUrl) signed.push(s.signedUrl);
    }
    return { ...row, photo_urls: signed };
  });

/** ==================== 4. Delete analysis ==================== */
export const deleteCompetitorAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase
      .from("competitor_analyses").select("photo_paths").eq("id", data.id).single();
    const paths: string[] = row?.photo_paths ?? [];
    if (paths.length) await context.supabase.storage.from("competitor-menus").remove(paths);
    const { error } = await context.supabase.from("competitor_analyses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** ==================== 5. Apply price suggestion ==================== */
export const applyCompetitorPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    product_id: z.string().min(1),
    new_price: z.number().positive().max(9999),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("products").update({ base_price: data.new_price }).eq("id", data.product_id);
    if (error) throw error;
    return { ok: true };
  });
