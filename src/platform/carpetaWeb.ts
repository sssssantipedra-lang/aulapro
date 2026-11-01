/**
 * La carpeta del ordenador de la versión web, para las pantallas
 * (Configuración › Datos y copias y el aviso de `components/CarpetaWeb.tsx`).
 * La copia en sí la hace `espejo.ts`; aquí se elige la carpeta, se recuerda
 * entre sesiones y se vuelve a pedir el permiso. Sin dependencias pesadas a
 * propósito: lo importan pantallas que también van en el escritorio.
 */
import { carpetaFs, idbKv } from './webFs';
import type { Conexion, Espejo } from './espejo';
import { createDriveFs } from './driveFs';
import { hayVueltaDrive, leerPermisoDrive, pedirPermisoDrive, quitarPermisoDrive, terminarVueltaDrive, tokenDrive } from './googleDrive';
import { hayVueltaOneDrive, leerPermisoOneDrive, oneDriveFs, pedirPermisoOneDrive, quitarPermisoOneDrive, terminarVueltaOneDrive } from './microsoft';
import { cuentaActual, leerCuenta } from './cuentaWeb';
import type { Fs } from './profileStore';

/** El nombre con el que sale el Drive del docente como «carpeta» (ver `driveFs.ts`). */
export const NOMBRE_DRIVE = 'Google Drive';
/** Lo mismo para OneDrive (ver `oneDriveFs.ts`). */
export const NOMBRE_ONEDRIVE = 'OneDrive';
const driveFs = () => createDriveFs(tokenDrive);

/** Dónde guarda su trabajo el docente: Google Drive o OneDrive, según con qué cuenta entró. */
interface Nube {
  nombre: string;
  fs: () => Fs;
  leerPermiso: () => Promise<{ email: string } | undefined>;
  /** Pide el permiso; con la redirección, la página se va a Microsoft o Google y esto no vuelve. */
  pedirPermiso: (email: string) => Promise<unknown>;
  hayVuelta: () => boolean;
  terminarVuelta: (email: string) => Promise<unknown>;
  quitarPermiso: () => Promise<void>;
}
const GOOGLE: Nube = {
  nombre: NOMBRE_DRIVE, fs: driveFs, leerPermiso: leerPermisoDrive, pedirPermiso: pedirPermisoDrive,
  hayVuelta: () => hayVueltaDrive(), terminarVuelta: terminarVueltaDrive, quitarPermiso: quitarPermisoDrive,
};
const ONEDRIVE: Nube = {
  nombre: NOMBRE_ONEDRIVE, fs: oneDriveFs, leerPermiso: leerPermisoOneDrive, pedirPermiso: pedirPermisoOneDrive,
  hayVuelta: hayVueltaOneDrive, terminarVuelta: terminarVueltaOneDrive, quitarPermiso: quitarPermisoOneDrive,
};
/** La nube de una cuenta (por defecto, Google). */
export const nubeDe = (proveedor?: string): Nube => (proveedor === 'microsoft' ? ONEDRIVE : GOOGLE);
const nubeActual = async () => nubeDe((cuentaActual() ?? await leerCuenta())?.proveedor);
/** La nube que está copiando ahora, por el nombre con el que se conectó. */
const nubeConectada = () => { const e = espejo?.estado(); const n = e && 'nombre' in e ? e.nombre : ''; return n === NOMBRE_ONEDRIVE ? ONEDRIVE : n === NOMBRE_DRIVE ? GOOGLE : null; };

/** Lo lanza `platform/web.ts` justo antes de abrir el diálogo de imprimir (aquí para no cargar web.ts en las pantallas). */
export const EVENTO_PDF = 'aulapro:pdf';

interface CarpetaGuardada { handle: FileSystemDirectoryHandle; nombre: string }
type Permisos = FileSystemDirectoryHandle & {
  queryPermission: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
};
const SELECTOR = 'showDirectoryPicker';

let espejo: Espejo | null = null;

export function iniciarCarpeta(e: Espejo) { espejo = e; }
/** La carpeta elegida (o Drive) que espera a que el docente diga si se queda con sus datos o con los de aquí. */
let porConfirmar: FileSystemDirectoryHandle | 'drive' | null = null;

