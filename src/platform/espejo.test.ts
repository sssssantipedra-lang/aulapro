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

  it('con la app abierta, tras traer lo de otro dispositivo no se vuelve a guardar lo viejo encima', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'X');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { v: 1 });
    await a.espejo.vaciar();
    const b = dispositivo('B');
    await b.espejo.conectar(carpeta.fs, 'X');
    await a.store.saveData(p.id, { v: 2 });
    await a.espejo.vaciar();

    expect(await b.espejo.comprobar({ congelar: true })).toBe(1);
    expect(b.espejo.congelado()).toBe(true);
    // La app de B aún tiene { v: 1 } en memoria y lo guarda: no pisa nada
    await b.store.saveData(p.id, { v: 1 });
    await b.espejo.vaciar();
    expect(await b.store.loadData(p.id)).toEqual({ v: 2 });
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ v: 2 });
  });
});

/**
 * Auditoría del 1-11-2026: lo que se ve cuando el navegador no ha podido leer el trabajo es un perfil vacío. Ese perfil
 * no puede subir encima del bueno de la carpeta o de la nube (con las versiones antiguas borradas, no habría vuelta
 * atrás), ni uno vacío de la carpeta sustituir al de aquí, sin que el docente lo elija.
 */
describe('una copia vacía nunca sustituye a una con datos sin preguntar', () => {
  const VACIO = { classes: [], students: [], grades: {}, apoyo: { alumnos: [] }, auditLog: [{ id: 'x' }] };

  it('un perfil vacío aquí no se sube encima del de la carpeta: queda como conflicto «aquí vacío»', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'Google Drive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { classes: [{ id: 'c1' }] });
    await a.espejo.vaciar();
    // El navegador «pierde» los datos y la app guarda un perfil vacío
    await a.store.saveData(p.id, VACIO);
    await a.espejo.vaciar();
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ classes: [{ id: 'c1' }] });
    expect(a.espejo.conflictos()).toEqual([p.id]);
    expect(a.espejo.vacios()).toEqual({ [p.id]: 'aqui' });
    // Si el docente elige la de la carpeta, vuelve su trabajo
    await a.espejo.resolver(p.id, 'carpeta');
    expect(await leer(a.local.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ classes: [{ id: 'c1' }] });
    expect(a.espejo.conflictos()).toEqual([]);
    expect(a.espejo.vacios()).toEqual({});
  });

  it('si el docente elige quedarse con el vacío, se sube (lo ha decidido él)', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'Google Drive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { classes: [{ id: 'c1' }] });
    await a.espejo.vaciar();
    await a.store.saveData(p.id, VACIO);
    await a.espejo.vaciar();
    await a.espejo.resolver(p.id, 'local');
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual(VACIO);
  });

  it('un perfil vacío en la carpeta (de otro dispositivo) no sustituye al de aquí: conflicto «allí vacío»', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'OneDrive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { classes: [{ id: 'c1' }] });
    await a.espejo.vaciar();

    const b = dispositivo('B');
    await b.espejo.conectar(carpeta.fs, 'OneDrive');
    // B escribe un perfil vacío en la carpeta (como si su navegador hubiera fallado), firmado como suyo
    await carpeta.fs.write(`AulaPro/perfiles/${p.id}/datos.json`, JSON.stringify(VACIO));
    await carpeta.fs.write(`AulaPro/perfiles/${p.id}/guardado.json`, JSON.stringify({ dispositivo: 'B', en: ahora() }));

    expect(await a.espejo.comprobar({ congelar: true })).toBe(0);
    expect(await leer(a.local.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ classes: [{ id: 'c1' }] });
    expect(a.espejo.vacios()).toEqual({ [p.id]: 'alli' });
    // No se ha quedado congelado: aquí se sigue guardando
    expect(a.espejo.congelado()).toBe(false);
    await a.espejo.resolver(p.id, 'local');
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ classes: [{ id: 'c1' }] });
  });

  it('detener: la pestaña que ha perdido la app deja de copiar y de guardar los perfiles', async () => {
    const carpeta = memoryFs();
    const a = dispositivo('A');
    await a.espejo.conectar(carpeta.fs, 'OneDrive');
    const p = await a.store.createProfile({ name: 'Profesor' });
    await a.store.saveData(p.id, { classes: [{ id: 'c1' }] });
    await a.espejo.vaciar();
    a.espejo.detener();
    await a.store.saveData(p.id, { classes: [{ id: 'viejo' }] });
    await a.espejo.vaciar();
    expect(await leer(a.local.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ classes: [{ id: 'c1' }] });
    expect(await leer(carpeta.fs, `AulaPro/perfiles/${p.id}/datos.json`)).toEqual({ classes: [{ id: 'c1' }] });
  });
});
