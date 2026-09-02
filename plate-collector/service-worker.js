const CACHE_NAME = 'kennzeichen-sammler-v0.1.14';
const APP_SHELL = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/plates-data.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((asset) => cache.add(asset).catch((error) => {
        // Platzhalter-Icons dürfen bis zum Nachreichen der PNGs fehlen.
        console.warn(`App-Shell-Asset nicht gecacht: ${asset}`, error);
      }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('./index.html')))
  );
});

// Bei jedem App-Update CACHE_NAME (z. B. auf -v2) hochzählen.
