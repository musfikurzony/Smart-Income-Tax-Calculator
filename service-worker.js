// Smart Income Tax Calculator – Advanced PWA Service Worker
const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `smart-tax-cache-${CACHE_VERSION}`;

const FILES_TO_CACHE = [
  "/Smart-Income-Tax-Calculator/",
  "/Smart-Income-Tax-Calculator/index.html",
  "/Smart-Income-Tax-Calculator/manifest.json",
  "/Smart-Income-Tax-Calculator/icons/icon-192.png",
  "/Smart-Income-Tax-Calculator/icons/icon-512.png"
];

// INSTALL
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedRes => {
      if (cachedRes) return cachedRes;

      return fetch(event.request)
        .then(networkRes => {
          if (!networkRes || networkRes.status !== 200) return networkRes;

          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, networkRes.clone())
          );

          return networkRes;
        })
        .catch(() => cachedRes);
    })
  );
});

// SKIP WAITING handler
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
