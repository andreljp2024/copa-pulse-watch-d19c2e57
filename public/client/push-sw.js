// Handler de Web Push nativo — importado pelo SW gerado pelo vite-plugin-pwa.
/* eslint-disable no-restricted-globals */
self.addEventListener("push", (event) => {
  let data = { title: "Bolão AI", body: "Nova notificação", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
      vibrate: [100, 50, 100],
      tag: data.tag || "bolao-notif",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.navigate(url).then(() => c.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
