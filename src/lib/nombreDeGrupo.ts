/**
 * Cómo se llama un grupo («3.º A») y cuándo dos nombres son el mismo grupo. Aparte de `variosGrupos.ts` porque
 * también lo usa `cursoNuevo.ts`, que se carga al arrancar (`useAppState`) y no puede traer consigo el currículo.
 */

import type { Class } from '../types';
import type { Etapa } from './curriculum';

const ETAPA_EN_NOMBRE: Record<Etapa, string> = { primaria: 'Primaria', eso: 'ESO' };

/** Cómo se escribe el ordinal: «3.º», como manda la norma, o «3º», si el docente ya escribe así sus clases. */
export type Ordinal = '.º' | 'º';

/** «3.º A»; con la etapa, «3.º ESO A» (cuando el docente tiene clases de las dos etapas). */
export function nombreDeGrupo(curso: number, letra: string, etapa?: Etapa, ordinal: Ordinal = '.º'): string {
  return [`${curso}${ordinal}`, etapa ? ETAPA_EN_NOMBRE[etapa] : '', letra].filter(Boolean).join(' ');
}

/**
 * El ordinal que usan las clases que ya hay: si todas las que llevan uno lo escriben sin punto («3º A»), las
 * nuevas también, para que la lista se lea igual y se ordene bien. Si no, «3.º».
 */
export function ordinalDe(existentes: readonly Pick<Class, 'name'>[]): Ordinal {
  const sinPunto = existentes.some(c => /\dº/.test(c.name));
  const conPunto = existentes.some(c => /\d\.º/.test(c.name));
  return sinPunto && !conPunto ? 'º' : '.º';
}

/**
 * Lo que queda de un nombre para saber si dos son el mismo grupo: «3º ESO A», «3.º A», «3ºA» y «3 a» son «3a».
 * La etapa no cuenta aquí (se compara aparte, con la de la clase).
 */
export function claveDeGrupo(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(de|d'|educacion|educacio|primaria|primary|eso|secundaria|secondary|year|grade|curso|curs)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}
