import { describe, it, expect, vi } from 'vitest';
import { createProfileStore, DatosIlegibles, MAX_BACKUPS, type Fs } from './profileStore';
import { contenidoDe, perfilVacio, textoDePerfilVacio } from '../lib/contenidoPerfil';

/** Sistema de archivos en memoria, con la misma forma que el de Capacitor. */
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
        const rest = k.slice(dir.length + 1);
        const [name, ...more] = rest.split('/');
        out.set(name, more.length ? { name, type: 'directory', size: 0, mtime: 0 } : { name, type: 'file', size: v.data.length, mtime: v.mtime });
      }
      return [...out.values()];
    },
  };
  return { fs, files };
}

describe('guardado por perfiles en Android', () => {
  it('crea el perfil con la misma estructura de carpetas que el escritorio', async () => {
    const { fs, files } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana García', school: 'IES Ejemplo', subject: 'Mates', course: '2026-2027' });
    expect(await store.listProfiles()).toEqual([p]);
    expect(files.has('AulaPro/perfiles.json')).toBe(true);
    expect(files.has(`AulaPro/perfiles/${p.id}/datos.json`)).toBe(true);
    expect(await store.loadData(p.id)).toEqual({});
  });

  it('guarda y lee los datos sin dejar temporales', async () => {
    const { fs, files } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await store.saveData(p.id, { aulapro_classes: [{ id: 'c1' }] });
    expect(await store.loadData(p.id)).toEqual({ aulapro_classes: [{ id: 'c1' }] });
    expect([...files.keys()].some(k => k.endsWith('.tmp'))).toBe(false);
  });

  it('las escrituras seguidas no se pisan: gana la última', async () => {
    const { fs } = memoryFs();
    const slowWrite = fs.write;
    fs.write = async (p, d) => { await new Promise(r => setTimeout(r, Math.random() * 5)); return slowWrite(p, d); };
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await Promise.all([1, 2, 3, 4, 5].map(n => store.saveData(p.id, { n })));
    expect(await store.loadData(p.id)).toEqual({ n: 5 });
  });

  it('copias de seguridad: crea, lista, restaura y conserva solo las últimas', async () => {
    vi.useFakeTimers();
    try {
      const { fs } = memoryFs();
      const store = createProfileStore(fs);
      const p = await store.createProfile({ name: 'Ana' });
      expect(await store.backup(p.id)).toBeNull(); // sin datos no hay copia
      await store.saveData(p.id, { v: 1 });
      for (let i = 0; i < MAX_BACKUPS + 3; i++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 9, 1, 10, 0, i)));
        await store.backup(p.id);
      }
      const list = await store.listBackups(p.id);
      expect(list).toHaveLength(MAX_BACKUPS);
      await store.saveData(p.id, { v: 2 });
      expect(await store.restoreBackup(p.id, list[0].file)).toBe(true);
      expect(await store.loadData(p.id)).toEqual({ v: 1 });
      const info = await store.folderInfo(p.id);
      expect(info.backups).toHaveLength(MAX_BACKUPS);
      expect(info.bytes).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('borrar un perfil quita su carpeta y lo saca del índice', async () => {
    const { fs, files } = memoryFs();
    const store = createProfileStore(fs);
    const a = await store.createProfile({ name: 'Ana' });
    const b = await store.createProfile({ name: 'Luis' });
    await store.deleteProfile(a.id);
    expect((await store.listProfiles()).map(p => p.id)).toEqual([b.id]);
    expect([...files.keys()].some(k => k.includes(a.id))).toBe(false);
  });

  it('un nombre de copia con ruta no sale de la carpeta del perfil', async () => {
    const { fs } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await fs.write('AulaPro/perfiles.json.bak', '{"robado":true}');
    expect(await store.restoreBackup(p.id, '../../perfiles.json.bak')).toBe(false);
  });
});

/**
 * Auditoría del 1-11-2026: si los datos no se pueden leer, nunca se abre un perfil vacío (el guardado automático lo
 * escribiría encima de los buenos y la copia lo subiría al Drive), y una copia vacía no sustituye a las buenas.
 */
