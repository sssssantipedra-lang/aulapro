/**
 * La adaptación curricular significativa como contexto para la IA, solo si el docente lo marca (casilla «Tener en
 * cuenta su ACS», `components/apoyo/CasillaAcs.tsx`). Decisión del dueño (3-11-2026): que la ACS sirva para
 * programar, sacar objetivos concretos, adaptar la SdA, las sesiones y las fichas, tanto en PT y AL como en el aula y
 * en EF, pero a petición.
 *
 * Lo que sale: el área, el curso de referencia, los criterios y los saberes elegidos (con su texto oficial), los
 * objetivos, las estrategias y los criterios de calificación. Lo que nunca sale: el profesorado, las fechas, la
 * justificación, las barreras, los acuerdos con la familia, las observaciones del seguimiento ni el nombre del
 * alumno. Los textos libres pasan por `textoLibreParaIA` (sin datos de contacto ni de salud: diagnósticos, trastornos,
 * discapacidades, medicación; revisión del abogado del dueño, 3-11-2026), y en el aula, además, por `sinNombres`. Nunca van
 * las categorías NEAE del alumno.
 */
import { ESTRATEGIAS_ACS, textosElegidos } from './acs';
import { textoLibreParaIA } from './documentoParaIA';
import { sinNombres } from './barreras';
import type { ModeloAcs } from './acsModelos';
import type { MateriaDeClase } from './curriculum/criteriosParaIA';
import type { AcsApoyo, CursoDe } from '../types/apoyo';

const limpio = (x: string, nombres: readonly string[]) => textoLibreParaIA(sinNombres(x.trim(), nombres)).trim();

/**
 * Una adaptación en texto para la IA. `materia` es el área en el currículo del curso de referencia, para poner el
 * texto de cada criterio; sin ella, solo los códigos. `nombres`, las palabras de los nombres del alumnado que no deben
 * salir aunque el docente las haya escrito.
 */
export function acsParaIA(
  acs: AcsApoyo, modelo: ModeloAcs, materia: MateriaDeClase | undefined, nombreCurso: (c: CursoDe) => string,
  nombres: readonly string[] = [],
): string {
  const el = textosElegidos(acs, materia);
  const estrategias = ESTRATEGIAS_ACS.filter(e => acs.estrategias.includes(e.id)).map(e => e.texto);
  const otras = limpio(acs.otrasEstrategias, nombres);
  const calificacion = limpio(acs.calificacion, nombres);
  const objetivos = (acs.objetivos ?? []).map(o =>
    `- ${limpio(o.texto, nombres)} (trimestre ${o.trimestres.join(', ')}${o.criterio ? `; criterio ${o.criterio}` : ''})`);
  const lineas = [
    `${modelo.sigla} del área «${acs.area}» con el currículo de ${nombreCurso(acs.nivel)}` +
      (acs.materiaAula.trim() && acs.materiaAula.trim() !== acs.area ? ` (en su clase, «${limpio(acs.materiaAula, nombres)}»)` : '') + '.',
    el.criterios.length ? `Criterios de evaluación de la adaptación (son los que se evalúan):\n${el.criterios.map(c => `- ${c}`).join('\n')}` : '',
    el.saberes.length ? `Saberes básicos mínimos: ${el.saberes.join('; ')}.` : '',
    objetivos.length ? `Objetivos concretos:\n${objetivos.join('\n')}` : '',
    estrategias.length || otras ? `Estrategias que le ayudan: ${[...estrategias, otras].filter(Boolean).join('; ')}.` : '',
    calificacion ? `Cómo se califica: ${calificacion}` : '',
  ];
  return lineas.filter(Boolean).join('\n');
}

/** Varias adaptaciones de un mismo alumno o de una clase, separadas; vacío si no hay ninguna. */
export function acsVariasParaIA(
  lista: readonly AcsApoyo[], modelo: ModeloAcs, materiaDe: (a: AcsApoyo) => MateriaDeClase | undefined,
  nombreCurso: (c: CursoDe) => string, nombres: readonly string[] = [], etiqueta?: (a: AcsApoyo) => string,
): string {
  return lista.map(a => (etiqueta ? `${etiqueta(a)}: ` : '') + acsParaIA(a, modelo, materiaDe(a), nombreCurso, nombres)).join('\n\n');
}
