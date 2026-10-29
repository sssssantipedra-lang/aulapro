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
import { leerPermisoDrive, pedirPermisoDrive, quitarPermisoDrive, tokenDrive } from './googleDrive';
import { cuentaActual, leerCuenta } from './cuentaWeb';

/** El nombre con el que sale el Drive del docente como «carpeta» (ver `driveFs.ts`). */
export const NOMBRE_DRIVE = 'Google Drive';
const driveFs = () => createDriveFs(tokenDrive);

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
  const r = await espejo!.conectar(driveFs(), NOMBRE_DRIVE, preferir);
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

  /** Guardar en el Google Drive de la cuenta con la que se entró (al pulsar un botón: abre la ventana de Google). */
  async conectarDrive(): Promise<Conexion | null> {
    const email = (cuentaActual() ?? await leerCuenta())?.email;
    if (!espejo || !email) return null;
    await pedirPermisoDrive(email);
    return conectarDrive();
  },

  usaDrive: () => { const e = espejo?.estado(); return !!e && 'nombre' in e && e.nombre === NOMBRE_DRIVE; },

  /** El navegador (o Google) volvió a pedir permiso: hace falta que el docente pulse. */
  async pedirPermiso(): Promise<number> {
    if (carpetaWeb.usaDrive()) {
      const email = (cuentaActual() ?? await leerCuenta())?.email;
      if (!email || !espejo) return 0;
      await pedirPermisoDrive(email);
      return espejo.activar(driveFs(), NOMBRE_DRIVE, { congelar: true });
    }
    const g = await idbKv.get<CarpetaGuardada>('carpeta');
    if (!g || !espejo) return 0;
    if ((await (g.handle as Permisos).requestPermission({ mode: 'readwrite' })) !== 'granted') return 0;
    return espejo.activar(carpetaFs(g.handle), g.nombre, { congelar: true });
  },

  async desconectar() {
    espejo?.desconectar();
    await idbKv.del('carpeta');
    await quitarPermisoDrive();
  },

  resolver: (id: string, con: 'carpeta' | 'local') => espejo?.resolver(id, con),
};

/**
 * Al abrir la app: Drive o la carpeta de la última vez. Drive no espera:
 * la app se pinta con lo que hay aquí y, si Drive trae algo más nuevo de otro
 * dispositivo, se recarga en cuanto se pueda sin cortar al docente.
 */
export async function abrirCarpetaGuardada() {
  const permiso = await leerPermisoDrive();
  if (permiso && espejo) {
    const cuenta = await leerCuenta();
    // El Drive es de una cuenta: con otra, no se copia nada en él
    if (!cuenta || cuenta.email !== permiso.email) { await quitarPermisoDrive(); return; }
    espejo.activar(driveFs(), NOMBRE_DRIVE, { congelar: true }).then(n => { if (n > 0) recargarCuandoSeAPuedeSinCortar(); });
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
