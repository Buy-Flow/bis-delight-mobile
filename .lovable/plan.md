# Notificações Push para clientes com app instalado

Quando alguém instala o Quero Bis no celular, você (admin) poderá disparar notificações que chegam direto na tela, mesmo com o app fechado. Uso ideal: promoções, novidades, cupom especial, aviso de "chegou o sabor X".

## Fluxo pro cliente
1. Cliente instala o app (já existe).
2. Ao abrir, aparece um card discreto: "Quer receber ofertas e novidades?" → botão **Ativar notificações**.
3. Navegador pede permissão. Se aceitar, o dispositivo dele fica registrado no banco.
4. Ele pode desativar quando quiser (mesmo card vira "Desativar").

## Fluxo pro admin
Nova aba **Notificações** no painel admin com:
- Campo **Título** e **Mensagem**.
- Campo opcional **Link** (ex.: abrir uma categoria ou produto ao tocar).
- Campo opcional **Imagem** (aparece na notificação em Android).
- Filtros do público: **Todos**, **Só quem comprou nos últimos 30 dias**, **Aniversariantes do mês**, **Sem compra há 60+ dias**.
- Preview de como fica na tela e contador de "vai chegar em X dispositivos".
- Botão **Enviar agora**.
- Histórico das últimas campanhas com quantos receberam / quantos abriram.

## Detalhes técnicos

Backend (Lovable Cloud):
- Nova tabela `push_subscriptions` (user_id nullable, endpoint, p256dh, auth, user_agent, created_at, last_seen_at). RLS: usuário insere/deleta a própria; admin lê tudo.
- Nova tabela `push_campaigns` (título, corpo, url, image, filtro, sent_count, opened_count, created_by, created_at). RLS: só admin.
- Nova tabela `push_deliveries` (campaign_id, subscription_id, status, opened_at) para métricas e limpar assinaturas quebradas.
- Chaves VAPID: gero um par com `generate_secret` e salvo `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`. A pública vai pro frontend via `site_settings` (ou variável pública) — é seguro expor.
- Edge Function `send-push` (admin-only, valida `has_role('admin')`): recebe campaign_id, busca assinaturas pelo filtro e envia via Web Push protocol usando as chaves VAPID. Marca inválidas (410/404) pra remoção. Atualiza `sent_count`.
- Edge Function pública `push-opened` (chamada pelo service worker no clique) só incrementa `opened_count`.

Frontend:
- `src/lib/push.ts`: helpers `subscribeToPush()` / `unsubscribeFromPush()` usando `serviceWorker.pushManager` + a chave pública VAPID.
- Componente `PushOptInCard` na home (só aparece se app instalado + permissão ainda não decidida ou revogada).
- Service worker já existe (vite-plugin-pwa); adiciono handlers `push` (mostra notificação com título/corpo/imagem/data) e `notificationclick` (abre a URL e faz ping em `push-opened`). Como o plugin gera o SW, uso `injectManifest` mode ou custom `additionalManifestEntries` — na verdade migro pra `injectManifest` só se preciso; caso contrário uso `workbox.runtimeCaching` + um handler push adicional via `importScripts` no `src/sw-push.js`.
- Página admin `/notificacoes` com o formulário, preview e histórico.

Notas importantes:
- **iOS**: só recebe push se o usuário **instalou o app na tela inicial** (iOS 16.4+). No Safari normal não funciona. Vou avisar isso no card de opt-in.
- **Android/Chrome/Edge**: funciona no navegador e no app instalado.
- Sem envio agendado nesta primeira versão — só "enviar agora". Se quiser agendar depois, adiciono `scheduled_for` + cron.
- Sem segmentação por produto favorito nesta versão (dá pra adicionar depois).

## Ordem de implementação
1. Migração das 3 tabelas + RLS + grants.
2. Gerar VAPID keys e salvar como secrets.
3. Edge Function `send-push` + `push-opened`.
4. Service worker: handlers de `push` e `notificationclick`.
5. Frontend: helpers + card de opt-in na home.
6. Painel admin `/notificacoes`.
7. Teste ponta-a-ponta enviando pra minha própria assinatura de preview.

Posso seguir?