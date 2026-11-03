/**
 * Los currículos autonómicos que lleva AulaPro y cómo se abre cada uno. Vive
 * aparte de `./cargar.ts` porque no toca el currículo estatal: el selector de
 * comunidad (pantalla de bienvenida y perfil) solo necesita saber qué etapas
 * tienen decreto propio, y desde aquí lo sabe sin cargar al abrir la app los
 * cientos de KB del estatal, que se abren con la primera pantalla que los usa.
 */

import type { CurriculumBloqueSaberes, CurriculumEntry, Etapa, RawEntry } from './index';
import { normalizarEntradas } from './entradas';
import type { ComunidadId, IdiomaOficial } from './comunidades';

/**
 * Abre los datos de una comunidad y etapa en un idioma oficial. Cuando la
 * comunidad publica en dos idiomas hay un archivo por idioma, y se pide el de
 * la app (ver `idiomaDelTexto`); con uno solo, siempre se pide ese. Devuelve
 * también el idioma que ha servido de verdad: mientras falte el archivo de un
 * idioma, se sirve el del otro.
 */
export type Cargador = (idioma: IdiomaOficial) => Promise<{ idioma: IdiomaOficial; materias: CurriculumEntry[] }>;
export type Cargadores = Partial<Record<ComunidadId, Partial<Record<Etapa, Cargador>>>>;

/**
 * Datos de un decreto que no reparte los saberes básicos por ciclo: una sola
 * lista por materia. En AulaPro cada bloque lleva todos sus saberes en todos
 * los ciclos (decisión del dueño, 2-10-2026: las X de ciclo del decreto son
 * orientativas), así que la misma lista sirve para cada grupo de cursos que
 * tenga criterios.
 */
export interface RawEntrySaberesComunes extends Omit<RawEntry, 'saberes'> {
  saberes: CurriculumBloqueSaberes[];
  /**
   * Los grupos que traen saberes propios en vez de los comunes: en la ESO
   * valenciana, la adenda de cuarto de Biología y Geología y de Física y
   * Química.
   */
  saberesPorGrupo?: Record<string, CurriculumBloqueSaberes[]>;
}

export function conLosMismosSaberesEnCadaCiclo(raw: RawEntrySaberesComunes[]): CurriculumEntry[] {
  return normalizarEntradas(raw.map(({ saberesPorGrupo, ...r }) => ({
    ...r,
    saberes: Object.fromEntries(Object.keys(r.criterios).map(grupo => [grupo, saberesPorGrupo?.[grupo] ?? r.saberes])),
  })));
}

/**
 * Datos de un decreto de Primaria con criterios de cada curso (Andalucía: «1.1.a»
 * en el primer curso del ciclo y «1.1.b» en el segundo). Los criterios van ya por
 * curso («1º Primaria»…, lo que busca `resolverGrupo`) y los saberes, por ciclo
 * («1», «2», «3»), como en el decreto: cada curso toma los de su ciclo.
 */
export function porCursoDePrimaria(raw: RawEntry[]): CurriculumEntry[] {
  return normalizarEntradas(raw.map(r => ({
    ...r,
    saberes: Object.fromEntries(Object.keys(r.criterios).map(grupo => {
      const curso = Number(/^(\d)º Primaria$/.exec(grupo)?.[1]);
      return [grupo, r.saberes[String(Math.ceil(curso / 2))] ?? []];
    })),
  })));
}

/**
 * Los currículos autonómicos que AulaPro ya lleva copiados. Cada entrada abre
 * su archivo de datos bajo demanda. Una comunidad entra aquí solo cuando su
 * decreto está copiado, comprobado con los totales oficiales y con sus normas
 * verificadas en `comunidades.ts`.
 */
export const CARGADORES: Cargadores = {
  // Decreto 106/2022 con el 96/2026 aplicado (`scripts/curriculo/primaria_cv.py`),
  // en sus dos lenguas oficiales.
  'comunitat-valenciana': {
    primaria: async idioma => ({
      idioma,
      materias: conLosMismosSaberesEnCadaCiclo((idioma === 'ca'
        ? (await import('./data/comunitat-valenciana/primaria.ca.json')).default
        : (await import('./data/comunitat-valenciana/primaria.es.json')).default) as unknown as RawEntrySaberesComunes[]),
    }),
    // Decreto 107/2022 con el 66/2024 aplicado (`scripts/curriculo/eso_cv.py`).
    // Como en Primaria, los saberes de cada materia valen para todos sus cursos.
    eso: async idioma => ({
      idioma,
      materias: conLosMismosSaberesEnCadaCiclo((idioma === 'ca'
        ? (await import('./data/comunitat-valenciana/eso.ca.json')).default
        : (await import('./data/comunitat-valenciana/eso.es.json')).default) as unknown as RawEntrySaberesComunes[]),
    }),
  },
  // Decret 175/2022 (`scripts/curriculo/catalunya.py`), solo en catalán: Primaria
  // y ESO en un mismo decreto. Sus saberes cambian de un ciclo o curso a otro.
  cataluna: {
    primaria: async () => ({
      idioma: 'ca',
      materias: normalizarEntradas((await import('./data/cataluna/primaria.ca.json')).default as unknown as RawEntry[]),
    }),
    eso: async () => ({
      idioma: 'ca',
      materias: normalizarEntradas((await import('./data/cataluna/eso.ca.json')).default as unknown as RawEntry[]),
    }),
  },
  // Decretos 61/2022 y 65/2022 con el 59/2024 aplicado (`scripts/curriculo/madrid_primaria.py`
  // y `madrid_eso.py`), solo en castellano. Sus contenidos cambian de un ciclo o
  // curso a otro: cada grupo lleva los suyos.
  // Andalucía, solo en castellano. Primaria: Orden de 30 de mayo de 2023, que
  // desarrolla el Decreto 101/2023 (`scripts/curriculo/andalucia_primaria.py`),
  // con criterios de cada curso y saberes de cada ciclo.
  andalucia: {
    primaria: async () => ({
      idioma: 'es',
      materias: porCursoDePrimaria((await import('./data/andalucia/primaria.es.json')).default as unknown as RawEntry[]),
    }),
    // Orden de 30 de mayo de 2023, que desarrolla el Decreto 102/2023 (`scripts/curriculo/andalucia_eso.py`):
    // anexos II y III, curso a curso, como Madrid
    eso: async () => ({
      idioma: 'es',
      materias: normalizarEntradas((await import('./data/andalucia/eso.es.json')).default as unknown as RawEntry[]),
    }),
  },
  madrid: {
    primaria: async () => ({
      idioma: 'es',
      materias: normalizarEntradas((await import('./data/madrid/primaria.es.json')).default as unknown as RawEntry[]),
    }),
    eso: async () => ({
      idioma: 'es',
      materias: normalizarEntradas((await import('./data/madrid/eso.es.json')).default as unknown as RawEntry[]),
    }),
  },
};

export function tieneCurriculoPropio(
  comunidad: ComunidadId, etapa: Etapa, cargadores: Cargadores = CARGADORES,
): boolean {
  return !!cargadores[comunidad]?.[etapa];
}

/** Las etapas de las que AulaPro lleva copiado el decreto de esta comunidad. */
export function etapasConCurriculoPropio(
  comunidad: ComunidadId, cargadores: Cargadores = CARGADORES,
): Etapa[] {
  return (['primaria', 'eso'] as const).filter(e => tieneCurriculoPropio(comunidad, e, cargadores));
}
