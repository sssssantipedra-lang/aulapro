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
import type { AchievementLevel, EvalDiana } from '../types';

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
