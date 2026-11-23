/* Мая SW v18: push + аккуратный офлайн-кэш оболочки.
   /api не кэшируем. HTML — network-first (чтобы не было белых экранов от старых чанков).
   Статика /_next/static и иконки — cache-first. */
const CACHE = "maya-shell-v18";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  if (url.pathname.startsWith("/avatars/")) return true;
  if (url.pathname.startsWith("/banners/")) return true;
  if (url.pathname.startsWith("/demo/")) return true;
  if (/\.(png|jpg|jpeg|webp|svg|ico|wav|woff2?)$/i.test(url.pathname)) {
    return true;
  }
  return false;
}

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      (request.headers.get("accept") || "").includes("text/html"))
  );
}

async function networkFirst(request, { fallbackUrl } = {}) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      void cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const offline = await cache.match(fallbackUrl);
      if (offline) return offline;
    }
    return new Response("Нет интернета. Попробуйте позже.", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      void cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request, { fallbackUrl: "/offline.html" }));
    return;
  }

  if (isStaticAsset(url) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Прочие same-origin GET (страницы-чанки RSC и т.п.) — network-first без жёсткого offline.html
  event.respondWith(networkFirst(request));
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

function showNotice(title, body, tag, url) {
  return self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: tag || "maya",
    renotify: true,
    data: { url: url || "/" },
  });
}

self.addEventListener("push", (event) => {
  const { title, body, url, tag } = parsePushPayload(event);
  event.waitUntil(showNotice(title, body, tag, url));
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
      showNotice(
        data.title,
        data.body || "",
        data.tag || "maya",
        data.url || "/",
      ),
    );
  }
});
