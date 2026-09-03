/**
 * Currículo oficial (competencias específicas, criterios de evaluación y
 * saberes básicos), transcrito literalmente de los Anexos II de:
 *  - RD 157/2022, de 1 de marzo (enseñanzas mínimas de Primaria).
 *  - RD 217/2022, de 29 de marzo (enseñanzas mínimas de la ESO).
 *
 * Es la pieza que falta para que la IA no se invente competencias específicas
 * ni saberes básicos al redactar una situación de aprendizaje (ver
 * `services/learningSituations.ts`): antes se le pedía que los REDACTASE, y
 * solo puede redactar algo que sea legislación real si la memoriza al dedillo
 * — con miles de códigos repartidos en decenas de materias, no lo hace. Ahora
 * se le da la lista real de esta materia y este curso, y ELIGE de ahí; el
 * texto final lo pinta la propia aplicación desde estos datos, no la IA.
 *
 * Solo son las enseñanzas mínimas ESTATALES: lo común a toda España. No
 * sustituye el decreto de la comunidad autónoma, que añade y desarrolla sobre
 * esto — pero es la base sobre la que se construye cualquier currículo
 * autonómico, así que ya es un salto grande frente a no tener nada real.
 *
 * Dos particularidades del propio texto oficial que se conservan tal cual, no
 * defectos de la transcripción:
 *  - Si una competencia tiene un único criterio en su grupo de cursos, el BOE
 *    lo redacta sin subíndice. Ese criterio lleva aquí el código «N.1»
 *    (inequívoco, al ser el único) pero con `codigoLiteral: false`, para que
 *    quede constancia de que esa numeración no viene escrita así en el texto.
 *  - Algunas materias van del bloque de saberes con letra directo a los
 *    ítems, sin el epígrafe numerado intermedio que sí tienen otras. Ahí
 *    `epigrafe.titulo` y `epigrafe.n` quedan en `null`.
 */

import primariaData from './data/primaria.json';
import esoData from './data/eso.json';

export type Etapa = 'primaria' | 'eso';

export interface CurriculumCompetencia {
  n: number;
  texto: string;
}

export interface CurriculumCriterio {
  /** «1.1», «2.3»… Ver la nota sobre `codigoLiteral` más arriba. */
  codigo: string;
  /** A qué competencia específica pertenece (su `n`). */
  competencia: number;
  texto: string;
  /** `false` cuando el código es una numeración añadida, no texto del BOE. */
  codigoLiteral: boolean;
}

export interface CurriculumEpigrafe {
  n: number | null;
  titulo: string | null;
  items: string[];
}

export interface CurriculumBloqueSaberes {
  /** «A», «B»… la letra con la que el decreto numera el bloque. */
  bloque: string;
  tituloBloque: string;
  epigrafes: CurriculumEpigrafe[];
}

/**
 * Una materia (o área, en Primaria) con sus tres piezas. `criterios` y
 * `saberes` van indexados por grupo de cursos: en Primaria son siempre "1",
 * "2" y "3" (los tres ciclos); en la ESO son literales del propio decreto
 * («Cursos de primero a tercero», «Cuarto curso», «Matemáticas A»…), porque
 * la ESO no reparte todas las materias en los mismos bloques de cursos.
 */
export interface CurriculumEntry {
  nombre: string;
  competencias: CurriculumCompetencia[];
  criterios: Record<string, CurriculumCriterio[]>;
  saberes: Record<string, CurriculumBloqueSaberes[]>;
}

interface RawEntry {
  area?: string;
  materia?: string;
  competencias: CurriculumCompetencia[];
  criterios: Record<string, CurriculumCriterio[]>;
  saberes: Record<string, CurriculumBloqueSaberes[]>;
}

function normalizarEntradas(raw: RawEntry[]): CurriculumEntry[] {
  return raw.map(r => ({
    nombre: r.area ?? r.materia ?? '',
    competencias: r.competencias,
    criterios: r.criterios,
    saberes: r.saberes,
  }));
}

