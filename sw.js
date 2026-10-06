const CACHE_NAME = 'otaku-world-v1.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/firebase.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Pour les pages et ressources statiques : Cache d'abord avec repli réseau
  if (STATIC_ASSETS.includes(url.pathname) || url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
    return;
  }

  // Pour les requêtes images AniList / externes : Stratégie Stale-While-Revalidate
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(e.request).then((cachedResponse) => {
          const fetchPromise = fetch(e.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(e.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        })
      )
    );
    return;
  }

  // Requêtes réseau standards avec secours
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
