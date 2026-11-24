/**
 * La cobertura del currículo de una clase (18-11-2026, decisión del dueño):
 * cuántos criterios de evaluación oficiales de una materia se han evaluado ya
 * con rúbricas y dianas, y cuáles faltan. Un criterio cuenta como evaluado en
 * cuanto alguna evaluación de la clase lleva su nota (`officialCriteriaScores`,
 * ver `evaluacionPorCriterios.ts`). No es una nota: es por dónde va el curso.
 */
import type { CurriculumEntry } from './index';
import type { Evaluation } from '../../types';
import { EVALUACIONES, cuentaEn, type RangoDeFechas } from '../periodos';

export interface CriterioPendiente {
  codigo: string;
  texto: string;
  /** El número de su competencia específica. */
  competencia: number;
}

export interface Cobertura {
  total: number;
  evaluados: number;
  /** Los que aún no se han evaluado ninguna vez, en el orden del decreto. */
  pendientes: CriterioPendiente[];
  /** Las competencias específicas con algún criterio sin evaluar. */
  competenciasPendientes: number[];
}

/** Los criterios de la materia que le tocan a ese grupo de cursos, en el orden del decreto. */
function criteriosDe(entry: CurriculumEntry, grupo: string): CriterioPendiente[] {
  // Sin importar `index.ts` (ni `evaluacionPorCriterios.ts`, que lo importa): trae el currículo estatal entero y esto se usa también en pantallas ligeras
  const numeros = new Set((entry.competenciasPorGrupo?.[grupo] ?? entry.competencias).map(c => c.n));
  return (entry.criterios[grupo] ?? []).filter(cr => numeros.has(cr.competencia))
    .map(cr => ({ codigo: cr.codigo, texto: cr.texto, competencia: cr.competencia }));
}

/** `evaluaciones` son las de la clase (todas las de su alumnado). */
export function coberturaDeMateria(entry: CurriculumEntry, grupo: string, evaluaciones: Evaluation[]): Cobertura {
  const evaluadas = new Set<string>();
  for (const ev of evaluaciones) for (const k of Object.keys(ev.officialCriteriaScores ?? {})) evaluadas.add(k);
  const criterios = criteriosDe(entry, grupo);
  const pendientes = criterios.filter(cr => !evaluadas.has(`${entry.id}|${cr.codigo}`));
  return {
    total: criterios.length,
    evaluados: criterios.length - pendientes.length,
    pendientes,
    competenciasPendientes: [...new Set(pendientes.map(p => p.competencia))].sort((a, b) => a - b),
  };
}

/* ── La cobertura de una evaluación (20-11-2026) ──
 * Para repartir los criterios entre los trimestres hace falta saber, de cada uno, si ya se ha evaluado en
 * esta evaluación, si se evaluó en otra o si no se ha evaluado en todo el curso. Qué evaluación cuenta cada
 * rúbrica o diana lo decide su fecha, con la misma regla que el cuaderno y el acta (`cuentaEn`). */

export interface CriterioDeOtra extends CriterioPendiente {
  /** Las evaluaciones del curso en las que sí se evaluó, en orden; vacío si solo tiene nota con fecha de otro curso. */
  periodos: string[];
}

export interface CoberturaDeEvaluacion {
  total: number;
  /** Los evaluados en esta evaluación, en el orden del decreto. */
  enEsta: CriterioPendiente[];
  /** Los que no se han evaluado en esta, pero sí en otro momento del curso. */
  enOtra: CriterioDeOtra[];
  /** Los que no se han evaluado ninguna vez: los que quedan por repartir. Son los `pendientes` de todo el curso. */
  enNinguna: CriterioPendiente[];
}

/**
 * `evaluaciones` son las de la clase, todas las del curso; `periodo`, una de las tres evaluaciones. Una
 * evaluación sin fecha cuenta en las tres, como en el cuaderno.
 */
export function coberturaDeEvaluacion(
  entry: CurriculumEntry, grupo: string, evaluaciones: Evaluation[],
  periodo: string, hoy: string, rangos: Record<string, RangoDeFechas>,
): CoberturaDeEvaluacion {
  /** De cada criterio con nota, en qué evaluaciones del curso la tiene. */
  const donde = new Map<string, Set<string>>();
  for (const ev of evaluaciones) {
    const claves = Object.keys(ev.officialCriteriaScores ?? {});
    if (!claves.length) continue;
    const suyas = EVALUACIONES.filter(p => cuentaEn(ev.date, p, hoy, rangos));
    for (const k of claves) {
      const en = donde.get(k) ?? new Set<string>();
      for (const p of suyas) en.add(p);
      donde.set(k, en);
    }
  }
  const out: CoberturaDeEvaluacion = { total: 0, enEsta: [], enOtra: [], enNinguna: [] };
  for (const cr of criteriosDe(entry, grupo)) {
    out.total++;
    const en = donde.get(`${entry.id}|${cr.codigo}`);
    if (!en) out.enNinguna.push(cr);
    else if (en.has(periodo)) out.enEsta.push(cr);
    else out.enOtra.push({ ...cr, periodos: EVALUACIONES.filter(p => en.has(p)) });
  }
  return out;
}

/** «50 %», redondeado; 0 si la materia no tiene criterios. */
export const porcentaje = (c: Pick<Cobertura, 'total' | 'evaluados'>) => (c.total ? Math.round((c.evaluados / c.total) * 100) : 0);
