/**
 * Las cuentas de `components/ui/CampoNumero.tsx` (24-11-2026): qué número es lo escrito y qué queda al salir del campo.
 */
export interface Limites { min?: number; max?: number; decimales?: boolean }

/** Lo escrito como número, sin mirar el margen (`null` si está vacío, a medias o no es un número). */
function leer(texto: string, decimales: boolean): number | null {
  const t = texto.trim().replace(/\s+/g, '');
  if (t === '' || t === '-' ) return null;
  const patron = decimales ? /^-?\d+([.,]\d+)?$/ : /^-?\d+$/;
  if (!patron.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * El número escrito si ya es válido y está dentro del margen: es lo que se pasa a la pantalla mientras se escribe.
 * Vacío, a medias («4» cuando el mínimo es 20), con letras o fuera del margen: `null`, y la pantalla no cambia.
 */
export function numeroEscrito(texto: string, { min, max, decimales = false }: Limites): number | null {
  const n = leer(texto, decimales);
  if (n === null) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
}

/**
 * Lo que queda al salir del campo: lo escrito llevado al margen (un 50 con máximo 12 queda en 12; un 0 con mínimo 1,
 * en 1) o, si está vacío o no es un número, el último valor bueno. Sin decimales, se redondea.
 */
export function numeroAlSalir(texto: string, anterior: number, { min, max, decimales = false }: Limites): number {
  const leido = leer(texto, true);
  if (leido === null) return anterior;
  let n = decimales ? leido : Math.round(leido);
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}
