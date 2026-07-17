// Service worker for HIT Training Protocol.
// v2: network-first for the HTML shell (index.html / navigation requests), so a new deploy on
// GitHub Pages is picked up on the very next load instead of being stuck behind a stale cache.
// Static assets (manifest, icons) stay cache-first since they rarely change and this keeps the
// app installable/offline-capable.
//
// IMPORTANT for future updates: bump CACHE_NAME (e.g. v3, v4, ...) every time you deploy a new
// index.html. This forces the old cache to be discarded on activate, so even the network-first
// fetch below always has a byte-for-byte fresh copy to fall back to if the user goes offline
// right after an update.
const CACHE_NAME = "hit-training-v2";
const ASSETS = ["./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isHtmlShell = event.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname === "/" || url.pathname.endsWith("/");

  if (isHtmlShell) {
    // Network-first: always try to fetch the latest index.html. Only fall back to whatever we
    // have cached if the network request fails (e.g. truly offline).
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (manifest, icons, Tailwind CDN, etc.): cache-first as before.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
