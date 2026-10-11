import type { User, Class, Student, ScheduleBlock, CalEvent, Task, Rubric, GradeCategory, GradeItem, GradeMap, ClassMark } from '../types';
import { isoDate } from './utils';
import type { ComunidadId } from './curriculum/comunidades';
import { translate, type Lang } from '../i18n/core';
import { nombreDeAlumnoDeEjemplo } from '../i18n/demo';

/**
 * Datos de ejemplo para explorar la app sin introducir datos reales.
 * Se cargan solo si el usuario pulsa "Cargar datos de ejemplo".
 */

/** La comunidad del perfil de demostración (es solo la de los datos de ejemplo). */
export const DEMO_COMMUNITY: ComunidadId = 'comunitat-valenciana';

export const DEMO_USER: User = {
  id: 'demo-uid-001',
  email: 'demo@aulapro.es',
  full_name: 'Profesor',
  school: 'IES Ejemplo',
  subject: 'Matemáticas',
  initials: 'P',
};

/** Los textos de los ejemplos, en el idioma de la aplicación (ver `i18n/demo.ts`). */
type Tr = (s: string, vars?: Record<string, string | number>) => string;

function demoTasks(tr: Tr, alumno: (n: number) => string): Task[] {
  return [
    { id: 't1', text: tr('Corregir exámenes 3º ESO A'), priority: 'high', done: false },
    { id: 't2', text: tr('Preparar UD Fracciones'), priority: 'medium', done: false },
    { id: 't3', text: tr('Llamar a la familia de {alumno}', { alumno: alumno(1) }), priority: 'high', done: false },
    { id: 't4', text: tr('Actualizar notas en ITACA'), priority: 'low', done: true },
  ];
}

function demoClasses(tr: Tr): Class[] {
  const mat = tr('Matemáticas'), bio = tr('Biología y Geología'), tut = tr('Tutoría');
  return [
    // La primera es una tutoría con varias asignaturas, para que se vea de qué
    // va eso nada más cargar los datos de ejemplo. El nombre de cada asignatura
    // va en el idioma de la aplicación; su materia oficial, como la llama el currículo.
    {
      id: 'c1', name: '3º ESO A', room: tr('Aula {n}', { n: 12 }), color: '#0284c7',
      isTutoria: true,
      subject: mat,
      subjects: [mat, bio, tut],
      etapa: 'eso', curso: 3,
      materiasOficiales: { [mat]: 'Matemáticas', [bio]: 'Biología y Geología', [tut]: null },
    },
    {
      id: 'c2', name: '4º ESO B', subject: mat, subjects: [mat], room: tr('Aula {n}', { n: 7 }), color: '#10b981',
      etapa: 'eso', curso: 4, opcionMatematicas: 'B', materiasOficiales: { [mat]: 'Matemáticas' },
    },
    // Bachillerato no es una etapa de la app: se queda sin currículo oficial, como ejemplo de clase libre
    { id: 'c3', name: '1º Bach A', subject: tr('Matemáticas I'), subjects: [tr('Matemáticas I')], room: tr('Aula {n}', { n: 8 }), color: '#8b5cf6' },
  ];
}

function demoStudents(tr: Tr, alumno: (n: number) => string): Student[] {
  const s = (n: number, class_id: string, alerts: Student['alerts'] = [], notes = ''): Student => ({
    id: `s${String(n).padStart(2, '0')}`, class_id, name: alumno(n), email: `alumno${n}@ies.es`, photo: null, alerts, notes,
  });
  return [
    s(1, 'c1', [{ id: 'al1', text: tr('Dificultades con fracciones'), level: 'warn' }], tr('Necesita refuerzo en operaciones con fracciones.')),
    s(2, 'c1'),
    s(3, 'c1', [], tr('Muy participativo.')),
    s(4, 'c1', [{ id: 'al2', text: tr('Faltas reiteradas'), level: 'danger' }]),
    s(5, 'c1'),
    s(6, 'c1'),
    s(7, 'c2', [{ id: 'al3', text: tr('3 faltas sin justificar'), level: 'danger' }], tr('Tutoría con familia pendiente.')),
    s(8, 'c2'),
    s(9, 'c2'),
    s(10, 'c2', [{ id: 'al4', text: tr('Mejora notable en el último examen'), level: 'info' }]),
    s(11, 'c3'),
    s(12, 'c3'),
    s(13, 'c3'),
  ];
}

