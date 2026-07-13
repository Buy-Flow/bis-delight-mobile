# 5 melhorias visíveis no painel e no cardápio

1. **🔍 Busca global Cmd+K no admin** — novo `CommandPalette.tsx` acionado por Cmd/Ctrl+K em qualquer tela. Busca pedidos (id/nome/telefone), clientes (nome/telefone/CPF), produtos (nome), + atalhos pra todas as seções. Integrado no `AdminShell.tsx`.

2. **🌡️ Termômetro de frete grátis + timer de reserva** no `/finalizar` e `/carrinho` — barra "Faltam R$X pra frete grátis" e "reservamos por 15min".

3. **🔊 Som de novo pedido no Rush** — beep quando pedido novo entra + toggle liga/desliga persistente por dispositivo.

4. **🗺️ Mapa único de motoboys em `/entregas`** — bloco no topo com Leaflet mostrando todos os motoboys online em realtime (`courier_locations`), pino colorido por status, clique abre o pedido atribuído.

5. **🚀 Página `/rastrear/$orderId`** — mapa em tempo real com pin do motoboy + ETA + timeline + botão WhatsApp do motoboy. Link enviado ao cliente quando "saiu pra entrega".

## Fora deste plano

- QR PIX no PDV — depende dos secrets do Asaas.
- Configurador visual do açaí — precisa dos PNGs de camadas.
