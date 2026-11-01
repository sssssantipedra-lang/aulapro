// El service worker de la versión web (web/app/sw.js), con las cachés y la red de mentira. Auditoría del 1-11-2026:
// una versión nueva no se instala sin el código de las pantallas si la de antes lo tenía entero. Si se instalara así y
// se pusiera sin conexión, en el aula, las pantallas no abrirían.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PRECARGA = ['./', 'assets/index-a.js'];
const PRIVADO = ['assets/Notebook-b.js', 'assets/Fichas-c.js'];

function montar({ conSesion, cachesPrevias = {} }) {
  const fuente = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8')
    .replace("'__CACHE__'", "'aulapro-2.0.0-nueva'")
    .replace('= __PRECARGA__;', `= ${JSON.stringify(PRECARGA)};`)
    .replace('= __PRIVADO__;', `= ${JSON.stringify(PRIVADO)};`)
    .replace('= __EXTRA__;', '= [];');
  const almacen = new Map(Object.entries(cachesPrevias).map(([nombre, urls]) => [nombre, new Map(urls.map(u => [u, new Response('1')]))]));
  class RequestFalso { constructor(url) { this.url = typeof url === 'string' ? url : url.url; } }
  const url = r => (typeof r === 'string' ? r : r.url);
  const fetchFalso = async r => {
    const u = url(r);
    if (PRIVADO.includes(u) && !conSesion) return new Response('hace falta una suscripción', { status: 401 });
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
    location: { href: 'https://aulapro.app/app/sw.js' },
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', 'Request', 'Response', fuente)(selfFalso, cachesFalso, fetchFalso, RequestFalso, Response);
  const instalar = async () => {
    let trabajo;
    oyentes.install({ waitUntil: p => { trabajo = p; } });
    await trabajo;
  };
  return { instalar, almacen };
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
