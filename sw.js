const CACHE = 'viaje-v7';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/db.js',
  './js/icons.js',
  './js/ui.js',
  './js/store.js',
  './js/sync.js',
  './js/storage.js',
  './js/settings.js',
  './js/platform.js',
  './js/geo.js',
  './js/ai.js',
  './js/seed.js',
  './js/modules/common.js',
  './js/modules/hoy.js',
  './js/modules/itinerario.js',
  './js/modules/lugares.js',
  './js/modules/gastos.js',
  './js/modules/hospedajes.js',
  './js/modules/mas.js',
  './js/modules/asistente.js',
  './js/modules/documentos.js',
  './js/modules/checklist.js',
  './js/modules/notas.js',
  './js/modules/enlaces.js',
  './js/modules/ajustes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.endsWith('/sw.js')) return;

  if (sameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request)
            .then((res) => res.ok && caches.open(CACHE).then((c) => c.put(request, res.clone())))
            .catch(() => {});
          return cached;
        }
        return fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => Response.error()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
