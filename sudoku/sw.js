// sw.js
// -----------------------------------------------------------------------------
// Service Worker for the Sudoku PWA.
//
// Strategy: cache-first for all static assets. On install we pre-cache the
// app shell so the first offline launch works. The activate step cleans up
// any old caches from previous versions.
// -----------------------------------------------------------------------------

const CACHE_NAME = 'sudoku-pwa-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './solver.js',
  './generator.js',
  './main.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache same-origin successful responses.
        if (res && res.status === 200 &&
            new URL(req.url).origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
