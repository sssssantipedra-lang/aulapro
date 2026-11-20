/**
 * «Empezar curso nuevo» (20-11-2026, de la revisión a fondo de la app). Hasta ahora, en junio solo existía
 * «Vaciar el curso», que borra también las clases, el horario y las categorías y los pesos del cuaderno: cada
 * septiembre se rehacía lo que casi no cambia.
 *
 * Aquí está toda la cuenta, sin pantalla y sin tocar nada: de los datos del perfil y de lo que el docente elige
 * (`PlanDeCurso`) sale el perfil del curso nuevo (`cursoNuevoDe`) y, comparando los dos, el resumen de lo que se
 * conserva y lo que se borra (`resumenDeCursoNuevo`), que se enseña antes de aplicar. Lo aplica
 * `startNewSchoolYear` (`hooks/useAppState.ts`), después de guardar una copia; el asistente es
 * `components/CursoNuevo.tsx`.
 *
 * Qué pasa con cada cosa:
 *
 * - **Clases.** Cada una «sube de curso» (5.º A pasa a ser 6.º A, con su alumnado y sus asignaturas), «se queda
 *   vacía» (la misma clase, sin alumnado: para quien da el mismo curso a un grupo nuevo) o «se va».
 * - **Alumnado.** Sigue el de las clases que suben, con sus avisos y sus notas de la ficha si el docente lo pide.
 * - **Horario** y **categorías y pesos del cuaderno**: se conservan, si se pide, los de las clases que siguen.
 * - **Rúbricas, dianas y escalas**: se conservan todas, unidas a las clases que siguen (son del grupo y de su
 *   cuaderno) y sin las que se van.
 * - **Situaciones de aprendizaje, fichas y sesiones**: se conservan todas. Son de un curso, no de un grupo: lo
 *   que se preparó para 5.º sigue en la clase que el curso nuevo tenga en 5.º (la misma, si se queda vacía, o la
 *   que sube desde 4.º); si no hay ninguna, se queda en la biblioteca sin clase. Las sesiones pierden la fecha y
 *   la marca de «hecha».
 * - **Lo que empieza limpio**: notas y columnas del cuaderno, evaluaciones, asistencia, anotaciones, informes,
 *   mesas, dianas competenciales, autoevaluaciones y eventos de la agenda.
 * - **PT y AL**: `apoyoParaOtroCurso` (alumnado de apoyo, grupos, programas, adaptaciones y agendas).
 * - **Educación Física**: el material del docente (`efParaOtroCurso`) y, del alumnado que sigue, su nivel, con
 *   quién no conviene juntarlo y, si se conservan los avisos, sus medidas de apoyo. Marcas, exentos y equipos, no.
 * - Reuniones y formaciones no se tocan, como al vaciar el curso.
 */

import type {
  Class, Student, ScheduleBlock, CalEvent, Task, Rubric, Evaluation, GradeCategory, GradeItem, GradeMap,
  DianaProfile, EvalDiana, AttendanceMap, CompetencyReport, SelfAssessmentSession, LearningSituation, Ficha,
  WorkSession, SeatingPlan, ClassMark, MarksBlockConfig, GradeTarget,
} from '../types';
import type { ApoyoData } from '../types/apoyo';
import type { EfData } from '../types/ef';
import { apoyoParaOtroCurso } from './apoyo';
import { efParaOtroCurso } from './ef';
import { objetivosDe } from './objetivos';
import { esRegistro } from './registro';
import { claveDeGrupo } from './nombreDeGrupo';

/** Todo lo que se guarda de un perfil, menos el registro de cambios (la forma de `ProfileSnapshot`). */
export interface DatosDelCurso {
  tasks: Task[];
  classes: Class[];
  students: Student[];
  blocks: ScheduleBlock[];
  events: CalEvent[];
  rubrics: Rubric[];
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  dianaProfiles: Record<string, DianaProfile>;
  attendance: AttendanceMap;
  reports: CompetencyReport[];
  selfAssessments: SelfAssessmentSession[];
  learningSituations: LearningSituation[];
  fichas: Ficha[];
  workSessions: WorkSession[];
  seatingPlans: Record<string, SeatingPlan>;
  classMarks: ClassMark[];
  marksConfigs: Record<string, MarksBlockConfig>;
  apoyo: ApoyoData;
  ef: EfData;
}

/** Qué pasa con una clase al empezar el curso nuevo. */
export type Destino = 'sube' | 'vacia' | 'se-va';

