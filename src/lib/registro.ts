/**
 * La escala de registro (petición del dueño, 19-10-2026: «una escala de
 * registro en la que se evalúe algún concepto en concreto y las opciones sean
 * pulgar arriba, bien hecho, o pulgar abajo, mejorable»).
 *
 * Cada concepto se valora con 👍 (bien hecho) o 👎 (mejorable), o se deja sin
 * valorar. Se guarda como una diana con `tipo: 'registro'` y sus evaluaciones
 * como las de una diana: la puntuación de cada concepto es 2 (bien hecho) o 1
 * (mejorable). La nota sobre 10 es la proporción de pulgares arriba entre los
 * conceptos valorados: todos bien hecho, un 10; la mitad, un 5; ninguno, un 0.
 */
import type { AchievementLevel, EvalDiana, Evaluation } from '../types';
import { mismaEvaluacion } from './periodos';

export const BIEN = 2;
export const MEJORABLE = 1;
export type Valoracion = typeof BIEN | typeof MEJORABLE;

export const NIVELES_REGISTRO: AchievementLevel[] = [
  { value: MEJORABLE, label: 'Mejorable' },
  { value: BIEN, label: 'Bien hecho' },
];

export const esRegistro = (d: Pick<EvalDiana, 'tipo'>): boolean => d.tipo === 'registro';

/** Nota sobre 10: pulgares arriba entre valorados, con el peso de cada concepto. Sin ninguno valorado, `null`. */
export function notaRegistro(
  items: readonly { id: string; weight?: number }[], marcas: Readonly<Record<string, number | undefined>>,
): number | null {
  let arriba = 0;
  let total = 0;
  for (const it of items) {
    const v = marcas[it.id];
    if (v !== BIEN && v !== MEJORABLE) continue;
    const w = it.weight && it.weight > 0 ? it.weight : 1;
    total += w;
    if (v === BIEN) arriba += w;
  }
  return total === 0 ? null : Math.round((arriba / total) * 100) / 10;
}

/** Cuántos conceptos están bien hechos y cuántos son mejorables. */
export function cuentaRegistro(marcas: Readonly<Record<string, number | undefined>>, ids: readonly string[]): { bien: number; mejorable: number } {
  let bien = 0;
  let mejorable = 0;
  for (const id of ids) {
    if (marcas[id] === BIEN) bien++;
    else if (marcas[id] === MEJORABLE) mejorable++;
  }
  return { bien, mejorable };
}

/** La última valoración de un alumno con una escala (la más reciente por fecha; a igual fecha, la que va antes en la lista). */
export function ultimaValoracion(evaluations: readonly Evaluation[], escalaId: string, studentId: string): Evaluation | undefined {
  let ultima: Evaluation | undefined;
  for (const e of evaluations) {
    if (e.rubric_id !== escalaId || e.student_id !== studentId) continue;
    if (!ultima || e.date > ultima.date) ultima = e;
  }
  return ultima;
}

/**
 * Si lo marcado a un alumno ya está guardado tal cual y no hay que guardarlo otra vez. Solo vale la última
 * valoración si es de la misma evaluación del curso que `hoy` (20-11-2026): la columna del cuaderno de una
 * escala es por evaluación, así que lo que se valoró en el primer trimestre y se ve igual al guardar en el
 * segundo tiene que guardarse también en el segundo, o su columna se quedaría sin la nota de quien no cambia.
 */
export function yaGuardado(previa: Evaluation | undefined, marcas: Readonly<Record<string, number>>, hoy: string): boolean {
  if (!previa || !mismaEvaluacion(previa.date, hoy)) return false;
  const ids = Object.keys(marcas);
  return Object.keys(previa.scores).length === ids.length && ids.every(id => previa.scores[id] === marcas[id]);
}
