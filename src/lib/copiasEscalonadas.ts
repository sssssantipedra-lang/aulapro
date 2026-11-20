/**
 * Qué copias automáticas del dispositivo se conservan (20-11-2026, de la revisión a fondo de la app).
 *
 * Antes se quedaban las 12 últimas: con una copia cada 10 minutos, dos horas de uso. Un borrado visto al día
 * siguiente ya no tenía vuelta atrás dentro de la app. Ahora, con las mismas 12 copias como mucho (no ocupa más),
 * se escalonan:
 *
 * - las 5 más recientes (los últimos 50 minutos de uso, de 10 en 10);
 * - la primera copia de cada uno de los 4 últimos días con uso (cómo estaba todo al empezar ese día);
 * - de lo que queda por detrás de esos días, la primera copia de cada una de las 3 últimas semanas con uso (la
 *   primera suele ser la semana en curso: su lunes).
 *
 * Así llegan a dos o tres semanas atrás. En un día o una semana manda, si la hay, la copia con nombre
 * («antes-de-vaciar», «antes-de-cargar», «antes-de-restaurar»): guarda el trabajo justo antes de un paso que lo
 * cambia entero. La copia que se queda de un día o de una semana es siempre la misma (la primera), así que no se
 * va sustituyendo por otra más nueva con el paso de las horas.
 */

export const COPIAS_RECIENTES = 5;
export const COPIAS_DE_DIAS = 4;
export const COPIAS_DE_SEMANAS = 3;
/** Cuántas copias automáticas hay como mucho en el dispositivo. */
export const MAX_COPIAS = COPIAS_RECIENTES + COPIAS_DE_DIAS + COPIAS_DE_SEMANAS;

const NOMBRE = /^copia-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(-.+)?\.json$/;

/** El momento en que se hizo una copia, por su nombre (`copia-2026-11-20T10-30-00[-motivo].json`, hora UTC). */
export function fechaDeCopia(nombre: string): Date | null {
  const m = NOMBRE.exec(nombre);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Si es una copia con nombre, hecha antes de un paso que cambia todo el trabajo. */
export function copiaConMotivo(nombre: string): boolean {
  return !!NOMBRE.exec(nombre)?.[7];
}

const dos = (n: number) => String(n).padStart(2, '0');
/** El día del docente (hora local), no el de la hora UTC del nombre. */
const diaDe = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
/** El lunes de su semana. */
function semanaDe(d: Date): string {
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return diaDe(lunes);
}

interface Copia { nombre: string; fecha: Date }

/** De un grupo (un día, una semana), la que se queda: la última con nombre o, si no hay, la primera. */
function laQueSeQueda(grupo: Copia[]): Copia {
  const conMotivo = grupo.filter(c => copiaConMotivo(c.nombre));
  if (conMotivo.length) return conMotivo.reduce((a, b) => (b.fecha > a.fecha ? b : a));
  return grupo.reduce((a, b) => (b.fecha < a.fecha ? b : a));
}

/** Agrupa por una clave, conservando el orden en que aparece cada clave (de la más nueva a la más antigua). */
function agrupar(copias: Copia[], clave: (d: Date) => string): Copia[][] {
  const grupos = new Map<string, Copia[]>();
  for (const c of copias) {
    const k = clave(c.fecha);
    const g = grupos.get(k);
    if (g) g.push(c); else grupos.set(k, [c]);
  }
  return [...grupos.values()];
}

/**
 * Las copias que se pueden borrar, dadas todas las que hay. Nunca entran las más recientes ni un archivo cuyo
 * nombre no se entiende (no se borra lo que no se sabe qué es).
 */
export function copiasQueSobran(nombres: string[]): string[] {
  const copias: Copia[] = [];
  for (const nombre of new Set(nombres)) {
    const fecha = fechaDeCopia(nombre);
    if (fecha) copias.push({ nombre, fecha });
  }
  copias.sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.nombre.localeCompare(a.nombre));

  const seQuedan = new Set(copias.slice(0, COPIAS_RECIENTES).map(c => c.nombre));
  const resto = copias.slice(COPIAS_RECIENTES);
  const dias = agrupar(resto, diaDe);
  for (const dia of dias.slice(0, COPIAS_DE_DIAS)) seQuedan.add(laQueSeQueda(dia).nombre);
  const semanas = agrupar(dias.slice(COPIAS_DE_DIAS).flat(), semanaDe);
  for (const semana of semanas.slice(0, COPIAS_DE_SEMANAS)) seQuedan.add(laQueSeQueda(semana).nombre);

  return copias.filter(c => !seQuedan.has(c.nombre)).map(c => c.nombre);
}