function demoBlocks(tr: Tr): ScheduleBlock[] {
  const c1 = { subject: `3º ESO A - ${tr('Matemáticas')}`, room: tr('Aula {n}', { n: 12 }), class_id: 'c1', color: '#0284c7' };
  const c2 = { subject: `4º ESO B - ${tr('Matemáticas')}`, room: tr('Aula {n}', { n: 7 }), class_id: 'c2', color: '#10b981' };
  const c3 = { subject: `1º Bach A - ${tr('Matemáticas I')}`, room: tr('Aula {n}', { n: 8 }), class_id: 'c3', color: '#8b5cf6' };
  return [
    { id: 'b1', day: 1, time_start: '08:30', time_end: '09:25', ...c1 },
    { id: 'b2', day: 1, time_start: '09:30', time_end: '10:25', ...c2 },
    { id: 'b3', day: 1, time_start: '11:00', time_end: '11:55', ...c3 },
    { id: 'b4', day: 2, time_start: '08:30', time_end: '09:25', ...c3 },
    { id: 'b5', day: 2, time_start: '11:00', time_end: '11:55', ...c1 },
    { id: 'b6', day: 3, time_start: '09:30', time_end: '10:25', ...c2 },
    { id: 'b7', day: 3, time_start: '12:00', time_end: '12:55', ...c1 },
    { id: 'b8', day: 4, time_start: '08:30', time_end: '09:25', ...c3 },
    { id: 'b9', day: 5, time_start: '08:30', time_end: '09:25', ...c2 },
    { id: 'b10', day: 5, time_start: '09:30', time_end: '10:25', ...c1 },
  ];
}

