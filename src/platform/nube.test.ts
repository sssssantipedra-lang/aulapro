import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDriveFs, vaADrive, VERSIONES_GUARDADAS } from './driveFs';
import { createOneDriveFs } from './oneDriveFs';
import { createEspejo } from './espejo';
import { createProfileStore, type Fs } from './profileStore';
import type { Kv } from './webFs';

afterEach(() => { vi.useRealTimers(); });

const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

/** Un Drive de mentira con versiones: cada subida a un archivo existente añade una. La última no se puede borrar. */
function driveConVersiones(opts: { sinPermisoDeVersiones?: boolean } = {}) {
  const files = new Map<string, string>();
  const versiones = new Map<string, { id: string; modifiedTime: string }[]>();
  const llamadas: string[] = [];
  let n = 0, t = 0;
  const nueva = (id: string) => { versiones.get(id)!.push({ id: `v${++n}`, modifiedTime: new Date(++t * 1000).toISOString() }); };
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url); const met = init.method ?? 'GET';
    llamadas.push(`${met} ${u.pathname.replace('/drive/v3/files', '')}`);
    const q = u.searchParams.get('q') ?? '';
    const rev = /\/files\/([^/]+)\/revisions(?:\/([^/]+))?$/.exec(u.pathname);
    if (rev) {
      if (opts.sinPermisoDeVersiones) return new Response('{}', { status: 403 });
      const lista = versiones.get(rev[1])!;
      if (met === 'GET') return ok({ revisions: lista });
      if (rev[2] === lista[lista.length - 1].id) return new Response('{}', { status: 403 });
      versiones.set(rev[1], lista.filter(v => v.id !== rev[2]));
      return new Response(null, { status: 204 });
    }
    if (met === 'GET' && q.includes('mimeType')) return ok({ files: [{ id: 'D' }] });
    if (met === 'GET') return ok({ files: [...files.keys()].map(id => ({ id, name: id, size: '1' })) });
    if (met === 'POST') {
      const id = `${/"name":"([^"]+)"/.exec(String(init.body))![1]}`;
      files.set(id, ''); versiones.set(id, []); nueva(id);
      return ok({ id, name: id, size: '1' });
    }
    if (met === 'PATCH') {
      const id = u.pathname.split('/').pop()!;
      nueva(id);
      return ok({ id, name: id, size: '1' });
    }
    throw new Error('no esperado ' + met + ' ' + url);
  }) as typeof fetch;
  return { fetcher, versiones, llamadas };
}

describe('Google Drive: cada subida borra las versiones antiguas del archivo menos las tres últimas', () => {
  it('tras varias subidas quedan la actual y las dos anteriores (auditoría del 1-11-2026: antes, solo la última)', async () => {
    const d = driveConVersiones();
    const fs = createDriveFs(async () => 'T', d.fetcher);
    for (let i = 0; i < 6; i++) await fs.write('AulaPro/perfiles/p1/datos.json', `{"v":${i}}`);
    expect(d.versiones.get('perfiles~p1~datos.json')).toHaveLength(VERSIONES_GUARDADAS);
    expect(d.llamadas.filter(l => l.startsWith('DELETE'))).toHaveLength(6 - VERSIONES_GUARDADAS);
  });

  it('las copias de antes de vaciar, cargar o restaurar van a Drive; las automáticas, no', () => {
    expect(vaADrive('AulaPro/perfiles/p1/copias/copia-2026-11-01T10-00-00-antes-de-cargar.json')).toBe(true);
    expect(vaADrive('AulaPro/perfiles/p1/copias/copia-2026-11-01T10-00-00-antes-de-restaurar.json')).toBe(true);
    expect(vaADrive('AulaPro/perfiles/p1/copias/copia-2026-11-01T10-00-00-antes-de-vaciar.json')).toBe(true);
    expect(vaADrive('AulaPro/perfiles/p1/copias/copia-2026-11-01T10-00-00.json')).toBe(false);
    expect(vaADrive('AulaPro/perfiles/p1/datos.json.tmp')).toBe(false);
  });

  it('si Drive no deja podar, la subida sale igual y no se vuelve a intentar', async () => {
    const d = driveConVersiones({ sinPermisoDeVersiones: true });
    const fs = createDriveFs(async () => 'T', d.fetcher);
    for (let i = 0; i < 4; i++) await fs.write('AulaPro/perfiles/p1/datos.json', `{"v":${i}}`);
    expect(d.llamadas.filter(l => l.includes('/revisions'))).toHaveLength(1);
    expect(d.llamadas.filter(l => l.startsWith('PATCH'))).toHaveLength(3);
  });
});

