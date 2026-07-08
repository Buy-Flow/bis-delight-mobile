## Melhorias sugeridas para o Quero Bis

Depois de dar uma olhada geral no site (Hero, Novidades, Destaques, Monte seu açaí, Cardápio, cards de produto), separei em **impacto alto** (o que mais melhora a percepção) e **polimento** (detalhes finos). Você escolhe o que quer aplicar — nada é feito antes da sua aprovação.

---

### 1. Hero (topo) — impacto alto
- **Texto "TRANSFORMA" quebrando em duas linhas** no mobile. Reduzir 1 passo o tamanho no mobile (ex.: `text-6xl` no lugar de `text-7xl`) para caber numa linha só e ficar mais elegante.
- **Botão "QUERO BIS"** pode ter uma leve pulsação/glow amarelo pra virar CTA principal (hoje se perde no meio do texto).
- **Barra de benefícios** (Entrega rápida / Produtos / Feito com amor): textos estão espremidos com quebras estranhas ("os melhores ingredientes" ficou "osmelhores"). Ajustar padding/espaçamento.

### 2. Cards de produto no cardápio — impacto alto
- Fundo roxo dos cards tem **listras diagonais visíveis** (mesmo problema de transição de cor que resolvemos no fundo). Trocar por gradiente liso ou um brilho radial suave.
- Selo "A PARTIR DE R$ XX" amarelo está **cobrindo parte da imagem do produto**. Reposicionar pra baixo do card ou tornar menor.
- Botão coração (favoritar) e botão "+" competem visualmente com o preço. Padronizar tamanhos.

### 3. Seção Destaques — polimento
- Carrossel mostra só 1 card e um "espião" cortado do próximo. Bom no mobile, mas os **dots de paginação** podiam ser mais visíveis (hoje quase somem no fundo escuro).
- Tag "TOP" amarela poderia ter um leve movimento (shine) pra chamar atenção sem exagero.

### 4. Consistência tipográfica — polimento
- Hoje misturamos: script (Sabor que / Rápido Prático), display bold (TRANSFORMA / NOSSAS NOVIDADES), sans regular (descrições). Está bom, mas o **script "acabou de sair!"** ao lado de "NOSSAS NOVIDADES" fica pequeno demais no mobile — subir 1 tamanho.
- Palavras destacadas em amarelo/rosa (irresistível, colher, DESTAQUES, CARDÁPIO) — manter só **uma cor de destaque por seção** pra dar ritmo.

### 5. Performance e SSR — técnico
- Verificar se as imagens grandes do hero (sorvete e copo Bis) estão com `loading="eager"` e `fetchpriority="high"`, e as demais com `loading="lazy"`. Ganha LCP.
- Confirmar `<title>` e `meta description` únicos por rota (hoje o root talvez esteja sobrescrevendo).

### 6. Micro-interações — polimento
- Botões "Personalizar" e "+" ganharem **feedback tátil** (scale 0.97 no press) — dá sensação de app.
- Ícones da CategoryStrip (Tudo/Açaí/Taças/Mix/Kids) com leve **elevação no ativo** em vez de só borda.

### 7. WhatsApp flutuante — polimento
- Está bom, mas o **círculo verde** cobre preço/coração nos cards da direita quando rola. Deslocar levemente pra baixo ou adicionar um padding-bottom no grid.

---

### O que eu sugiro fazer primeiro (se pedir só "faz o melhor")
1. Corrigir listras diagonais dos cards de produto (mesmo tratamento do fundo).
2. Ajustar o Hero mobile ("TRANSFORMA" numa linha + barra de benefícios).
3. Reposicionar o selo de preço pra não cobrir a imagem.
4. Empurrar o botão do WhatsApp pra não cobrir os cards.

Me diga **quais itens você quer** (pode ser "1, 2, 3", "todos", ou "só os de impacto alto") que eu preparo um plano de execução detalhado.