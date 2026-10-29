/*
 * AulaPro, versión web (aulapro.app/app/): que funcione sin conexión, en el
 * patio o en un aula sin wifi. Guarda la app entera la primera vez y después
 * la sirve desde el dispositivo. Los datos del docente no pasan por aquí: van
 * en IndexedDB (src/platform/web.ts).
 *
 * `__CACHE__`, `__PRECARGA__` y `__EXTRA__` los rellena vite.config.ts al
 * compilar en modo `web`. Una versión nueva se descarga en segundo plano y
 * espera: la app la pone al abrirse la próxima vez (manda «activar»), sin
 * avisos.
 *
 * Se instala solo lo imprescindible para abrir (código, estilos, fuentes: unos
 * 9 MB). Los dibujos y pictogramas (otros 9 MB) se bajan después, cuando la
 * app ya funciona sin conexión: si la instalación pide 18 MB de golpe y el móvil
 * la corta o un archivo falla, no queda nada guardado y sin internet no abre.
 */
const CACHE = '__CACHE__';
const PRECARGA = __PRECARGA__;
const EXTRA = __EXTRA__;
/** Se guarda en la caché cuando ya están todos los de EXTRA: la app lo mira para decir «Lista». */
const MARCA = './.todo-guardado';

/** Guarda un archivo sin la caché HTTP del navegador (que no se mezcle una versión con otra), con un reintento por si la red del móvil falla. */
async function guardar(cache, url) {
  const pedir = () => cache.add(new Request(url, { cache: 'reload' }));
  try { await pedir(); } catch {
    await new Promise(r => setTimeout(r, 600));
    await pedir();
  }
}

let bajando = null;
/** Baja lo que falta de EXTRA; se puede repetir: sigue donde se quedó. */
function bajarExtra() {
  if (!bajando) {
    bajando = (async () => {
      const cache = await caches.open(CACHE);
      if (await cache.match(MARCA)) return;
      const faltan = [];
      for (const url of EXTRA) if (!(await cache.match(url))) faltan.push(url);
      let fallos = 0;
      for (let i = 0; i < faltan.length; i += 12) {
        await Promise.all(faltan.slice(i, i + 12).map(url => guardar(cache, url).catch(() => { fallos++; })));
      }
      if (!fallos) await cache.put(MARCA, new Response('1'));
    })().catch(() => {}).finally(() => { bajando = null; });
  }
  return bajando;
}

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
    // Por tandas
    for (let i = 0; i < PRECARGA.length; i += 40) {
      await Promise.all(PRECARGA.slice(i, i + 40).map(url => guardar(cache, url)));
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
  // La app lo manda al abrirse: así lo que quedó a medias se retoma
  if (event.data === 'resto') event.waitUntil(bajarExtra());
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
