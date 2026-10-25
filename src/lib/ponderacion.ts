/**
 * Lo que cuenta cada nota dentro de su categoría del cuaderno (petición del dueño, 25-10-2026: «elegir el
 * porcentaje de las actividades, lo que cuentan dentro del peso»).
 *
 * Una nota (`GradeItem`) puede llevar `weight`, su % dentro de la categoría. Sin él, todas las de la
 * categoría cuentan igual, como siempre. Los pesos son relativos: la media divide por lo que suman las
 * notas que el alumno sí tiene, así que una nota sin calificar no resta y que sumen 100 es lo ideal, no un
 * requisito. Un alumno con las notas de 40, 40 y 20 (%) y la última sin poner promedia solo las dos primeras.
 */
import type { GradeItem, GradeMap } from '../types';

/** El peso con el que cuenta cada nota en su categoría: el que eligió el docente o, sin él, su parte igual. */
function pesoDe(i: GradeItem, n: number): number {
  return typeof i.weight === 'number' && i.weight >= 0 ? i.weight : 100 / n;
}

/** El % que cuenta cada nota de una categoría, ya repartido para que sumen 100 (por id). */
export function porcentajesEnCategoria(items: GradeItem[]): Map<string, number> {
  const pesos = items.map(i => pesoDe(i, items.length));
  const total = pesos.reduce((a, b) => a + b, 0);
  return new Map(items.map((i, k) => [i.id, total > 0 ? (pesos[k] / total) * 100 : 0]));
}

/** ¿Alguna nota de la categoría tiene un peso elegido? Si no, todas cuentan igual. */
export const hayPesosElegidos = (items: GradeItem[]): boolean => items.some(i => typeof i.weight === 'number');

/** La suma de los pesos elegidos de una categoría (las notas sin peso cuentan como su parte igual). */
export function sumaDePesosEnCategoria(items: GradeItem[]): number {
  return items.reduce((a, i) => a + pesoDe(i, items.length), 0);
}

/** Media de un alumno en las notas de una categoría, con el peso de cada una; `null` si no tiene ninguna. */
export function mediaDeCategoria(items: GradeItem[], grades: GradeMap, studentId: string): number | null {
  let suma = 0, pesos = 0;
  for (const i of items) {
    const v = grades[i.id]?.[studentId];
    if (typeof v !== 'number') continue;
    const w = pesoDe(i, items.length);
    suma += v * w;
    pesos += w;
  }
  return pesos > 0 ? suma / pesos : null;
}

/** Cuánto cuenta una nota en la nota final, en %: su parte de la categoría por lo que pesa la categoría. */
export function pesoEnLaNotaFinal(item: GradeItem, itemsDeLaCategoria: GradeItem[], pesoCategoria: number): number {
  return ((porcentajesEnCategoria(itemsDeLaCategoria).get(item.id) ?? 0) * pesoCategoria) / 100;
}