export interface PlanDeCurso {
  /** Por id de clase. La que falte se queda vacía. */
  destinos: Record<string, Destino>;
  /** El nombre nuevo de las clases que suben, si el docente lo ha corregido. */
  nombres: Record<string, string>;
  /** Del alumnado que sigue: sus avisos y las notas de su ficha. */
  conservarAvisos: boolean;
  conservarHorario: boolean;
  /** Las categorías del cuaderno y sus pesos, y cómo cuenta el bloque de trabajo diario y actitud. */
  conservarCuaderno: boolean;
}

/** El último curso de la ESO no tiene a dónde subir dentro de la app. */
export function puedeSubir(c: Pick<Class, 'etapa' | 'curso'>): boolean {
  return !(c.etapa === 'eso' && c.curso === 4);
}

const destinoDe = (plan: PlanDeCurso, c: Class): Destino => {
  const d = plan.destinos[c.id] ?? 'vacia';
  return d === 'sube' && !puedeSubir(c) ? 'vacia' : d;
};

/** De partida todas se quedan vacías: es lo que no deja a un grupo en un curso que no es el suyo. */
export function planDePartida(classes: readonly Class[]): PlanDeCurso {
  return {
    destinos: Object.fromEntries(classes.map(c => [c.id, 'vacia' as const])),
    nombres: {}, conservarAvisos: true, conservarHorario: true, conservarCuaderno: true,
  };
}

/** La etapa y el curso que siguen: de 6.º de Primaria se pasa a 1.º de ESO. Sin curso puesto, nada cambia. */
function nivelSiguiente(c: Pick<Class, 'etapa' | 'curso'>): Pick<Class, 'etapa' | 'curso'> {
  if (!c.etapa || !c.curso) return { etapa: c.etapa, curso: c.curso };
  if (c.etapa === 'primaria' && c.curso >= 6) return { etapa: 'eso', curso: 1 };
  return { etapa: c.etapa, curso: c.curso + 1 };
}

/**
 * El nombre de una clase al subir de curso: «5º A» pasa a «6º A» y «6º Primaria B», a «1º ESO B». Solo se cambia
 * el número del curso (el primero que aparezca suelto); si el nombre no lo lleva («Los delfines»), se queda igual.
 */
export function nombreAlSubir(c: Pick<Class, 'name' | 'etapa' | 'curso'>): string {
  if (!c.curso) return c.name;
  const sig = nivelSiguiente(c);
  let nombre = c.name.replace(new RegExp(`(^|[^0-9])${c.curso}(?![0-9])`), `$1${sig.curso}`);
  if (sig.etapa !== c.etapa) nombre = nombre.replace(/\b(de\s+)?(educaci[oó]n?\s+)?prim[aà]ria\b|\bprimary\b/i, 'ESO');
  return nombre;
}

/** La clase, ya en el curso siguiente. Con cambio de etapa, las materias oficiales se vuelven a elegir. */
export function claseAlSubir(c: Class, nombre?: string): Class {
  const sig = nivelSiguiente(c);
  const { opcionMatematicas: _o, ...resto } = c;
  void _o;
  return {
    ...resto, ...sig,
    name: nombre?.trim() || nombreAlSubir(c),
    ...(sig.etapa !== c.etapa ? { materiasOficiales: {} } : {}),
  };
}

/** Las clases del curso nuevo, en el orden de siempre. */
function clasesNuevas(classes: readonly Class[], plan: PlanDeCurso): Class[] {
  return classes.flatMap(c => {
    const d = destinoDe(plan, c);
    return d === 'se-va' ? [] : [d === 'sube' ? claseAlSubir(c, plan.nombres[c.id]) : c];
  });
}

/**
 * A qué clase del curso nuevo va lo que se preparó para una clase (situaciones, fichas y sesiones): a la que
 * esté en su mismo curso. Si hay varias, la de su misma letra; si hay una sola, esa. Si no hay ninguna de ese
 * curso, a ninguna. Una clase sin etapa ni curso puestos no dice de qué curso es: lo suyo sigue con ella.
 */
