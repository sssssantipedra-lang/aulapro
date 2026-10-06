import type { User, Class, Student, ScheduleBlock, CalEvent, Task, Rubric, GradeCategory, GradeItem, GradeMap, ClassMark } from '../types';
import { isoDate } from './utils';
import type { ComunidadId } from './curriculum/comunidades';

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

const DEMO_TASKS: Task[] = [
  { id: 't1', text: 'Corregir exámenes 3º ESO A',    priority: 'high',   done: false },
  { id: 't2', text: 'Preparar UD Fracciones',        priority: 'medium', done: false },
  { id: 't3', text: 'Llamar a la familia de Alumno 1', priority: 'high', done: false },
  { id: 't4', text: 'Actualizar notas en Séneca',    priority: 'low',    done: true  },
];

const DEMO_CLASSES: Class[] = [
  // La primera es una tutoría con varias asignaturas, para que se vea de qué
  // va eso nada más cargar los datos de ejemplo.
  {
    id: 'c1', name: '3º ESO A', room: 'Aula 12', color: '#0284c7',
    isTutoria: true,
    subject: 'Matemáticas',
    subjects: ['Matemáticas', 'Biología y Geología', 'Tutoría'],
    etapa: 'eso', curso: 3,
    materiasOficiales: { Matemáticas: 'Matemáticas', 'Biología y Geología': 'Biología y Geología', Tutoría: null },
  },
  {
    id: 'c2', name: '4º ESO B',  subject: 'Matemáticas',   subjects: ['Matemáticas'],   room: 'Aula 7', color: '#10b981',
    etapa: 'eso', curso: 4, opcionMatematicas: 'B', materiasOficiales: { Matemáticas: 'Matemáticas' },
  },
  // Bachillerato no es una etapa de la app: se queda sin currículo oficial, como ejemplo de clase libre
  { id: 'c3', name: '1º Bach A', subject: 'Matemáticas I', subjects: ['Matemáticas I'], room: 'Aula 8', color: '#8b5cf6' },
];

const DEMO_STUDENTS: Student[] = [
  { id:'s01', class_id:'c1', name:'Alumno 1',  email:'alumno1@ies.es',  photo:null, alerts:[{id:'al1',text:'Dificultades con fracciones',level:'warn'}], notes:'Necesita refuerzo en operaciones con fracciones.' },
  { id:'s02', class_id:'c1', name:'Alumno 2',  email:'alumno2@ies.es',  photo:null, alerts:[], notes:'' },
  { id:'s03', class_id:'c1', name:'Alumno 3',  email:'alumno3@ies.es',  photo:null, alerts:[], notes:'Muy participativo.' },
  { id:'s04', class_id:'c1', name:'Alumno 4',  email:'alumno4@ies.es',  photo:null, alerts:[{id:'al2',text:'Faltas reiteradas',level:'danger'}], notes:'' },
  { id:'s05', class_id:'c1', name:'Alumno 5',  email:'alumno5@ies.es',  photo:null, alerts:[], notes:'' },
  { id:'s06', class_id:'c1', name:'Alumno 6',  email:'alumno6@ies.es',  photo:null, alerts:[], notes:'' },
  { id:'s07', class_id:'c2', name:'Alumno 7',  email:'alumno7@ies.es',  photo:null, alerts:[{id:'al3',text:'3 faltas sin justificar',level:'danger'}], notes:'Tutoría con familia pendiente.' },
  { id:'s08', class_id:'c2', name:'Alumno 8',  email:'alumno8@ies.es',  photo:null, alerts:[], notes:'' },
  { id:'s09', class_id:'c2', name:'Alumno 9',  email:'alumno9@ies.es',  photo:null, alerts:[], notes:'' },
  { id:'s10', class_id:'c2', name:'Alumno 10', email:'alumno10@ies.es', photo:null, alerts:[{id:'al4',text:'Mejora notable en el último examen',level:'info'}], notes:'' },
  { id:'s11', class_id:'c3', name:'Alumno 11', email:'alumno11@ies.es', photo:null, alerts:[], notes:'' },
  { id:'s12', class_id:'c3', name:'Alumno 12', email:'alumno12@ies.es', photo:null, alerts:[], notes:'' },
  { id:'s13', class_id:'c3', name:'Alumno 13', email:'alumno13@ies.es', photo:null, alerts:[], notes:'' },
];

