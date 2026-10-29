/**
 * La carpeta del ordenador de la versión web, para las pantallas
 * (Configuración › Datos y copias y el aviso de `components/CarpetaWeb.tsx`).
 * La copia en sí la hace `espejo.ts`; aquí se elige la carpeta, se recuerda
 * entre sesiones y se vuelve a pedir el permiso. Sin dependencias pesadas a
 * propósito: lo importan pantallas que también van en el escritorio.
 */
import { carpetaFs, idbKv } from './webFs';
import type { Conexion, Espejo } from './espejo';

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
/** La carpeta elegida que espera a que el docente diga si se queda con sus datos o con los de aquí. */
let porConfirmar: FileSystemDirectoryHandle | null = null;

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
    return porConfirmar ? conectarCon(porConfirmar, preferir) : null;
  },

  /** El navegador volvió a pedir permiso: hace falta que el docente pulse. */
  async pedirPermiso(): Promise<number> {
    const g = await idbKv.get<CarpetaGuardada>('carpeta');
    if (!g || !espejo) return 0;
    if ((await (g.handle as Permisos).requestPermission({ mode: 'readwrite' })) !== 'granted') return 0;
    return espejo.activar(carpetaFs(g.handle), g.nombre);
  },

  async desconectar() {
    espejo?.desconectar();
    await idbKv.del('carpeta');
  },

  resolver: (id: string, con: 'carpeta' | 'local') => espejo?.resolver(id, con),
};

/** Al abrir la app: la carpeta de la última vez, si el navegador aún da permiso. */
export async function abrirCarpetaGuardada() {
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