/** Un OneDrive de mentira con versiones: la primera de la lista es la actual y no se puede borrar. */
function oneDriveConVersiones() {
  const versiones = new Map<string, { id: string; lastModifiedDateTime: string }[]>();
  const llamadas: string[] = [];
  let n = 0, t = 0;
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url); const met = init.method ?? 'GET';
    const ruta = decodeURIComponent(u.pathname).replace('/v1.0/me/drive', '');
    llamadas.push(`${met} ${ruta}`);
    if (ruta.endsWith('/special/approot')) return ok({ id: 'F' });
    if (met === 'GET' && ruta === '/items/F/children') return ok({ value: [...versiones.keys()].map(id => ({ id, name: id, size: 1 })) });
    const sube = /^\/items\/F:\/([^:]+):\/content$/.exec(ruta);
    if (sube) {
      const id = sube[1];
      if (!versiones.has(id)) versiones.set(id, []);
      versiones.get(id)!.unshift({ id: `v${++n}`, lastModifiedDateTime: new Date(++t * 1000).toISOString() });
      return ok({ id, name: id, size: 1 });
    }
    const ver = /^\/items\/([^/]+)\/versions(?:\/([^/]+))?$/.exec(ruta);
    if (ver) {
      const lista = versiones.get(ver[1])!;
      if (met === 'GET') return ok({ value: lista });
      if (ver[2] === lista[0].id) return new Response('{}', { status: 400 });
      versiones.set(ver[1], lista.filter(v => v.id !== ver[2]));
      return new Response(null, { status: 204 });
    }
    throw new Error('no esperado ' + met + ' ' + url);
  }) as typeof fetch;
  return { fetcher, versiones, llamadas };
}

describe('OneDrive: cada subida borra las versiones antiguas del archivo menos las tres últimas', () => {
  it('tras varias subidas quedan la actual y las dos anteriores', async () => {
    const g = oneDriveConVersiones();
    const fs = createOneDriveFs(async () => 'T', g.fetcher);
    await fs.list('AulaPro'); // como al abrir: así se sabe qué archivos ya existen
    for (let i = 0; i < 6; i++) await fs.write('AulaPro/perfiles/p1/datos.json', `{"v":${i}}`);
    expect(g.versiones.get('perfiles~p1~datos.json')).toHaveLength(VERSIONES_GUARDADAS);
  });
});

