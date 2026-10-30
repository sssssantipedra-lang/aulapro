import { describe, it, expect } from 'vitest';
import { createOneDriveFs } from './oneDriveFs';
import { createEspejo } from './espejo';
import { createProfileStore, type Fs } from './profileStore';
import type { Kv } from './webFs';

/** Un OneDrive de mentira con lo que usa `oneDriveFs`: la carpeta de la app, listar, subir, bajar y borrar. */
function graphFalso() {
  const archivos = new Map<string, { name: string; data: string; mtime: number }>();
  const papelera: string[] = [];
  const llamadas: string[] = [];
  const subidas: { url: string; auth: string | null; rango: string | null }[] = [];
  let n = 0, reloj = 0, llena = false, prohibido = false;
  let sesion = '';
  const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
  const item = (id: string) => { const f = archivos.get(id)!; return { id, name: f.name, size: f.data.length, lastModifiedDateTime: new Date(f.mtime).toISOString() }; };
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const met = init.method ?? 'GET';
    const auth = new Headers(init.headers).get('Authorization');
    llamadas.push(`${met} ${u.host}${decodeURIComponent(u.pathname).replace('/v1.0/me/drive', '')}`);
    if (u.host === 'descarga.test') {
      expect(auth).toBeNull(); // la dirección de bajada ya lleva el permiso
      return new Response(archivos.get(u.pathname.slice(1))!.data, { status: 200 });
    }
    if (u.host === 'subida.test') {
      subidas.push({ url, auth, rango: new Headers(init.headers).get('Content-Range') });
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(new Headers(init.headers).get('Content-Range') ?? '')!;
      const cuerpo = new TextDecoder().decode(init.body as Uint8Array);
      const f = archivos.get(sesion) ?? { name: '', data: '', mtime: 0 };
      archivos.set(sesion, { ...f, data: f.data + cuerpo, mtime: ++reloj });
      return Number(m[2]) + 1 < Number(m[3]) ? ok({}, 202) : ok(item(sesion));
    }
    expect(auth).toBe('Bearer T');
    if (prohibido) return new Response('{}', { status: 403 });
    if (u.pathname.endsWith('/special/approot')) return ok({ id: 'F' });
    if (met === 'GET' && u.pathname.endsWith('/items/F/children')) {
      return ok({ value: [...archivos.keys()].map(id => ({ ...item(id), '@microsoft.graph.downloadUrl': `https://descarga.test/${id}` })) });
    }
    const alRuta = /\/items\/F:\/([^:]+):\/(content|createUploadSession)$/.exec(decodeURIComponent(u.pathname));
    if (alRuta && met === 'PUT') {
      if (llena) return new Response('{}', { status: 507 });
      const existente = [...archivos.entries()].find(([, f]) => f.name === alRuta[1])?.[0];
      const id = existente ?? `i${++n}`;
      archivos.set(id, { name: alRuta[1], data: String(init.body), mtime: ++reloj });
      return ok(item(id));
    }
    if (alRuta && met === 'POST') {
      sesion = `i${++n}`;
      archivos.set(sesion, { name: alRuta[1], data: '', mtime: 0 });
      return ok({ uploadUrl: 'https://subida.test/sesion1' });
    }
    if (met === 'DELETE') { const id = u.pathname.split('/items/')[1]; papelera.push(archivos.get(id)!.name); archivos.delete(id); return new Response(null, { status: 204 }); }
    throw new Error('no esperado ' + met + ' ' + url);
  }) as typeof fetch;
  return { fetcher, archivos, papelera, llamadas, subidas, llenar: () => { llena = true; }, prohibir: () => { prohibido = true; } };
}

const fsDe = (g: ReturnType<typeof graphFalso>) => createOneDriveFs(async () => 'T', g.fetcher);

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

