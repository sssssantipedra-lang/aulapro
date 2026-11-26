/**
 * Los cinco tramos de los juegos para la clase (26-11-2026): 1.º y 2.º de Primaria, 3.º y 4.º, 5.º y 6.º, 1.º y 2.º
 * de ESO y 3.º y 4.º de ESO. Son los niveles de «Tirar de la cuerda» (25-11-2026), que ahora comparten todos los
 * juegos (`lib/juegos/catalogo.ts`), y el tramo que se propone sale de la clase activa por su etapa y su curso o, si
 * no los tiene, por su nombre.
 */

/** Lo que un juego sabe de la clase activa: su nombre y, si los tiene, su etapa y su curso. */
export interface ClaseDelJuego { name: string; etapa?: string; curso?: number }

export type Tramo = 'p12' | 'p34' | 'p56' | 'e12' | 'e34';

export const TRAMOS: readonly { id: Tramo; nombre: string; etapa: 'primaria' | 'eso' }[] = [
  { id: 'p12', nombre: '1.º y 2.º de Primaria', etapa: 'primaria' },
  { id: 'p34', nombre: '3.º y 4.º de Primaria', etapa: 'primaria' },
  { id: 'p56', nombre: '5.º y 6.º de Primaria', etapa: 'primaria' },
  { id: 'e12', nombre: '1.º y 2.º de ESO', etapa: 'eso' },
  { id: 'e34', nombre: '3.º y 4.º de ESO', etapa: 'eso' },
];

export const esEso = (n: Tramo): boolean => n.startsWith('e');
export const esTramo = (x: unknown): x is Tramo => TRAMOS.some(n => n.id === x);

/** El tramo que toca a una clase por su etapa y su curso o, si no los tiene, por su nombre («3.º ESO B»). */
export function tramoDeClase(c: { etapa?: string; curso?: number; name?: string } | null | undefined): Tramo | null {
  if (!c) return null;
  let etapa = c.etapa;
  let curso = c.curso;
  const nombre = (c.name ?? '').toLowerCase();
  if (!etapa) {
    if (/\b(eso|secundaria)\b/.test(nombre)) etapa = 'eso';
    else if (/prim[aà]ria|\bep\b|\bprim\b/.test(nombre)) etapa = 'primaria';
  }
  if (!curso) {
    const m = nombre.match(/(?:^|\D)([1-6])\s*(?:\.?\s*[ºª°o]|r|n|t|st|nd|rd|th)?(?=\D|$)/);
    if (m) curso = Number(m[1]);
  }
  if (!curso) return null;
  if (!etapa && curso >= 5) etapa = 'primaria';
  if (etapa === 'eso') return curso <= 2 ? 'e12' : curso <= 4 ? 'e34' : null;
  if (etapa === 'primaria') return curso <= 2 ? 'p12' : curso <= 4 ? 'p34' : 'p56';
  return null;
}