function memoryFs() {
  const files = new Map<string, string>();
  const escrituras: string[] = [];
  const fs: Fs = {
    read: async p => files.get(p) ?? null,
    write: async (p, data) => { files.set(p, data); escrituras.push(p); },
    rename: async (from, to) => { files.set(to, files.get(from)!); files.delete(from); },
    remove: async p => { files.delete(p); },
    removeDir: async p => { for (const k of [...files.keys()]) if (k.startsWith(p + '/')) files.delete(k); },
    list: async dir => {
      const out = new Map<string, { name: string; type: 'file' | 'directory'; size: number; mtime: number }>();
      for (const [k, v] of files) {
        if (!k.startsWith(dir + '/')) continue;
        const [name, ...more] = k.slice(dir.length + 1).split('/');
        out.set(name, more.length ? { name, type: 'directory', size: 0, mtime: 0 } : { name, type: 'file', size: v.length, mtime: 0 });
      }
      return [...out.values()];
    },
  };
  return { fs, files, escrituras };
}
const memoryKv = (): Kv => { const m = new Map<string, unknown>(); return { get: async <T,>(k: string) => m.get(k) as T | undefined, set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; };

const MIN = 60_000;
const avanzar = (min: number) => vi.advanceTimersByTimeAsync(min * MIN);

describe('copia a la nube más espaciada', () => {
  async function montar(nube: boolean) {
    vi.useFakeTimers();
    const carpeta = memoryFs();
    const local = memoryFs();
    const kv = memoryKv();
    const espejo = createEspejo({ local: local.fs, kv, dispositivo: 'A', pausa: 4000, reloj: () => Date.now() });
    const store = createProfileStore(espejo.fs);
    await espejo.conectar(carpeta.fs, nube ? 'Google Drive' : 'Carpeta', undefined, nube);
    const p = await store.createProfile({ name: 'Profesor' });
    await espejo.vaciar();
    const datos = `AulaPro/perfiles/${p.id}/datos.json`;
    const subidas = () => carpeta.escrituras.filter(e => e === datos).length;
    return { carpeta, local, kv, espejo, store, id: p.id, datos, subidas };
  }

  it('a una carpeta del ordenador copia a los pocos segundos, como siempre', async () => {
    const m = await montar(false);
    const antes = m.subidas();
    await m.store.saveData(m.id, { v: 1 });
    await avanzar(0.2);
    expect(m.subidas()).toBe(antes + 1);
  });

  it('a la nube sube una vez cada media hora, con lo último, aunque se siga trabajando', async () => {
    const m = await montar(true);
    const antes = m.subidas();
    await m.store.saveData(m.id, { v: 1 });
    await avanzar(10);
    await m.store.saveData(m.id, { v: 2 });
    await avanzar(10);
    await m.store.saveData(m.id, { v: 3 });
    await avanzar(9);
    expect(m.subidas()).toBe(antes); // 29 minutos: nada
    await avanzar(2);
    expect(m.subidas()).toBe(antes + 1);
    expect(JSON.parse(m.carpeta.files.get(m.datos)!)).toEqual({ v: 3 });
  });

  it('la comprobación de cada 30 segundos no adelanta la subida', async () => {
    const m = await montar(true);
    const antes = m.subidas();
    await m.store.saveData(m.id, { v: 1 });
    await m.espejo.comprobar();
    await avanzar(1);
    await m.espejo.comprobar();
    expect(m.subidas()).toBe(antes);
  });

  it('al salir sube lo pendiente, pero no más de una vez cada cinco minutos', async () => {
    const m = await montar(true);
    await avanzar(6); // desde la subida de al conectar ya han pasado más de cinco minutos
    const antes = m.subidas();
    await m.store.saveData(m.id, { v: 1 });
    await m.espejo.vaciar({ alSalir: true });
    expect(m.subidas()).toBe(antes + 1);

    await avanzar(2);
    await m.store.saveData(m.id, { v: 2 });
    await m.espejo.vaciar({ alSalir: true }); // hace 2 minutos: espera
    expect(m.subidas()).toBe(antes + 1);

    await avanzar(4);
    await m.espejo.vaciar({ alSalir: true }); // ya han pasado más de 5
    expect(m.subidas()).toBe(antes + 2);
    expect(JSON.parse(m.carpeta.files.get(m.datos)!)).toEqual({ v: 2 });
  });

  it('lo que no llegó a subir queda marcado y se sube al abrir otra vez', async () => {
    const m = await montar(true);
    const antes = m.subidas();
    await m.store.saveData(m.id, { v: 9 });
    // la página se cierra sin subir: la cuenta atrás se pierde, pero el navegador recuerda que falta
    m.espejo.desconectar();
    expect(m.subidas()).toBe(antes);
    const otra = createEspejo({ local: m.local.fs, kv: m.kv, dispositivo: 'A', reloj: () => Date.now() });
    await otra.activar(m.carpeta.fs, 'Google Drive', { nube: true });
    await otra.vaciar();
    expect(m.subidas()).toBe(antes + 1);
    expect(JSON.parse(m.carpeta.files.get(m.datos)!)).toEqual({ v: 9 });
  });
});
