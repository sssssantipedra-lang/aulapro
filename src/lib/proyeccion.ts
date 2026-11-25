/**
 * Proyectar una ficha de ejercicios, un ejercicio por pantalla (decisión del dueño, 25-11-2026).
 *
 * Aquí está la lógica sin pantalla de `components/live/ProyeccionEjercicios.tsx`: el orden de los
 * ejercicios, la cabecera de cada bloque sin repetir «Sala 1 · Sala 1: …», cuándo un movimiento del
 * dedo es deslizar y el tamaño de letra que hace caber un ejercicio en la pantalla.
 */
import type { FichaActivity, FichaExercise } from '../services/resources';

/** Un ejercicio en su sitio: el bloque al que pertenece y su número dentro de él (el de la hoja) y en toda la ficha. */
export interface EjercicioProyectado {
  ex: FichaExercise;
  /** Índice del bloque (0, 1, 2…). */
  bloque: number;
  /** Su número dentro del bloque, como en la hoja impresa (1, 2…). */
  enBloque: number;
  /** Su número en toda la ficha (1 de 8, 2 de 8…). */
  n: number;
}

/**
 * La marca del ejercicio en el recuadro, la misma que lleva en la hoja impresa (`exportFicha.ts`):
 * en «Cuaderno», un bloque de un solo ejercicio no lleva número (`null`) y uno con listas de cálculos
 * va con letras (A, B…), para no confundirlas con las líneas 1., 2.; en los demás estilos, 1, 2, 3.
 * `acts` ya llega sin los ejercicios sin escribir, que tampoco se imprimen ni gastan número.
 */
export function marcaEnHoja(acts: readonly FichaActivity[], bloque: number, enBloque: number, cuaderno: boolean): string | null {
  if (!cuaderno) return String(enBloque);
  const ejs = acts[bloque]?.ejercicios ?? [];
  if (ejs.length === 1) return null;
  if (ejs.some(e => e.tipo === 'calculos')) return String.fromCharCode(64 + enBloque);
  return String(enBloque);
}

/** Los ejercicios de la ficha uno detrás de otro, en el orden de la hoja. */
export function ejerciciosEnOrden(acts: readonly FichaActivity[]): EjercicioProyectado[] {
  const out: EjercicioProyectado[] = [];
  acts.forEach((a, bloque) => a.ejercicios.forEach((ex, i) => out.push({ ex, bloque, enBloque: i + 1, n: out.length + 1 })));
  return out;
}

const llano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * La cabecera de un bloque o de una sala: «Sala 1 · La compuerta». Si el título ya empieza por la
 * etiqueta y el número («Sala 1: la compuerta»), se queda solo el título: antes salía
 * «Sala 1 · Sala 1: la compuerta». `etiquetas` son las formas posibles de la etiqueta (la traducida
 * primero, que es la que se escribe, y después la original: la ficha puede estar en otro idioma).
 */
export function cabeceraDeBloque(etiquetas: readonly string[], n: number, titulo: string): string {
  const tit = titulo.trim();
  const ya = etiquetas.filter(Boolean).some(e => new RegExp(`^${escapar(llano(e))}\\s*${n}(?!\\d)`, 'u').test(llano(tit)));
  if (ya) return tit;
  const prefijo = `${etiquetas[0]} ${n}`;
  return tit ? `${prefijo} · ${tit}` : prefijo;
}

/* ── Deslizar el dedo ── */

/** Lo mínimo que tiene que recorrer el dedo en horizontal para pasar de ejercicio. */
export const DESLIZ_MIN_PX = 60;
/** Lo que puede durar un deslizamiento: más es arrastrar despacio, no pasar página. */
export const DESLIZ_MAX_MS = 900;

/**
 * Si un movimiento del dedo es pasar de ejercicio: 1, al siguiente (el dedo va a la izquierda); -1,
 * al anterior (a la derecha); 0, nada. Un toque no se mueve lo bastante, y uno más vertical que
 * horizontal es desplazar la pantalla.
 */
export function direccionDeDeslizar(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  if (ms > DESLIZ_MAX_MS) return 0;
  if (Math.abs(dx) < DESLIZ_MIN_PX) return 0;
  if (Math.abs(dx) < Math.abs(dy) * 1.4) return 0;
  return dx < 0 ? 1 : -1;
}

/* ── El tamaño de la letra ── */

/**
 * Entre qué tamaños de letra se busca, según el alto de la zona del ejercicio. El mínimo es lo que
 * aún se lee desde el fondo del aula en esa pantalla (en un móvil, que se mira de cerca, 16 px); el
 * máximo, el de un enunciado corto que llena la pantalla sin que parezca un cartel.
 */
export function limitesDeLetra(alto: number): { min: number; max: number } {
  const min = Math.round(Math.max(16, Math.min(34, alto / 24)));
  const max = Math.round(Math.max(min, Math.min(104, alto / 5.2)));
  return { min, max };
}

/**
 * El tamaño de letra más grande con el que el ejercicio cabe (`cabe(px)` lo prueba en la pantalla),
 * buscado entre `min` y `max` a medio píxel. Si ni con el mínimo cabe, se queda en el mínimo y
 * `desborda` dice que hay que dejar desplazar.
 */
export function tamanoQueCabe(cabe: (px: number) => boolean, min: number, max: number): { px: number; desborda: boolean } {
  if (cabe(max)) return { px: max, desborda: false };
  if (!cabe(min)) return { px: min, desborda: true };
  let lo = min, hi = max;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (cabe(mid)) lo = mid; else hi = mid;
  }
  return { px: Math.floor(lo * 2) / 2, desborda: false };
}

/** La solución que se enseña de un ejercicio, o nada si no tiene. */
export const solucionDe = (ex: FichaExercise): string => (ex.solucion ?? '').trim();
