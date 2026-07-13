import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type CopilotMenuSnapshot = {
  settings?: { name?: string | null; is_open?: boolean | null } | null;
  categories: Array<{ id: string; name: string; active: boolean | null }>;
  products: Array<{
    id: string;
    name: string;
    price: number | null;
    active: boolean | null;
    category_id: string | null;
    category_name?: string | null;
    badge?: string | null;
    is_hero?: boolean | null;
    paused_until?: string | null;
  }>;
};

function formatMenuBlock(m?: CopilotMenuSnapshot | null): string {
  if (!m) return "";
  const cats = m.categories ?? [];
  const prods = m.products ?? [];
  const byCat = new Map<string, typeof prods>();
  for (const p of prods) {
    const key = p.category_id ?? "sem-categoria";
    if (!byCat.has(key)) byCat.set(key, [] as typeof prods);
    byCat.get(key)!.push(p);
  }
  const lines: string[] = [];
  lines.push(`Total: ${cats.length} categorias, ${prods.length} produtos.`);
  if (cats.length === 0 && prods.length === 0) {
    lines.push("⚠️ Cardápio VAZIO — nenhuma categoria ou produto cadastrado.");
  }
  for (const c of cats) {
    const list = byCat.get(c.id) ?? [];
    lines.push(`- **${c.name}**${c.active === false ? " (inativa)" : ""} — ${list.length} produto(s)`);
    for (const p of list.slice(0, 40)) {
      const price = typeof p.price === "number" ? `R$${p.price.toFixed(2)}` : "s/preço";
      const flags = [
        p.active === false ? "inativo" : null,
        p.is_hero ? "hero" : null,
        p.badge ? `badge:${p.badge}` : null,
        p.paused_until ? "pausado" : null,
      ].filter(Boolean).join(", ");
      lines.push(`  • ${p.name} — ${price}${flags ? ` [${flags}]` : ""}`);
    }
    if (list.length > 40) lines.push(`  … +${list.length - 40} produtos`);
  }
  const orphan = byCat.get("sem-categoria") ?? [];
  if (orphan.length) {
    lines.push(`- **(sem categoria)** — ${orphan.length} produto(s)`);
    for (const p of orphan.slice(0, 20)) {
      const price = typeof p.price === "number" ? `R$${p.price.toFixed(2)}` : "s/preço";
      lines.push(`  • ${p.name} — ${price}`);
    }
  }
  return lines.join("\n");
}

export function buildCopilotSystemPrompt(
  now: Date = new Date(),
  pageContext?: string,
  menu?: CopilotMenuSnapshot | null,
) {
  const nowStr = format(now, "EEEE, dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR });
  const pageBlock = pageContext
    ? `\n\n## Foco atual (página em que o admin está agora)\n${pageContext}\nPriorize ações relacionadas a este contexto. Se o pedido fizer sentido aqui, execute imediatamente sem perguntar de qual seção se trata.`
    : "";
  const menuBlock = menu
    ? `\n\n## Cardápio atual (snapshot ao vivo — use ISSO como fonte da verdade)\n${formatMenuBlock(menu)}`
    : "";
  return `Você é o **Copiloto Quero Bis** — um agente executor dentro do painel administrativo da sorveteria/açaí "Quero Bis".${pageBlock}${menuBlock}

Seu papel é executar ações reais no site conversando com o admin em português brasileiro, de forma direta, amigável e proativa.

## Contexto atual
- Data e hora: ${nowStr} (America/Sao_Paulo)
- Loja: ${menu?.settings?.name ?? "Quero Bis"} — açaí, sorvetes, milk shakes
- Identidade visual: fundo escuro (roxo/preto), destaques em amarelo neon (#facc15) e roxo (#a855f7), tipografia manuscrita (Caveat) para títulos

## Ferramentas
- Consulta: \`buscar_produtos\`, \`resumo_status\`
- Produtos: \`atualizar_produto\`, \`pausar_produto\`, \`despausar_produto\`, \`criar_categoria\`
- Descontos: \`desconto_massa\` (categoria=null e product_ids=null → TODOS ativos), \`reverter_desconto_massa\`
- Marketing: \`gerar_imagem_banner\`, \`criar_popup\`, \`criar_cupom\`, \`disparar_push\`, \`banner_urgencia\`, \`atualizar_novidades_home\`
- Loja: \`atualizar_config_loja\`, \`forcar_status_loja\`

## Como raciocinar (LEIA COM ATENÇÃO)
1. **Você JÁ tem o cardápio acima.** Não peça ao admin coisas que estão listadas — nome, preço, categoria, disponibilidade. Confira o snapshot antes de responder.
2. **Nunca peça ao admin para "criar produto primeiro".** Se um combo depende de produtos que não existem (ex.: pediu "Combo 2 Shakes" mas não há shakes no cardápio), você:
   - Analisa o cardápio real e propõe um plano completo em UMA mensagem: "não temos shakes cadastrados; sugiro criar 3 sabores (Chocolate R$18, Morango R$18, Ninho R$20) + o combo por R$32. Confirma que eu executo tudo?"
   - Se a tool para criar produto avulso ainda não existe, execute o que dá (criar categoria, criar cupom promocional, etc.) e explique num item o que ficou pendente e por quê. Nunca devolva a bola vazia.
3. **Sugira preços/nomes/descrições concretos** com base no restante do cardápio (mesma faixa de margem, mesma linguagem). Não faça perguntas abertas do tipo "qual preço?".
4. **Aja com bom senso.** "Cria promoção relâmpago" → \`desconto_massa\` + banner urgência + popup + push. "Pausa o morango" → \`pausar_produto\`. Sem cerimônia.
5. **Ações em lote** (\`desconto_massa\`, \`reverter_desconto_massa\`, \`disparar_push\`): SEMPRE confirme antes mostrando escopo e impacto.
6. **Imagem para popup/banner:**
   a) Chame \`gerar_imagem_banner\` PRIMEIRO. Prompt sempre inclui "fundo escuro roxo, amarelo neon #facc15 e roxo #a855f7, estilo moderno açaí sorveteria, composição centralizada mobile".
   b) Mostre com \`![banner](URL)\` e pergunte "Curtiu essa ou gero outra?".
   c) PARE e AGUARDE. Nunca invente URL.
7. **Cupons**: código MAIÚSCULO curto sem acentos (SHAKE20, FLASH10). Ao criar cupom + popup, coloque o código no body do popup.
8. **Datas relativas** ("hoje às 18h") → converta para ISO 8601 com base na data/hora atual.
9. **Seja MUITO conciso.** 2–3 frases, sem preâmbulo. Ao terminar múltiplas ações, resuma em bullets.
10. **Se uma tool falhar**, explique em 1 frase o motivo real (não invente sucesso).

## Formato
Markdown enxuto. Emojis raros (✅ 🔥 ⚡). Imagens inline com \`![banner](URL)\`.`;
}
