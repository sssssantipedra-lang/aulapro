import { describe, it, expect } from 'vitest';
import { createDriveFs, nombreDe, rutaDe, vaADrive } from './driveFs';
import { createEspejo } from './espejo';
import { createProfileStore, type Fs } from './profileStore';
import type { Kv } from './webFs';

/** Un Google Drive de mentira con lo que usa `driveFs`: buscar, listar, crear, subir, bajar y borrar. */
function driveFalso() {
  const archivos = new Map<string, { name: string; parents: string[]; mime?: string; data: string; mtime: number }>();
  let n = 0, reloj = 0, llamadas = 0;
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
      f.data = String(init.body); f.mtime = ++reloj;
      return ok({ id: fid, name: f.name, size: String(f.data.length) });
    }
    if (met === 'DELETE') { archivos.delete(id); return new Response(null, { status: 204 }); }
    throw new Error('no esperado ' + met + ' ' + url);
  }) as typeof fetch;
  return { fetcher, archivos, papelera, llamadas: () => llamadas };
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