export function claseDelMismoCurso(vieja: Class, nuevas: readonly Class[]): string | undefined {
  if (!vieja.etapa || !vieja.curso) return nuevas.some(c => c.id === vieja.id) ? vieja.id : undefined;
  const delCurso = nuevas.filter(c => c.etapa === vieja.etapa && c.curso === vieja.curso);
  if (delCurso.some(c => c.id === vieja.id)) return vieja.id;
  const clave = claveDeGrupo(vieja.name);
  const mismaLetra = delCurso.filter(c => claveDeGrupo(c.name) === clave);
  if (mismaLetra.length === 1) return mismaLetra[0].id;
  return delCurso.length === 1 ? delCurso[0].id : undefined;
}

/** Sin los campos que van `undefined` (para no escribir claves vacías en el perfil). */
function limpio<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Una rúbrica, una diana o una escala, unida solo a las clases que siguen. */
function instrumentoDelCursoNuevo<T extends GradeTarget>(inst: T, siguen: ReadonlySet<string>, conCuaderno: boolean): T {
  const { class_id, subject, category_id, otras_clases, areas, modo_areas, ...resto } = inst;
  void subject; void category_id; void otras_clases;
  const objetivos = objetivosDe(inst)
    .filter(o => siguen.has(o.class_id))
    .map(o => limpio({ class_id: o.class_id, subject: o.subject, category_id: conCuaderno ? o.category_id : undefined }));
  if (objetivos.length === 0) return resto as T;
  const [principal, ...otras] = objetivos;
  // Las áreas de una situación interdisciplinar son de la clase principal: valen si sigue siendo la misma
  const mismas = principal.class_id === class_id && areas?.length;
  return {
    ...resto, ...principal,
    ...(otras.length ? { otras_clases: otras } : {}),
    ...(mismas ? { areas: conCuaderno ? areas : areas.map(a => limpio({ ...a, category_id: undefined })) } : {}),
    ...(mismas && modo_areas ? { modo_areas } : {}),
  } as T;
}

/** El perfil con el que empieza el curso nuevo. No toca `d`. */
export function cursoNuevoDe(d: DatosDelCurso, plan: PlanDeCurso): DatosDelCurso {
  const classes = clasesNuevas(d.classes, plan);
  const siguen = new Set(classes.map(c => c.id));
  const suben = new Set(d.classes.filter(c => destinoDe(plan, c) === 'sube').map(c => c.id));
  const nombreDe = new Map(classes.map(c => [c.id, c.name]));

  const students = d.students
    .filter(s => suben.has(s.class_id))
    .map(s => (plan.conservarAvisos ? s : { ...s, alerts: [], notes: '' }));
  const alumnos = new Set(students.map(s => s.id));

  /** Dónde queda lo que era de una clase del curso que acaba (situaciones, fichas y sesiones). */
  const destinoDeLoSuyo = new Map(d.classes.map(c => [c.id, claseDelMismoCurso(c, classes)]));
  const nuevaDe = (id?: string) => (id ? destinoDeLoSuyo.get(id) : undefined);
  const nombres = (ids: string[]) => ids.map(id => nombreDe.get(id) ?? '').filter(Boolean).join(', ');

  const learningSituations = d.learningSituations.map(s => {
    const { class_id, otras_clases, class_name, ...resto } = s;
    void class_name;
    const ids = [...new Set([class_id, ...(otras_clases ?? [])].map(nuevaDe).filter((x): x is string => !!x))];
    const sesiones = resto.content?.sesiones;
    return {
      ...resto,
      ...(ids.length ? { class_id: ids[0], class_name: nombres(ids) } : {}),
      ...(ids.length > 1 ? { otras_clases: ids.slice(1) } : {}),
      // «Hecha» era del curso que acaba: el progreso empieza de cero
      ...(Array.isArray(sesiones) && sesiones.some(x => x.completada)
        ? { content: { ...resto.content, sesiones: sesiones.map(({ completada: _c, ...x }) => { void _c; return x; }) } }
        : {}),
    } as LearningSituation;
  });

  const fichas = d.fichas.map(f => {
    const { class_id, class_name, ...resto } = f;
    void class_name;
    const id = nuevaDe(class_id);
    return (id ? { ...resto, class_id: id, class_name: nombreDe.get(id) } : resto) as Ficha;
  });

  const base = efParaOtroCurso(d.ef);
  const ef: EfData = {
    ...base,
    sesiones: d.ef.sesiones.map(s => {
      const { claseId, fecha, completada, ...resto } = s;
      void fecha; void completada;
      const id = nuevaDe(claseId);
      return id ? { ...resto, claseId: id } : resto;
    }),
    // Del alumnado que sigue con el docente: lo que no cambia de un curso a otro
    niveles: Object.fromEntries(Object.entries(d.ef.niveles).filter(([id]) => alumnos.has(id))),
    sexos: Object.fromEntries(Object.entries(d.ef.sexos).filter(([id]) => alumnos.has(id))),
    separar: d.ef.separar.filter(p => alumnos.has(p.a) && alumnos.has(p.b)),
    apoyos: plan.conservarAvisos ? d.ef.apoyos.filter(a => alumnos.has(a.alumnoId)) : [],
  };

  // Las adaptaciones de aula del alumnado que sigue, sin lo que es del curso que acaba (como las de PT y AL)
  const apoyo: ApoyoData = {
    ...apoyoParaOtroCurso(d.apoyo),
    acsAula: d.apoyo.acsAula.filter(a => alumnos.has(a.alumnoId))
      .map(a => { const copia = { ...a }; delete copia.notas; delete copia.promocion; return copia; }),
  };

  return {
    // Lo pendiente sigue pendiente; lo hecho se va con el curso
    tasks: d.tasks.filter(t => !t.done),
    classes,
    students,
    blocks: plan.conservarHorario ? d.blocks.filter(b => !b.class_id || siguen.has(b.class_id)) : [],
    events: [],
    rubrics: d.rubrics.map(r => instrumentoDelCursoNuevo(r, siguen, plan.conservarCuaderno)),
    dianas: d.dianas.map(x => instrumentoDelCursoNuevo(x, siguen, plan.conservarCuaderno)),
    evaluations: [],
    gradeCategories: plan.conservarCuaderno ? d.gradeCategories.filter(g => siguen.has(g.class_id)) : [],
    gradeItems: [],
    grades: {},
    dianaProfiles: {},
    attendance: {},
    reports: [],
    selfAssessments: [],
    learningSituations,
    fichas,
    workSessions: d.workSessions,
    seatingPlans: {},
    classMarks: [],
    marksConfigs: plan.conservarCuaderno
      ? Object.fromEntries(Object.entries(d.marksConfigs).filter(([k]) => siguen.has(k.split('|')[0])))
      : {},
    apoyo,
    ef,
  };
}

