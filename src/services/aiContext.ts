/**
 * Resumen del cuaderno del docente en texto plano, para dárselo a la IA.
 *
 * El asistente del Cuaderno respondía en genérico porque no veía nada: la
 * llamada a Gemini solo llevaba la pregunta. Así, ante «¿cómo va Marta?» o
 * «¿quién va peor en 2ºB?» no podía más que dar consejos de manual o
 * inventarse los datos. Esto arma una ficha compacta —clases, alumnos con su
 * media real, asistencia, evaluaciones recientes, agenda— que se envía junto
 * a cada pregunta.
 *
 * Dos reglas al tocarlo:
 *
 * 1. **Compacto por encima de completo.** Cabe un curso entero, pero no las
 *    notas celda a celda: se mandan medias y agregados. Si hiciera falta el
 *    detalle de una prueba concreta, es mejor añadir una línea resumida que
 *    volcar la matriz de notas.
 * 2. **Nunca inventar.** Lo que no hay se dice que no hay («sin notas»), para
 *    que el modelo pueda responder «no tienes datos de eso» en vez de
 *    rellenar el hueco por su cuenta.
 */

import type {
  Class, Student, GradeCategory, GradeItem, GradeMap, Evaluation,
  AttendanceMap, AttendanceStatus, CompetencyReport, CalEvent, ScheduleBlock,
  Task, LearningSituation, SeatingPlan,
} from '../types';
import { seatStudentId } from '../types';
import type { Lang } from '../i18n';

/**
 * Un mensaje de la conversación tal y como se pinta en pantalla. Vive solo en
 * memoria (como el documento de normativa): una consulta al asistente no es
 * trabajo del curso y no tiene por qué acabar en `datos.json`.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Instante del mensaje, en ISO. */
  at: string;
}

export interface TeacherData {
  profile: { name: string; school: string; subject: string; course: string } | null;
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  evaluations: Evaluation[];
  attendance: AttendanceMap;
  reports: CompetencyReport[];
  calEvents: CalEvent[];
  scheduleBlocks: ScheduleBlock[];
  tasks: Task[];
  learningSituations: LearningSituation[];
  /** Distribución de aula de cada clase, indexada por `class_id`. */
  seatingPlans: Record<string, SeatingPlan>;
}

/** Media ponderada de un alumno: media de cada categoría × su peso. */
export function weightedAverage(
  studentId: string,
  categories: GradeCategory[],
  items: GradeItem[],
  grades: GradeMap,
): number | null {
  let sum = 0;
  let weightUsed = 0;
  for (const cat of categories) {
    const catItems = items.filter(i => i.category_id === cat.id);
    const scores = catItems
      .map(i => grades[i.id]?.[studentId])
      .filter((v): v is number => typeof v === 'number');
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    sum += avg * cat.weight;
    weightUsed += cat.weight;
  }
  if (weightUsed === 0) return null;
  return sum / weightUsed;
}

/**
 * Porcentaje de asistencia de un alumno. Retraso y falta justificada cuentan
 * como asistencia, igual que en la pantalla de Asistencia: si ahí el docente
 * ve un 92%, la IA tiene que decir 92%.
 */
export function attendanceRate(
  classId: string,
  studentId: string,
  attendance: AttendanceMap,
): { pct: number; days: number; absences: number } | null {
  const days = attendance[classId];
  if (!days) return null;
  let counted = 0;
  let present = 0;
  let absences = 0;
  for (const date of Object.keys(days)) {
    const status: AttendanceStatus | undefined = days[date]?.[studentId];
    if (!status) continue;
    counted++;
    if (status === 'absent') absences++;
    else present++;
  }
  if (counted === 0) return null;
  return { pct: Math.round((present / counted) * 100), days: counted, absences };
}

/**
 * Una nota, escrita EXACTAMENTE igual que en pantalla.
 *
 * Se usa el mismo `toLocaleString` que el cuaderno y el panel de rendimiento a
 * propósito: con `toFixed` una media de 8,35 sale «8,3» aquí y «8,4» en la
 * tarjeta de Inicio, y el docente vería a la IA contradecir su propia
 * aplicación por una décima.
 */