// TypeScript infiere de cada JSON el tipo exacto de sus claves literales
// («Cursos de primero a tercero», «1», «2»…), que varía de una materia a
// otra y por eso no es asignable directamente a `Record<string, …>`; de ahí
// el paso por `unknown`, no un descuido de tipado.
const PRIMARIA: CurriculumEntry[] = normalizarEntradas(primariaData as unknown as RawEntry[]);
const ESO: CurriculumEntry[] = normalizarEntradas(esoData as unknown as RawEntry[]);

export function materiasDe(etapa: Etapa): CurriculumEntry[] {
  return etapa === 'primaria' ? PRIMARIA : ESO;
}

export function buscarMateria(etapa: Etapa, nombre: string): CurriculumEntry | undefined {
  return materiasDe(etapa).find(m => m.nombre === nombre);
}

/** 1º-2º → 1er ciclo, 3º-4º → 2º ciclo, 5º-6º → 3er ciclo. */
export function cicloDePrimaria(curso: number): 1 | 2 | 3 {
  return Math.min(3, Math.ceil(curso / 2)) as 1 | 2 | 3;
}

/**
 * Qué cursos cubre un grupo de la ESO, a partir de su nombre literal. Devuelve
 * `null` para los grupos que no representan un rango de curso —«Matemáticas
 * A» y «Matemáticas B» son opciones de 4º, no un curso distinto— para que
 * quien llame decida esos casos aparte en vez de que se les asigne un curso
 * por una coincidencia de patrón que no le corresponde.
 */
export function cursosDelGrupoEso(nombreGrupo: string): number[] | null {
  if (/no especificado/i.test(nombreGrupo)) return [1, 2, 3, 4];
  if (/cuarto curso/i.test(nombreGrupo)) return [4];
  if (/primero a tercero/i.test(nombreGrupo)) return [1, 2, 3];
  if (/primero y segundo/i.test(nombreGrupo)) return [1, 2];
  if (/tercero y cuarto/i.test(nombreGrupo)) return [3, 4];
  return null;
}

/**
 * El grupo de cursos de esta materia que corresponde a `curso`, o `null` si
 * no hay uno claro —por ejemplo, Matemáticas en 4º de la ESO, que necesita
 * que el docente elija entre la opción A o B; ver `resolverGrupo`—.
 */
export function grupoDeEso(entry: CurriculumEntry, curso: number): string | null {
  for (const nombreGrupo of Object.keys(entry.criterios)) {
    const cursos = cursosDelGrupoEso(nombreGrupo);
    if (cursos?.includes(curso)) return nombreGrupo;
  }
  return null;
}

/**
 * Resuelve una materia y su grupo de cursos correcto para una etapa y un
 * curso concretos. `opcionMatematicas` solo hace falta para Matemáticas de
 * 4º de la ESO (elige entre "A" y "B"); en cualquier otro caso se ignora.
 * Devuelve `null` si la materia no existe en esta etapa, o si es la
 * Matemáticas de 4º de la ESO sin haber indicado la opción.
 */
export function resolverGrupo(
  etapa: Etapa,
  nombreMateria: string,
  curso: number,
  opcionMatematicas?: 'A' | 'B',
): { entry: CurriculumEntry; grupo: string } | null {
  const entry = buscarMateria(etapa, nombreMateria);
  if (!entry) return null;

  if (etapa === 'primaria') {
    const grupo = String(cicloDePrimaria(curso));
    return entry.criterios[grupo] ? { entry, grupo } : null;
  }

  if (nombreMateria === 'Matemáticas' && curso === 4) {
    if (!opcionMatematicas) return null;
    const grupo = `Matemáticas ${opcionMatematicas}`;
    return entry.criterios[grupo] ? { entry, grupo } : null;
  }

  const grupo = grupoDeEso(entry, curso);
  return grupo ? { entry, grupo } : null;
}