/* ── El resumen que se enseña antes de aplicar ── */

export interface ResumenDeCurso {
  clases: { suben: number; vacias: number; seVan: number };
  /** Alumnado que sigue (el de las clases que suben) y que sale del perfil. */
  alumnado: { sigue: number; sale: number; conAvisos: number };
  /** Lo que se conserva: cuántos hay de cada cosa en el curso nuevo. */
  conserva: {
    bloquesDeHorario: number; categorias: number;
    rubricas: number; dianas: number; escalas: number; situaciones: number; fichas: number;
    sesiones: number; reuniones: number; tareasPendientes: number;
    /** PT y AL. */
    alumnadoDeApoyo: number; programas: number; adaptaciones: number; agendas: number;
    /** Educación Física. */
    pruebas: number; actividades: number; material: number; pizarras: number; circuitos: number;
  };
  /** Lo que se borra: cuántos había y ya no están. */
  borra: {
    notas: number; columnas: number; evaluaciones: number; diasDeAsistencia: number; anotaciones: number;
    informes: number; mesas: number; dianasCompetenciales: number; autoevaluaciones: number;
    eventos: number; tareasHechas: number; bloquesDeHorario: number; categorias: number;
    /** PT y AL. */
    registrosDeApoyo: number; coordinaciones: number; cierres: number; documentosDeApoyo: number;
    /** Educación Física. */
    marcas: number; exentos: number; equipos: number;
  };
  /** Situaciones, fichas y sesiones que estaban en una clase y se quedan sin ninguna. */
  sinClase: { situaciones: number; fichas: number; sesiones: number; instrumentos: number };
}

const notasPuestas = (g: GradeMap) => Object.values(g).reduce((n, fila) => n + Object.values(fila).filter(v => v !== null && v !== undefined).length, 0);
const diasDeAsistencia = (a: AttendanceMap) => Object.values(a).reduce((n, dias) => n + Object.keys(dias).length, 0);

