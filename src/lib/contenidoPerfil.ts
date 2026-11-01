/**
 * ¿Tiene algo el trabajo de un perfil? (auditoría del 1-11-2026)
 *
 * Un perfil vacío es lo que se ve cuando los datos no se han podido leer, y guardarlo encima de los buenos los borraría
 * para siempre: en el navegador, en las copias automáticas y en el Drive u OneDrive del docente. Esto lo distingue sin
 * conocer cada pantalla: cuenta los elementos de las listas y de los mapas del perfil (clases, alumnado, notas, apoyo,
 * Educación Física…), sin el registro de cambios, que también tiene entradas en un perfil recién vaciado.
 *
 * Lo usan `profileStore.backup` (una copia vacía no sustituye a las buenas) y `espejo.ts` (un perfil vacío no se sube
 * encima de uno con datos, ni uno vacío de la nube sustituye al de aquí, sin preguntar).
 */

/** Lo que no cuenta como trabajo: el registro de cambios del perfil. */
const SIN_CONTAR = new Set(['auditLog']);

function cuenta(valor: unknown, profundidad: number): number {
  if (Array.isArray(valor)) return valor.length;
  // Un valor suelto (un texto, un número) también es trabajo; un perfil vacío no tiene ninguno
  if (!valor || typeof valor !== 'object') return valor ? 1 : 0;
  const valores = Object.values(valor as Record<string, unknown>);
  // Dentro de un mapa (las notas por alumno, la asistencia por día), cada entrada cuenta
  if (profundidad >= 2) return valores.length;
  return valores.reduce<number>((n, v) => n + cuenta(v, profundidad + 1), 0);
}

/** Cuántos elementos tiene el trabajo de un perfil (0: vacío). Lo que no es un objeto no se sabe medir: -1. */
export function contenidoDe(datos: unknown): number {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return -1;
  let n = 0;
  for (const [clave, valor] of Object.entries(datos as Record<string, unknown>)) {
    if (!SIN_CONTAR.has(clave)) n += cuenta(valor, 1);
  }
  return n;
}

/** El perfil está vacío: no tiene ningún elemento de trabajo. */
export const perfilVacio = (datos: unknown) => contenidoDe(datos) === 0;

/** Lo mismo, a partir del texto de `datos.json`. Un texto que no se puede leer no se da por vacío (`false`). */
export function textoDePerfilVacio(raw: string | null | undefined): boolean {
  if (raw == null || raw.trim() === '') return true;
  try { return perfilVacio(JSON.parse(raw)); } catch { return false; }
}
