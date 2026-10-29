/*
 * AulaPro, versión web (aulapro.app/app/): que funcione sin conexión, en el
 * patio o en un aula sin wifi. Guarda la app entera la primera vez y después
 * la sirve desde el dispositivo. Los datos del docente no pasan por aquí: van
 * en IndexedDB (src/platform/web.ts).
 *
 * `__CACHE__` y `__PRECARGA__` los rellena vite.config.ts al compilar en modo
 * `web`. Una versión nueva se instala en segundo plano y espera: la app avisa
 * («Reiniciar y actualizar») y, al pulsar, manda «activar».
 */
const CACHE = '__CACHE__';
const PRECARGA = __PRECARGA__;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Por tandas, y sin la caché HTTP del navegador: que no se mezcle una versión con otra
    for (let i = 0; i < PRECARGA.length; i += 40) {
      await cache.addAll(PRECARGA.slice(i, i + 40).map(url => new Request(url, { cache: 'reload' })));
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith('aulapro-') && nombre !== CACHE) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'activar') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo lo de la app; la licencia (/api/) y lo de fuera (Gemini, el calendario) van a la red
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;

  if (req.mode === 'navigate') {
    // La app es una sola página
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('index.html')) ?? fetch(req);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(req, { ignoreSearch: true });
    if (guardada) return guardada;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  })());
});
