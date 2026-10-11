import type { User, Class, Student, ScheduleBlock, CalEvent, Task, Rubric, Evaluation, EvalDiana, DianaProfile, GradeCategory, GradeItem, GradeMap, ClassMark, MarksBlockConfig, OfficialCriterionRef } from '../types';
import { gradeFromLevels, levelsOf, competencyScoresFor } from '../types';
import { isoDate, LOMLOE_TO_DIANA } from './utils';
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

/*
 * Las clases de ejemplo (decisión del dueño, 11-10-2026): un grupo de cada
 * curso de la ESO, de 1º a 4º, con Matemáticas, y uno de cada curso de
 * Primaria, de 1º a 6º, cada uno con un área distinta. Una sola asignatura
 * por clase, con su currículo oficial. Así el cuaderno, la evaluación por
 * competencias y la portada de Evaluar enseñan algo nada más cargarlos.
 */
interface ClaseDemo {
  id: string;
  etapa: 'primaria' | 'eso';
  curso: 1 | 2 | 3 | 4 | 5 | 6;
  grupo: string;
  aula: number;
  color: string;
  /** El nombre de la asignatura (se traduce) y su materia oficial (`CurriculumEntry.id`). */
  asignatura: string;
  materia: string;
}

const CLASES: ClaseDemo[] = [
  { id: 'c1', etapa: 'eso', curso: 1, grupo: '1º ESO A', aula: 4,  color: '#0284c7', asignatura: 'Matemáticas', materia: 'matematicas' },
  { id: 'c2', etapa: 'eso', curso: 2, grupo: '2º ESO B', aula: 9,  color: '#10b981', asignatura: 'Matemáticas', materia: 'matematicas' },
  { id: 'c3', etapa: 'eso', curso: 3, grupo: '3º ESO A', aula: 12, color: '#8b5cf6', asignatura: 'Matemáticas', materia: 'matematicas' },
  { id: 'c4', etapa: 'eso', curso: 4, grupo: '4º ESO B', aula: 7,  color: '#f59e0b', asignatura: 'Matemáticas', materia: 'matematicas' },
  { id: 'p1', etapa: 'primaria', curso: 1, grupo: '1º Primaria A', aula: 1, color: '#ef4444', asignatura: 'Lengua Castellana y Literatura', materia: 'lengua-castellana' },
  { id: 'p2', etapa: 'primaria', curso: 2, grupo: '2º Primaria A', aula: 2, color: '#ec4899', asignatura: 'Matemáticas', materia: 'matematicas' },
  { id: 'p3', etapa: 'primaria', curso: 3, grupo: '3º Primaria A', aula: 3, color: '#14b8a6', asignatura: 'Conocimiento del Medio', materia: 'conocimiento-del-medio' },
  { id: 'p4', etapa: 'primaria', curso: 4, grupo: '4º Primaria A', aula: 5, color: '#6366f1', asignatura: 'Valenciano', materia: 'valenciano' },
  { id: 'p5', etapa: 'primaria', curso: 5, grupo: '5º Primaria A', aula: 6, color: '#65a30d', asignatura: 'Inglés', materia: 'lengua-extranjera' },
  { id: 'p6', etapa: 'primaria', curso: 6, grupo: '6º Primaria A', aula: 8, color: '#f97316', asignatura: 'Música y Danza', materia: 'musica-y-danza' },
];

/** Seis alumnos por clase: Alumno 1 a 6 en la primera, 7 a 12 en la segunda… */
const POR_CLASE = 6;
const alumnosDe = (i: number) => Array.from({ length: POR_CLASE }, (_, k) => i * POR_CLASE + k + 1);
const sid = (n: number) => `s${String(n).padStart(2, '0')}`;

/**
 * Cómo le va a cada alumno, de 0 a 10: de aquí salen sus notas, sus
 * evaluaciones y sus anotaciones, para que todo cuente la misma historia.
 * Los de la ESO van a mano; los de Primaria, repartidos entre 4,4 y 9,3.
 */
