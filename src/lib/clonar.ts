/**
 * Copiar a otras clases (petición del dueño, 18-10-2026): quien da Educación
 * Física, o cualquier otra materia, a varias clases del mismo curso no
 * tiene por qué volver a crear la situación de aprendizaje ni las sesiones de
 * cada una. Aquí está lo que cambia al copiar: la clase de destino, un
 * identificador nuevo y, en las sesiones, la fecha y si estaban completadas.
 */
import type { Class, LearningSituation } from '../types';
import type { SesionEF } from '../types/ef';

/**
 * Una copia de la situación de aprendizaje para otra clase. El contenido se
 * copia entero (sin compartirlo con la original: editar una no cambia la
 * otra) y, si la clase de destino dice su etapa y su curso, la petición los
 * toma de ella.
 */
export function clonarSda(sda: LearningSituation, destino: Class, id: string, ahora: Date = new Date()): LearningSituation {
  const { otras_clases: _o, ...copia } = structuredClone(sda);
  void _o;
  return {
    ...copia,
    content: { ...copia.content, sesiones: copia.content.sesiones.map(({ completada: _c, ...resto }) => { void _c; return resto; }) },
    id,
    at: ahora.toISOString(),
    date: `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`,
    class_id: destino.id,
    class_name: destino.name,
    request: {
      ...copia.request,
      ...(destino.etapa ? { etapa: destino.etapa } : {}),
      ...(destino.curso ? { curso: destino.curso } : {}),
    },
  };
}

/** Una copia de la sesión para otra clase, sin fecha (cada clase tiene su horario) salvo que se pida conservarla. */
export function clonarSesionEF(s: SesionEF, destino: Class, id: string, conservarFecha = false): SesionEF {
  const copia = structuredClone(s);
  const { fecha, completada: _c, ...resto } = copia;
  void _c;
  return { ...resto, id, claseId: destino.id, ...(conservarFecha && fecha ? { fecha } : {}) };
}

/** Si dos clases son del mismo curso (los dos conocidos e iguales). */
export function mismoNivel(a: Pick<Class, 'etapa' | 'curso'>, b: Pick<Class, 'etapa' | 'curso'>): boolean {
  return !!a.etapa && !!a.curso && a.etapa === b.etapa && a.curso === b.curso;
}
