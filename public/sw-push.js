// Push notification handlers, imported by the generated Workbox service worker.
/* eslint-disable no-restricted-globals */

function truncate(str, n) {
  if (!str) return "";
  const s = String(str);
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Quero Bis", body: event.data ? event.data.text() : "" };
  }

  const isOrder = payload.kind === "order" || /novo pedido/i.test(payload.title || "");
  const title = truncate(payload.title || "Quero Bis 💜", 60);
  const body = truncate(payload.body || "", 140);

  const actions = isOrder
    ? [
        { action: "open", title: "Ver pedido" },
        { action: "dismiss", title: "Depois" },
      ]
    : [
        { action: "open", title: "Abrir" },
        { action: "dismiss", title: "Dispensar" },
      ];

  const options = {
    body,
    icon: "/pwa-192.png",
    badge: "/badge-72.png",
    image: payload.image || undefined,
    tag: payload.tag || (isOrder ? "qb-order" : "qb-campaign"),
    renotify: true,
    requireInteraction: isOrder,
    silent: false,
    vibrate: isOrder ? [200, 80, 200, 80, 300] : [120, 60, 120],
    timestamp: Date.now(),
    lang: "pt-BR",
    dir: "auto",
    actions,
    data: {
      url: payload.url || (isOrder ? "/pedidos" : "/"),
      deliveryId: payload.deliveryId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const data = event.notification.data || {};
  const scope = self.registration.scope || self.location.origin + "/";
  let targetUrl;
  try {
    targetUrl = new URL(data.url || "/", scope).href;
  } catch {
    targetUrl = scope;
  }

  event.waitUntil(
    (async () => {
      if (data.deliveryId) {
        try {
          const supabaseUrl = self.__SUPABASE_URL || "";
          const supabaseKey = self.__SUPABASE_ANON || "";
          if (supabaseUrl && supabaseKey) {
            await fetch(`${supabaseUrl}/rest/v1/rpc/mark_push_opened`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({ _delivery_id: data.deliveryId }),
              keepalive: true,
            });
          }
        } catch {
          /* noop */
        }
      }

      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Prefer a client already on the target URL
      for (const client of allClients) {
        if (client.url === targetUrl && "focus" in client) {
          try {
            return await client.focus();
          } catch {
            /* try next */
          }
        }
      }

      // Otherwise navigate the first available client
      for (const client of allClients) {
        try {
          if ("navigate" in client) {
            const navigated = await client.navigate(targetUrl);
            if (navigated) return await navigated.focus();
          }
          if ("focus" in client) return await client.focus();
        } catch {
          /* try next */
        }
      }

      if (self.clients.openWindow) {
        try {
          return await self.clients.openWindow(targetUrl);
        } catch {
          return await self.clients.openWindow(scope);
        }
      }
    })(),
  );
});

// Listen for a config message from the page so we know the API endpoint / anon key.
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "SUPABASE_CONFIG") {
    self.__SUPABASE_URL = msg.url;
    self.__SUPABASE_ANON = msg.anon;
  }
});
