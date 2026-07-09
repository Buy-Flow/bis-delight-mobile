
# Objetivo
Fazer o site pintar de uma vez — texto, Hero, cards e rodapé aparecendo juntos — em vez de em ondas.

# Causa
A rota `/` só busca produtos, categorias e configurações **depois** que o HTML já foi renderizado (`useQuery` puro no cliente). Cada query resolve num momento diferente e cada imagem chega quando quer. Sem `aspect-ratio` nos `<img>`, cada foto que chega empurra o layout.

# O que vou mudar

## 1. Pré-carregar dados no loader da rota (principal)
Em `src/routes/index.tsx`:
- `loader: async ({ context }) => { await Promise.all([ ensureQueryData(products), ensureQueryData(categories), ensureQueryData(siteSettings) ]); return { heroImages, texture } }`.
- No SSR o HTML já sai com os dados hidratados → sem "pop-in" de conteúdo nem de layout.
- Component lê com `useSuspenseQuery` (padrão canônico Router + Query).

## 2. Preload da imagem LCP e das laterais no `head()` da rota `/`
Usando `head({ loaderData }).links` (per-route, não sitewide):
- `{ rel: "preload", as: "image", href: heroImages.left.url, fetchpriority: "high" }` — a imagem esquerda é a LCP candidata.
- `{ rel: "preload", as: "image", href: heroImages.right.url }` (sem `fetchpriority`, só uma LCP).
- `{ rel: "preload", as: "image", href: texture }`.

## 3. Reservar espaço nos elementos com imagem
Prevenir layout shift:
- `Hero.tsx`: dimensões explícitas e `aspect-ratio` nos `<img>` laterais.
- `ProductCard.tsx`, `NewsCarousel.tsx` (`NewsPosterCard`) e `HighlightCard.tsx`: `aspect-ratio` + `width`/`height` nos `<img>` e fundo roxo da marca como placeholder.

## 4. Fontes sem trocar de peso
No `__root.tsx` (sitewide — Google Fonts é usado em todas as rotas):
- `<link rel="preconnect" href="https://fonts.googleapis.com">`
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
- Garantir `&display=swap` no `<link>` das Google Fonts.
- `<link rel="preload" as="font" crossorigin>` para a Barlow Condensed 900 (usada no título do Hero, tipografia mais visível).

## 5. Placeholders coloridos
Fundo roxo da marca por trás da imagem dos cards para eles já parecerem "cheios" antes da foto baixar.

## 6. Splash opcional
Só se após 1–5 ainda ficar irregular: overlay com logo que some quando `document.readyState === "complete"`. Provavelmente desnecessário depois dos passos anteriores.

# Detalhes técnicos
- `ensureQueryData` respeita o `staleTime` das queries — sem refetch extra.
- LCP: só um `fetchpriority: "high"` por página (imagem esquerda do Hero).
- Preloads de imagens ficam no `head()` da rota `/`, nunca no `__root.tsx`, para não penalizar outras rotas.
- Nenhum dado sensível no HTML — produtos/settings já são públicos.
- Sem alteração em carrinho, checkout, admin ou backend.

# Ordem
1. Loader + `ensureQueryData` (70% do problema)
2. Preload de imagens no `head()` da rota `/` (LCP com `fetchpriority: "high"`)
3. `aspect-ratio` nos `<img>` de Hero e cards
4. Fontes (`preconnect` + `preload` + `display=swap`) no `__root.tsx`
5. Placeholders coloridos nos cards
6. Reavaliar; splash só se necessário

# Fora de escopo
- Converter PNGs para WebP/AVIF e trocar CDN de imagens (posso propor em plano separado se ainda pesar).
- Lógica de negócio.
