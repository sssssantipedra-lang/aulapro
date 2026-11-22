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
 * Un ordinal que no se escribe con «º»: en catalán y valenciano («1r», «2n», «3r», «4t», «5è» o «5é»), en inglés
 * («1st», «2nd») y las formas largas del castellano («1er», «1ro», «2do», «4to»). Solo en minúscula y pegado al
 * número: «4T» o «4 t» es el grupo T de 4.º.
 */
type FamiliaDeOrdinal = 'ca' | 'en' | 'es';
const SIN_LETRA_DETRAS = '(?![A-Za-zÀ-ÿ0-9])';
const ORDINAL_ESCRITO = new RegExp(`(1r|2n|3r|4t|[56][èé]|\\d(?:st|nd|rd|th|er|ro|do|to))${SIN_LETRA_DETRAS}`, 'g');
/** El sufijo que puede seguir al número de un curso (para leerlo en un nombre). */
export const SUFIJO_DE_ORDINAL = `(st|nd|rd|th|er|ro|do|to|r|n|t|è|é)${SIN_LETRA_DETRAS}`;

function familiaDe(curso: number, sufijo: string): FamiliaDeOrdinal | null {
  if (/^(st|nd|rd|th)$/.test(sufijo)) return 'en';
  if (/^(er|ro|do|to)$/.test(sufijo)) return 'es';
  const ca = curso === 1 || curso === 3 ? 'r' : curso === 2 ? 'n' : curso === 4 ? 't' : 'èé';
  return ca.includes(sufijo) ? 'ca' : null;
}

/**
 * El sufijo del ordinal de otro curso, escrito como el del nombre: de «4t» sale «5è», de «1st», «2nd», y de
 * «3ro», «4to». `null` si lo que seguía al número no era un ordinal (la letra de un grupo). En catalán, de 5.º en
 * adelante se escribe con el acento que ya use el docente (`agudo`: «5é», como en valenciano).
 */
export function sufijoDeOrdinal(cursoDeAntes: number, sufijo: string, cursoNuevo: number, agudo = false): string | null {
  const familia = familiaDe(cursoDeAntes, sufijo);
  if (!familia) return null;
  if (familia === 'en') return ['th', 'st', 'nd', 'rd'][cursoNuevo] ?? 'th';
  // «1er» y «3er» no tienen pareja en 2.º y 4.º: se escriben «2º» y «4º»
  if (familia === 'es') return sufijo === 'er' ? 'º' : ['', 'ro', 'do', 'ro'][cursoNuevo] ?? 'to';
  return ['', 'r', 'n', 'r', 't'][cursoNuevo] ?? (sufijo === 'é' || (sufijo !== 'è' && agudo) ? 'é' : 'è');
}

/** Si alguno de esos nombres escribe los ordinales como en valenciano («5é», «6é»). */
export function conOrdinalAgudo(nombres: readonly string[]): boolean {
  return nombres.some(n => new RegExp(`\\dé${SIN_LETRA_DETRAS}`).test(n.normalize('NFC')));
}

/**
 * Lo que queda de un nombre para saber si dos son el mismo grupo: «3º ESO A», «3.º A», «3ºA», «3r A», «3rd A» y
 * «3 a» son «3a». La etapa no cuenta aquí (se compara aparte, con la de la clase).
 */
export function claveDeGrupo(nombre: string): string {
  return nombre.normalize('NFC').replace(ORDINAL_ESCRITO, m => `${m[0]} `)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(de|d'|educacion|educacio|primaria|primary|eso|secundaria|secondary|year|grade|curso|curs)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}
