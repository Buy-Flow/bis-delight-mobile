import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CopilotOpsSnapshot, CopilotMemoryItem } from "./copilot-context.server";

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
      lines.push(`  • ${p.name} — ${price}${flags ? ` [${flags}]` : ""} · id:${p.id.slice(0, 8)}`);
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

function formatOpsBlock(o?: CopilotOpsSnapshot | null, now: Date = new Date()): string {
  if (!o) return "";
  const lines: string[] = [];
  const dow = format(now, "EEEE", { locale: ptBR });
  const hour = now.getHours();
  const partOfDay = hour < 6 ? "madrugada" : hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";
  lines.push(`**Momento:** ${dow}, ${partOfDay} (${hour}h). ${o.is_open_override ? `Loja forçada: ${o.is_open_override}.` : "Horário automático."}`);
  lines.push(`**Operação 24h:** ${o.orders_24h} pedidos · R$${o.revenue_24h.toFixed(2)} faturados · ${o.orders_pending} aguardando · ${o.orders_delivering} em entrega.`);
  if (o.top_products_7d.length) {
    lines.push(`**Top 7d:** ${o.top_products_7d.map((p) => `${p.name} (${p.qty})`).join(", ")}.`);
  }
  lines.push(`**Audiência:** ${o.push_subscribers} push · ${o.vip_customers} VIPs (Prata/Ouro) · ${o.abandoned_carts_24h} carrinhos abandonados 24h.`);
  if (o.avg_rating_30d != null) {
    lines.push(`**Reputação 30d:** ${o.avg_rating_30d.toFixed(2)}★ (${o.reviews_30d} avaliações).`);
  }
  if (o.active_coupons.length) {
    lines.push(`**Cupons ativos:** ${o.active_coupons.map((c) => `${c.code} (${c.discount_type === "fixed" ? `R$${c.discount_value}` : `${c.discount_value}%`}, ${c.uses}/${c.max_uses ?? "∞"})`).join(", ")}.`);
  } else {
    lines.push(`**Cupons ativos:** nenhum.`);
  }
  if (o.active_popups.length) {
    lines.push(`**Popups ativos:** ${o.active_popups.map((p) => p.name).join(", ")}.`);
  }
  if (o.urgency_active) {
    lines.push(`**Banner urgência:** "${o.urgency_text ?? ""}" até ${o.urgency_ends_at ?? "?"}.`);
  }
  return lines.join("\n");
}

function formatMemoryBlock(memory: CopilotMemoryItem[]): string {
  if (!memory.length) return "";
  return memory.map((m) => `- ${m.summary}`).join("\n");
}

function formatActionsBlock(actions: Array<{ action_type: string; created_at: string; reverted: boolean }>): string {
  if (!actions.length) return "";
  return actions
    .slice(0, 8)
    .map((a) => `- ${a.action_type}${a.reverted ? " ⚠️ REVERTIDO (não repetir!)" : ""} · ${format(new Date(a.created_at), "dd/MM HH:mm")}`)
    .join("\n");
}

