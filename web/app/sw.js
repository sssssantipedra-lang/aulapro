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

/**
 * Chrome no deja abrir una página con una respuesta que viene de una
 * redirección (ERR_FAILED), y Cloudflare redirige /app/index.html a /app/:
 * la página se guarda como './' y, por si acaso, cualquier respuesta
 * redirigida se copia limpia antes de servirla.
 */
const limpia = res => (res && res.redirected
  ? res.blob().then(cuerpo => new Response(cuerpo, { status: res.status, statusText: res.statusText, headers: res.headers }))
  : res);

/** Las versiones del 29-10-2026 por la mañana guardaban la página redirigida y ya no abrían: hay que sustituirlas sin esperar. */
async function hayVersionRota() {
  for (const nombre of await caches.keys()) {
    if (!nombre.startsWith('aulapro-') || nombre === CACHE) continue;
    const c = await caches.open(nombre);
    if ((await c.keys()).some(r => r.url.endsWith('/index.html'))) return true;
  }
  return false;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Por tandas, y sin la caché HTTP del navegador: que no se mezcle una versión con otra
    for (let i = 0; i < PRECARGA.length; i += 40) {
      await cache.addAll(PRECARGA.slice(i, i + 40).map(url => new Request(url, { cache: 'reload' })));
    }
    if (await hayVersionRota()) await self.skipWaiting();
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
    // La app es una sola página: si está guardada, esa; si no, o si algo falla, la de la red
    event.respondWith((async () => {
      try {
        const pagina = await (await caches.open(CACHE)).match('./');
        if (pagina) return await limpia(pagina);
      } catch { /* a la red */ }
      return fetch(req);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(req, { ignoreSearch: true });
    if (guardada) return limpia(guardada);
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  })());
});
