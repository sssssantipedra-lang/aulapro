import type { Evaluation } from '../types';

/**
 * Si dos evaluaciones son «la misma del día»: mismo alumno, instrumento, clase y fecha. Con una así ya
 * guardada, la nueva puede ser una corrección (la sustituye) u otro trabajo evaluado con el mismo
 * instrumento (se guardan las dos): lo decide el docente al guardar, salvo en las escalas de registro,
 * que se abren con lo ya valorado y siempre corrigen. Las autoevaluaciones del alumnado no entran.
 */
export function mismaEvaluacionDelDia(a: Evaluation, b: Evaluation): boolean {
  return a.rubric_id !== 'autoeval' && !!a.student_id
    && a.id !== b.id && a.rubric_id === b.rubric_id && a.student_id === b.student_id && a.class_id === b.class_id
    && a.date === b.date && (a.instrument ?? 'rubric') === (b.instrument ?? 'rubric');
}
