/**
 * Una sesión de la situación de aprendizaje como texto (para el PDF y el Word) y
 * como la sesión que se pasa a Sesiones. Desde el 18-11-2026 (decisión del dueño)
 * todas las sesiones traen tres momentos, cada uno con sus actividades
 * (`MomentosSesionEF`): en EF, activación, desarrollo y vuelta a la calma; en las
 * demás áreas, inicio, desarrollo y conclusión. Se guardan siempre con las claves
 * de antes (`preimpacto`, `impacto`, `postimpacto`), así que las SdA ya hechas se
 * leen igual; solo cambian los nombres que se enseñan. Las sesiones de antes sin
 * momentos solo tienen su descripción.
 */
import type { ActividadSesionEF, MomentoSesionEF, MomentosSesionEF, SdaSession } from '../services/learningSituations';

type T = (clave: string, vars?: Record<string, string | number>) => string;

/** `label` con «@@sesion» cuando la palabra ya tiene otra traducción en la app («Inicio» es «Home» en el menú). */
type Momento = { id: keyof MomentosSesionEF; label: string; ayuda: string };

/** Los tres momentos de una sesión de EF. */
export const MOMENTOS_EF: readonly Momento[] = [
  { id: 'preimpacto', label: 'Activación', ayuda: 'Calentamiento, presentación de la tarea y normas' },
  { id: 'impacto', label: 'Desarrollo@@sesion', ayuda: 'Las tareas principales, de menos a más' },
  { id: 'postimpacto', label: 'Vuelta a la calma', ayuda: 'Relajación, puesta en común, evaluación y cierre' },
];

/** Los tres momentos de una sesión de las demás áreas. */
export const MOMENTOS_AULA: readonly Momento[] = [
  { id: 'preimpacto', label: 'Inicio@@sesion', ayuda: 'Activar lo que saben y presentar el reto' },
  { id: 'impacto', label: 'Desarrollo@@sesion', ayuda: 'Las actividades principales' },
  { id: 'postimpacto', label: 'Conclusión', ayuda: 'Puesta en común, comprobación y cierre' },
];

export const momentosDe = (ef: boolean) => (ef ? MOMENTOS_EF : MOMENTOS_AULA);
/** El título del bloque de los tres momentos. */
export const tituloMomentos = (ef: boolean) => (ef ? 'Activación, desarrollo y vuelta a la calma' : 'Inicio, desarrollo y conclusión');

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

/** La sesión entera en texto, con saltos de línea. `ef`: si la SdA es de Educación Física (cambia el nombre de los momentos). */
export function sesionEnTexto(s: SdaSession, t: T, ef = false): string {
  if (!s.momentos) return s.descripcion;
  return [
    s.descripcion,
    ...momentosDe(ef).map(m => momentoEnTexto(t(m.label), s.momentos![m.id], t)),
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