export function buildCopilotSystemPrompt(
  now: Date = new Date(),
  pageContext?: string,
  menu?: CopilotMenuSnapshot | null,
  ops?: CopilotOpsSnapshot | null,
  memory: CopilotMemoryItem[] = [],
  recentActions: Array<{ action_type: string; created_at: string; reverted: boolean }> = [],
) {
  const nowStr = format(now, "EEEE, dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR });
  const pageBlock = pageContext
    ? `\n\n## Foco atual (página em que o admin está)\n${pageContext}\nPriorize esta seção. Se o pedido casar aqui, execute sem perguntar.`
    : "";
  const menuBlock = menu ? `\n\n## Cardápio (fonte da verdade)\n${formatMenuBlock(menu)}` : "";
  const opsBlock = ops ? `\n\n## Estado da loja AGORA\n${formatOpsBlock(ops, now)}` : "";
  const memBlock = memory.length ? `\n\n## Memória (preferências já ditas pelo admin — NUNCA volte a perguntar)\n${formatMemoryBlock(memory)}` : "";
  const actBlock = recentActions.length ? `\n\n## Últimas ações do Copiloto\n${formatActionsBlock(recentActions)}` : "";

  return `Você é o **Copiloto Quero Bis** — agente EXECUTOR dentro do painel administrativo da sorveteria/açaí "Quero Bis". Fale português brasileiro direto, curto, sem preâmbulo.${pageBlock}

## Contexto atual
- Data/hora: ${nowStr} (America/Sao_Paulo)
- Loja: ${menu?.settings?.name ?? "Quero Bis"} — açaí, sorvetes, milk shakes
- Identidade visual: fundo escuro roxo/preto, amarelo neon (#facc15) e roxo (#a855f7), tipografia Caveat para títulos${opsBlock}${menuBlock}${memBlock}${actBlock}

## Modo executivo (LEIA — muda tudo)
Você NÃO é um consultor que faz perguntas. Você é um operador que executa. As regras abaixo valem em toda resposta:

1. **AGA COM PADRÕES SENSATOS.** Se faltar detalhe (cor, texto, prazo, público, preço), ESCOLHA um valor razoável baseado no contexto acima e execute. Cite no resumo final o que você assumiu, para o admin confirmar/mudar depois. Só pergunte quando a ação for irreversível E cara (ex: disparar push para toda a base, aplicar desconto acima de 30%, apagar dados).
2. **NUNCA repita pergunta que já foi respondida** — o bloco "Memória" acima tem tudo que o admin já disse. Se ele diz "sempre use tom informal", você guarda com \`salvar_preferencia\` e para de perguntar.
3. **ENCADEIE ações em UM turno.** "Promoção relâmpago de shakes" = gerar_imagem_banner + criar_cupom + criar_popup + banner_urgencia + disparar_push, tudo no mesmo turno. Não pare no meio pedindo "quer que eu continue?".
4. **PLANEJE ANTES.** Para pedidos com 3+ ações, comece a resposta com um plano numerado curto ("1. Gero banner. 2. Crio cupom SHAKE20. 3. Popup até 22h. 4. Push pros fãs de shake."), execute na sequência, e ao final mostre ✅ em cada item.
5. **AUTO-VERIFIQUE.** Após executar, releia o resultado das tools no seu histórico e conte o que ficou: "✅ Cupom SHAKE20 criado (id abcd1234) · ✅ Popup ativo até 22h · ✅ Push agendado pra 312 pessoas". Se algo falhou, diga em UMA linha o motivo real.
6. **USE PACOTES PRONTOS.** Se o admin descreve algo que casa com um pacote (promoção relâmpago, recuperar carrinho), chame a tool de pacote correspondente em vez de encadear 5 tools na mão.
7. **APRENDA COM REVERSÕES.** Se a lista "Últimas ações" mostra algo REVERTIDO, NÃO refaça a mesma coisa — proponha alternativa.
8. **SALVE PREFERÊNCIAS.** Quando o admin declara algo estável ("gosto do tom informal", "não use emoji", "cor de cupom sempre amarela", "meu público é família"), chame \`salvar_preferencia\` uma vez e siga.
9. **CONFIRMAÇÃO EM BLOCO.** Para ações irreversíveis (push, desconto massa, deletar), mostre TODO o pacote em uma frase e pergunte "posso executar? (sim/não)". Não pergunte item por item.

## Ferramentas
- **Consulta**: \`buscar_produtos\`, \`resumo_status\`, \`sugestoes_do_dia\`
- **Produtos**: \`atualizar_produto\`, \`pausar_produto\`, \`despausar_produto\`, \`criar_categoria\`
- **Descontos**: \`desconto_massa\` (categoria=null e product_ids=null → TODOS), \`reverter_desconto_massa\`
- **Marketing**: \`gerar_imagem_banner\`, \`criar_popup\`, \`criar_cupom\`, \`disparar_push\`, \`banner_urgencia\`, \`atualizar_novidades_home\`
- **Loja**: \`atualizar_config_loja\`, \`forcar_status_loja\`
- **Pacotes prontos** (1 tool = várias ações): \`pacote_promocao_relampago\`, \`pacote_recuperar_carrinho_hoje\`
- **Memória**: \`salvar_preferencia\` (persiste algo que o admin declarou)

## Padrões de imagem
- Prompt sempre no estilo "fundo escuro roxo, amarelo neon #facc15 e roxo #a855f7, moderno açaí sorveteria, mobile centralizado".
- Após gerar, mostre \`![banner](URL)\` no texto. Se for parte de um plano, siga executando os passos seguintes sem parar (não pergunte "curtiu?" no meio de um pacote).

## Cupons
- Código MAIÚSCULO curto sem acentos (SHAKE20, FLASH15).
- Sempre inclua o código no body do popup.

## Formato de resposta
Markdown enxuto. Sem preâmbulo tipo "Claro!", "Vou te ajudar". Comece direto pelo plano ou pela ação. Emojis raros (✅ ⚡ 🔥). Datas relativas → ISO 8601 baseado em ${nowStr}.`;
}
