import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Extract structured menu items from an image, PDF page, or long text using
 * Lovable AI Gateway (Gemini vision). Never touches the DB — purely parsing.
 */

const InputSchema = z.object({
  // Base64 data URL (image/png, image/jpeg, application/pdf converted to image)
  images: z.array(z.string().min(20)).max(6).optional(),
  text: z.string().max(60000).optional(),
  hint: z.string().max(500).optional(),
});

export type ExtractedItem = {
  name: string;
  description: string;
  category: string;
  price: number;
  badge?: string | null;
};

async function assertAdmin(context: {
  supabase: any;
  userId: string;
}): Promise<void> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Acesso negado");
}

export const extractMenuFromMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");
    if (!data.images?.length && !data.text) {
      throw new Error("Envie ao menos uma imagem, PDF ou texto");
    }

    const systemPrompt = `Você é um extrator de cardápios. Analise a entrada (imagem, PDF ou texto) e devolva SOMENTE um JSON válido no formato:
{"items":[{"name":"...","description":"...","category":"...","price": 0.00, "badge": null}]}
Regras:
- name: nome curto do produto
- description: 1 frase objetiva; se não houver, gere breve descrição baseada no nome
- category: agrupe (ex: "Açaí", "Shakes", "Bebidas", "Sobremesas"). Nunca vazio.
- price: número em reais (float). Se houver múltiplos tamanhos, use o MENOR preço.
- badge: opcional ("Novo","Popular","Promoção") ou null.
Nunca invente itens; se um preço estiver ilegível, use 0.
${data.hint ? `Contexto extra: ${data.hint}` : ""}
Responda APENAS com o JSON, sem markdown.`;

    const userContent: any[] = [];
    if (data.text) userContent.push({ type: "text", text: data.text });
    else userContent.push({ type: "text", text: "Extraia todos os itens do cardápio das imagens." });
    for (const img of data.images ?? []) {
      userContent.push({ type: "image_url", image_url: { url: img } });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
    const payload = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim() ?? "{}";
    let parsed: { items?: ExtractedItem[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const items = (parsed.items ?? []).map((i) => ({
      name: String(i.name ?? "").slice(0, 120).trim(),
      description: String(i.description ?? "").slice(0, 400).trim(),
      category: String(i.category ?? "Geral").slice(0, 60).trim() || "Geral",
      price: Math.max(0, Number(i.price) || 0),
      badge: i.badge ? String(i.badge).slice(0, 30) : null,
    })).filter((i) => i.name.length > 0);

    return { items };
  });
