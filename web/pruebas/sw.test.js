// El service worker de la versión web (web/app/sw.js), con las cachés y la red de mentira. Auditoría del 1-11-2026:
// una versión nueva no se instala sin el código de las pantallas si la de antes lo tenía entero. Si se instalara así y
// se pusiera sin conexión, en el aula, las pantallas no abrirían.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PRECARGA = ['./', 'assets/index-a.js'];
const PRIVADO = ['assets/Notebook-b.js', 'assets/Fichas-c.js'];

function montar({ conSesion, cachesPrevias = {} }) {
  const estado = { conSesion };
  const fuente = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8')
    .replace("'__CACHE__'", "'aulapro-2.0.0-nueva'")
    .replace('= __PRECARGA__;', `= ${JSON.stringify(PRECARGA)};`)
    .replace('= __PRIVADO__;', `= ${JSON.stringify(PRIVADO)};`)
    .replace('= __EXTRA__;', '= [];');
  const almacen = new Map(Object.entries(cachesPrevias).map(([nombre, urls]) => [nombre, new Map(urls.map(u => [u, new Response('1')]))]));
  class RequestFalso { constructor(url) { this.url = typeof url === 'string' ? url : url.url; } }
  // La caché de verdad guarda direcciones absolutas; aquí, relativas a /app/ (como las listas del sw.js), se pidan como se pidan
  const BASE = 'https://aulapro.app/app/';
  const url = r => { const u = typeof r === 'string' ? r : r.url; return u.startsWith(BASE) ? (u.slice(BASE.length) || './') : u; };
  const fetchFalso = async r => {
    if (globalThis.__sinRed) throw new TypeError('Failed to fetch');
    const u = url(r);
    if (PRIVADO.includes(u) && !estado.conSesion) return new Response('hace falta una suscripción', { status: 401 });
    return new Response(`contenido de ${u}`, { status: 200 });
  };
  const abrir = async nombre => {
    if (!almacen.has(nombre)) almacen.set(nombre, new Map());
    const m = almacen.get(nombre);
    return {
      match: async r => m.get(url(r)),
      put: async (r, res) => { m.set(url(r), res); },
      add: async r => { const res = await fetchFalso(r); if (!res.ok) throw new Error(`fallo ${url(r)}`); m.set(url(r), res); },
      keys: async () => [...m.keys()].map(u => ({ url: u })),
    };
  };
  const cachesFalso = { open: abrir, keys: async () => [...almacen.keys()], delete: async n => almacen.delete(n) };
  const oyentes = {};
  const selfFalso = {
    location: new URL('https://aulapro.app/app/sw.js'),
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', 'Request', 'Response', fuente)(selfFalso, cachesFalso, fetchFalso, RequestFalso, Response);
  const instalar = async () => {
    let trabajo;
    oyentes.install({ waitUntil: p => { trabajo = p; } });
    await trabajo;
  };
  const activar = async () => {
    let trabajo;
    oyentes.activate({ waitUntil: p => { trabajo = p; } });
    await trabajo;
  };
  /** Un mensaje de la app («privado», «resto», «activar»). */
  const mensaje = async data => {
    let trabajo;
    oyentes.message({ data, waitUntil: p => { trabajo = p; } });
    await trabajo;
  };
  /** Una petición de la página (GET a una dirección de /app/), como la ve el service worker. */
  const pedir = async (ruta, mode = 'cors') => {
    let respuesta;
    oyentes.fetch({ request: { method: 'GET', url: `https://aulapro.app/app/${ruta}`, mode }, respondWith: p => { respuesta = p; } });
    return respuesta;
  };
  return { instalar, activar, mensaje, pedir, almacen, estado };
}

describe('instalación del service worker', () => {
  it('con sesión guarda todo el código y deja la marca de versión entera', async () => {
    const { instalar, almacen } = montar({ conSesion: true });
    await instalar();
    const nueva = almacen.get('aulapro-2.0.0-nueva');
    for (const u of [...PRECARGA, ...PRIVADO]) expect(nueva.has(u), u).toBe(true);
    expect(nueva.has('./.privado-guardado')).toBe(true);
  });

  it('sin sesión y sin versión anterior (quien aún no ha comprado) se instala solo lo de entrar y comprar', async () => {
    const { instalar, almacen } = montar({ conSesion: false });
    await instalar();
    const nueva = almacen.get('aulapro-2.0.0-nueva');
    expect(nueva.has('assets/index-a.js')).toBe(true);
    expect(nueva.has('assets/Notebook-b.js')).toBe(false);
    expect(nueva.has('./.privado-guardado')).toBe(false);
  });

  it('sin sesión, si la versión anterior estaba entera, no se instala la nueva a medias', async () => {
    const { instalar } = montar({
      conSesion: false,
      cachesPrevias: { 'aulapro-1.9.0-vieja': ['./', 'assets/index-z.js', 'assets/Notebook-y.js', './.privado-guardado'] },
    });
    await expect(instalar()).rejects.toThrow(/sin sesión/);
  });

  it('sin sesión, una versión anterior sin la marca (de antes de este cambio) no lo impide, como hasta ahora', async () => {
    const { instalar } = montar({ conSesion: false, cachesPrevias: { 'aulapro-1.9.0-vieja': ['./', 'assets/index-z.js'] } });
    await expect(instalar()).resolves.toBeUndefined();
  });
});

describe('el código de las pantallas, con y sin suscripción', () => {
  it('instalada sin sesión (antes de comprar), al entrar con licencia el mensaje «privado» completa el código y deja la marca', async () => {
    const { instalar, mensaje, almacen, estado } = montar({ conSesion: false });
    await instalar();
    const nueva = almacen.get('aulapro-2.0.0-nueva');
    expect(nueva.has('assets/Notebook-b.js')).toBe(false);
    await mensaje('privado');   // aún sin sesión: no pasa nada, y no es un fallo
    expect(nueva.has('assets/Notebook-b.js')).toBe(false);
    estado.conSesion = true;   // la app pidió la sesión (platform/sesionWeb.ts) y manda «privado»
    await mensaje('privado');
    for (const u of PRIVADO) expect(nueva.has(u), u).toBe(true);
    expect(nueva.has('./.privado-guardado')).toBe(true);
  });

  it('con sesión, una versión nueva se instala entera aunque la anterior ya lo estuviera, y al activarse borra la anterior', async () => {
    const { instalar, activar, almacen } = montar({
      conSesion: true,
      cachesPrevias: { 'aulapro-1.9.0-vieja': ['./', 'assets/index-z.js', 'assets/Notebook-y.js', './.privado-guardado'] },
    });
    await instalar();
    expect(almacen.get('aulapro-2.0.0-nueva').has('./.privado-guardado')).toBe(true);
    await activar();
    expect([...almacen.keys()]).toEqual(['aulapro-2.0.0-nueva']);
  });

  it('sin conexión, el código guardado se sirve desde el dispositivo; lo que no está guardado va a la red y, si falla, falla', async () => {
    const { instalar, pedir, almacen } = montar({ conSesion: true });
    await instalar();
    expect(await (await pedir('assets/Notebook-b.js')).text()).toBe('contenido de assets/Notebook-b.js');
    expect(await (await pedir('', 'navigate')).text()).toBe('contenido de ./');
    // Fuera de la caché (p. ej. tras olvidarApp, que borra las cachés de AulaPro): sin red, no hay código
    almacen.get('aulapro-2.0.0-nueva').delete('assets/Notebook-b.js');
    globalThis.__sinRed = true;
    try {
      await expect(pedir('assets/Notebook-b.js')).rejects.toThrow();
    } finally { delete globalThis.__sinRed; }
  });
});
