/**
 * La densidad de una ficha «Cuaderno»: cuánto aire hay entre sus ejercicios y de qué tamaño son sus
 * espacios de respuesta (las letras no cambian). La elige el compositor (`services/compositor.ts`)
 * midiendo la hoja, para que quepa en las menos páginas posibles y sin dejar huecos grandes al pie.
 * Sale de las pruebas con IA real (14-10-2026): una ficha de seis ejercicios pasaba a tres hojas, con la
 * última casi vacía, por unos milímetros, y quitarlos a mano ficha por ficha no es una opción.
 *
 * Aquí solo hay lógica pura (la elección); medir está en `lib/paginacion.ts`.
 */

export type Densidad = 'apretada' | 'compacta' | 'normal' | 'holgada';

/** De más apretada a más holgada. */
export const DENSIDADES: readonly Densidad[] = ['apretada', 'compacta', 'normal', 'holgada'];

export const esDensidad = (d: unknown): d is Densidad => typeof d === 'string' && (DENSIDADES as readonly string[]).includes(d);

/** Los nombres que se ven en el editor (claves en castellano, como el resto de textos). */
export const NOMBRE_DENSIDAD: Record<Densidad, string> = {
  apretada: 'Apretada',
  compacta: 'Compacta',
  normal: 'Normal',
  holgada: 'Holgada',
};

/** El factor de cada densidad sobre el aire vertical (`--d` en `CUADERNO_STYLE`). */
export const ESCALA_DENSIDAD: Record<Densidad, number> = { apretada: 0.8, compacta: 0.9, normal: 1, holgada: 1.15 };

/** La hoja tal como la mide el compositor: cuántas páginas ocupa y cuánto espacio libre queda al pie de cada una (px). */
export interface MedidaPaginas {
  paginas: number;
  /** Espacio libre al pie de cada página, la última incluida; `huecos.length === paginas`. */
  huecos: number[];
}

/**
 * Lo que «cuesta» alejarse de la densidad normal, en milímetros de hueco al pie: la hoja normal es la que
 * se diseñó, así que solo se aprieta o se afloja si de verdad gana algo.
 */
const PENALIZACION_MM: Record<Densidad, number> = { normal: 0, compacta: 8, holgada: 12, apretada: 30 };
const PX_POR_MM = 96 / 25.4;

/** Lo mal que queda una medida: páginas primero; después, los huecos al pie de las páginas que no son la última. */
export function puntosDeMedida(d: Densidad, m: MedidaPaginas): number {
  const huecoIntermedio = m.huecos.slice(0, -1).reduce((s, h) => s + Math.max(0, h), 0);
  const huecoFinal = Math.max(0, m.huecos[m.huecos.length - 1] ?? 0);
  // La última página vacía pesa menos: es lo normal; pero una más llena también se agradece
  return m.paginas * 1e6 + huecoIntermedio + 0.25 * huecoFinal + PENALIZACION_MM[d] * PX_POR_MM;
}

/**
 * La densidad que mejor deja la hoja: la que ocupa menos páginas; entre las que empatan, la que deja menos
 * huecos al pie de las páginas llenas; y, a igualdad, la normal. Sin medidas, la normal.
 */
export function elegirDensidad(medidas: Partial<Record<Densidad, MedidaPaginas>>): Densidad {
  let mejor: Densidad = 'normal';
  let mejorPuntos = Infinity;
  for (const d of DENSIDADES) {
    const m = medidas[d];
    if (!m || m.paginas < 1) continue;
    const p = puntosDeMedida(d, m);
    // `<` y el orden de DENSIDADES: a igualdad gana la más apretada, que casi nunca empata por la penalización
    if (p < mejorPuntos) { mejor = d; mejorPuntos = p; }
  }
  return mejor;
}
