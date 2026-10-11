/**
 * Evaluación por competencias específicas (decisión del dueño, 3-10-2026; ver
 * `docs/COMUNIDADES.md`).
 *
 * La nota de una rúbrica o una diana sigue yendo, entera, a una asignatura y
 * una categoría del cuaderno. Además, cada criterio de la rúbrica (o ítem de
 * la diana) puede llevar los criterios de evaluación oficiales que evalúa, de
 * una o varias materias: una situación de aprendizaje trabaja varias áreas a
 * la vez. Al evaluar, la nota de ese criterio se apunta en todos ellos, y de
 * ahí sale, por alumno y materia:
 *
 * - la nota de cada criterio de evaluación: la media de las veces que se ha
 *   evaluado;
 * - la de cada competencia específica: la media de sus criterios evaluados;
 * - la de la materia por competencias: la media de sus competencias evaluadas.
 *
 * Medias simples, y la nota de la materia por competencias se muestra, no
 * sustituye a la del cuaderno (decisión del dueño).
 */
import { competenciasDe, type CurriculumEntry } from './index';
import type { Evaluation, OfficialCriterionRef } from '../../types';

const ORDEN_CLAVE = ['CCL', 'CP', 'STEM', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC'];

/**
 * Las competencias clave con las que el decreto conecta una competencia
 * específica: de sus descriptores («CCL1», «STEM4») sale la competencia
 * («CCL», «STEM»), sin repetir y en el orden oficial. Se leen de
 * `entry.competencias` por número: en Madrid Primaria `competenciasPorGrupo`
 * repite el texto de cada ciclo, pero la conexión es la misma.
 */
export function competenciasClaveDe(entry: CurriculumEntry, n: number): string[] {
  const descriptores = entry.competencias.find(c => c.n === n)?.descriptores ?? [];
  const clave = new Set(descriptores.map(d => d.replace(/\d+$/, '')));
  return ORDEN_CLAVE.filter(c => clave.has(c));
}

/** La clave con que se guarda la nota de un criterio oficial en una evaluación. */
export function claveCriterioOficial(ref: OfficialCriterionRef): string {
  return `${ref.materia}|${ref.codigo}`;
}

const redondear = (n: number) => Math.round(n * 10) / 10;
const media = (ns: number[]) => (ns.length ? redondear(ns.reduce((a, b) => a + b, 0) / ns.length) : null);

/**
 * Nota sobre 10 de cada criterio oficial que evalúa un instrumento, a partir
 * de los niveles marcados (`maxLevel`, el más alto de su escala, es el 10). Si
 * dos criterios de la rúbrica apuntan al mismo criterio oficial, cuenta la
 * media de los dos. `undefined` si nada lleva criterios oficiales, para no
 * añadir un campo vacío a las evaluaciones de siempre.
 */
export function officialCriteriaScoresFor(
  items: { id: string; officialCriteria?: OfficialCriterionRef[] }[],
  scores: Record<string, number>,
  maxLevel: number,
): Record<string, number> | undefined {
  if (!(maxLevel > 0)) return undefined;
  const notas: Record<string, number[]> = {};
  for (const it of items) {
    const v = scores[it.id];
    if (typeof v !== 'number' || v <= 0 || !it.officialCriteria?.length) continue;
    for (const ref of it.officialCriteria) {
      (notas[claveCriterioOficial(ref)] ??= []).push((v / maxLevel) * 10);
    }
  }
  const claves = Object.keys(notas);
  if (claves.length === 0) return undefined;
  return Object.fromEntries(claves.map(k => [k, media(notas[k])!]));
}

export interface NotaCriterio {
  codigo: string;
  texto: string;
  /** Media de las veces que se ha evaluado; `null` si ninguna. */
  nota: number | null;
  veces: number;
}

export interface NotaCompetencia {
  n: number;
  texto: string;
  nota: number | null;
  /** Las competencias clave con las que la conecta el decreto, en el orden oficial; vacío si no lo dice. */
  clave: string[];
  criterios: NotaCriterio[];
}

export interface NotaMateria {
  id: string;
  nombre: string;
  grupo: string;
  /** La de la materia por competencias; `null` si no hay ninguna evaluada. */
  nota: number | null;
  competencias: NotaCompetencia[];
}

/**
 * Las notas de un alumno en una materia y su grupo de cursos, con todas sus
 * competencias y criterios (también los que aún no tienen nota, para que se
 * vea lo que falta por evaluar). `evaluaciones` son las del alumno.
 */
export function notasDeMateria(entry: CurriculumEntry, grupo: string, evaluaciones: Evaluation[]): NotaMateria {
  const competencias = competenciasDe(entry, grupo).map(c => {
    const criterios = (entry.criterios[grupo] ?? []).filter(cr => cr.competencia === c.n).map(cr => {
      const clave = claveCriterioOficial({ materia: entry.id, codigo: cr.codigo });
      const notas = evaluaciones
        .map(ev => ev.officialCriteriaScores?.[clave])
        .filter((v): v is number => typeof v === 'number');
      return { codigo: cr.codigo, texto: cr.texto, nota: media(notas), veces: notas.length };
    });
    const evaluados = criterios.map(cr => cr.nota).filter((v): v is number => v !== null);
    return { n: c.n, texto: c.texto, nota: media(evaluados), clave: competenciasClaveDe(entry, c.n), criterios };
  });
  const evaluadas = competencias.map(c => c.nota).filter((v): v is number => v !== null);
  return { id: entry.id, nombre: entry.nombre, grupo, nota: media(evaluadas), competencias };
}

/**
 * Para el informe que redacta la IA: una línea por cada competencia específica
 * evaluada del alumno, con su materia, su texto oficial y su nota sobre 10.
 * Las que no tienen nota no salen. `evaluaciones` son las del alumno.
 */
export function lineasDeCompetencias(
  materias: { entry: CurriculumEntry; grupo: string }[], evaluaciones: Evaluation[], en: boolean,
): string[] {
  return materias.flatMap(m => notasDeMateria(m.entry, m.grupo, evaluaciones).competencias
    .filter(c => c.nota !== null)
    .map(c => `- ${m.entry.nombre}, ${en ? 'SC' : 'CE'}${c.n} (${c.texto}): ${c.nota!.toFixed(1)}/10`));
}

/** Los códigos de los criterios de una materia que aún no tienen nota, en orden. */
export function sinEvaluar(notas: NotaMateria): string[] {
  return notas.competencias.flatMap(c => c.criterios.filter(cr => cr.nota === null).map(cr => cr.codigo));
}

/**
 * Un resumen corto de un criterio o una competencia para las tablas: su
 * principio, hasta la primera coma si cae pronto o hasta la última palabra que
 * cabe, con «…» si se ha cortado. El texto entero se ve al pasar el ratón.
 */
export function resumir(texto: string, max = 70): string {
  if (texto.length <= max) return texto;
  const coma = texto.indexOf(', ');
  if (coma >= 20 && coma <= max) return `${texto.slice(0, coma)}…`;
  const corte = texto.lastIndexOf(' ', max);
  return `${texto.slice(0, corte > 20 ? corte : max).replace(/[,;:.]$/, '')}…`;
}
