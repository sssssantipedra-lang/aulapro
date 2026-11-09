/**
 * La aceptación expresa de las condiciones de venta y de uso y de la política de privacidad (3-11-2026, revisión del
 * abogado del dueño): una casilla sin marcar, para quien paga y para quien entra gratis (los fundadores), antes de entrar.
 *
 * Se guarda en el dispositivo qué versión se aceptó y cuándo, y la app la manda una vez al servidor con la búsqueda de
 * la licencia de la cuenta (`platform/cuentaWeb.ts` y `web/funciones/api/_aceptacion.js`), que la anota con una huella
 * del correo. Si cambian las condiciones o la privacidad de forma que haya que volver a aceptarlas, se sube
 * `VERSION_CONDICIONES` (la fecha del cambio) y la app vuelve a pedir la casilla a todo el mundo
 * (`components/AceptarCondiciones.tsx`). La del 9-11-2026 añade el registro de usuarios y de uso (`web/funciones/api/_usuarios.js`).
 */
export const VERSION_CONDICIONES = '2026-11-09';

const CLAVE = 'aulapro_condiciones';

interface Aceptacion { v: string; fecha: string; registrada?: boolean }

function leer(): Aceptacion | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    return v && typeof v.v === 'string' ? v : null;
  } catch { return null; }
}

function escribir(a: Aceptacion) {
  try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin almacenamiento: se volverá a pedir */ }
}

/** ¿Se aceptó en este dispositivo la versión vigente? */
export const condicionesAceptadas = () => leer()?.v === VERSION_CONDICIONES;

/** Marca la casilla: la versión vigente, aceptada ahora. */
export function aceptarCondiciones(ahora = new Date()) {
  if (condicionesAceptadas()) return;
  escribir({ v: VERSION_CONDICIONES, fecha: ahora.toISOString() });
}

/** La versión aceptada que el servidor aún no ha anotado, para mandarla con la búsqueda de la licencia. */
export function aceptacionSinRegistrar(): string | undefined {
  const a = leer();
  return a && a.v === VERSION_CONDICIONES && !a.registrada ? a.v : undefined;
}

/** El servidor ya la anotó: no se vuelve a mandar. */
export function aceptacionRegistrada(version: string) {
  const a = leer();
  if (a && a.v === version) escribir({ ...a, registrada: true });
}