const DEMO_BLOCKS: ScheduleBlock[] = [
  {id:'b1',  day:1, time_start:'08:30', time_end:'09:25', subject:'3º ESO A - Matemáticas',  room:'Aula 12', class_id:'c1', color:'#0284c7'},
  {id:'b2',  day:1, time_start:'09:30', time_end:'10:25', subject:'4º ESO B - Matemáticas',  room:'Aula 7',  class_id:'c2', color:'#10b981'},
  {id:'b3',  day:1, time_start:'11:00', time_end:'11:55', subject:'1º Bach A - Matemáticas I', room:'Aula 8', class_id:'c3', color:'#8b5cf6'},
  {id:'b4',  day:2, time_start:'08:30', time_end:'09:25', subject:'1º Bach A - Matemáticas I', room:'Aula 8', class_id:'c3', color:'#8b5cf6'},
  {id:'b5',  day:2, time_start:'11:00', time_end:'11:55', subject:'3º ESO A - Matemáticas',  room:'Aula 12', class_id:'c1', color:'#0284c7'},
  {id:'b6',  day:3, time_start:'09:30', time_end:'10:25', subject:'4º ESO B - Matemáticas',  room:'Aula 7',  class_id:'c2', color:'#10b981'},
  {id:'b7',  day:3, time_start:'12:00', time_end:'12:55', subject:'3º ESO A - Matemáticas',  room:'Aula 12', class_id:'c1', color:'#0284c7'},
  {id:'b8',  day:4, time_start:'08:30', time_end:'09:25', subject:'1º Bach A - Matemáticas I', room:'Aula 8', class_id:'c3', color:'#8b5cf6'},
  {id:'b9',  day:5, time_start:'08:30', time_end:'09:25', subject:'4º ESO B - Matemáticas',  room:'Aula 7',  class_id:'c2', color:'#10b981'},
  {id:'b10', day:5, time_start:'09:30', time_end:'10:25', subject:'3º ESO A - Matemáticas',  room:'Aula 12', class_id:'c1', color:'#0284c7'},
];

/** Fecha ISO desplazada N días desde hoy. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function buildDemoEvents(): CalEvent[] {
  return [
    {id:'ev1', name:'Entrega notas 1ª Eval.', date:daysFromNow(3),  time:'09:00', type:'deadline', urgency:'alta',  color:'#ef4444', desc:'Plazo máximo de entrega a jefatura'},
    {id:'ev2', name:'Reunión Orientación',    date:daysFromNow(5),  time:'11:30', type:'meeting',  urgency:'media', color:'#f59e0b', desc:'Con el departamento de orientación'},
    {id:'ev3', name:'Excursión 3º ESO A',     date:daysFromNow(8),  time:'08:30', type:'event',    urgency:'baja',  color:'#10b981', desc:'Visita al museo de ciencias'},
    {id:'ev4', name:'Claustro trimestral',    date:daysFromNow(12), time:'17:00', type:'meeting',  urgency:'media', color:'#8b5cf6', desc:''},
  ];
}

const DEMO_RUBRICS: Rubric[] = [
  {
    id: 'r1',
    name: 'Exposición oral',
    context: 'Presentación de un trabajo de investigación',
    criteria: [
      { id: 'cr1', name: 'Claridad expositiva', descriptors: { 1: 'No se entiende el mensaje', 2: 'Se entiende con esfuerzo', 3: 'Discurso claro en general', 4: 'Discurso claro, ordenado y fluido' } },
      { id: 'cr2', name: 'Dominio del contenido', descriptors: { 1: 'No domina el tema', 2: 'Conocimiento superficial', 3: 'Buen conocimiento', 4: 'Dominio completo, responde preguntas' } },
      { id: 'cr3', name: 'Material de apoyo', descriptors: { 1: 'Sin material o inadecuado', 2: 'Material poco cuidado', 3: 'Material correcto', 4: 'Material excelente y original' } },
    ],
  },
];

const DEMO_CATEGORIES: GradeCategory[] = [
  { id: 'gc1', class_id: 'c1', name: 'Exámenes',      weight: 60 },
  { id: 'gc2', class_id: 'c1', name: 'Tareas',        weight: 30 },
  { id: 'gc3', class_id: 'c1', name: 'Participación', weight: 10 },
];

function buildDemoGradeItems(): GradeItem[] {
  return [
    { id: 'gi1', class_id: 'c1', category_id: 'gc1', name: 'Examen T1', date: daysFromNow(-20) },
    { id: 'gi2', class_id: 'c1', category_id: 'gc1', name: 'Examen T2', date: daysFromNow(-5) },
    { id: 'gi3', class_id: 'c1', category_id: 'gc2', name: 'Cuaderno',  date: daysFromNow(-10) },
    { id: 'gi4', class_id: 'c1', category_id: 'gc3', name: '1ª Eval.',  date: daysFromNow(-3) },
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

export function buildDemoData(): DemoData {
  return {
    tasks: DEMO_TASKS,
    classes: DEMO_CLASSES,
    students: DEMO_STUDENTS,
    scheduleBlocks: DEMO_BLOCKS,
    calEvents: buildDemoEvents(),
    rubrics: DEMO_RUBRICS,
    gradeCategories: DEMO_CATEGORIES,
    gradeItems: buildDemoGradeItems(),
    grades: DEMO_GRADES,
    classMarks: buildDemoMarks(),
  };
}

export const PALETTE = ['#0284c7','#10b981','#f59e0b','#ef4444','#8b5cf6','#3b82f6'];
