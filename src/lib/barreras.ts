/**
 * Las barreras de aprendizaje del alumnado de una o varias clases, para que
 * la IA las tenga en cuenta al generar una situación de aprendizaje (petición
 * del dueño, 20-10-2026). Salen de los avisos de cada alumno (`Student.alerts`).
 *
 * A la IA no llegan nombres: una línea por alumno con lo que hay que tener en
 * cuenta, y el nombre de ese alumno o de sus compañeros, si el aviso lo
 * escribe, se sustituye. Quien genera la SdA ve en pantalla lo que se envía.
 */
import type { Student } from '../types';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Las palabras de los nombres del alumnado (de 3 letras o más), para no enviarlas. */
function nombresPropios(alumnado: readonly Student[]): string[] {
  const set = new Set<string>();
  for (const s of alumnado) for (const p of sinTildes(s.name).split(/\s+/)) if (p.length >= 3) set.add(p);
  return [...set];
}

/** Cambia por «el alumno» cada nombre propio del alumnado que aparezca en el texto. */
export function sinNombres(texto: string, nombres: readonly string[]): string {
  if (nombres.length === 0) return texto;
  const plano = sinTildes(texto);
  // `sinTildes` no cambia la longitud del texto, así que los índices valen para el original
  const re = new RegExp(`(?<![a-z0-9])(?:${nombres.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-z0-9])`, 'g');
  let fuera = '';
  let desde = 0;
  for (const m of plano.matchAll(re)) {
    fuera += texto.slice(desde, m.index) + 'el alumno';
    desde = (m.index ?? 0) + m[0].length;
  }
  return fuera + texto.slice(desde);
}

/** Una línea por alumno con avisos, sin su nombre; las iguales se juntan («2 alumnos: dislexia»). */
export function barrerasDeClases(students: readonly Student[], classIds: readonly string[]): string[] {
  const alumnado = students.filter(s => classIds.includes(s.class_id));
  const nombres = nombresPropios(alumnado);
  const cuenta = new Map<string, number>();
  for (const s of alumnado) {
    const texto = s.alerts.map(a => sinNombres(a.text.trim(), nombres)).filter(Boolean).join('; ');
    if (texto) cuenta.set(texto, (cuenta.get(texto) ?? 0) + 1);
  }
  return [...cuenta].map(([texto, n]) => (n > 1 ? `${n} alumnos: ${texto}` : texto));
}

/** Cuántos alumnos de esas clases tienen algún aviso. */
export const alumnosConBarreras = (students: readonly Student[], classIds: readonly string[]): number =>
  students.filter(s => classIds.includes(s.class_id) && s.alerts.some(a => a.text.trim())).length;