/** Lo que cambia entre el perfil de ahora y el del curso nuevo, en números. */
export function resumenDeCursoNuevo(d: DatosDelCurso, plan: PlanDeCurso): ResumenDeCurso {
  const n = cursoNuevoDe(d, plan);
  const destinos = d.classes.map(c => destinoDe(plan, c));
  const cuenta = (x: Destino) => destinos.filter(y => y === x).length;
  const escalas = (l: EvalDiana[]) => l.filter(esRegistro).length;
  return {
    clases: { suben: cuenta('sube'), vacias: cuenta('vacia'), seVan: cuenta('se-va') },
    alumnado: {
      sigue: n.students.length, sale: d.students.length - n.students.length,
      conAvisos: n.students.filter(s => s.alerts.length > 0 || s.notes.trim() !== '').length,
    },
    conserva: {
      bloquesDeHorario: n.blocks.length, categorias: n.gradeCategories.length,
      rubricas: n.rubrics.length, dianas: n.dianas.length - escalas(n.dianas), escalas: escalas(n.dianas),
      situaciones: n.learningSituations.length, fichas: n.fichas.length,
      sesiones: n.ef.sesiones.length, reuniones: n.workSessions.length, tareasPendientes: n.tasks.length,
      alumnadoDeApoyo: n.apoyo.alumnos.length, programas: n.apoyo.programas.length,
      adaptaciones: n.apoyo.acs.length + n.apoyo.acsAula.length, agendas: n.apoyo.agendas.length,
      pruebas: n.ef.pruebas.length, actividades: n.ef.actividades.length, material: n.ef.material.length,
      pizarras: n.ef.pizarras.length, circuitos: n.ef.circuitos.length,
    },
    borra: {
      notas: notasPuestas(d.grades), columnas: d.gradeItems.length, evaluaciones: d.evaluations.length,
      diasDeAsistencia: diasDeAsistencia(d.attendance), anotaciones: d.classMarks.length,
      informes: d.reports.length, mesas: Object.keys(d.seatingPlans).length,
      dianasCompetenciales: Object.keys(d.dianaProfiles).length, autoevaluaciones: d.selfAssessments.length,
      eventos: d.events.length, tareasHechas: d.tasks.length - n.tasks.length,
      bloquesDeHorario: d.blocks.length - n.blocks.length, categorias: d.gradeCategories.length - n.gradeCategories.length,
      registrosDeApoyo: d.apoyo.sesiones.length, coordinaciones: d.apoyo.coordinaciones.length,
      cierres: d.apoyo.evaluaciones.length, documentosDeApoyo: d.apoyo.documentos.length,
      marcas: d.ef.marcas.length, exentos: d.ef.exentos.length, equipos: Object.keys(d.ef.equipos).length,
    },
    sinClase: {
      situaciones: d.learningSituations.filter((s, i) => s.class_id && !n.learningSituations[i].class_id).length,
      fichas: d.fichas.filter((f, i) => f.class_id && !n.fichas[i].class_id).length,
      sesiones: d.ef.sesiones.filter((s, i) => s.claseId && !n.ef.sesiones[i].claseId).length,
      instrumentos: d.rubrics.filter((r, i) => r.class_id && !n.rubrics[i].class_id).length
        + d.dianas.filter((x, i) => x.class_id && !n.dianas[i].class_id).length,
    },
  };
}