const num = (n: number | null, locale: string) =>
  n === null
    ? 'sin notas'
    : n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Fecha de hoy en `AAAA-MM-DD`, en hora local (nunca `toISOString`). */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Cuántos alumnos como mucho se detallan por clase antes de resumir. */
const MAX_STUDENTS_PER_CLASS = 60;
/** Cuántas evaluaciones recientes se citan. */
const MAX_EVALUATIONS = 25;
/** Cuántos eventos próximos de la agenda se citan. */
const MAX_EVENTS = 12;

/**
 * Arma la ficha de datos. `classId` la limita a una clase; sin él se incluyen
 * todas, que es lo que permite preguntas del tipo «compara mis dos grupos».
 */
export function buildTeacherContext(
  d: TeacherData,
  options: { classId?: string; locale?: string } = {},
): string {
  const hoy = todayIso();
  // Las notas se escriben con el mismo formato que ve el docente en pantalla.
  const locale = options.locale ?? 'es-ES';
  const n = (v: number | null) => num(v, locale);
  const classes = options.classId
    ? d.classes.filter(c => c.id === options.classId)
    : d.classes;

  const L: string[] = [];

  L.push('=== DATOS REALES DEL CUADERNO DE ESTE DOCENTE ===');
  L.push(`Fecha de hoy: ${hoy}`);
  if (d.profile) {
    L.push(`Docente: ${d.profile.name || '(sin nombre)'} · Centro: ${d.profile.school || '(sin centro)'}` +
      ` · Asignatura principal: ${d.profile.subject || '(sin asignatura)'} · Curso escolar: ${d.profile.course || '(sin curso)'}`);
  }

  if (classes.length === 0) {
    L.push('');
    L.push('El docente todavía NO tiene ninguna clase creada en la aplicación.');
    return L.join('\n');
  }

  L.push('');
  L.push(`CLASES (${classes.length}${options.classId ? ' — el docente ha limitado la consulta a esta clase' : ''}):`);

  for (const cls of classes) {
    const alumnos = d.students.filter(s => s.class_id === cls.id);
    const cats = d.gradeCategories.filter(c => c.class_id === cls.id);
    const items = d.gradeItems.filter(i => i.class_id === cls.id);

    L.push('');
    L.push(`── ${cls.name} · ${cls.subjects.join(', ')}${cls.isTutoria ? ' · es su tutoría' : ''}` +
      `${cls.room ? ` · aula ${cls.room}` : ''} · ${alumnos.length} alumnos`);

    L.push(cats.length
      ? `   Categorías de nota: ${cats.map(c => `${c.name} ${c.weight}%`).join(', ')}`
      : '   Categorías de nota: ninguna definida todavía (no se puede calcular media ponderada).');

    if (items.length) {
      const porCat = cats.map(c => {
        const suyos = items.filter(i => i.category_id === c.id);
        return suyos.length ? `${c.name}: ${suyos.map(i => `«${i.name}» (${i.date})`).join(', ')}` : '';
      }).filter(Boolean);
      L.push(`   Pruebas registradas (${items.length}): ${porCat.join(' | ')}`);
    } else {
      L.push('   Pruebas registradas: ninguna.');
    }

    // Media del grupo, para poder decir quién está por encima o por debajo
    const medias = alumnos
      .map(s => weightedAverage(s.id, cats, items, d.grades))
      .filter((v): v is number => v !== null);
    L.push(medias.length
      ? `   Media del grupo: ${n(medias.reduce((a, b) => a + b, 0) / medias.length)} (sobre 10, con ${medias.length} alumnos calificados de ${alumnos.length})`
      : '   Media del grupo: no calculable, aún no hay notas.');

    const diasPasados = Object.keys(d.attendance[cls.id] ?? {}).length;
    if (diasPasados) L.push(`   Días de asistencia pasados: ${diasPasados}`);

    if (alumnos.length === 0) {
      L.push('   Sin alumnos en la lista.');
      continue;
    }

    L.push(`   ALUMNOS (nombre · media ponderada · asistencia · avisos):`);
    const mostrados = alumnos.slice(0, MAX_STUDENTS_PER_CLASS);
    for (const s of mostrados) {
      const media = weightedAverage(s.id, cats, items, d.grades);
      const asis = attendanceRate(cls.id, s.id, d.attendance);
      const avisos = s.alerts?.length ? ` · avisos: ${s.alerts.map(a => a.text).join('; ')}` : '';
      const notas = s.notes?.trim() ? ` · anotación del docente: ${s.notes.trim()}` : '';
      const asisTxt = asis
        ? `asistencia ${asis.pct}% (${asis.absences} faltas de ${asis.days} sesiones)`
        : 'sin datos de asistencia';
      L.push(`   · ${s.name} · media ${n(media)} · ${asisTxt}${avisos}${notas}`);
    }
    if (alumnos.length > mostrados.length) {
      L.push(`   · (…y ${alumnos.length - mostrados.length} alumnos más no listados aquí por espacio)`);
    }

    /* ── Distribución de aula: quién está en cada mesa, con su rol de esta semana ── */
    const plan = d.seatingPlans[cls.id];
    const mesasConGente = plan?.groups.filter(g => g.studentIds.length > 0) ?? [];
    if (mesasConGente.length) {
      L.push(`   GRUPOS COOPERATIVOS (roles rotados ${plan!.weekOffset} vez/veces desde que se formaron):`);
      for (const g of mesasConGente) {
        const asientos = Array.from({ length: plan!.groupSize }, (_, i) => {
          const sid = seatStudentId(g, i);
          if (!sid) return null; // asiento libre: no aporta nada que decir
          const alumno = alumnos.find(a => a.id === sid);
          const rol = plan!.roles[(i + plan!.weekOffset) % plan!.groupSize];
          return `${alumno?.name ?? '(alumno ya no está en la clase)'} — ${rol?.name ?? 'sin rol asignado'}`;
        }).filter((x): x is string => x !== null).join('; ');
        L.push(`   · ${g.label}: ${asientos}`);
      }
    }
  }

  /* ── Evaluaciones recientes con rúbrica o diana ── */
  const classIds = new Set(classes.map(c => c.id));
  const evs = d.evaluations
    .filter(e => classIds.has(e.class_id))
    .slice(0, MAX_EVALUATIONS);
  if (evs.length) {
    L.push('');
    L.push(`EVALUACIONES RECIENTES CON RÚBRICA O DIANA (${evs.length} de ${d.evaluations.length}):`);
    for (const e of evs) {
      L.push(`· ${e.date} · ${e.student_name} · «${e.rubric_name}»` +
        `${typeof e.grade === 'number' ? ` · nota ${n(e.grade)}` : ''}` +
        `${e.notes ? ` · observaciones: ${e.notes}` : ''}`);
    }
  }

  /* ── Informes ya redactados ── */
  const informes = d.reports.filter(r => classIds.has(r.class_id));
  if (informes.length) {
    L.push('');
    L.push(`INFORMES COMPETENCIALES YA REDACTADOS (${informes.length}):`);
    for (const r of informes.slice(0, 20)) {
      L.push(`· ${r.student_name} · ${r.period} · ${r.text.slice(0, 220)}${r.text.length > 220 ? '…' : ''}`);
    }
  }

  /* ── Situaciones de aprendizaje ── */
  if (d.learningSituations.length) {
    L.push('');
    L.push('SITUACIONES DE APRENDIZAJE GUARDADAS:');
    for (const s of d.learningSituations.slice(0, 15)) {
      L.push(`· «${s.title}»${s.class_name ? ` para ${s.class_name}` : ''} (${s.date})`);
    }
  }

  /* ── Agenda: horario y lo que viene ── */
  if (d.scheduleBlocks.length) {
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    L.push('');
    L.push('HORARIO SEMANAL:');
    for (const b of d.scheduleBlocks) {
      const cls = d.classes.find(c => c.id === b.class_id);
      L.push(`· ${DIAS[b.day] ?? `día ${b.day}`} ${b.time_start}-${b.time_end} · ${b.subject}` +
        `${cls ? ` · ${cls.name}` : ''}${b.room ? ` · aula ${b.room}` : ''}`);
    }
  }

  const proximos = d.calEvents
    .filter(ev => ev.date >= hoy)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_EVENTS);
  if (proximos.length) {
    L.push('');
    L.push('PRÓXIMOS EVENTOS DE LA AGENDA:');
    for (const ev of proximos) {
      L.push(`· ${ev.date}${ev.time ? ` ${ev.time}` : ''} · ${ev.name} (${ev.type}, urgencia ${ev.urgency})` +
        `${ev.desc ? ` · ${ev.desc}` : ''}`);
    }
  }

  const pendientes = d.tasks.filter(t => !t.done);
  if (pendientes.length) {
    L.push('');
    L.push(`TAREAS PENDIENTES DEL DOCENTE (${pendientes.length}):`);
    for (const t of pendientes.slice(0, 20)) L.push(`· [${t.priority}] ${t.text}`);
  }

  return L.join('\n');
}

