/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string }> };

precacheAndRoute(self.__WB_MANIFEST);

// Listener para mensagens do cliente (ex: pular espera de atualização)
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Aplica atualização automaticamente quando possível
self.addEventListener("install", (event: ExtendableEvent) => {
  // Força a ativação imediata do novo service worker
  self.skipWaiting();
});

// Ativa o novo service worker imediatamente quando instalado
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      // Notifica todos os clientes sobre a nova versão
      return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          if (client instanceof WindowClient) {
            client.postMessage({ type: "SW_UPDATED" });
          }
        });
      });
    })
  );
});

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let title = "DescompliCAR";
  let body = "";
  let data: { url?: string } = {};
  try {
    const json = event.data.json() as { title?: string; body?: string; url?: string };
    if (json.title) title = json.title;
    if (json.body) body = json.body;
    if (json.url) data.url = json.url;
  } catch {
    body = event.data.text();
  }
  const options: NotificationOptions = {
    body,
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    tag: "descomplicar-push",
    renotify: true,
    data: { url: data.url || "/" },
    requireInteraction: false,
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.navigate(url);
          return (client as WindowClient).focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