async function conectarDrive(preferir?: 'carpeta' | 'local'): Promise<Conexion> {
  const nube = await nubeActual();
  const r = await espejo!.conectar(nube.fs(), nube.nombre, preferir, true);
  if (r.elegir) { porConfirmar = 'drive'; return r; }
  porConfirmar = null;
  await idbKv.del('carpeta');
  return r;
}

/** Recarga la app para enseñar lo que ha llegado de otro dispositivo, sin cortar al docente mientras escribe. */
export function recargarCuandoSeAPuedeSinCortar() {
  const ocupado = () => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) || !!document.querySelector('.modal-overlay.open');
  };
  const intentar = () => { if (ocupado()) setTimeout(intentar, 2000); else window.location.reload(); };
  intentar();
}

async function conectarCon(handle: FileSystemDirectoryHandle, preferir?: 'carpeta' | 'local'): Promise<Conexion> {
  const r = await espejo!.conectar(carpetaFs(handle), handle.name, preferir);
  if (r.elegir) { porConfirmar = handle; return r; }
  porConfirmar = null;
  await idbKv.set('carpeta', { handle, nombre: handle.name } satisfies CarpetaGuardada);
  return r;
}

/** Para Configuración › Datos y copias y el aviso de la carpeta (`components/CarpetaWeb.tsx`). */
export const carpetaWeb = {
  /** Chrome y Edge de escritorio. En Android, iPhone, iPad y Firefox no se puede elegir carpeta. */
  soportada: () => typeof window !== 'undefined' && SELECTOR in window,
  estado: () => espejo?.estado() ?? { tipo: 'sin-carpeta' as const },
  conflictos: () => espejo?.conflictos() ?? [],
  onCambio: (fn: () => void) => espejo?.onCambio(fn) ?? (() => {}),

  /** Abre el selector de carpetas (tiene que ser al pulsar un botón). `null` si el docente lo cierra. */
  async elegir(): Promise<Conexion | null> {
    if (!espejo) return null;
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker({ id: 'aulapro-datos', mode: 'readwrite', startIn: 'documents' });
    } catch {
      return null; // cerró el selector
    }
    return conectarCon(handle);
  },

  /** Tras `elegir: true`: con qué datos quedarse. */
  async confirmar(preferir: 'carpeta' | 'local'): Promise<Conexion | null> {
    if (porConfirmar === 'drive') return conectarDrive(preferir);
    return porConfirmar ? conectarCon(porConfirmar, preferir) : null;
  },

  /** Guardar en el Google Drive o el OneDrive de la cuenta con la que se entró (al pulsar un botón: abre la ventana de Google o va a la página de Microsoft). */
  async conectarDrive(): Promise<Conexion | null> {
    const email = (cuentaActual() ?? await leerCuenta())?.email;
    if (!espejo || !email) return null;
    await (await nubeActual()).pedirPermiso(email);
    return conectarDrive();
  },

  /** La nube ya permitida al entrar (un solo paso con Google): solo falta conectarla. */
  async conectarYa(): Promise<Conexion | null> {
    if (!espejo || !(await (await nubeActual()).leerPermiso())) return null;
    return conectarDrive();
  },

  /** Se vuelve de la página de Google (Safari) o de Microsoft: termina de conectar. */
  hayVuelta: () => hayVueltaNube(),
  async terminarVuelta(): Promise<Conexion | null> {
    const email = (cuentaActual() ?? await leerCuenta())?.email;
    if (!espejo || !email) return null;
    await (await nubeActual()).terminarVuelta(email);
    return conectarDrive();
  },

  usaDrive: () => nubeConectada() !== null,
  /** Con qué nube está copiando: «Google Drive» u «OneDrive» (vacío si ninguna). */
  nombreNube: () => nubeConectada()?.nombre ?? '',

  /** El navegador (o Google, o Microsoft) volvió a pedir permiso: hace falta que el docente pulse. */
  async pedirPermiso(): Promise<number> {
    const nube = nubeConectada();
    if (nube) {
      const email = (cuentaActual() ?? await leerCuenta())?.email;
      if (!email || !espejo) return 0;
      await nube.pedirPermiso(email);
      return espejo.activar(nube.fs(), nube.nombre, { congelar: true, nube: true });
    }
    const g = await idbKv.get<CarpetaGuardada>('carpeta');
    if (!g || !espejo) return 0;
    if ((await (g.handle as Permisos).requestPermission({ mode: 'readwrite' })) !== 'granted') return 0;
    return espejo.activar(carpetaFs(g.handle), g.nombre, { congelar: true });
  },

  async desconectar() {
    const nube = nubeConectada() ?? await nubeActual();
    espejo?.desconectar();
    await idbKv.del('carpeta');
    await nube.quitarPermiso();
  },

  resolver: (id: string, con: 'carpeta' | 'local') => espejo?.resolver(id, con),
};

