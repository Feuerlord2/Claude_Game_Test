// Cache-first service worker: the whole game works offline after first load.
// Bump CACHE_VERSION on every deploy to invalidate old caches.

const CACHE_VERSION = 'sd-v1.4.0';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/game.js',
  './js/physics.js',
  './js/render.js',
  './js/particles.js',
  './js/audio.js',
  './js/haptics.js',
  './js/storage.js',
  './js/daily.js',
  './js/i18n.js',
  './js/share.js',
  './js/ads.js',
  './js/rng.js',
  './manifest.webmanifest',
  // The 512px icons are install-time-only (~600 KB combined) — the runtime
  // fetch handler still caches them on demand, so they stay out of the
  // first-load precache budget.
  './assets/icons/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // cache:'reload' bypasses the HTTP cache — otherwise hosts with max-age
      // (GitHub Pages: 600s) can populate a new CACHE_VERSION with stale bytes,
      // pinning users to a broken mixed deploy forever.
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

// No skipWaiting/clients.claim: the new version activates only once all pages
// using the old one are closed, so a loading page never mixes two versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // never intercept SDK/ad requests

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});