/**
 * Instrucciones del asistente.
 *
 * El grueso del prompt son las reglas anti-invención: con datos delante, el
 * riesgo deja de ser que responda en genérico y pasa a ser que rellene los
 * huecos («Marta va bien») cuando esa alumna no tiene ni una nota puesta.
 */
export function chatSystemPrompt(lang: Lang, hasContext: boolean): string {
  if (lang === 'en') {
    return [
      'You are the teaching assistant built into Aula Pro, a gradebook app used by school teachers.',
      'You answer in clear, useful English, in a warm but professional tone. Use short paragraphs and lists.',
      hasContext
        ? [
            'The user message includes a section titled "DATOS REALES DEL CUADERNO DE ESTE DOCENTE" with the teacher\'s actual data.',
            'RULES ABOUT THAT DATA — they take priority over everything else:',
            '1. Answer questions about students, classes, marks, averages or attendance USING ONLY those figures. Quote the actual numbers.',
            '2. NEVER invent a student, a class, a mark or a date that is not there. If the data says "sin notas" (no marks) or the student is missing, say plainly that there is no data yet and suggest where to add it in the app.',
            '3. Marks are out of 10; the pass mark in Spain is 5.',
            '4. Do not dump the whole dataset back at the user: answer the question that was asked.',
          ].join('\n')
        : 'You have NOT been given the teacher\'s data in this conversation, so do not pretend to know their students, classes or marks: answer in general terms and say that they can switch on "use my data" for specific answers.',
      'When a question is genuinely ambiguous, ask one short clarifying question instead of guessing.',
      'The curriculum framework is the Spanish LOMLOE unless the teacher says otherwise.',
    ].join('\n\n');
  }

  return [
    'Eres el asistente del cuaderno de Aula Pro, la aplicación de gestión de aula que usa este docente. Respondes en español de España, con claridad y en tono cercano pero profesional. Usa párrafos cortos y listas cuando ayuden.',
    hasContext
      ? [
          'En el mensaje del docente viene un bloque titulado «DATOS REALES DEL CUADERNO DE ESTE DOCENTE» con su información auténtica.',
          'REGLAS SOBRE ESOS DATOS — mandan por encima de todo lo demás:',
          '1. Las preguntas sobre alumnos, clases, notas, medias o asistencia se responden USANDO ESAS CIFRAS. Cita los números concretos y el nombre del alumno o de la clase.',
          '2. NO inventes nunca un alumno, una clase, una nota, una fecha ni un dato que no aparezca. Si pone «sin notas», o el alumno no está en la lista, dilo con naturalidad («todavía no tienes notas de…») y explica dónde se añade en la aplicación.',
          '3. Las notas son sobre 10 y el aprobado está en 5.',
          '4. No devuelvas el listado entero de datos: responde a lo que se te ha preguntado, con lo justo para justificarlo.',
          '5. Si te piden un cálculo (medias, comparaciones, quién aprueba), hazlo con los datos que tienes y di sobre cuántos alumnos lo has hecho.',
        ].join('\n')
      : 'En esta conversación NO tienes los datos del docente, así que no simules conocer a sus alumnos, sus clases ni sus notas: responde en general y avísale de que puede activar «usar mis datos» para respuestas concretas sobre su cuaderno.',
    'Si una pregunta es de verdad ambigua, haz UNA pregunta breve de aclaración en vez de adivinar.',
    'El marco curricular de referencia es la LOMLOE española, salvo que el docente diga otra cosa.',
  ].join('\n\n');
}