describe('OneDrive como carpeta (versión web)', () => {
  it('escribe, lee, lista y borra en la carpeta de la aplicación, y borrar va a la papelera', async () => {
    const g = graphFalso();
    const fs = fsDe(g);
    await fs.write('AulaPro/perfiles.json', '[1]');
    await fs.write('AulaPro/perfiles/p1/datos.json', '{"a":1}');
    await fs.write('AulaPro/perfiles/p1/datos.json', '{"a":2}');
    expect([...g.archivos.values()].map(f => f.name).sort()).toEqual(['perfiles.json', 'perfiles~p1~datos.json']);
    expect(await fs.read('AulaPro/perfiles/p1/datos.json')).toBe('{"a":2}');
    expect((await fs.list('AulaPro/perfiles')).map(e => e.name)).toEqual(['p1']);
    await fs.removeDir('AulaPro/perfiles/p1');
    expect(await fs.read('AulaPro/perfiles/p1/datos.json')).toBeNull();
    expect(g.papelera).toEqual(['perfiles~p1~datos.json']);
  });

  it('no sube las copias con fecha ni los temporales', async () => {
    const g = graphFalso();
    const fs = fsDe(g);
    await fs.write('AulaPro/perfiles/p1/copias/copia-1.json', '{}');
    await fs.write('AulaPro/perfiles/p1/datos.json.tmp', '{}');
    await fs.write('AulaPro/perfiles/p1/copias/copia-2-antes-de-vaciar.json', '{}');
    expect([...g.archivos.values()].map(f => f.name)).toEqual(['perfiles~p1~copias~copia-2-antes-de-vaciar.json']);
  });

  it('un archivo grande va por trozos a la dirección de subida, sin el permiso en la cabecera', async () => {
    const g = graphFalso();
    const fs = fsDe(g);
    const grande = 'x'.repeat(11 * 1024 * 1024);
    await fs.write('AulaPro/perfiles/p1/datos.json', grande);
    expect(g.subidas.length).toBeGreaterThan(1);
    expect(g.subidas.every(s => s.auth === null)).toBe(true);
    expect(g.subidas[0].rango).toMatch(/^bytes 0-\d+\/11534336$/);
    expect(g.subidas.at(-1)!.rango).toMatch(/-11534335\/11534336$/);
    expect([...g.archivos.values()][0].data.length).toBe(grande.length);
  });

  it('un 403 sale como falta de permiso y un 507 como OneDrive lleno', async () => {
    const lleno = graphFalso(); lleno.llenar();
    await expect(fsDe(lleno).write('AulaPro/perfiles.json', '[]')).rejects.toMatchObject({ name: 'ErrorDrive', message: 'drive-lleno' });
    const sin = graphFalso(); sin.prohibir();
    await expect(fsDe(sin).write('AulaPro/perfiles.json', '[]')).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('lee siempre por la dirección de bajada, también un archivo recién escrito', async () => {
    const g = graphFalso();
    const fs = fsDe(g);
    await fs.write('AulaPro/perfiles.json', '[1]');
    await fs.list('AulaPro');
    await fs.write('AulaPro/perfiles.json', '[2]');
    expect(await fs.read('AulaPro/perfiles.json')).toBe('[2]');
    expect(g.llamadas.some(l => l.endsWith('/content') && l.startsWith('GET'))).toBe(false);
  });

  it('no vuelve a listar la carpeta en cada llamada', async () => {
    const g = graphFalso();
    const fs = fsDe(g);
    await fs.write('AulaPro/perfiles/p1/datos.json', '{}');
    await fs.list('AulaPro/perfiles');
    const antes = g.llamadas.length;
    await Promise.all([fs.list('AulaPro/perfiles'), fs.list('AulaPro/perfiles/p1'), fs.read('AulaPro/perfiles/p1/datos.json')]);
    expect(g.llamadas.slice(antes).filter(l => l.includes('/children'))).toHaveLength(0);
  });

  it('con el espejo: lo de un dispositivo aparece en otro al comprobar', async () => {
    const g = graphFalso();
    const a = createEspejo({ local: memoryFs(), kv: memoryKv(), dispositivo: 'A', pausa: 10_000 });
    const sa = createProfileStore(a.fs);
    await a.conectar(fsDe(g), 'OneDrive');
    const p = await sa.createProfile({ name: 'Profesor' });
    await sa.saveData(p.id, { nota: 7 });
    await a.vaciar();

    const b = createEspejo({ local: memoryFs(), kv: memoryKv(), dispositivo: 'B', pausa: 10_000 });
    const sb = createProfileStore(b.fs);
    expect(await b.conectar(fsDe(g), 'OneDrive')).toEqual({ elegir: false, cargados: 1 });
    expect(await sb.loadData(p.id)).toEqual({ nota: 7 });
  });
});
