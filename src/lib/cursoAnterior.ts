/**
 * El curso escolar que tenía el perfil antes de «Empezar curso nuevo» (22-11-2026).
 *
 * El curso escolar («2026-2027») se guarda con el perfil, no con el trabajo, así que una copia automática del
 * dispositivo no lo lleva. Quien, tras empezar el curso nuevo, volvía atrás restaurando una copia de «Mis datos» (la
 * «antes-de-curso-nuevo» u otra anterior) se quedaba con el trabajo del curso anterior y el nombre del nuevo: en los
 * documentos, en el nombre de la siguiente copia y en el curso que el asistente proponía después.
 *
 * Por eso, al empezar el curso nuevo se apunta en este dispositivo, por perfil, qué curso había y cuándo se cambió;
 * al restaurar una copia hecha antes de ese momento, el perfil vuelve a ese curso (`components/DataFolder.tsx`).
 * Quien vuelve atrás cargando el archivo descargado no lo necesita: el archivo dice su curso (`lib/copiaDeDatos.ts`).
 */
import { fechaDeCopia } from './copiasEscalonadas';

const CLAVE = 'aulapro_curso_anterior_';

interface CambioDeCurso { curso: string; cuando: string }

function leer(perfil: string): CambioDeCurso | null {
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE + perfil) ?? 'null') as Partial<CambioDeCurso> | null;
    return x && typeof x.curso === 'string' && typeof x.cuando === 'string' && !Number.isNaN(Date.parse(x.cuando))
      ? { curso: x.curso, cuando: x.cuando }
      : null;
  } catch { return null; }
}

/** Se llama al empezar el curso nuevo, después de hacer la copia «antes-de-curso-nuevo». */
export function apuntarCambioDeCurso(perfil: string, cursoDeAntes: string, ahora: Date = new Date()): void {
  try { localStorage.setItem(CLAVE + perfil, JSON.stringify({ curso: cursoDeAntes, cuando: ahora.toISOString() })); } catch { /* sin almacenamiento: el curso se corrige a mano */ }
}

/**
 * El curso escolar al que tiene que volver el perfil si se restaura esa copia (`copia-…json`): el de antes del
 * cambio, si la copia se hizo antes. `null` si no hay nada que cambiar (la copia es del curso nuevo, no se sabe de
 * cuándo es o no se ha empezado ningún curso en este dispositivo).
 */
export function cursoAlRestaurar(perfil: string, archivo: string): string | null {
  const cambio = leer(perfil);
  const fecha = fechaDeCopia(archivo.split('/').pop() ?? '');
  if (!cambio || !fecha) return null;
  return fecha.getTime() < Date.parse(cambio.cuando) ? cambio.curso : null;
}
