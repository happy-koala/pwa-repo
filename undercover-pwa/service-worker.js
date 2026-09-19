/* =========================================================================
 * Undercover PWA – Service Worker
 *
 * Strategy: App-Shell caching.
 *   - On install: pre-cache all static assets (HTML, CSS, JS, manifest, icons).
 *   - On fetch: cache-first for same-origin GET requests, fall back to network.
 *     Update the cache in the background from the network when possible.
 *   - Old caches are cleaned up on activation.
 *
 * Bumping the CACHE_VERSION constant forces a one-time refresh of all
 * clients after a new deploy (clients.claim + skipWaiting in main JS).
 * ========================================================================= */

const CACHE_VERSION = "undercover-v1";
const CACHE_NAME = `${CACHE_VERSION}-shell`;

// Minimal "app shell" – every file the UI needs to boot offline.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
  "./icons/favicon.ico"
];

// Install: open the cache and pre-cache every shell asset.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()) // activate immediately on first install
  );
});

// Activate: drop any old caches left from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim()) // take control of open pages
  );
});

// Fetch: cache-first for our own shell, network-only otherwise (no cross-origin risk).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh the cache in the background so the next visit gets updates.
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        // Opportunistically cache successful same-origin responses.
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