describe('datos que no se pueden leer', () => {
  it('un fallo al leer datos.json lanza DatosIlegibles en vez de devolver un perfil vacío', async () => {
    const { fs } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await store.saveData(p.id, { classes: [{ id: 'c1' }] });
    const leer = fs.read;
    fs.read = async ruta => { if (ruta.endsWith('datos.json')) throw new DOMException('Connection lost', 'UnknownError'); return leer(ruta); };
    await expect(store.loadData(p.id)).rejects.toBeInstanceOf(DatosIlegibles);
    await expect(store.loadData(p.id)).rejects.toMatchObject({ causa: 'lectura' });
  });

  it('un datos.json dañado lanza DatosIlegibles («formato»); sin archivo, el perfil está vacío', async () => {
    const { fs } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await fs.write(`AulaPro/perfiles/${p.id}/datos.json`, '{"classes": [');
    await expect(store.loadData(p.id)).rejects.toMatchObject({ causa: 'formato' });
    await fs.write(`AulaPro/perfiles/${p.id}/datos.json`, '[1, 2]');
    await expect(store.loadData(p.id)).rejects.toMatchObject({ causa: 'formato' });
    await fs.remove(`AulaPro/perfiles/${p.id}/datos.json`);
    expect(await store.loadData(p.id)).toEqual({});
  });

  it('un fallo al leer la lista de perfiles no la da por vacía, y una lista dañada se rehace con las carpetas', async () => {
    const { fs } = memoryFs();
    const store = createProfileStore(fs);
    const a = await store.createProfile({ name: 'Ana' });
    await fs.write('AulaPro/perfiles.json', '[{"id":');
    expect((await store.listProfiles()).map(p => p.id)).toEqual([a.id]);
    const leer = fs.read;
    fs.read = async ruta => { if (ruta.endsWith('perfiles.json')) throw new DOMException('closed', 'InvalidStateError'); return leer(ruta); };
    await expect(store.listProfiles()).rejects.toBeInstanceOf(DatosIlegibles);
  });

  it('un perfil vacío no se copia: no va sustituyendo a las copias buenas', async () => {
    const { fs } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await store.saveData(p.id, { classes: [], students: [], grades: {}, apoyo: { alumnos: [] }, auditLog: [{ id: 'x' }] });
    expect(await store.backup(p.id)).toBeNull();
    await store.saveData(p.id, { classes: [{ id: 'c1' }], auditLog: [] });
    expect(await store.backup(p.id)).not.toBeNull();
  });

  it('restaurar una copia guarda antes lo de ahora, para poder deshacerlo', async () => {
    const { fs } = memoryFs();
    const store = createProfileStore(fs);
    const p = await store.createProfile({ name: 'Ana' });
    await store.saveData(p.id, { classes: [{ id: 'vieja' }] });
    const copia = (await store.backup(p.id))!.split('/').pop()!;
    await store.saveData(p.id, { classes: [{ id: 'nueva' }] });
    expect(await store.restoreBackup(p.id, copia)).toBe(true);
    expect(await store.loadData(p.id)).toEqual({ classes: [{ id: 'vieja' }] });
    const antes = (await store.listBackups(p.id)).find(b => b.file.endsWith('-antes-de-restaurar.json'));
    expect(antes).toBeTruthy();
  });
});

describe('contenido de un perfil', () => {
  it('el perfil vacío de la app no tiene contenido; con una clase, una nota o un alumno de apoyo, sí', () => {
    const vacio = {
      tasks: [], classes: [], students: [], grades: {}, attendance: {}, seatingPlans: {},
      apoyo: { alumnos: [], grupos: [] }, ef: { exentos: [], niveles: {}, sesiones: [] }, auditLog: [{ id: 'a' }],
    };
    expect(perfilVacio(vacio)).toBe(true);
    expect(contenidoDe({ ...vacio, classes: [{ id: 'c' }] })).toBe(1);
    expect(perfilVacio({ ...vacio, grades: { alu1: { item1: 7 } } })).toBe(false);
    expect(perfilVacio({ ...vacio, apoyo: { alumnos: [{ id: 'x' }] } })).toBe(false);
    expect(perfilVacio({ ...vacio, ef: { niveles: { alu1: 2 } } })).toBe(false);
  });

  it('a partir del texto: sin archivo o vacío cuenta como vacío; un texto ilegible, no', () => {
    expect(textoDePerfilVacio(null)).toBe(true);
    expect(textoDePerfilVacio('{"classes":[],"auditLog":[{"id":1}]}')).toBe(true);
    expect(textoDePerfilVacio('{"classes":[{"id":1}]}')).toBe(false);
    expect(textoDePerfilVacio('{"classes": [')).toBe(false);
    expect(contenidoDe([1, 2])).toBe(-1);
  });
});
