import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDriveFs, nombreDe, rutaDe, vaADrive, VERSIONES_GUARDADAS } from './driveFs';
import { createEspejo, huellaDeDatos } from './espejo';
import { createProfileStore, type Fs } from './profileStore';
import type { Kv } from './webFs';

/** Un Google Drive de mentira con lo que usa `driveFs`: buscar, listar, crear, subir, bajar y borrar. */
function driveFalso() {
  const archivos = new Map<string, { name: string; parents: string[]; mime?: string; data: string; mtime: number }>();
  let n = 0, reloj = 0, llamadas = 0, subidas = 0;
  const papelera: string[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    llamadas++;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer T');
    const u = new URL(url);
    const met = init.method ?? 'GET';
    const ok = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
    const id = u.pathname.split('/files/')[1];
    if (met === 'GET' && !id) {
      const q = u.searchParams.get('q') ?? '';
      const padre = /'([^']+)' in parents/.exec(q)?.[1];
      const nombre = /name='([^']+)'/.exec(q)?.[1];
      const files = [...archivos.entries()]
        .filter(([, f]) => (!nombre || f.name === nombre) && (padre === 'root' ? f.parents.length === 0 : f.parents.includes(padre!)))
        .map(([fid, f]) => ({ id: fid, name: f.name, size: String(f.data.length), modifiedTime: new Date(f.mtime).toISOString() }));
      return ok({ files });
    }
    if (met === 'GET' && id) {
      const f = archivos.get(id);
      return f ? new Response(f.data, { status: 200 }) : new Response('', { status: 404 });
    }
    if (met === 'POST' && u.pathname.startsWith('/upload')) {
      subidas++;
      const cuerpo = String(init.body);
      const partes = cuerpo.split(/--aulapro\w+/).filter(p => p.includes('\r\n\r\n'));
      const meta = JSON.parse(partes[0].split('\r\n\r\n')[1].trim());
      const data = partes[1].split('\r\n\r\n')[1].replace(/\r\n$/, '');
      const fid = `f${++n}`;
      archivos.set(fid, { name: meta.name, parents: meta.parents, data, mtime: ++reloj });
      return ok({ id: fid, name: meta.name, size: String(data.length) });
    }
    if (met === 'POST') {
      const meta = JSON.parse(String(init.body));
      const fid = `c${++n}`;
      archivos.set(fid, { name: meta.name, parents: [], mime: meta.mimeType, data: '', mtime: ++reloj });
      return ok({ id: fid });
    }
    if (met === 'PATCH') {
      const fid = u.pathname.split('/files/')[1];
      const f = archivos.get(fid);
      if (!f) return new Response('', { status: 404 });
      if (!u.pathname.startsWith('/upload')) { papelera.push(f.name); archivos.delete(fid); return ok({ id: fid }); }
      subidas++;
      f.data = String(init.body); f.mtime = ++reloj;
      return ok({ id: fid, name: f.name, size: String(f.data.length) });
    }
    if (met === 'DELETE') { archivos.delete(id); return new Response(null, { status: 204 }); }
    throw new Error('no esperado ' + met + ' ' + url);
  }) as typeof fetch;
  return { fetcher, archivos, papelera, llamadas: () => llamadas, subidas: () => subidas };
}

