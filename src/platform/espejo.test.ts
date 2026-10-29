import { describe, it, expect } from 'vitest';
import { createEspejo } from './espejo';
import { createProfileStore, type Fs } from './profileStore';
import type { Kv } from './webFs';

function memoryFs() {
  const files = new Map<string, { data: string; mtime: number }>();
  let clock = 1_000;
  const fs: Fs = {
    read: async p => files.get(p)?.data ?? null,
    write: async (p, data) => { files.set(p, { data, mtime: clock++ }); },
    rename: async (from, to) => {
      const f = files.get(from);
      if (!f) throw new Error('no existe ' + from);
      files.delete(from);
      files.set(to, f);
    },
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
  return { fs, files };
}

function memoryKv(): Kv {
  const m = new Map<string, unknown>();
  return {
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => { m.set(k, v); },
    del: async k => { m.delete(k); },
  };
}

let reloj = 0;
const ahora = () => new Date(Date.UTC(2026, 10, 1, 0, 0, reloj++)).toISOString();

/** Un navegador: sus datos, su copia en la carpeta y la app encima. */
function dispositivo(nombre: string) {
  const local = memoryFs();
  const espejo = createEspejo({ local: local.fs, kv: memoryKv(), dispositivo: nombre, ahora, pausa: 10_000 });
  const store = createProfileStore(espejo.fs);
  return { local, espejo, store };
}

const leer = async (fs: Fs, p: string) => JSON.parse((await fs.read(p)) ?? 'null');

describe('copia en una carpeta del ordenador (versión web)', () => {
  it('copia en la carpeta lo que se guarda, con la estructura de la app de escritorio', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'OneDrive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { notas: [1, 2, 3] });
    await a.espejo.vaciar();

    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ notas: [1, 2, 3] });
    expect((await leer(carpeta.fs, 'AulaPro/perfiles.json')).map((x: { id: string }) => x.id)).toEqual([p.id]);
    expect((await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/guardado.json`)).dispositivo).toBe('A');
    // Los temporales de la escritura segura no llegan a la carpeta
    expect([...carpeta.files.keys()].some(k => k.endsWith('.tmp'))).toBe(false);
    expect(a.espejo.estado()).toMatchObject({ tipo: 'activa', nombre: 'OneDrive' });
  });

  it('otro ordenador con la misma carpeta trae el trabajo al abrir', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'OneDrive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { v: 1 });
    await a.espejo.vaciar();

    const b = dispositivo('B');
    expect(await b.espejo.conectar(carpeta.fs, 'OneDrive')).toEqual({ elegir: false, cargados: 1 });
    expect(await b.store.loadData(p.id)).toEqual({ v: 1 });

    // A sigue trabajando; B, al abrir otra vez, lo trae solo
    await a.store.saveData(p.id, { v: 2 });
    await a.espejo.vaciar();
    expect(await b.espejo.comprobar()).toBe(1);
    expect(await b.store.loadData(p.id)).toEqual({ v: 2 });
    expect(b.espejo.conflictos()).toEqual([]);
  });

  it('no pisa el trabajo de otro dispositivo: si los dos han cambiado, pregunta', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'OneDrive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { v: 1 });
    await a.espejo.vaciar();
    const b = dispositivo('B');
    await b.espejo.conectar(carpeta.fs, 'OneDrive');

    await a.store.saveData(p.id, { v: 'de A' });
    await a.espejo.vaciar();
    await b.store.saveData(p.id, { v: 'de B' });
    await b.espejo.vaciar();

    expect(b.espejo.conflictos()).toEqual([p.id]);
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ v: 'de A' });
    expect(await b.store.loadData(p.id)).toEqual({ v: 'de B' });

    await b.espejo.resolver(p.id, 'carpeta');
    expect(await b.store.loadData(p.id)).toEqual({ v: 'de A' });
    expect(b.espejo.conflictos()).toEqual([]);
  });

  it('quedarse con lo de aquí sustituye lo de la carpeta', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'X');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { v: 1 });
    await a.espejo.vaciar();
    const b = dispositivo('B');
    await b.espejo.conectar(carpeta.fs, 'X');
    await a.store.saveData(p.id, { v: 'de A' });
    await a.espejo.vaciar();
    await b.store.saveData(p.id, { v: 'de B' });
    await b.espejo.vaciar();

    await b.espejo.resolver(p.id, 'local');
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ v: 'de B' });
    // Ahora es A quien tiene que preguntar si tiene cambios propios; sin ellos, lo trae
    expect(await a.espejo.comprobar()).toBe(1);
    expect(await a.store.loadData(p.id)).toEqual({ v: 'de B' });
  });

  it('si la carpeta y el navegador tienen datos, pregunta antes de conectar', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'X');
    const pa = await a.store.createProfile({ name: 'En la carpeta' });
    await a.store.saveData(pa.id, { v: 'carpeta' });
    await a.espejo.vaciar();

    const b = dispositivo('B');
    const pb = await b.store.createProfile({ name: 'En el navegador' });
    await b.store.saveData(pb.id, { v: 'navegador' });
    expect(await b.espejo.conectar(carpeta.fs, 'X')).toEqual({ elegir: true, cargados: 0 });
    expect(b.espejo.estado().tipo).toBe('sin-carpeta');

    // Traer los de la carpeta conserva los que solo estaban aquí, y los sube
    expect(await b.espejo.conectar(carpeta.fs, 'X', 'carpeta')).toEqual({ elegir: false, cargados: 1 });
    expect((await b.store.listProfiles()).map(p => p.id).sort()).toEqual([pa.id, pb.id].sort());
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${pb.id}/datos.json`)).toEqual({ v: 'navegador' });
    expect((await leer(carpeta.fs, 'AulaPro/perfiles.json')).length).toBe(2);
  });

  it('un perfil borrado no vuelve desde la carpeta', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'X');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { v: 1 });
    await a.espejo.vaciar();
    await a.store.deleteProfile(p.id);
    await a.espejo.vaciar();

    expect(await a.espejo.comprobar()).toBe(0);
    expect(await a.store.listProfiles()).toEqual([]);
    expect(await leer(carpeta.fs, 'AulaPro/perfiles.json')).toEqual([]);
    const b = dispositivo('B');
    expect(await b.espejo.conectar(carpeta.fs, 'X')).toEqual({ elegir: false, cargados: 0 });
    expect(await b.store.listProfiles()).toEqual([]);
  });

  it('sin permiso para la carpeta, se sigue guardando en el navegador', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'X');
    const p = await a.store.createProfile({ name: 'Profesor' });
    carpeta.fs.write = async () => { throw new DOMException('no', 'NotAllowedError'); };
    await a.store.saveData(p.id, { v: 1 });
    await a.espejo.vaciar();

    expect(a.espejo.estado()).toEqual({ tipo: 'sin-permiso', nombre: 'X' });
    expect(await a.store.loadData(p.id)).toEqual({ v: 1 });
  });
});
