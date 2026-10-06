/**
 * Ayuda sobre la propia aplicación: el manual que lee la IA para responder
 * «¿cómo hago…?».
 *
 * Es distinto del asistente del Cuaderno (`aiContext.ts`), que responde sobre
 * los alumnos y sus notas. Aquí NO se envía ningún dato del docente: solo la
 * pregunta y este manual. Quien pregunta por su clase se va a la otra pantalla.
 *
 * El manual y las instrucciones del asistente están en `appHelpManual.ts`, que
 * se carga al abrir la ayuda y no con la aplicación: son unos 60 KB de texto
 * que la mayoría de las veces no se leen.
 *
 * **Al añadir o cambiar una pantalla hay que actualizar el manual y, si es una
 * pantalla nueva, `HELP_TARGETS`.** Un manual desfasado es peor que no tener
 * ayuda: manda al docente a un botón que ya no existe y le hace perder la
 * confianza en todo lo demás.
 */

import { translate, type Lang } from '../i18n';
import type { Section } from '../types';

/**
 * Secciones a las que el asistente puede llevar de un salto. Son los mismos
 * identificadores que usa `Section` en types/index.ts; se validan contra esta
 * lista antes de pintar el botón, para que un identificador inventado por la
 * IA no deje un botón que no lleva a ninguna parte.
 */
export const HELP_TARGETS: Record<Section, { es: string; en: string }> = {
  dashboard:             { es: 'Inicio', en: 'Home' },
  classes:               { es: 'Mis Clases', en: 'My Classes' },
  agenda:                { es: 'Agenda', en: 'Planner' },
  notebook:              { es: 'Cuaderno de Notas', en: 'Gradebook' },
  attendance:            { es: 'Asistencia', en: 'Attendance' },
  seating:               { es: 'Distribución de aula', en: 'Classroom Layout' },
  'learning-situations': { es: 'Situaciones de aprendizaje', en: 'Learning Situations' },
  rubrics:               { es: 'Rúbricas', en: 'Rubrics' },
  diana:                 { es: 'Diana Competencial', en: 'Learner Profile Tracking' },
  reports:               { es: 'Informes', en: 'Reports' },
  records:               { es: 'Actas', en: 'Grade Sheets' },
  selfassess:            { es: 'Autoevaluaciones', en: 'Self-Assessments' },
  history:               { es: 'Historial', en: 'Assessment History' },
  resources:             { es: 'Recursos', en: 'Resources' },
  meetings:              { es: 'Reuniones', en: 'Meetings' },
  trainings:             { es: 'Formaciones', en: 'Training' },
  'sec-classroom':       { es: 'Aula Live', en: 'Live Classroom' },
  'classroom-live':      { es: 'Sala de alumnos', en: 'Student Room' },
  share:                 { es: 'Trabajo compartido', en: 'Shared Workspace' },
  audit:                 { es: 'Registro de cambios', en: 'Change Log' },
  profile:               { es: 'Configuración', en: 'Settings' },
  'apoyo-registro':      { es: 'Registro diario', en: 'Session Log' },
  'apoyo-alumnado':      { es: 'Alumnado y grupos', en: 'Students and Groups' },
  'apoyo-programas':     { es: 'Programas', en: 'Programmes' },
  'apoyo-documentos':    { es: 'Programación e informes', en: 'Planning and Reports' },
  'apoyo-coordinaciones': { es: 'Coordinaciones', en: 'Coordination' },
  'apoyo-agenda-visual': { es: 'Agenda visual', en: 'Visual Schedule' },
  'ef-pista':            { es: 'En la pista', en: 'On the Court' },
  'ef-exentos':          { es: 'Exentos y lesiones', en: 'Exemptions and Injuries' },
  'ef-pruebas':          { es: 'Pruebas físicas', en: 'Fitness Tests' },
  'ef-equipos':          { es: 'Equipos', en: 'Teams' },
  'ef-circuitos':        { es: 'Circuitos', en: 'Circuits' },
  'ef-sda':              { es: 'Situaciones de aprendizaje', en: 'Learning Situations' },
  'ef-sesiones':         { es: 'Sesiones', en: 'Sessions' },
  'ef-actividades':      { es: 'Actividades', en: 'Activities' },
  'ef-material':         { es: 'Material e instalaciones', en: 'Equipment and Facilities' },
};

/**
 * ¿Es este identificador una pantalla de verdad? Estrecha `string` a
 * `Section`, que es lo que hace falta para leer HELP_TARGETS sin castings:
 * los identificadores que se comprueban vienen de fuera del tipo —de lo que
 * escribe la IA o de la sección abierta— y podrían ser cualquier cosa.
 */
export function isHelpTarget(id: string): id is Section {
  return Object.prototype.hasOwnProperty.call(HELP_TARGETS, id);
}

/** Nombre de la pantalla en el idioma de la interfaz; el propio id si no lo es. */
export function targetLabel(id: string, lang: Lang): string {
  if (!isHelpTarget(id)) return id;
  // En catalán, el nombre en castellano pasa por el diccionario, como el menú
  return lang === 'ca' ? translate('ca', HELP_TARGETS[id].es) : HELP_TARGETS[id][lang];
}

/** Marca con la que el modelo propone un salto de pantalla. */
export const JUMP_RE = /\[IR:([a-z-]+)\]/gi;

/**
 * Separa el texto de la respuesta del salto de pantalla que proponga.
 * Se limpia SIEMPRE la marca, salga o no un destino válido, para que nunca
 * quede a la vista un «[IR:algo]» en mitad de una frase.
 */
export function splitJump(raw: string): { text: string; target?: string } {
  let target: string | undefined;
  for (const m of raw.matchAll(JUMP_RE)) {
    const id = m[1].toLowerCase();
    if (!target && isHelpTarget(id)) target = id;
  }
  return { text: raw.replace(JUMP_RE, '').replace(/[ \t]+\n/g, '\n').trim(), target };
}
