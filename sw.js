/* sw.js — My Little WorkBuddy Service Worker
 *
 * Strategy:
 *   - App shell (HTML/CSS/JS/icons/manifest) is pre-cached on install.
 *   - On activate: purge old caches.
 *   - On fetch: network-first for same-origin GET (so updates show up),
 *     fall back to cache if the network fails (so offline still works).
 *   - For external (fonts, etc.) use stale-while-revalidate so the app
 *     keeps working offline but refreshes when online.
 *   - Cross-origin POSTs (e.g. AI API) are never intercepted.
 *
 * Bump CACHE_VERSION whenever the shell changes to invalidate.
 */
const CACHE_VERSION = 'mlwb-v2.0.0';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
  './icons/icon-167.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './css/style.css',
  './js/storage.js',
  './js/ui.js',
  './js/ai.js',
  './js/app.js',
  './js/views/dashboard.js',
  './js/views/todo.js',
  './js/views/schedule.js',
  './js/views/timer.js',
  './js/views/learning.js',
  './js/views/habit.js',
  './js/views/mood.js',
  './js/views/notes.js',
  './js/views/wins.js',
  './js/views/buddyai.js',
  './js/views/food.js',
  './js/views/goals.js',
  './js/views/progress.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use addAll with individual fallbacks so one missing file doesn't
      // break the whole install.
      Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] cache skip:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never handle non-GET

  const url = new URL(req.url);

  // Don't try to cache opaque or non-http(s) requests
  if (!/^https?:$/.test(url.protocol)) return;

  // Same-origin: network first, fall back to cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache successful responses for offline use
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // External (fonts, AI endpoints, etc.):
  // stale-while-revalidate so offline works and content refreshes online.
  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});