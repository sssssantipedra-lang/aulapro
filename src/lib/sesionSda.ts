/**
 * Una sesión de la situación de aprendizaje de EF como texto (para el PDF y el
 * Word) y como la sesión que se pasa a Educación Física → Sesiones. Las
 * sesiones de EF traen los tres momentos de la enseñanza, cada uno con sus
 * actividades reales (`MomentosSesionEF`); las de antes y las de otras materias
 * solo tienen su descripción.
 */
import type { ActividadSesionEF, MomentoSesionEF, MomentosSesionEF, SdaSession } from '../services/learningSituations';

type T = (clave: string, vars?: Record<string, string | number>) => string;

export const MOMENTOS: readonly { id: keyof MomentosSesionEF; label: string; ayuda: string }[] = [
  { id: 'preimpacto', label: 'Preimpacto', ayuda: 'Antes de la práctica: preparar, presentar y activar' },
  { id: 'impacto', label: 'Impacto', ayuda: 'Durante la práctica principal' },
  { id: 'postimpacto', label: 'Postimpacto', ayuda: 'Después: feedback, evaluación y cierre' },
];

/** Los minutos que suman las actividades de la sesión. */
export function minutosDeSesion(m: MomentosSesionEF): number {
  return [m.preimpacto, m.impacto, m.postimpacto].flatMap(x => x.actividades).reduce((s, a) => s + a.minutos, 0);
}

/** Una actividad en texto: «Nombre (10 min). Cómo se hace. Organización: … Material: …» */
export function actividadEnTexto(a: ActividadSesionEF, t: T): string {
  return [
    `${a.nombre}${a.minutos ? ` (${a.minutos} min)` : ''}. ${a.descripcion}`,
    a.organizacion && `${t('Organización')}: ${a.organizacion}`,
    a.material && `${t('Material')}: ${a.material}`,
  ].filter(Boolean).join(' ');
}

const momentoEnTexto = (etiqueta: string, m: MomentoSesionEF, t: T) =>
  [etiqueta.toUpperCase(), m.texto, ...m.actividades.map(a => `• ${actividadEnTexto(a, t)}`)].filter(Boolean).join('\n');

/** La sesión entera en texto, con saltos de línea. */
export function sesionEnTexto(s: SdaSession, t: T): string {
  if (!s.momentos) return s.descripcion;
  return [
    s.descripcion,
    ...MOMENTOS.map(m => momentoEnTexto(t(m.label), s.momentos![m.id], t)),
  ].filter(Boolean).join('\n\n');
}

/** Lo que de una sesión se pasa a cada parte de Educación Física → Sesiones. */
export function sesionParaEF(s: SdaSession, t: T): { objetivo: string; calentamiento: string; principal: string; calma: string; material: string } {
  if (!s.momentos) return { objetivo: s.descripcion, calentamiento: '', principal: s.descripcion, calma: '', material: '' };
  const m = s.momentos;
  const parte = (x: MomentoSesionEF) => [x.texto, ...x.actividades.map(a => actividadEnTexto(a, t))].filter(Boolean).join('\n');
  const materiales = [...new Set(
    [m.preimpacto, m.impacto, m.postimpacto].flatMap(x => x.actividades).map(a => a.material.trim()).filter(x => x && !/^ning/i.test(x)),
  )];
  return {
    objetivo: s.descripcion, calentamiento: parte(m.preimpacto), principal: parte(m.impacto), calma: parte(m.postimpacto),
    material: materiales.join('; '),
  };
}
