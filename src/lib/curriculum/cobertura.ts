/**
 * La cobertura del currículo de una clase (18-11-2026, decisión del dueño):
 * cuántos criterios de evaluación oficiales de una materia se han evaluado ya
 * con rúbricas y dianas, y cuáles faltan. Un criterio cuenta como evaluado en
 * cuanto alguna evaluación de la clase lleva su nota (`officialCriteriaScores`,
 * ver `evaluacionPorCriterios.ts`). No es una nota: es por dónde va el curso.
 */
import type { CurriculumEntry } from './index';
import type { Evaluation } from '../../types';

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

/** `evaluaciones` son las de la clase (todas las de su alumnado). */
export function coberturaDeMateria(entry: CurriculumEntry, grupo: string, evaluaciones: Evaluation[]): Cobertura {
  const evaluadas = new Set<string>();
  for (const ev of evaluaciones) for (const k of Object.keys(ev.officialCriteriaScores ?? {})) evaluadas.add(k);
  // Sin importar `index.ts` (ni `evaluacionPorCriterios.ts`, que lo importa): trae el currículo estatal entero y esto se usa también en pantallas ligeras
  const numeros = new Set((entry.competenciasPorGrupo?.[grupo] ?? entry.competencias).map(c => c.n));
  const criterios = (entry.criterios[grupo] ?? []).filter(cr => numeros.has(cr.competencia));
  const pendientes = criterios
    .filter(cr => !evaluadas.has(`${entry.id}|${cr.codigo}`))
    .map(cr => ({ codigo: cr.codigo, texto: cr.texto, competencia: cr.competencia }));
  return {
    total: criterios.length,
    evaluados: criterios.length - pendientes.length,
    pendientes,
    competenciasPendientes: [...new Set(pendientes.map(p => p.competencia))].sort((a, b) => a - b),
  };
}

/** «50 %», redondeado; 0 si la materia no tiene criterios. */
export const porcentaje = (c: Pick<Cobertura, 'total' | 'evaluados'>) => (c.total ? Math.round((c.evaluados / c.total) * 100) : 0);
