import { describe, it, expect, vi } from 'vitest';
import { createProfileStore, MAX_BACKUPS, type Fs } from './profileStore';

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
