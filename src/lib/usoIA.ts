/**
 * La aceptación del docente antes de poner su clave de la IA (4-11-2026, petición del dueño): una casilla sin marcar
 * con lo que AulaPro envía a Google y lo que no, y con la que el docente se hace responsable de su uso. Sin marcarla
 * no se puede guardar la clave (`components/ApiKeySettings.tsx`). Solo se guarda en el dispositivo: qué versión y cuándo.
 * Si cambia lo que se envía a la IA, se sube `VERSION_USO_IA` y se vuelve a pedir.
 */
export const VERSION_USO_IA = '2026-11-04';

const CLAVE = 'aulapro_uso_ia';

interface Aceptacion { v: string; fecha: string }

function leer(): Aceptacion | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    return v && typeof v.v === 'string' ? v : null;
  } catch { return null; }
}

/** ¿Se aceptó en este dispositivo la versión vigente? */
export const usoIaAceptado = () => leer()?.v === VERSION_USO_IA;

/** El día en que se aceptó la versión vigente (`AAAA-MM-DD`), o `null`. */
export const fechaUsoIa = (): string | null => {
  const a = leer();
  return a && a.v === VERSION_USO_IA ? a.fecha.slice(0, 10) : null;
};

export function aceptarUsoIa(ahora = new Date()) {
  if (usoIaAceptado()) return;
  try { localStorage.setItem(CLAVE, JSON.stringify({ v: VERSION_USO_IA, fecha: ahora.toISOString() })); } catch { /* sin almacenamiento: se volverá a pedir */ }
}
