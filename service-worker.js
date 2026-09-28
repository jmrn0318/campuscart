// Bump this number on every deploy that changes cached files.
// (Even if you forget, pages/scripts/styles are fetched network-first below,
//  so users still get fresh files whenever they are online.)
const CACHE_NAME = 'campuscart-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/manifest.json'
];

// Pre-cache the core files (one by one, so a single missing file
// doesn't make the whole install fail).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(urlsToCache.map((url) => cache.add(url).catch(() => {})))
    )
  );
  // Activate the new worker right away instead of waiting for all tabs to close.
  self.skipWaiting();
});

// Delete every old cache (e.g. campuscart-v1) and take control of open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Network-first: always try the server for the latest file,
// and only fall back to the cached copy when offline.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore anything that isn't a plain same-site GET
  // (Firebase / Firestore / Google APIs, POSTs, etc. go straight to the network).
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    // 'no-cache' makes the browser revalidate instead of reusing its own HTTP cache
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});