/** Fecha ISO desplazada N días desde hoy. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function buildDemoEvents(tr: Tr): CalEvent[] {
  return [
    { id: 'ev1', name: tr('Entrega notas 1ª Eval.'), date: daysFromNow(3), time: '09:00', type: 'deadline', urgency: 'alta', color: '#ef4444', desc: tr('Plazo máximo de entrega a jefatura') },
    { id: 'ev2', name: tr('Reunión Orientación'), date: daysFromNow(5), time: '11:30', type: 'meeting', urgency: 'media', color: '#f59e0b', desc: tr('Con el departamento de orientación') },
    { id: 'ev3', name: tr('Excursión 3º ESO A'), date: daysFromNow(8), time: '08:30', type: 'event', urgency: 'baja', color: '#10b981', desc: tr('Visita al museo de ciencias') },
    { id: 'ev4', name: tr('Claustro trimestral'), date: daysFromNow(12), time: '17:00', type: 'meeting', urgency: 'media', color: '#8b5cf6', desc: '' },
  ];
}

function demoRubrics(tr: Tr): Rubric[] {
  return [
    {
      id: 'r1',
      name: tr('Exposición oral'),
      context: tr('Presentación de un trabajo de investigación'),
      criteria: [
        { id: 'cr1', name: tr('Claridad expositiva'), descriptors: { 1: tr('No se entiende el mensaje'), 2: tr('Se entiende con esfuerzo'), 3: tr('Discurso claro en general'), 4: tr('Discurso claro, ordenado y fluido') } },
        { id: 'cr2', name: tr('Dominio del contenido'), descriptors: { 1: tr('No domina el tema'), 2: tr('Conocimiento superficial'), 3: tr('Buen conocimiento'), 4: tr('Dominio completo, responde preguntas') } },
        { id: 'cr3', name: tr('Material de apoyo'), descriptors: { 1: tr('Sin material o inadecuado'), 2: tr('Material poco cuidado'), 3: tr('Material correcto'), 4: tr('Material excelente y original') } },
      ],
    },
  ];
}

function demoCategories(tr: Tr): GradeCategory[] {
  return [
    { id: 'gc1', class_id: 'c1', name: tr('Exámenes'), weight: 60 },
    { id: 'gc2', class_id: 'c1', name: tr('Tareas'), weight: 30 },
    { id: 'gc3', class_id: 'c1', name: tr('Participación'), weight: 10 },
  ];
}

function buildDemoGradeItems(tr: Tr): GradeItem[] {
  return [
    { id: 'gi1', class_id: 'c1', category_id: 'gc1', name: tr('Examen T1'), date: daysFromNow(-20) },
    { id: 'gi2', class_id: 'c1', category_id: 'gc1', name: tr('Examen T2'), date: daysFromNow(-5) },
    { id: 'gi3', class_id: 'c1', category_id: 'gc2', name: tr('Libreta'), date: daysFromNow(-10) },
    { id: 'gi4', class_id: 'c1', category_id: 'gc3', name: tr('1ª Eval.'), date: daysFromNow(-3) },
  ];
}

const DEMO_GRADES: GradeMap = {
  gi1: { s01: 4.5, s02: 7.8, s03: 8.5, s04: 5.0, s05: 6.2, s06: 9.1 },
  gi2: { s01: 5.5, s02: 8.2, s03: 7.9, s04: 4.8, s05: 6.8, s06: 9.4 },
  gi3: { s01: 6.0, s02: 9.0, s03: 8.0, s04: 5.5, s05: 7.0, s06: 9.5 },
  gi4: { s01: 7.0, s02: 8.5, s03: 9.5, s04: 6.0, s05: 7.5, s06: 9.0 },
};

/**
 * Unas anotaciones del aula para que se vea en el cuaderno el bloque
 * «Trabajo diario y actitud» que forman.
 */
function buildDemoMarks(): ClassMark[] {
  const m = (id: string, student_id: string, type: ClassMark['type'], days: number): ClassMark =>
    ({ id, class_id: 'c1', student_id, type, date: daysFromNow(days) });
  return [
    m('mk1', 's01', 'homework', -6),
    m('mk2', 's01', 'homework', -2),
    m('mk3', 's04', 'homework', -1),
    m('mk4', 's02', 'participation', -3),
    m('mk5', 's02', 'participation', -1),
    m('mk6', 's06', 'participation', -2),
    m('mk7', 's05', 'behavior-bad', -1),
  ];
}

export interface DemoData {
  tasks: Task[];
  classes: Class[];
  students: Student[];
  scheduleBlocks: ScheduleBlock[];
  calEvents: CalEvent[];
  rubrics: Rubric[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  classMarks: ClassMark[];
}

/** Los datos de ejemplo del docente de aula, en el idioma de la aplicación. */
export function buildDemoData(lang: Lang = 'es'): DemoData {
  const tr: Tr = (s, vars) => translate(lang, s, vars);
  const alumno = (n: number) => nombreDeAlumnoDeEjemplo(n, lang);
  return {
    tasks: demoTasks(tr, alumno),
    classes: demoClasses(tr),
    students: demoStudents(tr, alumno),
    scheduleBlocks: demoBlocks(tr),
    calEvents: buildDemoEvents(tr),
    rubrics: demoRubrics(tr),
    gradeCategories: demoCategories(tr),
    gradeItems: buildDemoGradeItems(tr),
    grades: DEMO_GRADES,
    classMarks: buildDemoMarks(),
  };
}

export const PALETTE = ['#0284c7','#10b981','#f59e0b','#ef4444','#8b5cf6','#3b82f6'];