function memoryFs(): Fs {
  const files = new Map<string, { data: string; mtime: number }>();
  let clock = 1;
  return {
    read: async p => files.get(p)?.data ?? null,
    write: async (p, data) => { files.set(p, { data, mtime: clock++ }); },
    rename: async (a, b) => { const f = files.get(a); if (f) { files.delete(a); files.set(b, f); } },
    remove: async p => { files.delete(p); },
    removeDir: async p => { for (const k of [...files.keys()]) if (k.startsWith(p + '/')) files.delete(k); },
    list: async dir => {
      const out = new Map<string, { name: string; type: 'file' | 'directory'; size: number; mtime: number }>();
      for (const [k, v] of files) {
        if (!k.startsWith(dir + '/')) continue;
        const [name, ...more] = k.slice(dir.length + 1).split('/');
        out.set(name, more.length ? { name, type: 'directory', size: 0, mtime: 0 } : { name, type: 'file', size: v.data.length, mtime: v.mtime });
      }
      return [...out.values()];
    },
  };
}
const memoryKv = (): Kv => { const m = new Map(); return { get: async k => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; };

describe('Google Drive como carpeta (versión web)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('no vuelve a listar la carpeta en cada llamada, y varias peticiones a la vez comparten una', async () => {
    const d = driveFalso();
    const fs = createDriveFs(async () => 'T', d.fetcher);
    await fs.write('AulaPro/perfiles/p1/datos.json', '{}');
    let antes = d.llamadas();
    await Promise.all([fs.list('AulaPro/perfiles/p1'), fs.list('AulaPro/perfiles/p1'), fs.list('AulaPro/perfiles')]);
    expect(d.llamadas() - antes).toBe(0);

    // Un listado nuevo (otra pestaña, otro dispositivo): carpeta y listado, y los tres a la vez comparten la petición
    const nuevo = createDriveFs(async () => 'T', d.fetcher);
    antes = d.llamadas();
    await Promise.all([nuevo.list('AulaPro/perfiles/p1'), nuevo.list('AulaPro/perfiles/p1'), nuevo.list('AulaPro/perfiles')]);
    expect(d.llamadas() - antes).toBe(2);

    // Pasados unos segundos vuelve a mirar: así se ven los cambios de otro dispositivo
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 6000);
    antes = d.llamadas();
    await nuevo.list('AulaPro/perfiles');
    expect(d.llamadas() - antes).toBe(1);
  });

  it('al reabrir sin novedades no sube de nuevo la lista de perfiles y hace pocas llamadas', async () => {
    const d = driveFalso();
    const drive = () => createDriveFs(async () => 'T', d.fetcher);
    const kv = memoryKv(); const local = memoryFs();
    const a = createEspejo({ local, kv, dispositivo: 'A', pausa: 10_000 });
    const s = createProfileStore(a.fs);
    await a.conectar(drive(), 'Google Drive');
    await s.saveData((await s.createProfile({ name: 'Profesor' })).id, { nota: 7 });
    await a.vaciar();

    const recarga = createEspejo({ local, kv, dispositivo: 'A', pausa: 10_000 });
    const subidas = d.subidas(); const llamadas = d.llamadas();
    await recarga.activar(drive(), 'Google Drive', { congelar: true });
    await recarga.vaciar();
    expect(d.subidas() - subidas).toBe(0);
    // Antes eran 8
    expect(d.llamadas() - llamadas).toBeLessThanOrEqual(4);
  });

  it('con el Drive lleno no pide permiso: avisa de que no hay sitio', async () => {
    const lleno = (async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'storageQuotaExceeded' }] } }), { status: 403 })) as unknown as typeof fetch;
    const sinPermiso = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    await expect(createDriveFs(async () => 'T', lleno).write('AulaPro/perfiles.json', '[]')).rejects.toMatchObject({ name: 'ErrorDrive', message: 'drive-lleno' });
    await expect(createDriveFs(async () => 'T', sinPermiso).write('AulaPro/perfiles.json', '[]')).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('pasa las rutas a nombres de una sola carpeta y no sube las copias con fecha', () => {
    expect(nombreDe('AulaPro/perfiles/p1/datos.json')).toBe('perfiles~p1~datos.json');
    expect(rutaDe('perfiles~p1~datos.json')).toBe('AulaPro/perfiles/p1/datos.json');
    expect(vaADrive('AulaPro/perfiles/p1/copias/copia-1.json')).toBe(false);
    expect(vaADrive('AulaPro/perfiles/p1/datos.json')).toBe(true);
    expect(vaADrive('AulaPro/perfiles/p1/copias/copia-2026-06-30T10-00-00-antes-de-vaciar.json')).toBe(true);
  });

  it('escribe, lee, lista y borra en la carpeta «AulaPro» de Drive', async () => {
    const d = driveFalso();
    const fs = createDriveFs(async () => 'T', d.fetcher);
    await fs.write('AulaPro/perfiles.json', '[1]');
    await fs.write('AulaPro/perfiles/p1/datos.json', '{"a":1}');
    await fs.write('AulaPro/perfiles/p1/datos.json', '{"a":2}');
    expect(await fs.read('AulaPro/perfiles/p1/datos.json')).toBe('{"a":2}');
    expect([...d.archivos.values()].filter(f => f.mime).map(f => f.name)).toEqual(['AulaPro']);
    expect([...d.archivos.values()].filter(f => !f.mime)).toHaveLength(2);
    expect((await fs.list('AulaPro/perfiles')).map(e => e.name)).toEqual(['p1']);
    await fs.removeDir('AulaPro/perfiles/p1');
    expect(await fs.read('AulaPro/perfiles/p1/datos.json')).toBeNull();
    // A la papelera de Drive, no borrado para siempre
    expect(d.papelera).toEqual(['perfiles~p1~datos.json']);
  });

  it('con el espejo: lo de un dispositivo aparece en otro al comprobar', async () => {
    const d = driveFalso();
    const drive = () => createDriveFs(async () => 'T', d.fetcher);
    const a = createEspejo({ local: memoryFs(), kv: memoryKv(), dispositivo: 'A', pausa: 10_000 });
    const sa = createProfileStore(a.fs);
    await a.conectar(drive(), 'Google Drive');
    const p = await sa.createProfile({ name: 'Profesor' });
    await sa.saveData(p.id, { nota: 7 });
    await a.vaciar();

    const b = createEspejo({ local: memoryFs(), kv: memoryKv(), dispositivo: 'B', pausa: 10_000 });
    const sb = createProfileStore(b.fs);
    expect(await b.conectar(drive(), 'Google Drive')).toEqual({ elegir: false, cargados: 1 });
    expect(await sb.loadData(p.id)).toEqual({ nota: 7 });

    await sa.saveData(p.id, { nota: 9 });
    await a.vaciar();
    expect(await b.comprobar()).toBe(1);
    expect(await sb.loadData(p.id)).toEqual({ nota: 9 });
  });
});

