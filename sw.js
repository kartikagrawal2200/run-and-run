const CACHE_NAME = 'subway-surf-3d-v18';
const STATIC_ASSETS = [
  './',
  './index.html?v=subway3d_v18',
  './style.css?v=subway3d_v18',
  './game.js?v=subway3d_v18',
  './audio.js?v=subway3d_v18',
  './manifest.webmanifest',
  './pwa.js?v=subway3d_v18',
  './icon.svg',
  './splash.png?v=subway3d_v18'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy: Always fetch fresh code from network if online
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(req))
  );
});
