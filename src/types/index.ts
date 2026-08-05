export interface User {
  id: string;
  email: string;
  full_name: string;
  school: string;
  subject: string;
  initials?: string;
}

export interface Class {
  id: string;
  name: string;
  /**
   * Asignatura principal. Se mantiene siempre igual a `subjects[0]` para que
   * todo lo escrito antes de que existieran varias asignaturas siga leyendo
   * algo con sentido.
   */
  subject: string;
  /**
   * Todas las asignaturas que este docente da a este grupo. En primaria lo
   * normal es que sean varias: un mismo 5ºA con Mates, Lengua, Sociales…
   * Nunca está vacío: `normalizeClass()` garantiza al menos una.
   */
  subjects: string[];
  /** Es el grupo del que este docente es tutor. */
  isTutoria?: boolean;
  room: string;
  color: string;
}

/**
 * Completa una clase que venga del formato antiguo (una sola asignatura) o de
 * una copia de seguridad vieja. Se aplica al cargar, así que el resto del
 * código puede dar por hecho que `subjects` existe y tiene al menos un valor.
 */
export function normalizeClass(c: Class): Class {
  const list = Array.isArray(c.subjects) && c.subjects.length > 0
    ? c.subjects.filter(s => typeof s === 'string' && s.trim() !== '')
    : [];
  const subjects = list.length > 0 ? list : [c.subject || 'Sin asignatura'];
  return { ...c, subjects, subject: subjects[0] };
}

export interface Alert {
  id: string;
  text: string;
  level: 'info' | 'warn' | 'danger';
}

export interface Student {
  id: string;
  class_id: string;
  name: string;
  email: string;
  photo: string | null;
  alerts: Alert[];
  notes: string;
}

export interface ScheduleBlock {
  id: string;
  day: number;
  time_start: string;
  time_end: string;
  subject: string;
  room: string;
  class_id: string;
  color: string;
}

export interface CalEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  type: 'deadline' | 'meeting' | 'event';
  urgency: 'alta' | 'media' | 'baja';
  color: string;
  desc: string;
}

export interface Task {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
}

/* ── Cuaderno de calificaciones ── */
export interface GradeCategory {
  id: string;
  class_id: string;
  name: string;
  weight: number; // porcentaje 0-100
  /**
   * Asignatura a la que pertenece dentro de la clase. Ausente en las
   * categorías creadas antes de que una clase pudiera tener varias: se
   * entienden como de la asignatura principal.
   *
   * Los pesos suman 100% *por asignatura*, no por clase.
   */
  subject?: string;
}

export interface GradeItem {
  id: string;
  class_id: string;
  category_id: string;
  name: string;
  date: string;
}

/** notas[itemId][studentId] = nota 0-10 (null = sin calificar) */
export type GradeMap = Record<string, Record<string, number | null>>;

export interface RubricDescriptors {
  1: string;
  2: string;
  3: string;
  4: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  descriptors: Partial<RubricDescriptors>;
}

export interface Rubric {
  id: string;
  name: string;
  context?: string;
  criteria: RubricCriterion[];
}

export interface Evaluation {
  id: string;
  rubric_id: string;
  rubric_name: string;
  student_id: string;
  student_name: string;
  class_id: string;
  date: string;
  scores: Record<string, number>;
  notes: string;
  /** Instrumento usado. Ausente = rúbrica (evaluaciones anteriores). */
  instrument?: 'rubric' | 'diana';
  /** Nota sobre 10 calculada a partir de los niveles de logro. */
  grade?: number;
}

/* ── Diana de evaluación (instrumento con niveles de logro) ── */
export interface DianaItem {
  id: string;
  name: string;
  /** Peso relativo del ítem en la nota final. 1 = peso normal. */
  weight: number;
  descriptors?: Partial<RubricDescriptors>;
}

export interface EvalDiana {
  id: string;
  name: string;
  context?: string;
  items: DianaItem[];
}

export interface DianaScore {
  ds1: number; ds2: number; ds3: number;
  ds4: number; ds5: number; ds6: number;
}

export interface DianaDescriptors {
  [key: string]: string;
}

/** Diana competencial guardada de un alumno. */
export interface DianaProfile {
  scores: Record<string, number>;
  descriptors: Record<string, string>;
  updated: string;
}

/* ── Asistencia ── */
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified';

/** asistencia[claseId][fecha ISO][alumnoId] = estado */
export type AttendanceMap = Record<string, Record<string, Record<string, AttendanceStatus>>>;

/* ── Informes competenciales ── */
export interface CompetencyReport {
  id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  /** Periodo evaluado, por ejemplo «1ª evaluación». */
  period: string;
  date: string;
  text: string;
}

export type Section =
  | 'dashboard' | 'classes' | 'agenda'
  | 'rubrics' | 'diana' | 'history' | 'notebook' | 'profile'
  | 'sec-classroom' | 'share' | 'classroom-live'
  | 'attendance' | 'reports' | 'audit' | 'records';
