/* PWA: только push. Не перехватываем fetch — на телефоне это давало белый экран. */
const CACHE = "maya-shell-v16";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.delete(CACHE).catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function parsePushPayload(event) {
  let title = "Мая";
  let body = "Напоминание";
  let url = "/";
  let tag = "maya";
  try {
    const data = event.data ? event.data.json() : {};
    title = data.title || title;
    body = data.body || body;
    url = data.url || url;
    tag = data.tag || tag;
  } catch {
    try {
      body = event.data ? event.data.text() : body;
    } catch {
      /* ignore */
    }
  }
  return { title, body, url, tag };
}

function showIfAway(title, body, tag, url) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => {
      const looking = list.some((c) => c.visibilityState === "visible");
      if (looking) return;
      return self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        data: { url },
      });
    });
}

self.addEventListener("push", (event) => {
  const { title, body, url, tag } = parsePushPayload(event);
  event.waitUntil(showIfAway(title, body, tag, url));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client && url) {
            try {
              client.navigate(url);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "LIVE_TIMER" && data.title) {
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "maya-live-timer",
        silent: true,
        renotify: true,
        data: { url: data.url || "/" },
      }),
    );
    return;
  }
  if (data.type === "LIVE_TIMER_CLEAR") {
    event.waitUntil(
      self.registration
        .getNotifications({ tag: "maya-live-timer" })
        .then((list) => {
          for (const n of list) n.close();
        }),
    );
    return;
  }
  if (data.type === "SHOW_NOTIFICATION" && data.title) {
    event.waitUntil(
      showIfAway(
        data.title,
        data.body || "",
        data.tag || "maya",
        data.url || "/",
      ),
    );
  }
});