const NIVEL_ESO = [
  4.6, 7.9, 8.4, 5.0, 6.4, 9.2,
  5.8, 7.1, 6.6, 4.2, 8.8, 7.4,
  6.9, 5.3, 8.1, 7.7, 4.8, 9.0,
  6.2, 8.5, 5.6, 7.0, 9.4, 4.9,
];
const nivel = (n: number) => NIVEL_ESO[n - 1] ?? Math.round((4.4 + ((n * 37) % 50) / 10) * 10) / 10;

function demoClasses(tr: Tr): Class[] {
  return CLASES.map(c => {
    const asignatura = tr(c.asignatura);
    return {
      id: c.id, name: c.grupo, room: tr('Aula {n}', { n: c.aula }), color: c.color,
      subject: asignatura, subjects: [asignatura],
      etapa: c.etapa, curso: c.curso,
      ...(c.etapa === 'eso' && c.curso === 4 ? { opcionMatematicas: 'B' as const } : {}),
      materiasOficiales: { [asignatura]: c.materia },
    };
  });
}

function demoStudents(tr: Tr, alumno: (n: number) => string): Student[] {
  const avisos: Record<number, Pick<Student, 'alerts' | 'notes'>> = {
    1: { alerts: [{ id: 'al1', text: tr('Dificultades con fracciones'), level: 'warn' }], notes: tr('Necesita refuerzo en operaciones con fracciones.') },
    3: { alerts: [], notes: tr('Muy participativo.') },
    4: { alerts: [{ id: 'al2', text: tr('Faltas reiteradas'), level: 'danger' }], notes: '' },
    10: { alerts: [{ id: 'al3', text: tr('3 faltas sin justificar'), level: 'danger' }], notes: tr('Tutoría con familia pendiente.') },
    14: { alerts: [{ id: 'al4', text: tr('Mejora notable en el último examen'), level: 'info' }], notes: '' },
  };
  return CLASES.flatMap((c, i) => alumnosDe(i).map(n => ({
    id: sid(n), class_id: c.id, name: alumno(n), email: `alumno${n}@ies.es`, photo: null,
    alerts: avisos[n]?.alerts ?? [], notes: avisos[n]?.notes ?? '',
  })));
}

