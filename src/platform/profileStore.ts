/**
 * Guardado por perfiles para Android: la misma estructura de carpetas y las
 * mismas reglas que `electron/storage.cjs` en el escritorio, sobre un sistema
 * de archivos cualquiera (en la app, el almacenamiento privado de Aula Pro vía
 * Capacitor; en las pruebas, uno en memoria).
 *
 *   AulaPro/
 *     perfiles.json            índice de docentes
 *     perfiles/<id>/datos.json todo el trabajo del perfil
 *     perfiles/<id>/copias/    copias de seguridad con fecha
 *
 * Así una copia hecha en el ordenador se puede cargar en la tableta y al revés.
 */
import type { BackupInfo, FolderInfo, TeacherProfile } from '../services/storage';

export interface FsEntry { name: string; type: 'file' | 'directory'; size: number; mtime: number }

export interface Fs {
  /** `null` si el archivo no existe. */
  read: (path: string) => Promise<string | null>;
  /** Crea las carpetas que falten. */
  write: (path: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  removeDir: (path: string) => Promise<void>;
  /** Vacío si la carpeta no existe. */
  list: (path: string) => Promise<FsEntry[]>;
}

export const MAX_BACKUPS = 12;
const ROOT = 'AulaPro';
const PROFILES_FILE = `${ROOT}/perfiles.json`;

const safeId = (id: string) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');
const profileDir = (id: string) => `${ROOT}/perfiles/${safeId(id)}`;
const dataFile = (id: string) => `${profileDir(id)}/datos.json`;
const backupsDir = (id: string) => `${profileDir(id)}/copias`;

export function createProfileStore(fs: Fs) {
  /**
   * Las escrituras de un mismo archivo van en fila: la app guarda cada pocos
   * cientos de milisegundos y dos escrituras a la vez sobre el mismo temporal
   * podrían dejarlo a medias.
   */
  const queues = new Map<string, Promise<unknown>>();
  function serial<T>(file: string, job: () => Promise<T>): Promise<T> {
    const next = (queues.get(file) ?? Promise.resolve()).then(job, job);
    queues.set(file, next.catch(() => undefined));
    return next;
  }

  /** Escritura segura: primero a un temporal y luego se sustituye. */
  const writeJson = (file: string, value: unknown) => serial(file, async () => {
    await fs.write(`${file}.tmp`, JSON.stringify(value, null, 1));
    await fs.rename(`${file}.tmp`, file);
  });

  async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.read(file);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async function listProfiles(): Promise<TeacherProfile[]> {
    const list = await readJson<unknown>(PROFILES_FILE, []);
    return Array.isArray(list) ? list : [];
  }

  async function updateProfile(id: string, patch: Partial<TeacherProfile>) {
    const list = await listProfiles();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, id };
    await writeJson(PROFILES_FILE, list);
    return list[idx];
  }

  const loadData = (id: string) => readJson<Record<string, unknown>>(dataFile(id), {});

  async function listBackups(id: string): Promise<BackupInfo[]> {
    const files = (await fs.list(backupsDir(id))).filter(f => f.type === 'file' && f.name.startsWith('copia-') && f.name.endsWith('.json'));
    return files
      .map(f => ({ file: f.name, size: f.size, at: new Date(f.mtime).toISOString() }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  async function dirBytes(dir: string): Promise<number> {
    let bytes = 0;
    for (const e of await fs.list(dir)) {
      bytes += e.type === 'directory' ? await dirBytes(`${dir}/${e.name}`) : e.size;
    }
    return bytes;
  }

  return {
    listProfiles,

    async createProfile(p: { name?: string; school?: string; subject?: string; course?: string }) {
      const list = await listProfiles();
      const now = new Date().toISOString();
      const profile: TeacherProfile = {
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: String(p.name || 'Docente').slice(0, 80),
        school: String(p.school || '').slice(0, 120),
        subject: String(p.subject || '').slice(0, 120),
        course: String(p.course || '').slice(0, 20),
        createdAt: now,
        lastOpenedAt: now,
      };
      list.push(profile);
      await writeJson(PROFILES_FILE, list);
      await writeJson(dataFile(profile.id), {});
      return profile;
    },

    updateProfile,
    touchProfile: (id: string) => updateProfile(id, { lastOpenedAt: new Date().toISOString() }),

    async deleteProfile(id: string) {
      const list = await listProfiles();
      await writeJson(PROFILES_FILE, list.filter(p => p.id !== id));
      try { await fs.removeDir(profileDir(id)); } catch { /* la carpeta ya no estaba */ }
      return true;
    },

    loadData,
    async saveData(id: string, data: unknown) {
      await writeJson(dataFile(id), data);
      return true;
    },

    async backup(id: string) {
      const data = await loadData(id);
      if (!data || Object.keys(data).length === 0) return null;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = `${backupsDir(id)}/copia-${stamp}.json`;
      await writeJson(file, data);
      // Solo se conservan las más recientes
      const names = (await fs.list(backupsDir(id))).map(f => f.name).filter(n => n.startsWith('copia-') && n.endsWith('.json')).sort();
      for (const old of names.slice(0, Math.max(0, names.length - MAX_BACKUPS))) {
        await fs.remove(`${backupsDir(id)}/${old}`).catch(() => {});
      }
      return file;
    },

    listBackups,

    async restoreBackup(id: string, file: string) {
      const safe = String(file).split('/').pop() ?? '';
      const data = await readJson<unknown>(`${backupsDir(id)}/${safe}`, null);
      if (!data) return false;
      await writeJson(dataFile(id), data);
      return true;
    },

    async clearBackups(id: string) {
      try { await fs.removeDir(backupsDir(id)); } catch { /* ya no existía */ }
      return true;
    },

    async folderInfo(id: string): Promise<FolderInfo> {
      return { path: profileDir(id), bytes: await dirBytes(profileDir(id)), backups: await listBackups(id) };
    },

    /** En Android la carpeta es privada de la app: no hay explorador que abrir. */
    async openFolder() { return ''; },
  };
}
