/* Service Worker di Farkle — caching offline dell'app shell.
   Strategia: cache-first per le risorse statiche, con fallback a index.html. */

const CACHE = 'farkle-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-180.png',
  './icons/favicon-32.png',
];

// Installazione: pre-cache di tutte le risorse.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Attivazione: rimuove le cache di versioni precedenti.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve dalla cache, altrimenti dalla rete; fallback a index.html.
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(resp => {
        // memorizza in cache le nuove richieste GET valide (stesso origine)
        if(resp && resp.status === 200 && resp.type === 'basic'){
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