/** Nombres que quedarían repetidos entre las clases del curso nuevo (dos «6º A»): se avisa antes de aplicar. */
export function nombresRepetidos(classes: readonly Class[], plan: PlanDeCurso): string[] {
  const vistos = new Map<string, number>();
  for (const c of clasesNuevas(classes, plan)) {
    const k = `${c.etapa ?? ''}|${c.name.trim().toLocaleLowerCase('es')}`;
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  const repetidos = new Set<string>();
  for (const c of clasesNuevas(classes, plan)) {
    if ((vistos.get(`${c.etapa ?? ''}|${c.name.trim().toLocaleLowerCase('es')}`) ?? 0) > 1) repetidos.add(c.name.trim());
  }
  return [...repetidos];
}

/* ── El curso escolar ── */

/**
 * El curso que viene después del que dice el perfil: de «2026-2027» sale «2027-2028» (y de «2026/27»,
 * «2027/28»). Si el perfil no lo dice de una forma que se entienda, el que toca por la fecha: de junio en
 * adelante, el que empieza ese año.
 */
export function cursoSiguiente(actual: string, hoy: Date = new Date()): string {
  const m = /^\s*(\d{4})(\s*[-/–]\s*)(\d{4}|\d{2})\s*$/.exec(actual);
  if (m) {
    const a = Number(m[1]) + 1;
    const b = m[3].length === 2 ? String((a + 1) % 100).padStart(2, '0') : String(a + 1);
    return `${a}${m[2]}${b}`;
  }
  const y = hoy.getFullYear();
  return hoy.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** El nombre del archivo con la copia del curso que acaba: «aulapro-curso-2026-2027.json». */
export function archivoDelCurso(curso: string, hoy: string): string {
  const limpioNombre = curso.trim().replace(/[^0-9A-Za-z]+/g, '-').replace(/^-+|-+$/g, '');
  return `aulapro-curso-${limpioNombre || hoy}.json`;
}

/* ── El resumen, en líneas para la pantalla ── */

/** Una línea del resumen: su texto en castellano (la clave de su traducción) y cuántos son. */
export interface LineaDeResumen { texto: string; n: number }

/**
 * El resumen en dos listas, «se conserva» y «se borra», solo con lo que hay (lo que vale 0 no se enseña). Son
 * etiquetas con su número («Rúbricas: 4»), que se leen igual con uno que con varios.
 */
export function lineasDelResumen(r: ResumenDeCurso, plan: Pick<PlanDeCurso, 'conservarAvisos'>): { conserva: LineaDeResumen[]; borra: LineaDeResumen[] } {
  const lista = (filas: [string, number][]) => filas.filter(([, n]) => n > 0).map(([texto, n]) => ({ texto, n }));
  return {
    conserva: lista([
      ['Clases que suben de curso', r.clases.suben],
      ['Clases que se quedan vacías', r.clases.vacias],
      ['Alumnado que sigue contigo', r.alumnado.sigue],
      ['Alumnado que sigue con avisos o notas en su ficha', plan.conservarAvisos ? r.alumnado.conAvisos : 0],
      ['Bloques del horario', r.conserva.bloquesDeHorario],
      ['Categorías del cuaderno, con sus pesos', r.conserva.categorias],
      ['Rúbricas', r.conserva.rubricas],
      ['Dianas', r.conserva.dianas],
      ['Escalas de registro', r.conserva.escalas],
      ['Situaciones de aprendizaje', r.conserva.situaciones],
      ['Fichas', r.conserva.fichas],
      ['Sesiones, sin fecha', r.conserva.sesiones],
      ['Reuniones y formaciones', r.conserva.reuniones],
      ['Tareas pendientes', r.conserva.tareasPendientes],
      ['Alumnado de apoyo', r.conserva.alumnadoDeApoyo],
      ['Programas de apoyo', r.conserva.programas],
      ['Adaptaciones curriculares', r.conserva.adaptaciones],
      ['Agendas visuales', r.conserva.agendas],
      ['Pruebas físicas', r.conserva.pruebas],
      ['Actividades de Educación Física', r.conserva.actividades],
      ['Material del inventario', r.conserva.material],
      ['Pizarras de circuitos', r.conserva.pizarras + r.conserva.circuitos],
    ]),
    borra: lista([
      ['Clases que se van', r.clases.seVan],
      ['Alumnado que sale de tu perfil', r.alumnado.sale],
      ['Notas del cuaderno', r.borra.notas],
      ['Actividades del cuaderno (columnas)', r.borra.columnas],
      ['Evaluaciones con rúbricas, dianas y escalas', r.borra.evaluaciones],
      ['Días de asistencia', r.borra.diasDeAsistencia],
      ['Anotaciones de actitud', r.borra.anotaciones],
      ['Informes', r.borra.informes],
      ['Distribuciones de aula', r.borra.mesas],
      ['Dianas competenciales del alumnado', r.borra.dianasCompetenciales],
      ['Autoevaluaciones', r.borra.autoevaluaciones],
      ['Eventos de la agenda', r.borra.eventos],
      ['Tareas ya hechas', r.borra.tareasHechas],
      ['Bloques del horario', r.borra.bloquesDeHorario],
      ['Categorías del cuaderno', r.borra.categorias],
      ['Registros de sesiones de apoyo', r.borra.registrosDeApoyo],
      ['Coordinaciones', r.borra.coordinaciones],
      ['Valoraciones de cierre de trimestre', r.borra.cierres],
      ['Documentos de apoyo', r.borra.documentosDeApoyo],
      ['Marcas de pruebas físicas', r.borra.marcas],
      ['Exentos y lesiones', r.borra.exentos],
      ['Equipos', r.borra.equipos],
    ]),
  };
}
