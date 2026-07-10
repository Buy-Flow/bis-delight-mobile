// Push notification handlers, imported by the generated Workbox service worker.
/* eslint-disable no-restricted-globals */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Quero Bis", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Quero Bis";
  const options = {
    body: payload.body || "",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    image: payload.image || undefined,
    data: { url: payload.url || "/", deliveryId: payload.deliveryId || null },
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";

  event.waitUntil(
    (async () => {
      // Ping open endpoint for analytics (best effort)
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
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            await client.navigate(url);
            return client.focus();
          } catch {
            /* ignore navigation errors */
          }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
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
