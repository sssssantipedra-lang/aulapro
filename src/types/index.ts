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
  /**
   * Docente al que pertenece la lista de alumnos (id de su perfil).
   *
   * Al sincronizar con un compañero, su versión de la clase y de los alumnos
   * gana siempre, en cualquier modo de fusión. Sin esto, el último en
   * conectarse machacaba el trabajo del otro. Ausente en las clases creadas
   * antes de que existiera la sincronización por dueño.
   */
  owner?: string;
  /** Nombre del dueño, solo para poder decirlo en la interfaz. */
  owner_name?: string;
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
  /** Docente dueño de la ficha. Ver `Class.owner`. */
  owner?: string;
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

/**
 * Un nivel de logro. `value` empieza en 1 y va subiendo; el más alto es el
 * mejor, y es el que sirve de tope para calcular la nota.
 */
export interface AchievementLevel {
  value: number;
  label: string;
}

/** Los cuatro de siempre. Se usan cuando el instrumento no define los suyos. */
export const DEFAULT_LEVELS: AchievementLevel[] = [
  { value: 1, label: 'Insuficiente' },
  { value: 2, label: 'Suficiente' },
  { value: 3, label: 'Bien' },
  { value: 4, label: 'Excelente' },
];

const DEFAULT_LEVELS_EN: AchievementLevel[] = [
  { value: 1, label: 'Below expectations' },
  { value: 2, label: 'Approaching expectations' },
  { value: 3, label: 'Meeting expectations' },
  { value: 4, label: 'Exceeding expectations' },
];

/**
 * Niveles de partida para un instrumento nuevo, en el idioma en que se está
 * trabajando. Las etiquetas son datos del instrumento, no interfaz: se guardan
 * tal cual se crean y luego el docente puede reescribirlas, así que se eligen
 * aquí una sola vez en vez de traducirse al pintarlas.
 */
export function defaultLevels(lang: 'es' | 'en'): AchievementLevel[] {
  return lang === 'en' ? DEFAULT_LEVELS_EN : DEFAULT_LEVELS;
}

/**
 * Niveles de un instrumento. Los creados antes de que se pudieran configurar
 * no llevan ninguno, así que se entienden como los cuatro clásicos.
 */
export function levelsOf(inst: { levels?: AchievementLevel[] } | null | undefined): AchievementLevel[] {
  return inst?.levels?.length ? inst.levels : DEFAULT_LEVELS;
}

/**
 * Color de un nivel.
 *
 * Con cuatro niveles devuelve exactamente los colores de siempre, que es lo
 * que los docentes ya reconocen. Con otro número recorre el mismo camino
 * rojo → verde repartiendo el tono, para que «más a la derecha» siga
 * significando «mejor» sea cual sea el número de niveles.
 */
