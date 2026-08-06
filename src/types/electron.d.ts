/** Puente que expone el proceso principal de Electron (electron/preload.cjs). */

export interface ClassroomActivity {
  id: string;
  type: 'rubric' | 'brainstorm' | 'poll';
  title: string;
  prompt?: string;
  items?: { id: string; name: string }[];
  options?: string[];
}

export interface ClassroomResponse {
  n: number | null;
  name: string;
  activityId: string | null;
  type: string | null;
  data: {
    scores?: Record<string, number>;
    choice?: number;
    ideas?: string[];
  } | null;
  at: string;
}

export interface ClassroomSnapshot {
  running: boolean;
  port: number | null;
  code: string | null;
  /** Nombre de la clase, para que un alumno no confunda esta sala con otra. */
  label: string;
  addresses: { iface: string; ip: string }[];
  activity: ClassroomActivity | null;
  responses: ClassroomResponse[];
  connected: number;
  error?: string;
}

export interface ClassroomBridge {
  start: (opts: { roster: { n: number; name: string }[]; activity: ClassroomActivity | null; label?: string }) => Promise<ClassroomSnapshot>;
  stop: () => Promise<ClassroomSnapshot>;
  state: () => Promise<ClassroomSnapshot>;
  setActivity: (activity: ClassroomActivity | null) => Promise<ClassroomSnapshot>;
  setRoster: (roster: { n: number; name: string }[], label?: string) => Promise<ClassroomSnapshot>;
  onUpdate: (cb: (snapshot: ClassroomSnapshot) => void) => () => void;
}

export interface DocsBridge {
  /** Genera el PDF y abre el diálogo de guardar. */
  savePdf: (html: string, suggestedName?: string) =>
    Promise<{ ok?: boolean; path?: string; canceled?: boolean; error?: string }>;
  /** Abre el diálogo de impresión del sistema con el documento solo. */
  print: (html: string) =>
    Promise<{ ok?: boolean; canceled?: boolean; reason?: string; error?: string }>;
  /** Muestra el archivo recién guardado en el explorador. */
  reveal: (filePath: string) => Promise<void>;
}

/** Resultado de guardar o imprimir un documento. */
export interface DocsResult {
  ok?: boolean;
  /** El docente cerró el diálogo sin guardar ni imprimir. */
  canceled?: boolean;
  error?: string;
  reason?: string;
  /** Ruta del PDF guardado. */
  path?: string;
}

export interface DocsBridge {
  /** Genera el PDF y pregunta dónde guardarlo. Sin diálogo de impresora. */
  savePdf: (html: string, suggestedName?: string) => Promise<DocsResult>;
  /** Abre el diálogo de impresión del sistema con el documento solo. */
  print: (html: string) => Promise<DocsResult>;
  /** Muestra el archivo en el explorador. */
  reveal: (filePath: string) => Promise<void>;
}

export interface StoreBridge {
  listProfiles: () => Promise<unknown>;
  createProfile: (p: unknown) => Promise<unknown>;
  updateProfile: (id: string, patch: unknown) => Promise<unknown>;
  touchProfile: (id: string) => Promise<unknown>;
  deleteProfile: (id: string) => Promise<unknown>;
  loadData: (id: string) => Promise<unknown>;
  saveData: (id: string, data: unknown) => Promise<unknown>;
  backup: (id: string) => Promise<unknown>;
  listBackups: (id: string) => Promise<unknown>;
  restoreBackup: (id: string, file: string) => Promise<unknown>;
  clearBackups: (id: string) => Promise<unknown>;
  folderInfo: (id: string) => Promise<unknown>;
  openFolder: (id: string) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      platform: string;
      version: string;
      store?: StoreBridge;
      classroom?: ClassroomBridge;
      docs?: DocsBridge;
    };
  }
}

export {};
