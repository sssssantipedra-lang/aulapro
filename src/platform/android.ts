/**
 * Aula Pro en Android (Capacitor). Monta en `window.electronAPI` el mismo
 * contrato que da Electron en el escritorio, así el resto de la aplicación no
 * necesita saber en qué plataforma está:
 *
 *  - store:   perfiles y datos en el almacenamiento privado de la app.
 *  - docs:    actas, fichas, SdA… como PDF, guardado directamente en
 *             Documentos › AulaPro › (carpeta del tipo de documento), con un
 *             aviso que lleva a él. Si no se puede (Android anterior al 10, o
 *             un fallo), al diálogo de impresión del sistema, que también
 *             ofrece «Guardar como PDF».
 *  - secrets: la clave de la IA cifrada con el Android Keystore.
 *  - files:   los Word, CSV y copias, igual: Documentos › AulaPro › carpeta,
 *             con el aviso, y desde él se pueden compartir (Drive, correo…).
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
import { CARPETA_RAIZ, nombreDeCarpeta } from '../lib/carpetas';
import { avisarGuardado, type Guardado } from '../lib/guardado';
import type { ClassroomBridge, ClassroomSnapshot, DocsBridge, DocsResult, FilesBridge, StoreBridge } from '../types/electron';

interface AulaNativePlugin {
  print: (o: { html: string; name: string; landscape: boolean }) => Promise<{ ok: boolean }>;
  /** Guarda un PDF en Documentos/AulaPro/<folder> sin diálogo (Android 10 o más; si no, falla). */
  savePdfInDocuments: (o: { html: string; name: string; landscape: boolean; folder: string }) => Promise<{ uri: string; name: string }>;
  saveFileInDocuments: (o: { base64: string; name: string; mime: string; folder: string }) => Promise<{ uri: string; name: string }>;
  openFile: (o: { uri: string; mime: string }) => Promise<void>;
  openFolder: (o: { folder: string }) => Promise<{ existe?: boolean } | void>;
  openAppSettings: () => Promise<void>;
  setTextZoom: (o: { percent: number }) => Promise<void>;
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

const MIME: Record<string, string> = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv', json: 'application/json', txt: 'text/plain', png: 'image/png',
};
const mimeDe = (nombre: string, blob?: Blob) => (blob?.type && blob.type !== 'application/octet-stream'
  ? blob.type.split(';')[0]
  : MIME[nombre.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');

/** Avisa a la pantalla de que se ha guardado un archivo (ver `components/AvisoGuardado.tsx`). */
const anunciar = (carpeta: string, mime: string, r: { uri: string; name: string }): Guardado => {
  const g = { nombre: r.name, carpeta, uri: r.uri, mime };
  avisarGuardado(g);
  return g;
};

const docs: DocsBridge = {
  async savePdf(html, suggestedName, opts): Promise<DocsResult> {
    const landscape = opts?.landscape ?? true;
    const carpeta = nombreDeCarpeta(opts?.carpeta);
    try {
      const r = await AulaNative.savePdfInDocuments({ html, name: `${docName(suggestedName)}.pdf`, landscape, folder: carpeta });
      anunciar(carpeta, 'application/pdf', r);
      return { ok: true, path: `Documents/${CARPETA_RAIZ}/${carpeta}/${r.name}` };
    } catch {
      // Android anterior al 10 o un fallo al escribir: el diálogo del sistema, como antes
    }
    try {
      await AulaNative.print({ html, name: docName(suggestedName), landscape });
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
  async reveal() { /* en Android, el aviso de «Guardado» tiene el botón que lleva a la carpeta */ },
  async openFolder() {
    const r = await AulaNative.openFolder({ folder: '' });
    return { existe: !r || r.existe !== false };
  },
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
  async save(blob, filename, carpeta) {
    const safe = filename.replace(/[\\/:*?"<>|]+/g, '-');
    const folder = nombreDeCarpeta(carpeta);
    const mime = mimeDe(safe, blob);
    try {
      anunciar(folder, mime, await AulaNative.saveFileInDocuments({ base64: await blobToBase64(blob), name: safe, mime, folder }));
      return;
    } catch {
      // Android anterior al 10 o un fallo al escribir: el menú de compartir, como antes
    }
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

/** Para los botones del aviso de «Guardado»: abrir el archivo, ir a su carpeta o compartirlo. */
export const guardadoAndroid = {
  abrir: (g: Guardado) => AulaNative.openFile({ uri: g.uri, mime: g.mime }),
  /** La carpeta; si el sistema no sabe abrirla, el propio archivo. */
  async abrirCarpeta(g: Guardado) {
    try { await AulaNative.openFolder({ folder: g.carpeta }); } catch { await AulaNative.openFile({ uri: g.uri, mime: g.mime }); }
  },
  async compartir(g: Guardado) {
    try { await Share.share({ title: g.nombre, files: [g.uri], dialogTitle: g.nombre }); } catch { /* cerró el menú */ }
  },
};

export function installAndroidBridge() {
  window.electronAPI = {
    isDesktop: false,
    platform: 'android',
    version: '',
    store: createProfileStore(fs) as unknown as StoreBridge,
    docs,
    files,
    // Para el micrófono o la cámara negados: los ajustes de la app, donde se activan
    app: {
      openSettings: () => AulaNative.openAppSettings(),
      // Solo las letras: el zoom de texto del WebView (ver lib/tamanoLetra.ts)
      setTextScale: factor => AulaNative.setTextZoom({ percent: Math.round(factor * 100) }),
    },
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