export function levelColor(value: number, total: number): string {
  const CLASSIC = ['#dc2626', '#d97706', '#2563eb', '#16a34a'];
  if (total === 4) return CLASSIC[Math.min(3, Math.max(0, value - 1))];
  if (total <= 1) return CLASSIC[3];
  const t = (Math.min(total, Math.max(1, value)) - 1) / (total - 1);
  const hue = Math.round(0 + t * 140);          // 0 rojo → 140 verde
  const sat = 70 - Math.round(t * 12);
  const light = 42 + Math.round(t * 4);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/**
 * Nota sobre 10 a partir de los niveles marcados.
 *
 * El tope lo pone el nivel más alto del instrumento, no un 4 fijo: con seis
 * niveles, un 6 es la nota máxima. `weights` es opcional (las rúbricas no
 * ponderan sus criterios; las dianas sí).
 */
export function gradeFromLevels(
  scores: Record<string, number>,
  ids: string[],
  levels: AchievementLevel[],
  weights?: Record<string, number>,
): number | null {
  const max = Math.max(...levels.map(l => l.value));
  if (!Number.isFinite(max) || max <= 0) return null;

  let sum = 0, weight = 0;
  for (const id of ids) {
    const v = scores[id];
    if (typeof v !== 'number' || v <= 0) continue;
    const w = weights?.[id] && weights[id] > 0 ? weights[id] : 1;
    sum += (v / max) * w;
    weight += w;
  }
  if (weight === 0) return null;
  return Math.round((sum / weight) * 10 * 10) / 10;
}

/**
 * Nota por competencia, a partir de los criterios de una rúbrica o los ítems
 * de una diana: a efectos de esta cuenta son lo mismo, algo con un id, una
 * nota puesta y (a veces) una lista de competencias.
 *
 * Un criterio o ítem puede evaluar varias competencias a la vez (o ninguna,
 * si el instrumento es de los de siempre y no las trae). La nota de cada
 * competencia es la media de los que la mencionan, en la escala 1-4 de
 * siempre: lo único que hoy trae `competencies` es lo generado por IA —una
 * Situación de Aprendizaje, o el generador propio de Rúbricas y Dianas— y
 * eso usa siempre los cuatro niveles clásicos.
 *
 * Devuelve `undefined` —no un objeto vacío— cuando nada tiene competencias,
 * para no ensuciar con un campo inútil las evaluaciones de siempre.
 */
export function competencyScoresFor(
  items: { id: string; competencies?: string[] }[],
  scores: Record<string, number>,
): Record<string, number> | undefined {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const it of items) {
    const v = scores[it.id];
    if (typeof v !== 'number' || v <= 0 || !it.competencies?.length) continue;
    for (const code of it.competencies) {
      sums[code] = (sums[code] ?? 0) + v;
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }

  const codes = Object.keys(counts);
  if (codes.length === 0) return undefined;

  const out: Record<string, number> = {};
  for (const code of codes) out[code] = Math.round((sums[code] / counts[code]) * 10) / 10;
  return out;
}

export interface RubricCriterion {
  id: string;
  name: string;
  /**
   * Descripción de cada nivel, indexada por su `value`. Es un mapa abierto y
   * no una forma fija de cuatro claves, porque el docente puede definir
   * cuantos niveles quiera.
   */
  descriptors: Record<number, string>;
  /**
   * Competencias clave LOMLOE que evalúa este criterio (códigos de
   * `LOMLOE_COMPETENCES`: CCL, CP, STEM…). Ausente o vacío en la mayoría de
   * rúbricas, hechas a mano: solo las que genera una Situación de Aprendizaje
   * las trae, porque ahí es donde el docente ya las eligió al diseñarla.
   */
  competencies?: string[];
}

/**
 * A dónde va la nota que sale de evaluar con una rúbrica o una diana.
 *
 * Los instrumentos siguen siendo globales —se ven todos juntos— pero cada uno
 * declara a qué clase y asignatura pertenece y en qué categoría del cuaderno
 * cae su nota. Sin estos datos el instrumento funciona como siempre: la
 * evaluación se guarda en el Historial y no toca el cuaderno.
 */
export interface GradeTarget {
  class_id?: string;
  subject?: string;
  /** Categoría del cuaderno (Exámenes, Trabajos…) donde vive su columna. */
  category_id?: string;
}

/**
 * Columna del cuaderno que corresponde a un instrumento.
 *
 * Se deriva del id en vez de guardarse aparte: así no hay dos fuentes de
 * verdad y evaluar a varios alumnos seguidos no puede crear dos columnas
 * para la misma rúbrica. Al ser fija, volver a evaluar a un alumno
 * sobrescribe su nota anterior.
 */
export function gradeItemIdFor(instrumentId: string): string {
  return 'gi-' + instrumentId;
}

export interface Rubric extends GradeTarget {
  id: string;
  name: string;
  context?: string;
  criteria: RubricCriterion[];
  /** Niveles de logro propios. Ausente = los cuatro clásicos. */
  levels?: AchievementLevel[];
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
  /**
   * Nivel más alto de la escala con la que se evaluó.
   *
   * Se guarda aquí y no se deduce del instrumento porque su escala puede
   * cambiar después: sin esto, añadir un nivel a una rúbrica alteraría cómo
   * se leen las evaluaciones ya hechas. Ausente = los cuatro de siempre.
   */
  max_level?: number;
  /**
   * Nota por competencia clave LOMLOE, calculada con `competencyScoresFor` en
   * el momento de guardar. Solo la traen las evaluaciones con una rúbrica que
   * etiqueta sus criterios con competencias (las que vienen de una Situación
   * de Aprendizaje). Se congela aquí, como `rubric_name`: si la rúbrica
   * cambia después, esta evaluación sigue contando lo que contó entonces.
   */
  competencyScores?: Record<string, number>;
}

/* ── Diana de evaluación (instrumento con niveles de logro) ── */
export interface DianaItem {
  id: string;
  name: string;
  /** Peso relativo del ítem en la nota final. 1 = peso normal. */
  weight: number;
  /** Descripción de cada nivel, indexada por su `value`. Ver `RubricCriterion`. */
  descriptors?: Record<number, string>;
  /** Competencias LOMLOE que evalúa. Ver `RubricCriterion.competencies`. */
  competencies?: string[];
}

export interface EvalDiana extends GradeTarget {
  id: string;
  name: string;
  context?: string;
  items: DianaItem[];
  /** Niveles de logro propios. Ausente = los cuatro clásicos. */
  levels?: AchievementLevel[];
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

/* ── Autoevaluaciones de la Sala de alumnos ── */

/**
 * Lo que respondieron los alumnos desde su móvil en una sesión.
 *
 * Se guarda siempre, en cuanto hay respuestas: antes vivía solo en la memoria
 * del servidor de la sala y se perdía al cerrarla. Que pase o no al Historial
 * es una decisión posterior del docente, porque una autoevaluación no es una
 * calificación suya y puede querer descartarla.
 */
export interface SelfAssessmentSession {
  id: string;
  /** Instante en que se guardó. Para el día usar `date`. */
  at: string;
  date: string;
  class_id: string;
  class_name: string;
  /** Rúbrica o diana de la que salió, si aún existe. */
  source_id?: string;
  title: string;
  /** Ítems evaluados, con el nombre congelado por si luego se editan. */
  items: { id: string; name: string }[];
  rows: {
    student_id: string | null;
    student_name: string;
    scores: Record<string, number>;
    grade: number | null;
  }[];
  /** Ya volcada al Historial. Se conserva para no duplicarla. */
  included?: boolean;
}

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

/* ── Situaciones de aprendizaje ── */

/**
 * Una situación de aprendizaje guardada.
 *
 * `content` llega tal cual de la IA (ver `services/learningSituations.ts`) y el
 * docente puede editarlo a mano después: lo que se guarda es siempre lo que él
 * dio por bueno, no lo que propuso la máquina.
 */
export interface LearningSituation {
  id: string;
  /** Instante en que se guardó por última vez. */
  at: string;
  date: string;
  /** Clase para la que se diseñó, si se eligió una. */
  class_id?: string;
  class_name?: string;
  title: string;
  /** Lo que pidió el docente, para poder volver a generarla o ajustarla. */
  request: {
    idea: string;
    numero: string;
    temporalizacion: string;
    meses: string;
    areas: string[];
    numSesiones: number;
    nivel: string;
    /**
     * Etapa, curso y —si hacía falta— la opción de Matemáticas con los que se
     * generó, para poder reabrirla con el mismo currículo real que se usó
     * entonces (ver `lib/curriculum`). Ausentes en las SdA guardadas antes de
     * que existiera esto: siguen abriendo en modo libre, como siempre.
     */
    etapa?: import('../lib/curriculum').Etapa;
    curso?: number;
    opcionMatematicas?: 'A' | 'B';
    contextoClase: string;
    metodologia: string;
  };
  content: import('../services/learningSituations').SdaContent;
}

/**
 * Una ficha de trabajo guardada — el primer tipo de recurso del motor de
 * materiales pedagógicos. `sda_id`/`sda_title` solo están cuando la ficha se
 * generó anclada a una Situación de Aprendizaje (ver `generateFichaFromSda`
 * en `services/resources.ts`); las sueltas los dejan sin definir.
 */
export interface Ficha {
  id: string;
  at: string;
  date: string;
  class_id?: string;
  class_name?: string;
  sda_id?: string;
  sda_title?: string;
  title: string;
  request: {
    tema: string;
    area: string;
    nivel: string;
    numEjercicios: number;
    /** Si se pidieron variantes de apoyo/ampliación por ejercicio. */
    niveles: boolean;
    contextoClase: string;
  };
  content: import('../services/resources').FichaContent;
}

/* ── Reuniones y formaciones ── */

/**
 * Los dos módulos comparten estructura porque el trabajo es el mismo: se toman
 * anotaciones sueltas durante el acto y luego la IA las convierte en un
 * documento presentable. Lo que cambia es el papel que juega cada campo
 * (`organizer` es el órgano convocante en una reunión y la entidad formadora
 * en un curso) y qué apartados tiene el documento final.
 */
export type WorkSessionKind = 'meeting' | 'training';

/** El documento redactado por la IA a partir de las anotaciones. */
export interface WorkSessionDoc {
  /** Instante en que se redactó. */
  at: string;
  titulo: string;
  /** Dos o tres frases con lo esencial. */
  resumen: string;
  /** Puntos del orden del día, o bloques de contenido de la formación. */
  apartados: { titulo: string; contenido: string }[];
  /** Reuniones: acuerdos adoptados. Formaciones: ideas clave. */
  acuerdos: string[];
  /** Lo que queda por hacer, con responsable y plazo si se dijeron. */
  tareas: { tarea: string; responsable: string; plazo: string }[];
  /** Solo formaciones: cómo llevarlo al aula. */
  aplicacionAula: string[];
  /** Cierre: próxima convocatoria, o valoración del curso. */
  cierre: string;
}

/**
 * Una reunión o una formación, con las anotaciones del docente y —si ya se ha
 * generado— su documento final.
 *
 * No van atadas a una clase: un claustro o un curso del CEFIRE no pertenecen a
 * ningún grupo concreto.
 */
export interface WorkSession {
  id: string;
  kind: WorkSessionKind;
  /** Instante del último guardado. Para el día, `date`. */
  at: string;
  /** Día del acto, AAAA-MM-DD. */
  date: string;
  timeStart?: string;
  timeEnd?: string;
  title: string;
  /** Reuniones: órgano o quien convoca. Formaciones: entidad y ponente. */
  organizer?: string;
  place?: string;
  /** Reuniones: quiénes asistieron, en texto libre. */
  attendees?: string;
  /** Formaciones: horas certificadas. */
  hours?: number;
  /** Las anotaciones en bruto: el material de partida del documento. */
  notes: string;
  /** Lo que redactó la IA, editable después a mano. */
  document?: WorkSessionDoc;
}

export type Section =
  | 'dashboard' | 'classes' | 'agenda'
  | 'rubrics' | 'diana' | 'history' | 'notebook' | 'profile'
  | 'sec-classroom' | 'share' | 'classroom-live'
  | 'attendance' | 'reports' | 'selfassess' | 'audit' | 'records'
  | 'learning-situations' | 'resources'
  | 'meetings' | 'trainings';
