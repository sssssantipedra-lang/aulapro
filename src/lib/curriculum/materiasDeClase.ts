/**
 * Cuál es la materia oficial de cada asignatura de una clase.
 *
 * El docente escribe las asignaturas con sus palabras («Mates», «Cono»,
 * «Ciencias») y el currículo de su comunidad las llama de otra manera. Aquí se
 * decide, para una asignatura, una de tres cosas: ya se sabe cuál es (la
 * eligió el docente, o el nombre coincide con un alias seguro); el docente
 * decidió trabajarla en modo libre; o hay que preguntarle, y se le ofrecen las
 * materias reales de su comunidad y curso. Nunca se adivina ante la duda: un
 * emparejamiento equivocado generaría la SdA con las competencias de otra
 * materia, que es peor que no emparejar (ver `mapeoMaterias.ts`).
 */

import { buscarMateria, resolverGrupo, type CurriculumEntry, type Etapa } from './index';
import { emparejarMateria } from './mapeoMaterias';

export type EstadoMateria =
  /** Se sabe cuál es. `porAlias`: no la eligió el docente, la dedujo el alias. */
  | { tipo: 'oficial'; materia: string; porAlias: boolean }
  /** El docente decidió trabajarla sin lista oficial. */
  | { tipo: 'libre' }
  /** Hay que preguntar. `opciones` son las materias de este curso en su comunidad. */
  | { tipo: 'sin-decidir'; opciones: string[] };

export interface ContextoClase {
  etapa: Etapa;
  curso: number;
  opcionMatematicas?: 'A' | 'B';
  materiasOficiales?: Record<string, string | null>;
}

/**
 * ¿Tiene esta materia currículo para este curso? Matemáticas de 4º de ESO
 * cuenta aunque aún no se haya elegido la opción A o B: esa elección es otra
 * pregunta, y no por eso la materia deja de existir.
 */
function aplicaAlCurso(
  materia: string, ctx: ContextoClase, materias: CurriculumEntry[],
): boolean {
  if (resolverGrupo(ctx.etapa, materia, ctx.curso, ctx.opcionMatematicas, materias)) return true;
  if (ctx.etapa === 'eso' && ctx.curso === 4 && materia === 'Matemáticas' && !ctx.opcionMatematicas) {
    return (['A', 'B'] as const).some(o => resolverGrupo('eso', materia, 4, o, materias));
  }
  return false;
}

/** Las materias oficiales de este curso, para el desplegable. */
export function materiasDelCurso(ctx: ContextoClase, materias: CurriculumEntry[]): string[] {
  return materias.filter(m => aplicaAlCurso(m.nombre, ctx, materias)).map(m => m.nombre);
}

const tiene = (o: object | undefined, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k);

export function estadoDeMateria(
  asignatura: string, ctx: ContextoClase, materias: CurriculumEntry[],
): EstadoMateria {
  if (tiene(ctx.materiasOficiales, asignatura)) {
    const guardada = ctx.materiasOficiales![asignatura];
    if (guardada === null) return { tipo: 'libre' };
    // Una elección de otra comunidad o de otro curso ya no vale: se pregunta de nuevo
    if (aplicaAlCurso(guardada, ctx, materias)) return { tipo: 'oficial', materia: guardada, porAlias: false };
  }

  const alias = emparejarMateria(asignatura, ctx.etapa);
  if (alias && buscarMateria(ctx.etapa, alias, materias) && aplicaAlCurso(alias, ctx, materias)) {
    return { tipo: 'oficial', materia: alias, porAlias: true };
  }

  return { tipo: 'sin-decidir', opciones: materiasDelCurso(ctx, materias) };
}
