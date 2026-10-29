/**
 * Los dos sitios donde la versión web guarda archivos, con la misma forma
 * (`Fs`) que el almacenamiento privado de Android, para que `profileStore`
 * funcione igual en los tres:
 *
 *  - `idbFs`: dentro del navegador, en IndexedDB. Siempre está, en todos los
 *    sistemas (Windows, Mac, Android, iPhone, iPad).
 *  - `carpetaFs`: una carpeta del ordenador que elige el docente (Chrome y Edge
 *    de escritorio, con la API de acceso a archivos). Si es la de OneDrive o
 *    Google Drive, su programa la copia en su nube.
 *
 * `idbKv` guarda los ajustes de la versión web (la licencia, la clave de la
 * IA, la carpeta elegida) en el mismo IndexedDB.
 */
import type { Fs, FsEntry } from './profileStore';

const DB = 'aulapro';
const ARCHIVOS = 'archivos';
const AJUSTES = 'ajustes';

interface Archivo { data: string; mtime: number }

let abierta: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  return (abierta ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARCHIVOS)) db.createObjectStore(ARCHIVOS);
      if (!db.objectStoreNames.contains(AJUSTES)) db.createObjectStore(AJUSTES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { abierta = null; reject(req.error); };
  }));
}

/** Una transacción: `fn` pide lo que quiera y se resuelve cuando la transacción se completa. */
async function tx<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => resolve(req ? req.result : (undefined as T));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const rango = (dir: string) => IDBKeyRange.bound(`${dir}/`, `${dir}/￿`);

/** Las entradas que hay justo dentro de `dir`, a partir de las rutas completas. */
export function hijosDe(dir: string, rutas: [string, Archivo][]): FsEntry[] {
  const out = new Map<string, FsEntry>();
  for (const [ruta, a] of rutas) {
    if (!ruta.startsWith(`${dir}/`)) continue;
    const [name, ...resto] = ruta.slice(dir.length + 1).split('/');
    if (!name) continue;
    if (resto.length) { if (!out.has(name)) out.set(name, { name, type: 'directory', size: 0, mtime: 0 }); }
    else out.set(name, { name, type: 'file', size: a.data.length, mtime: a.mtime });
  }
  return [...out.values()];
}

export const idbFs: Fs = {
  async read(path) {
    const a = await tx<Archivo | undefined>(ARCHIVOS, 'readonly', s => s.get(path));
    return a ? a.data : null;
  },
  async write(path, data) {
    await tx(ARCHIVOS, 'readwrite', s => { s.put({ data, mtime: Date.now() } satisfies Archivo, path); });
  },
  /** En una sola transacción: o se mueve entero o no se mueve. */
  async rename(from, to) {
    await tx(ARCHIVOS, 'readwrite', s => {
      const req = s.get(from);
      req.onsuccess = () => {
        if (!req.result) return;
        s.put(req.result, to);
        s.delete(from);
      };
    });
  },
  async remove(path) {
    await tx(ARCHIVOS, 'readwrite', s => { s.delete(path); });
  },
  async removeDir(path) {
    await tx(ARCHIVOS, 'readwrite', s => { s.delete(rango(path)); });
  },
  async list(path) {
    const db = await abrir();
    const rutas = await new Promise<[string, Archivo][]>((resolve, reject) => {
      const out: [string, Archivo][] = [];
      const req = db.transaction(ARCHIVOS, 'readonly').objectStore(ARCHIVOS).openCursor(rango(path));
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(out); return; }
        out.push([String(c.key), c.value as Archivo]);
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
    return hijosDe(path, rutas);
  },
};

export interface Kv {
  get: <T = unknown>(clave: string) => Promise<T | undefined>;
  set: (clave: string, valor: unknown) => Promise<void>;
  del: (clave: string) => Promise<void>;
}

export const idbKv: Kv = {
  get: clave => tx(AJUSTES, 'readonly', s => s.get(clave)),
  set: async (clave, valor) => { await tx(AJUSTES, 'readwrite', s => { s.put(valor, clave); }); },
  del: async clave => { await tx(AJUSTES, 'readwrite', s => { s.delete(clave); }); },
};

/* ── Carpeta del ordenador ── */

type Dir = FileSystemDirectoryHandle;

/** La carpeta `partes` dentro de `raiz`; con `crear`, la crea si falta. `null` si no existe. */
async function carpetaDe(raiz: Dir, partes: string[], crear: boolean): Promise<Dir | null> {
  let d = raiz;
  for (const p of partes) {
    try { d = await d.getDirectoryHandle(p, { create: crear }); } catch (err) {
      if (!crear && (err as DOMException)?.name === 'NotFoundError') return null;
      throw err;
    }
  }
  return d;
}

const partir = (path: string) => {
  const partes = path.split('/').filter(Boolean);
  return { dirs: partes.slice(0, -1), nombre: partes[partes.length - 1] ?? '' };
};

export function carpetaFs(raiz: Dir): Fs {
  const fs: Fs = {
    async read(path) {
      const { dirs, nombre } = partir(path);
      try {
        const d = await carpetaDe(raiz, dirs, false);
        if (!d) return null;
        return await (await (await d.getFileHandle(nombre)).getFile()).text();
      } catch (err) {
        if ((err as DOMException)?.name === 'NotFoundError') return null;
        throw err;
      }
    },
    /** `createWritable` escribe en un temporal y lo sustituye al cerrar: no quedan archivos a medias. */
    async write(path, data) {
      const { dirs, nombre } = partir(path);
      const d = await carpetaDe(raiz, dirs, true);
      const w = await (await d!.getFileHandle(nombre, { create: true })).createWritable();
      await w.write(data);
      await w.close();
    },
    async rename(from, to) {
      const data = await fs.read(from);
      if (data == null) return;
      await fs.write(to, data);
      await fs.remove(from);
    },
    async remove(path) {
      const { dirs, nombre } = partir(path);
      const d = await carpetaDe(raiz, dirs, false);
      try { await d?.removeEntry(nombre); } catch { /* ya no estaba */ }
    },
    async removeDir(path) {
      const { dirs, nombre } = partir(path);
      const d = await carpetaDe(raiz, dirs, false);
      try { await d?.removeEntry(nombre, { recursive: true }); } catch { /* ya no estaba */ }
    },
    async list(path) {
      const d = await carpetaDe(raiz, partir(`${path}/x`).dirs, false);
      if (!d) return [];
      const out: FsEntry[] = [];
      for await (const h of (d as Dir & { values: () => AsyncIterable<FileSystemHandle> }).values()) {
        if (h.kind === 'directory') out.push({ name: h.name, type: 'directory', size: 0, mtime: 0 });
        else {
          const f = await (h as FileSystemFileHandle).getFile();
          out.push({ name: h.name, type: 'file', size: f.size, mtime: f.lastModified });
        }
      }
      return out;
    },
  };
  return fs;
}