/**
 * Auditoría del 5-11-2026: el acceso que caduca a mitad de una subida, una respuesta que se pierde al crear un archivo
 * y un corte de red mientras se podan las versiones.
 */
describe('Drive con fallos a mitad de camino', () => {
  /** Las versiones de cada archivo, que `driveFalso` no modela: una por subida, y se pueden borrar (o fallar al borrar). */
  function conVersiones(d: ReturnType<typeof driveFalso>, opts: { fallaBorrado?: () => boolean } = {}) {
    const versiones = new Map<string, { id: string; modifiedTime: string }[]>();
    let n = 0;
    const fetcher = (async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const met = init.method ?? 'GET';
      const rev = /\/files\/([^/]+)\/revisions(?:\/([^/?]+))?/.exec(u.pathname);
      if (rev && met === 'GET') return new Response(JSON.stringify({ revisions: versiones.get(rev[1]) ?? [] }), { status: 200 });
      if (rev && met === 'DELETE') {
        if (opts.fallaBorrado?.()) throw new TypeError('Failed to fetch');
        versiones.set(rev[1], (versiones.get(rev[1]) ?? []).filter(v => v.id !== rev[2]));
        return new Response(null, { status: 204 });
      }
      const r = await d.fetcher(url, init);
      if (u.pathname.startsWith('/upload') && r.ok) {
        const { id } = await r.clone().json();
        versiones.set(id, [...(versiones.get(id) ?? []), { id: `r${++n}`, modifiedTime: new Date(2026, 10, 1, 0, 0, n).toISOString() }]);
      }
      return r;
    }) as typeof fetch;
    return { fetcher, versiones };
  }

  it('si el acceso caduca entre los datos y la marca: queda pendiente, se pide permiso y al volver a darlo se completa', async () => {
    const d = driveFalso();
    let caducado = false;
    // La marca es la segunda subida de cada copia: ahí Google contesta 401
    const fetcher = (async (url: string, init: RequestInit = {}) => {
      if (caducado && url.includes('/upload/') && String(init.body).includes('"dispositivo"')) return new Response('', { status: 401 });
      return d.fetcher(url, init);
    }) as typeof fetch;
    const drive = () => createDriveFs(async () => 'T', fetcher);
    const kv = memoryKv(); const local = memoryFs();
    const a = createEspejo({ local, kv, dispositivo: 'A', pausa: 10_000 });
    const s = createProfileStore(a.fs);
    await a.conectar(drive(), 'Google Drive');
    const p = await s.createProfile({ name: 'Profesor' });
    await s.saveData(p.id, { v: 1 });
    await a.vaciar();
    caducado = true;
    await s.saveData(p.id, { v: 2 });
    await a.vaciar();
    expect(a.estado()).toMatchObject({ tipo: 'sin-permiso' });
    expect(await kv.get(`pendiente:${p.id}`)).toBe(true);
    const datos = () => [...d.archivos.values()].find(f => f.name === `perfiles~${p.id}~datos.json`)!.data;
    const marca = () => JSON.parse([...d.archivos.values()].find(f => f.name === `perfiles~${p.id}~guardado.json`)!.data);
    expect(JSON.parse(datos())).toEqual({ v: 2 });
    // Los datos ya están, pero la marca es la de antes: otro dispositivo no la tomaría por nueva hasta que se complete
    expect(marca().huella).not.toBe(huellaDeDatos(datos()));
    caducado = false;
    await a.activar(drive(), 'Google Drive', { congelar: true });
    await a.vaciar();
    expect(marca().huella).toBe(huellaDeDatos(datos()));
    expect(await kv.get(`pendiente:${p.id}`)).toBeUndefined();
    expect(a.estado()).toMatchObject({ tipo: 'activa' });
  });

  it('si se pierde la respuesta al crear un archivo, el siguiente intento no crea otro con el mismo nombre', async () => {
    const d = driveFalso();
    let perder = true;
    const fetcher = (async (url: string, init: RequestInit = {}) => {
      const r = await d.fetcher(url, init);
      if (perder && url.includes('uploadType=multipart')) { perder = false; throw new TypeError('Failed to fetch'); }
      return r;
    }) as typeof fetch;
    const fs = createDriveFs(async () => 'T', fetcher);
    await expect(fs.write('AulaPro/perfiles/p1/datos.json', '{"v":1}')).rejects.toThrow('Failed to fetch');
    await fs.write('AulaPro/perfiles/p1/datos.json', '{"v":2}');
    const conEseNombre = [...d.archivos.values()].filter(f => f.name === 'perfiles~p1~datos.json');
    expect(conEseNombre).toHaveLength(1);
    expect(conEseNombre[0].data).toBe('{"v":2}');
    expect(await fs.read('AulaPro/perfiles/p1/datos.json')).toBe('{"v":2}');
  });

  it('con dos archivos del mismo nombre en la carpeta (de antes de esta corrección), se lee el más reciente', async () => {
    const d = driveFalso();
    const fs = createDriveFs(async () => 'T', d.fetcher);
    await fs.write('AulaPro/perfiles/p1/datos.json', '{"v":"nuevo"}');
    const [id, nuevo] = [...d.archivos.entries()].find(([, f]) => f.name === 'perfiles~p1~datos.json')!;
    // El viejo, listado después del nuevo
    d.archivos.set('viejo', { ...nuevo, data: '{"v":"viejo"}', mtime: nuevo.mtime - 1 });
    const otro = createDriveFs(async () => 'T', d.fetcher);
    expect(await otro.read('AulaPro/perfiles/p1/datos.json')).toBe('{"v":"nuevo"}');
    expect(id).not.toBe('viejo');
  });

  it('un corte de red mientras se podan las versiones no estropea la subida, y la siguiente poda termina el trabajo', async () => {
    const d = driveFalso();
    let cortar = false;
    const { fetcher, versiones } = conVersiones(d, { fallaBorrado: () => cortar });
    const fs = createDriveFs(async () => 'T', fetcher);
    const ruta = 'AulaPro/perfiles/p1/datos.json';
    for (let i = 1; i <= 5; i++) await fs.write(ruta, `{"v":${i}}`);
    const id = [...d.archivos.entries()].find(([, f]) => f.name === 'perfiles~p1~datos.json')![0];
    expect(versiones.get(id)).toHaveLength(VERSIONES_GUARDADAS);
    cortar = true;
    await fs.write(ruta, '{"v":6}'); // no lanza
    expect(versiones.get(id)).toHaveLength(VERSIONES_GUARDADAS + 1);
    expect(await fs.read(ruta)).toBe('{"v":6}');
    cortar = false;
    await fs.write(ruta, '{"v":7}');
    expect(versiones.get(id)!.map(v => v.id)).toEqual(['r5', 'r6', 'r7']);
  });
});