function demoBlocks(tr: Tr): ScheduleBlock[] {
  const de = (id: string) => {
    const c = CLASES.find(x => x.id === id)!;
    return { subject: `${c.grupo} - ${tr(c.asignatura)}`, room: tr('Aula {n}', { n: c.aula }), class_id: c.id, color: c.color };
  };
  // Por la mañana la ESO; por la tarde, Primaria. Sin pisarse.
  const horario: [number, string, string, string][] = [
    [1, '08:30', '09:25', 'c1'], [1, '09:30', '10:25', 'c3'], [1, '11:00', '11:55', 'c4'],
    [2, '08:30', '09:25', 'c2'], [2, '11:00', '11:55', 'c1'], [2, '12:00', '12:55', 'c4'],
    [3, '09:30', '10:25', 'c3'], [3, '11:00', '11:55', 'c2'], [3, '12:00', '12:55', 'c1'],
    [4, '08:30', '09:25', 'c4'], [4, '09:30', '10:25', 'c2'], [4, '11:00', '11:55', 'c3'],
    [5, '08:30', '09:25', 'c1'], [5, '09:30', '10:25', 'c3'],
    [1, '15:00', '15:55', 'p1'], [2, '15:00', '15:55', 'p2'], [3, '15:00', '15:55', 'p3'],
    [4, '15:00', '15:55', 'p4'], [5, '15:00', '15:55', 'p5'], [1, '16:00', '16:55', 'p6'],
  ];
  return horario.map(([day, time_start, time_end, id], k) => ({ id: `b${k + 1}`, day, time_start, time_end, ...de(id) }));
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

/**
 * Criterios de evaluación oficiales (Comunitat Valenciana): `materia|código`
 * de cada uno. Los códigos elegidos existen en todos los grupos de cursos del
 * decreto, así que un mismo instrumento vale para todas las clases de esa
 * materia. Un criterio de rúbrica puede apuntar a varias materias: cada clase
 * solo lee la suya.
 */
const criterios = (...claves: string[]): OfficialCriterionRef[] =>
  claves.map(k => { const [materia, codigo] = k.split('|'); return { materia, codigo }; });

function demoRubrics(tr: Tr): Rubric[] {
  return [
    {
      id: 'r1',
      name: tr('Exposición oral'),
      context: tr('Presentación de un trabajo de investigación'),
      criteria: [
        { id: 'cr1', name: tr('Claridad expositiva'), competencies: ['CCL', 'CP'], officialCriteria: criterios('matematicas|6.3', 'lengua-castellana|4.1', 'valenciano|4.1', 'lengua-extranjera|4.1', 'conocimiento-del-medio|2.4', 'musica-y-danza|1.2'),
          descriptors: { 1: tr('No se entiende el mensaje'), 2: tr('Se entiende con esfuerzo'), 3: tr('Discurso claro en general'), 4: tr('Discurso claro, ordenado y fluido') } },
        { id: 'cr2', name: tr('Dominio del contenido'), competencies: ['STEM'], officialCriteria: criterios('matematicas|5.3', 'lengua-castellana|4.2', 'valenciano|4.2', 'lengua-extranjera|4.2', 'conocimiento-del-medio|3.3', 'musica-y-danza|2.1'),
          descriptors: { 1: tr('No domina el tema'), 2: tr('Conocimiento superficial'), 3: tr('Buen conocimiento'), 4: tr('Dominio completo, responde preguntas') } },
        { id: 'cr3', name: tr('Material de apoyo'), competencies: ['CD', 'CCEC'], officialCriteria: criterios('matematicas|5.1', 'lengua-castellana|4.3', 'valenciano|4.3', 'conocimiento-del-medio|1.3', 'musica-y-danza|3.2'),
          descriptors: { 1: tr('Sin material o inadecuado'), 2: tr('Material poco cuidado'), 3: tr('Material correcto'), 4: tr('Material excelente y original') } },
      ],
    },
    {
      id: 'r2',
      name: tr('Resolución de problemas'),
      context: tr('Problemas de la unidad, resueltos en clase'),
      criteria: [
        { id: 'cr4', name: tr('Comprende el enunciado'), competencies: ['STEM', 'CCL'], officialCriteria: criterios('matematicas|1.1'),
          descriptors: { 1: tr('No identifica los datos'), 2: tr('Identifica algunos datos'), 3: tr('Identifica los datos y la pregunta'), 4: tr('Lo explica con sus palabras') } },
        { id: 'cr5', name: tr('Estrategia'), competencies: ['STEM', 'CPSAA'], officialCriteria: criterios('matematicas|1.2'),
          descriptors: { 1: tr('Sin estrategia'), 2: tr('Estrategia incompleta'), 3: tr('Estrategia adecuada'), 4: tr('Estrategia clara y eficaz') } },
        { id: 'cr6', name: tr('Resultado y comprobación'), competencies: ['STEM', 'CE'], officialCriteria: criterios('matematicas|1.3'),
          descriptors: { 1: tr('Resultado incorrecto'), 2: tr('Resultado sin comprobar'), 3: tr('Resultado correcto'), 4: tr('Correcto y comprobado') } },
      ],
    },
    // Para Primaria: solo competencias clave, sin criterios oficiales
    {
      id: 'r3',
      name: tr('Cuaderno de clase'),
      context: tr('Revisión del cuaderno al final de cada unidad'),
      criteria: [
        { id: 'cr7', name: tr('Orden y presentación'), competencies: ['CPSAA', 'CCL'], descriptors: frecuencia(tr) },
        { id: 'cr8', name: tr('Tareas completas'), competencies: ['CPSAA', 'CE'], descriptors: frecuencia(tr) },
        { id: 'cr9', name: tr('Corrige sus errores'), competencies: ['CPSAA', 'CCL'], descriptors: frecuencia(tr) },
      ],
    },
  ];
}

const frecuencia = (tr: Tr) => ({ 1: tr('Casi nunca'), 2: tr('A veces'), 3: tr('Casi siempre'), 4: tr('Siempre') });

/** Una diana de ejemplo: el trabajo en equipo, con competencias clave y criterios oficiales. */
function demoDianas(tr: Tr): EvalDiana[] {
  return [{
    id: 'd1',
    name: tr('Trabajo en equipo'),
    context: tr('Proyecto de estadística por grupos'),
    items: [
      { id: 'di1', name: tr('Escucha y respeta'), weight: 1, competencies: ['CPSAA', 'CC'], officialCriteria: criterios('matematicas|8.2', 'lengua-extranjera|6.1', 'musica-y-danza|3.3') },
      { id: 'di2', name: tr('Aporta ideas'), weight: 1, competencies: ['CE', 'STEM'], officialCriteria: criterios('matematicas|6.2', 'lengua-extranjera|6.2', 'musica-y-danza|4.1') },
      { id: 'di3', name: tr('Cumple su papel'), weight: 2, competencies: ['CPSAA'], officialCriteria: criterios('matematicas|8.2', 'musica-y-danza|3.3') },
      { id: 'di4', name: tr('Aprende de los errores'), weight: 1, competencies: ['CPSAA', 'STEM'], officialCriteria: criterios('matematicas|8.3') },
    ],
  }];
}

/** Nota sobre 10 de cada criterio oficial, como la guarda la app al evaluar (`officialCriteriaScoresFor`). */
function notasDeCriterios(items: { id: string; officialCriteria?: OfficialCriterionRef[] }[], scores: Record<string, number>, max: number) {
  const notas: Record<string, number[]> = {};
  for (const it of items) {
    for (const ref of it.officialCriteria ?? []) (notas[`${ref.materia}|${ref.codigo}`] ??= []).push((scores[it.id] / max) * 10);
  }
  return Object.fromEntries(Object.entries(notas).map(([k, v]) => [k, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10]));
}

/** El nivel de logro (1 a 4) de un alumno en un criterio: su nivel, con un poco de variación. */
function logro(n: number, k: number): number {
  const ajuste = [0, 0.6, -0.5, 0.3][(n + k) % 4];
  return Math.min(4, Math.max(1, Math.round(nivel(n) / 2.6 + ajuste)));
}

/**
 * Evaluaciones en todas las clases: la exposición oral en todas, la
 * resolución de problemas en las de Matemáticas, el cuaderno de clase en
 * Primaria y la diana del trabajo en equipo en 3º y 4º de ESO y en 5º y 6º
 * de Primaria. Con sus competencias clave y criterios oficiales calculados,
 * como al evaluar de verdad. Los instrumentos no declaran clase ni
 * categoría: no tocan el cuaderno, pero sí la Diana competencial y la
 * pestaña «Por competencias».
 */
function demoEvaluations(alumno: (n: number) => string, rubrics: Rubric[], dianas: EvalDiana[]): Evaluation[] {
  const out: Evaluation[] = [];
  const evaluar = (inst: Rubric | EvalDiana, items: { id: string; weight?: number; competencies?: string[]; officialCriteria?: OfficialCriterionRef[] }[], instrument: 'rubric' | 'diana', classId: string, n: number, desfase: number) => {
    const scores = Object.fromEntries(items.map((it, k) => [it.id, logro(n, k + desfase)]));
    const levels = levelsOf(inst);
    const max = Math.max(...levels.map(l => l.value));
    const weights = Object.fromEntries(items.map(it => [it.id, it.weight ?? 1]));
    out.push({
      id: `dev${out.length + 1}`, rubric_id: inst.id, rubric_name: inst.name, instrument,
      student_id: sid(n), student_name: alumno(n), class_id: classId,
      date: daysFromNow(-2 - (out.length % 12)), scores, notes: '', max_level: max,
      grade: gradeFromLevels(scores, items.map(it => it.id), levels, instrument === 'diana' ? weights : undefined) ?? undefined,
      competencyScores: competencyScoresFor(items, scores),
      officialCriteriaScores: notasDeCriterios(items, scores, max),
    });
  };
  CLASES.forEach((c, i) => {
    const usa = (r: Rubric) => r.id === 'r1'
      || (r.id === 'r2' && c.materia === 'matematicas')
      || (r.id === 'r3' && c.etapa === 'primaria');
    // El desfase hace que cada instrumento y cada clase salgan algo distintos
    rubrics.forEach((r, ri) => { if (usa(r)) for (const n of alumnosDe(i)) evaluar(r, r.criteria, 'rubric', c.id, n, ri * 2 + i); });
    if (c.curso >= (c.etapa === 'eso' ? 3 : 5)) for (const d of dianas) for (const n of alumnosDe(i)) evaluar(d, d.items, 'diana', c.id, n, 1);
  });
  return out;
}

/**
 * La Diana competencial de cada alumno, ya rellena con lo que sale de sus
 * evaluaciones, como al pulsar «Rellenar desde evaluaciones»: la media de
 * las competencias clave de cada sector (1 a 4).
 */
function demoDianaProfiles(tr: Tr, evaluations: Evaluation[]): Record<string, DianaProfile> {
  const out: Record<string, DianaProfile> = {};
  for (const n of new Set(evaluations.map(e => e.student_id))) {
    const suyas = evaluations.filter(e => e.student_id === n);
    const valores: Record<string, number[]> = {};
    const fuentes: Record<string, Set<string>> = {};
    for (const e of suyas) {
      for (const [code, v] of Object.entries(e.competencyScores ?? {})) {
        for (const sector of LOMLOE_TO_DIANA[code] ?? []) {
          (valores[sector] ??= []).push(v);
          (fuentes[sector] ??= new Set()).add(e.rubric_name);
        }
      }
    }
    const sectores = Object.keys(valores);
    out[n] = {
      scores: Object.fromEntries(sectores.map(k => [k, Math.max(1, Math.min(4, Math.round(valores[k].reduce((a, b) => a + b, 0) / valores[k].length)))])),
      descriptors: Object.fromEntries(sectores.map(k => [k, tr('Calculado a partir de: {resumen}', { resumen: [...fuentes[k]].join(', ') })])),
      updated: daysFromNow(-1),
    };
  }
  return out;
}

/*
 * El cuaderno de cada clase (decisión del dueño, 11-10-2026): 40% pruebas,
 * 40% tareas y 20% trabajo diario y actitud. El trabajo diario es el bloque
 * que sale de las anotaciones del aula y se da en puntos: con 2 puntos sobre
 * 10, Pruebas y Tareas se reparten el resto a partes iguales (50% y 50% de
 * los otros 8), y la nota final queda en 40, 40 y 20.
 */
function demoCategories(tr: Tr): GradeCategory[] {
  return CLASES.flatMap(c => [
    { id: `${c.id}-pruebas`, class_id: c.id, name: tr('Pruebas'), weight: 50 },
    { id: `${c.id}-tareas`, class_id: c.id, name: tr('Tareas'), weight: 50 },
  ]);
}

/** El bloque «Trabajo diario y actitud» de cada clase: 2 puntos, el 20% de la nota. */
function demoMarksConfigs(tr: Tr): Record<string, MarksBlockConfig> {
  return Object.fromEntries(CLASES.map(c => [`${c.id}|${tr(c.asignatura)}`, {
    enabled: true, points: 2,
    weights: { homework: 33.33, behavior: 33.33, participation: 33.34 },
    bases: { homework: 10, behavior: 10, participation: 5 },
    step: 0.5,
  }]));
}

const COLUMNAS: { sufijo: string; cat: 'pruebas' | 'tareas'; nombre: string; dias: number; ajuste: number[] }[] = [
  { sufijo: 'p1', cat: 'pruebas', nombre: 'Prueba 1', dias: -24, ajuste: [-0.4, 0.2, -0.8, 0.5] },
  { sufijo: 'p2', cat: 'pruebas', nombre: 'Prueba 2', dias: -6, ajuste: [0.3, -0.5, 0.4, -0.2] },
  { sufijo: 't1', cat: 'tareas', nombre: 'Libreta', dias: -14, ajuste: [0.8, 0.5, 1.0, 0.3] },
  { sufijo: 't2', cat: 'tareas', nombre: 'Ficha de problemas', dias: -3, ajuste: [0.5, 1.1, 0.2, 0.7] },
];

function buildDemoGradeItems(tr: Tr): GradeItem[] {
  return CLASES.flatMap(c => COLUMNAS.map(col => ({
    id: `${c.id}-${col.sufijo}`, class_id: c.id, category_id: `${c.id}-${col.cat}`, name: tr(col.nombre), date: daysFromNow(col.dias),
  })));
}

function buildDemoGrades(): GradeMap {
  const notas: GradeMap = {};
  CLASES.forEach((c, i) => {
    for (const col of COLUMNAS) {
      notas[`${c.id}-${col.sufijo}`] = Object.fromEntries(alumnosDe(i).map(n => {
        const v = nivel(n) + col.ajuste[n % 4];
        return [sid(n), Math.round(Math.min(10, Math.max(0, v)) * 10) / 10];
      }));
    }
  });
  return notas;
}

/**
 * Unas anotaciones del aula en cada clase: de ellas sale el bloque «Trabajo
 * diario y actitud» del cuaderno. Quien va peor olvida más la tarea; quien
 * va mejor participa más.
 */
function buildDemoMarks(): ClassMark[] {
  const out: ClassMark[] = [];
  const m = (class_id: string, n: number, type: ClassMark['type'], days: number) =>
    out.push({ id: `mk${out.length + 1}`, class_id, student_id: sid(n), type, date: daysFromNow(days) });
  CLASES.forEach((c, i) => {
    for (const n of alumnosDe(i)) {
      if (nivel(n) < 5.5) { m(c.id, n, 'homework', -6); m(c.id, n, 'homework', -2); }
      if (nivel(n) < 5) m(c.id, n, 'behavior-bad', -1);
      if (nivel(n) > 8) { m(c.id, n, 'participation', -4); m(c.id, n, 'participation', -1); }
      if (nivel(n) > 7 && nivel(n) <= 8) m(c.id, n, 'behavior-good', -3);
    }
  });
  return out;
}

export interface DemoData {
  tasks: Task[];
  classes: Class[];
  students: Student[];
  scheduleBlocks: ScheduleBlock[];
  calEvents: CalEvent[];
  rubrics: Rubric[];
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  dianaProfiles: Record<string, DianaProfile>;
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  classMarks: ClassMark[];
  marksConfigs: Record<string, MarksBlockConfig>;
}

/** Los datos de ejemplo del docente de aula, en el idioma de la aplicación. */
export function buildDemoData(lang: Lang = 'es'): DemoData {
  const tr: Tr = (s, vars) => translate(lang, s, vars);
  const alumno = (n: number) => nombreDeAlumnoDeEjemplo(n, lang);
  const rubrics = demoRubrics(tr);
  const dianas = demoDianas(tr);
  const evaluations = demoEvaluations(alumno, rubrics, dianas);
  return {
    tasks: demoTasks(tr, alumno),
    classes: demoClasses(tr),
    students: demoStudents(tr, alumno),
    scheduleBlocks: demoBlocks(tr),
    calEvents: buildDemoEvents(tr),
    rubrics,
    dianas,
    evaluations,
    dianaProfiles: demoDianaProfiles(tr, evaluations),
    gradeCategories: demoCategories(tr),
    gradeItems: buildDemoGradeItems(tr),
    grades: buildDemoGrades(),
    classMarks: buildDemoMarks(),
    marksConfigs: demoMarksConfigs(tr),
  };
}

export const PALETTE = ['#0284c7','#10b981','#f59e0b','#ef4444','#8b5cf6','#3b82f6'];