/**
 * Al abrir la app: Drive o la carpeta de la última vez. Drive no espera:
 * la app se pinta con lo que hay aquí y, si Drive trae algo más nuevo de otro
 * dispositivo, se recarga en cuanto se pueda sin cortar al docente.
 */
export async function abrirCarpetaGuardada() {
  const cuenta = await leerCuenta();
  const nube = nubeDe(cuenta?.proveedor);
  const permiso = await nube.leerPermiso();
  if (permiso && espejo) {
    // El Drive (o el OneDrive) es de una cuenta: con otra, no se copia nada en él
    if (!cuenta || cuenta.email !== permiso.email) { await nube.quitarPermiso(); return; }
    espejo.activar(nube.fs(), nube.nombre, { congelar: true, nube: true }).then(n => { if (n > 0) recargarCuandoSeAPuedeSinCortar(); });
    return;
  }
  const g = await idbKv.get<CarpetaGuardada>('carpeta').catch(() => undefined);
  if (!g || !espejo) return;
  try {
    if ((await (g.handle as Permisos).queryPermission({ mode: 'readwrite' })) === 'granted') {
      await espejo.activar(carpetaFs(g.handle), g.nombre);
    } else {
      espejo.sinPermiso(g.nombre);
    }
  } catch {
    espejo.sinPermiso(g.nombre);
  }
}

/** Se vuelve de la página de Google o de Microsoft con el permiso de guardar en la nube (para el paso de Drive). */
export const hayVueltaNube = () => hayVueltaDrive() || hayVueltaOneDrive();
/** ¿Ya hay permiso para guardar en la nube de la cuenta con la que se entró? */
export async function leerPermisoNube() { return (await nubeActual()).leerPermiso(); }

/**
 * La clave escrita a mano (compra con otro correo o un pack), en la nube de la cuenta: así, en otro
 * dispositivo con la misma cuenta, se activa sola (petición del dueño, 29-10-2026). Un archivo aparte de la
 * carpeta «AulaPro», fuera de lo que copia `espejo.ts`.
 */
const LICENCIA = 'AulaPro/licencia.json';
export async function guardarClaveEnNube(key: string) {
  const nube = await nubeActual();
  if (!(await nube.leerPermiso())) return;
  await nube.fs().write(LICENCIA, JSON.stringify({ key }));
}
export async function claveDeNube(): Promise<string> {
  const nube = await nubeActual();
  if (!(await nube.leerPermiso())) return '';
  try {
    const k = JSON.parse((await nube.fs().read(LICENCIA)) ?? '{}').key;
    return typeof k === 'string' ? k : '';
  } catch { return ''; }
}
/**
 * «Desactivar en este equipo»: la clave sale también de la nube. Si no, la siguiente vez que se abre la app la
 * vuelve a activar sola desde ahí y desactivar no sirve de nada (1-11-2026). Solo si es la misma que se desactiva.
 */
export async function olvidarClaveDeNube(hint: string) {
  const k = await claveDeNube();
  if (!k || hint !== `••••${k.trim().slice(-4)}`) return; // como `keyHint` de androidLicense.ts, sin importarlo (iría al bloque de arranque)
  await (await nubeActual()).fs().write(LICENCIA, '{}');
}
