/*
 * Service Worker for the main "Für Mama" PWA hub.
 *
 * Strategy:
 *  - Stale-while-revalidate for precached core assets of the hub page.
 *  - Network-first for /fuer-mama/solitaire/ and /fuer-mama/sudoku/
 *    so the sub-apps can serve themselves with their own service workers.
 *  - No offline fallback page; the hub page works fully offline from cache.
 */

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CACHE_NAME = 'fuer-mama-v1';

// Critical files belonging to the hub that should be available offline.
const PRECACHE_URLS = [
  '/fuer-mama/',
  '/fuer-mama/index.html',
  '/fuer-mama/style.css',
  '/fuer-mama/app.js',
  '/fuer-mama/manifest.json',
  '/fuer-mama/icon-192.png',
  '/fuer-mama/icon-512.png',
];

// URL prefixes that belong to sub-apps with their own service workers.
// The hub service worker must not interfere with them – pass requests through
// to the network so each sub-app's SW can handle its own scope.
const SUBAPP_PREFIXES = [
  '/fuer-mama/solitaire/',
  '/fuer-mama/sudoku/',
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isSubAppRequest(requestUrl) {
  return SUBAPP_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix));
}

function isPrecached(requestUrl) {
  return PRECACHE_URLS.some((url) => {
    // Normalize trailing slashes for comparison.
    const normalized = requestUrl.pathname.endsWith('/') && url !== '/fuer-mama/'
      ? requestUrl.pathname
      : requestUrl.pathname;
    return normalized === url || normalized === url + '/';
  });
}

// -----------------------------------------------------------------------------
// Install: precache the core hub assets
// -----------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll so that if any resource fails, the whole install fails.
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Activate this version immediately after the install completes.
      return self.skipWaiting();
    })
  );
});

// -----------------------------------------------------------------------------
// Activate: clean up old caches belonging to previous versions
// -----------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('fuer-mama-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Start controlling existing clients without requiring a reload.
      return self.clients.claim();
    })
  );
});

// -----------------------------------------------------------------------------
// Fetch:
//   - Sub-app requests: network-first (fall back to cache only if offline)
//     so each sub-app's own service worker can run in its scope.
//   - Precache matches: stale-while-revalidate.
//   - Everything else (runtime GETs): try cache, then network.
// -----------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests; let everything else go to the network.
  if (request.method !== 'GET') {
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch (e) {
    return;
  }

  // Restrict handling to our own scope to avoid touching cross-origin assets.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // 1) Sub-apps: network-first so their own service workers stay in control.
  if (isSubAppRequest(requestUrl)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2) Precache matches: stale-while-revalidate.
  if (isPrecached(requestUrl)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3) Other same-origin GETs: cache-first with network fallback.
  event.respondWith(cacheFirst(request));
});

// -----------------------------------------------------------------------------
// Caching strategies
// -----------------------------------------------------------------------------

// Stale-while-revalidate: return cached version immediately (if any),
// then fetch from network in the background and update the cache.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed; keep what we have (may be undefined).
      return cachedResponse;
    });

  return cachedResponse || networkFetch;
}

// Network-first: try the network; fall back to cache when offline.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw err;
  }
}

// Cache-first for generic runtime assets within the hub scope.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}
