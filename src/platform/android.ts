/**
 * Aula Pro en Android (Capacitor). Monta en `window.electronAPI` el mismo
 * contrato que da Electron en el escritorio, así el resto de la aplicación no
 * necesita saber en qué plataforma está:
 *
 *  - store:   perfiles y datos en el almacenamiento privado de la app.
 *  - docs:    actas, fichas, SdA… al diálogo de impresión del sistema, que
 *             también ofrece «Guardar como PDF».
 *  - secrets: la clave de la IA cifrada con el Android Keystore.
 *  - files:   los Word, CSV y copias se comparten (Drive, correo, Archivos…).
 *
 *  - classroom: la Sala de alumnos, con un servidor en la propia tableta
 *             (RoomServer.java) y la misma lógica y página que el escritorio.
 *
 * Lo nativo está en android/app/src/main/java/es/aulapro/app/. Las
 * actualizaciones automáticas no están: en Android actualiza Google Play.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { createProfileStore, type Fs } from './profileStore';
import { createRoom, type RoomRequest } from './classroomRoom';
import { createAndroidLicense } from './androidLicense';
import studentPage from '../../electron/student.html?raw';
import type { ClassroomBridge, ClassroomSnapshot, DocsBridge, DocsResult, FilesBridge, StoreBridge } from '../types/electron';

interface AulaNativePlugin {
  print: (o: { html: string; name: string; landscape: boolean }) => Promise<{ ok: boolean }>;
  secretGet: (o: { name: string }) => Promise<{ value: string }>;
  secretSet: (o: { name: string; value: string }) => Promise<{ ok: boolean }>;
  roomStart: () => Promise<{ port: number; addresses: { iface: string; ip: string }[] }>;
  roomStop: () => Promise<void>;
  roomAddresses: () => Promise<{ addresses: { iface: string; ip: string }[] }>;
  roomRespond: (o: { id: string; status: number; type: string; body: string }) => Promise<void>;
  addListener: (event: 'roomRequest', fn: (req: RoomRequest & { id: string }) => void) => Promise<PluginListenerHandle>;
}

const AulaNative = registerPlugin<AulaNativePlugin>('AulaNative');

const DATA = Directory.Data;

const fs: Fs = {
  async read(path) {
    try {
      const { data } = await Filesystem.readFile({ path, directory: DATA, encoding: Encoding.UTF8 });
      return typeof data === 'string' ? data : await data.text();
    } catch {
      return null;
    }
  },
  async write(path, data) {
    await Filesystem.writeFile({ path, data, directory: DATA, encoding: Encoding.UTF8, recursive: true });
  },
  async rename(from, to) {
    await Filesystem.rename({ from, to, directory: DATA, toDirectory: DATA });
  },
  async remove(path) {
    await Filesystem.deleteFile({ path, directory: DATA });
  },
  async removeDir(path) {
    await Filesystem.rmdir({ path, directory: DATA, recursive: true });
  },
  async list(path) {
    try {
      const { files } = await Filesystem.readdir({ path, directory: DATA });
      return files.map(f => ({ name: f.name, type: f.type, size: f.size, mtime: f.mtime }));
    } catch {
      return [];
    }
  },
};

/** Nombre del documento sin extensión: es el que propone Android al guardar el PDF. */
const docName = (name?: string) => (name || 'Aula Pro').replace(/\.pdf$/i, '');

const docs: DocsBridge = {
  async savePdf(html, suggestedName, opts): Promise<DocsResult> {
    try {
      await AulaNative.print({ html, name: docName(suggestedName), landscape: opts?.landscape ?? true });
      // Desde aquí manda el diálogo del sistema (guardar, imprimir o cancelar):
      // la app no sabe cómo acaba, así que no se anuncia nada.
      return { canceled: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
  async print(html) {
    try {
      await AulaNative.print({ html, name: 'Aula Pro', landscape: true });
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
  async reveal() { /* en Android no hay explorador de archivos que abrir */ },
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const files: FilesBridge = {
  async save(blob, filename) {
    const safe = filename.replace(/[\\/:*?"<>|]+/g, '-');
    const { uri } = await Filesystem.writeFile({
      path: `compartir/${safe}`, data: await blobToBase64(blob), directory: Directory.Cache, recursive: true,
    });
    try {
      await Share.share({ title: safe, files: [uri], dialogTitle: safe });
    } catch {
      // El docente cerró el menú de compartir: no es un error
    }
  },
};

/** Sala de alumnos: el servidor es nativo; qué se contesta, `classroomRoom.ts`. */
function createClassroom(): ClassroomBridge {
  const room = createRoom(studentPage);
  const listeners = new Set<(s: ClassroomSnapshot) => void>();
  const emit = () => { const s = room.snapshot(); listeners.forEach(fn => fn(s)); };

  AulaNative.addListener('roomRequest', req => {
    const { changed, ...reply } = room.handle(req);
    AulaNative.roomRespond({ id: req.id, ...reply }).catch(() => {});
    if (changed) emit();
  });

  return {
    async start(opts) {
      try {
        const net = await AulaNative.roomStart();
        return room.open(opts, net);
      } catch (err) {
        return { ...room.snapshot(), error: err instanceof Error ? err.message : String(err) };
      }
    },
    async stop() {
      await AulaNative.roomStop().catch(() => {});
      return room.close();
    },
    async state() {
      // La wifi puede haber cambiado desde que se abrió la sala
      if (room.snapshot().running) {
        try { room.setAddresses((await AulaNative.roomAddresses()).addresses); } catch { /* se quedan las de antes */ }
      }
      return room.snapshot();
    },
    async setActivity(activity) { return room.setActivity(activity); },
    async setRoster(roster, label) { return room.setRoster(roster, label); },
    onUpdate(cb) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

export function installAndroidBridge() {
  window.electronAPI = {
    isDesktop: false,
    platform: 'android',
    version: '',
    store: createProfileStore(fs) as unknown as StoreBridge,
    docs,
    files,
    classroom: createClassroom(),
    license: createAndroidLicense({
      get: async name => (await AulaNative.secretGet({ name })).value ?? '',
      set: async (name, value) => (await AulaNative.secretSet({ name, value })).ok,
    }),
    secrets: {
      get: async name => (await AulaNative.secretGet({ name })).value ?? '',
      set: async (name, value) => (await AulaNative.secretSet({ name, value })).ok,
    },
  };
}
