/**
 * Leer una copia de seguridad descargada («Descargar mis datos») antes de cargarla (auditoría del 1-11-2026).
 *
 * Cargar una copia sustituye todo el trabajo del perfil. Antes se cargaba sin más: un archivo con una forma rara (editado
 * a mano, de otra aplicación) rompía la app al abrirse, y una copia vacía o equivocada dejaba el cuaderno así sin
 * preguntar. Ahora se comprueba aquí la forma de cada parte, una copia sin nada no se carga, y quien la carga
 * (`pages/Profile.tsx`) pide confirmación y deja antes una copia de lo de ahora (`useAppState`, «antes-de-cargar»).
 */
import { perfilVacio } from './contenidoPerfil';

/** Las partes del perfil que son listas y las que son mapas (`ProfileSnapshot` en `hooks/useAppState.ts`). */
const LISTAS = ['tasks', 'classes', 'students', 'blocks', 'events', 'rubrics', 'dianas', 'evaluations', 'gradeCategories',
  'gradeItems', 'reports', 'selfAssessments', 'learningSituations', 'fichas', 'workSessions', 'classMarks', 'auditLog'];
const MAPAS = ['grades', 'dianaProfiles', 'attendance', 'seatingPlans', 'marksConfigs', 'apoyo', 'ef'];

export type LecturaCopia = { ok: true; datos: Record<string, unknown> } | { ok: false; error: string };

const esMapa = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);

/** La copia, ya con la forma de los datos de un perfil, o el motivo por el que no se puede cargar (en castellano: se traduce al enseñarlo). */
export function leerCopiaDeDatos(raw: string): LecturaCopia {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, error: 'El archivo no es una copia de seguridad válida.' }; }
  if (!esMapa(parsed) || parsed._app !== 'AulaPro') return { ok: false, error: 'El archivo no parece una copia de seguridad de AulaPro.' };
  // Un archivo para compartir con otro docente no es una copia de seguridad: se abre en «Trabajo compartido»
  if (parsed._cifrada === true) return { ok: false, error: 'Este archivo es una copia cifrada para compartir con otro docente. Ábrela en «Trabajo compartido».' };

  // La versión 2 anida los datos; la 1 los tenía sueltos con otros nombres
  const datos: Record<string, unknown> = parsed.data !== undefined ? parsed.data as Record<string, unknown> : {
    tasks: parsed.tasks, classes: parsed.classes, students: parsed.students, blocks: parsed.blocks, events: parsed.events,
    rubrics: parsed.rubrics, dianas: parsed.dianas, evaluations: parsed.evaluations, gradeCategories: parsed.grade_categories,
    gradeItems: parsed.grade_items, grades: parsed.grades, dianaProfiles: parsed.diana_profiles,
  };
  if (!esMapa(datos)) return { ok: false, error: 'El archivo no es una copia de seguridad válida.' };
  for (const clave of LISTAS) if (datos[clave] != null && !Array.isArray(datos[clave])) return { ok: false, error: 'La copia está dañada y no se puede cargar.' };
  for (const clave of MAPAS) if (datos[clave] != null && !esMapa(datos[clave])) return { ok: false, error: 'La copia está dañada y no se puede cargar.' };
  // Lo que falta se queda vacío al cargar (`hydrate`): se quitan los huecos para no pasarlos como `undefined`
  const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v != null));
  if (perfilVacio(limpio)) return { ok: false, error: 'Esta copia está vacía: si la cargaras, tu cuaderno se quedaría sin nada. No se ha cargado.' };
  return { ok: true, datos: limpio };
}
