/**
 * «Crear varios grupos» de una vez (20-11-2026, de la revisión a fondo: un especialista con doce grupos repetía
 * doce veces «Nueva clase»). Se eligen la etapa, los cursos, las letras y una asignatura; antes de crear nada se
 * enseña la lista de lo que saldrá, y lo que ya existe no se duplica.
 *
 * Aquí solo está la cuenta, sin pantalla (`components/clases/CrearVariosGrupos.tsx`).
 */

import type { Class } from '../types';
import type { CurriculumEntry, Etapa } from './curriculum';
import { estadoDeMateria } from './curriculum/materiasDeClase';

/** Cuántos cursos tiene cada etapa. */
export const CURSOS_DE_ETAPA: Record<Etapa, number> = { primaria: 6, eso: 4 };

/** Como mucho, para que un despiste («A-Z») no llene el perfil de clases. */
export const MAX_GRUPOS = 40;

/**
 * Las letras escritas por el docente: «A, B, C», «a b c», «A;B» o «A-C» (de la A a la C). Una sola letra sale en
 * mayúscula; lo demás («Bilingüe», «1») se respeta. Sin repetidas.
 */
export function leerLetras(texto: string): string[] {
  const out: string[] = [];
  const vistas = new Set<string>();
  const poner = (l: string) => {
    const letra = l.length === 1 ? l.toLocaleUpperCase('es') : l;
    const clave = letra.toLocaleLowerCase('es');
    if (!letra || vistas.has(clave)) return;
    vistas.add(clave);
    out.push(letra);
  };
  for (const trozo of texto.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)) {
    const rango = /^([a-zA-Z])\s*-\s*([a-zA-Z])$/.exec(trozo);
    if (rango) {
      const [a, b] = [rango[1].toUpperCase().charCodeAt(0), rango[2].toUpperCase().charCodeAt(0)];
      for (let c = Math.min(a, b); c <= Math.max(a, b); c++) poner(String.fromCharCode(c));
    } else poner(trozo);
  }
  return out;
}

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
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(de|d'|educacion|educacio|primaria|primary|eso|secundaria|secondary|year|grade|curso|curs)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

export interface GrupoPrevisto {
  nombre: string;
  curso: number;
  letra: string;
  /** Ya hay una clase que es este grupo: no se crea otra. */
  existe: boolean;
}

type ClaseQueHay = Pick<Class, 'name' | 'etapa' | 'curso'>;

/**
 * Los grupos que saldrían, en orden de curso y de letra, con los que ya existen marcados. Sin letras, un grupo
 * por curso («3.º»). Un grupo existe si hay una clase de esa etapa y ese curso (o sin etapa puesta) cuyo nombre
 * es el mismo, se escriba como se escriba.
 */
export function gruposPrevistos(etapa: Etapa, cursos: readonly number[], letras: readonly string[], existentes: readonly ClaseQueHay[]): GrupoPrevisto[] {
  // Con clases de la otra etapa, el nombre lleva la suya: «3.º A» de Primaria y de ESO no se distinguirían
  const conEtapa = existentes.some(c => c.etapa && c.etapa !== etapa);
  const ordinal = ordinalDe(existentes);
  const validos = [...new Set(cursos)].filter(c => Number.isInteger(c) && c >= 1 && c <= CURSOS_DE_ETAPA[etapa]).sort((a, b) => a - b);
  const out: GrupoPrevisto[] = [];
  for (const curso of validos) {
    for (const letra of letras.length ? letras : ['']) {
      const clave = claveDeGrupo(nombreDeGrupo(curso, letra));
      const existe = existentes.some(c =>
        (c.etapa ? c.etapa === etapa && (c.curso ?? curso) === curso : true) && claveDeGrupo(c.name) === clave);
      out.push({ nombre: nombreDeGrupo(curso, letra, conEtapa ? etapa : undefined, ordinal), curso, letra, existe });
    }
  }
  return out;
}

/** Los que se crearán de verdad: los que no existen, hasta el tope. */
export function gruposACrear(previstos: readonly GrupoPrevisto[]): GrupoPrevisto[] {
  return previstos.filter(g => !g.existe).slice(0, MAX_GRUPOS);
}

/**
 * La clase de un grupo, con su asignatura casada con la materia oficial de su curso si lo es (si no, en modo
 * libre, como al escribir una asignatura que no está en la lista del formulario de siempre).
 */
export function claseDeGrupo(
  g: GrupoPrevisto, etapa: Etapa, asignatura: string, materias: readonly CurriculumEntry[],
  extra: { id: string; color: string },
): Class {
  const nombre = asignatura.trim();
  const estado = estadoDeMateria(nombre, { etapa, curso: g.curso }, materias as CurriculumEntry[]);
  const materia = estado.tipo === 'oficial' ? materias.find(m => m.nombre === estado.materia)?.id ?? null : null;
  return {
    id: extra.id, name: g.nombre, room: '', color: extra.color, isTutoria: false,
    subject: nombre, subjects: [nombre], etapa, curso: g.curso,
    materiasOficiales: { [nombre]: materia },
  };
}

/** Si la asignatura es una materia oficial de ese curso (para decirlo en la lista antes de crear). */
export function esOficialEnCurso(asignatura: string, etapa: Etapa, curso: number, materias: readonly CurriculumEntry[]): boolean {
  return estadoDeMateria(asignatura.trim(), { etapa, curso }, materias as CurriculumEntry[]).tipo === 'oficial';
}
