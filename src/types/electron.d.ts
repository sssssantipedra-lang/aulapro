/**
 * Puente con la parte nativa de la aplicación: el proceso principal de
 * Electron en Windows y Mac (electron/preload.cjs) y, en Android, el mismo
 * contrato hecho con Capacitor (src/platform/android.ts). Lo que una
 * plataforma no tiene (la sala de alumnos o las actualizaciones en Android)
 * simplemente no aparece.
 */

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
  /**
   * Genera el PDF y pregunta dónde guardarlo. Sin diálogo de impresora.
   * `landscape` por defecto es `true` (como las actas y la SdA); pásalo en
   * `false` para un documento vertical, como una ficha de trabajo.
   * `carpeta` (ver `lib/carpetas.ts`): en qué carpeta de «Documentos › AulaPro»
   * se guarda (en el ordenador, la que propone el diálogo).
   */
  savePdf: (html: string, suggestedName?: string, opts?: { landscape?: boolean; carpeta?: string }) => Promise<DocsResult>;
  /** Abre el diálogo de impresión del sistema con el documento solo. */
  print: (html: string) => Promise<DocsResult>;
  /** Muestra el archivo en el explorador. */
  reveal: (filePath: string) => Promise<void>;
  /**
   * Abre «Documentos › AulaPro», donde se guarda lo que genera la app.
   * `existe: false` si todavía no se había guardado nada; `abierto: false`
   * (solo Android) si el sistema no pudo abrir la carpeta y hay que orientar
   * al docente a buscarla a mano.
   */
  openFolder?: () => Promise<{ existe: boolean; abierto?: boolean }>;
}

export interface UpdateStatus {
  state: 'downloading' | 'ready' | 'error';
  version?: string;
  message?: string;
}

export interface UpdateBridge {
  /** Avisa cuando hay una actualización descargándose o lista. Devuelve una función para dejar de escuchar. */
  onStatus: (cb: (status: UpdateStatus) => void) => () => void;
  installNow: () => Promise<void>;
  /**
   * Idioma en el que escribir el aviso del sistema. El proceso principal no
   * puede leer el diccionario de la interfaz, así que se lo decimos nosotros.
   */
  setLanguage: (lang: 'es' | 'en' | 'ca') => Promise<void>;
}

export type LicenseStatus = 'fundador' | 'activa' | 'sin-licencia' | 'otro-equipo';
export type LicenseError = 'clave-no-valida' | 'limite' | 'desactivada' | 'otra-tienda' | 'sin-conexion' | 'error-tienda' | 'sin-licencia';

export interface LicenseState {
  /** Hay que enseñar la pantalla de activación antes de nada. */
  required: boolean;
  status: LicenseStatus;
  /** Si la venta ya ha empezado (antes, todo equipo queda como fundador). */
  enforced: boolean;
  /** Final de la clave (••••ABCD), nunca entera. */
  keyHint: string;
  since: string;
  /** Página donde se compra; vacía mientras no haya tienda. */
  buyUrl: string;
  /** Versión web: hasta cuándo vale la firma de la licencia (ms). Para renovarla a tiempo, no para fiarse. */
  firmaHasta?: number;
  /** Versión web: de dónde viene la licencia: la compra de la cuenta o una clave escrita a mano. */
  origen?: 'cuenta' | 'clave';
  /** Última vez que la tienda la dio por buena (ISO). */
  comprobada?: string;
}

export interface LicenseResult { ok: boolean; error?: LicenseError; state: LicenseState }

export interface LicenseBridge {
  state: () => Promise<LicenseState>;
  activate: (key: string) => Promise<LicenseResult>;
  /** Libera este equipo para poder activar la clave en otro. */
  deactivate: () => Promise<LicenseResult>;
  /**
   * Solo en la versión web: la licencia comprada con el correo de la cuenta de
   * Google (ya comprobada por el servidor). No ocupa ninguno de los 2
   * dispositivos: la cuenta entra en todos los que quiera (decisión del dueño,
   * 29-10-2026). `null` la quita (se devolvió o se anuló).
   */
  porCuenta?: (key: string | null, firma?: string) => Promise<LicenseState>;
}

export interface StoreBridge {
  listProfiles: () => Promise<unknown>;
  createProfile: (p: unknown) => Promise<unknown>;
  updateProfile: (id: string, patch: unknown) => Promise<unknown>;
  touchProfile: (id: string) => Promise<unknown>;
  deleteProfile: (id: string) => Promise<unknown>;
  loadData: (id: string) => Promise<unknown>;
  saveData: (id: string, data: unknown) => Promise<unknown>;
  backup: (id: string, motivo?: 'antes-de-vaciar') => Promise<unknown>;
  listBackups: (id: string) => Promise<unknown>;
  restoreBackup: (id: string, file: string) => Promise<unknown>;
  clearBackups: (id: string) => Promise<unknown>;
  folderInfo: (id: string) => Promise<unknown>;
  openFolder: (id: string) => Promise<unknown>;
}

/** Guardar un archivo generado (Word, CSV, copia…) donde el docente elija. */
export interface FilesBridge {
  /** `carpeta`: en qué carpeta de «Documentos › AulaPro» se guarda (ver `lib/carpetas.ts`); en el ordenador, la que propone el diálogo. */
  save: (blob: Blob, filename: string, carpeta?: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      /** `process.platform` en escritorio ('win32', 'darwin'…) o 'android'. */
      platform: string;
      version: string;
      store?: StoreBridge;
      classroom?: ClassroomBridge;
      docs?: DocsBridge;
      update?: UpdateBridge;
      license?: LicenseBridge;
      files?: FilesBridge;
      /** Atajos al sistema. */
      app?: {
        /** Solo en Android: los ajustes de la app, donde se activan los permisos negados. */
        openSettings?: () => Promise<void>;
        /** Tamaño de las letras: 1 es el normal (ver `lib/tamanoLetra.ts`). */
        setTextScale?: (factor: number) => Promise<void> | void;
      };
      secrets?: {
        get: (name: 'gemini') => Promise<string>;
        /** `false` si el sistema no ofrece cifrado: entonces no se ha guardado. */
        set: (name: 'gemini', value: string) => Promise<boolean>;
      };
    };
  }
}

export {};
