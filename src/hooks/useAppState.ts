import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type {
  Class, Student, ScheduleBlock, CalEvent, Task, Rubric, Evaluation,
  GradeCategory, GradeItem, GradeMap, DianaProfile, EvalDiana,
  AttendanceMap, AttendanceStatus, CompetencyReport, SelfAssessmentSession,
  LearningSituation, Ficha, WorkSession, SeatingPlan, ClassMark, MarksBlockConfig,
} from '../types';
import { normalizeClass } from '../types';
import { destinosDe, notaDeDestino, objetivoPara, objetivosDe } from '../lib/objetivos';
import { mismaEvaluacionDelDia } from '../lib/evaluacionDelDia';
import { evaluacionVigente } from '../lib/evaluarClase';
import { isoDate } from '../lib/utils';
import { buildDemoData } from '../lib/demoData';
import { buildDemoApoyo } from '../lib/demoApoyo';
import { mergeBundle, type SharedBundle, type MergeMode } from '../services/paquete';
import type { ChatMessage } from '../services/aiContext';
import * as store from '../services/storage';
import { comunidadDePerfil } from '../lib/curriculum/comunidades';
import { provinciaDePerfil } from '../lib/provincias';
import { APOYO_VACIO, normalizarApoyo, especialidadesDePerfil, apoyoParaOtroCurso, sinAcsDeAula } from '../lib/apoyo';
import type { ApoyoData } from '../types/apoyo';
import { useGuardadoAutomatico } from './useGuardadoAutomatico';
import { leerCopiaDeDatos } from '../lib/copiaDeDatos';
import { EF_VACIO, normalizarEF, efParaOtroCurso, sinAlumnoEF, sinClaseEF } from '../lib/ef';
import { buildDemoEF } from '../lib/demoEF';
import type { Lang } from '../i18n/core';
import { tipoDePerfil } from '../lib/tipoDocente';
import type { EfData } from '../types/ef';
import type { TeacherProfile } from '../services/storage';
import { ordenarAlumnado } from '../lib/alumnado';
import {
  pushEntry, newEntry, formatGrade, formatDay,
  type AuditEntry, type AuditAction, type AuditEntity,
} from '../services/audit';
import {
  anotarBorrado, borradoAlPintar, borradoDeApoyo, borradoDeEF, loQueVuelve, textoDeBorrados,
  type Borrado, type BorradoPendiente,
} from '../lib/deshacer';
import { translate } from '../i18n/core';

/** Cómo se lee cada estado de asistencia en el registro de cambios. */
const ATT_LABEL: Record<AttendanceStatus, string> = {
  present: 'presente', absent: 'falta', late: 'retraso', justified: 'justificada',
};

/** Espera antes de escribir a disco, para agrupar cambios seguidos. */
const SAVE_DELAY_MS = 700;
/** Cada cuánto se hace una copia de seguridad automática. */
const BACKUP_EVERY_MS = 10 * 60 * 1000;

/** Todo lo que se guarda de un perfil. */
interface ProfileSnapshot {
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
  /** Distribución de aula de cada clase, indexada por `class_id`. */
  seatingPlans: Record<string, SeatingPlan>;
  /** Anotaciones rápidas del aula (sin tarea, comportamiento…). */
  classMarks: ClassMark[];
  /** Cómo cuenta ese bloque en cada clase y asignatura, por `classId|asignatura`. */
  marksConfigs: Record<string, MarksBlockConfig>;
  /** Módulo de PT y AL (ver `docs/PTAL.md`). Solo lo usan los especialistas. */
  apoyo: ApoyoData;
  ef: EfData;
  auditLog: AuditEntry[];
}

/**
 * Lo que «Deshacer» puede reponer tras un borrado: todo el perfil menos el registro de cambios, que no vuelve
 * atrás (el borrado y el haberlo deshecho quedan anotados los dos). Ver `lib/deshacer.ts`.
 */
type Reponible = Omit<ProfileSnapshot, 'auditLog'>;
const REPONIBLES = [
  'tasks', 'classes', 'students', 'blocks', 'events', 'rubrics', 'dianas', 'evaluations',
  'gradeCategories', 'gradeItems', 'grades', 'dianaProfiles', 'attendance', 'reports', 'selfAssessments',
  'learningSituations', 'fichas', 'workSessions', 'seatingPlans', 'classMarks', 'marksConfigs', 'apoyo', 'ef',
] as const satisfies readonly (keyof Reponible)[];
/** Si se añade una colección al perfil y no se apunta arriba, esto no compila: «Deshacer» no la repondría. */
const REPONIBLES_COMPLETO: Exclude<keyof Reponible, (typeof REPONIBLES)[number]> extends never ? true : never = true;
void REPONIBLES_COMPLETO;

function emptySnapshot(): ProfileSnapshot {
  return {
    tasks: [], classes: [], students: [], blocks: [], events: [],
    rubrics: [], dianas: [], evaluations: [],
    gradeCategories: [], gradeItems: [], grades: {},
    dianaProfiles: {}, attendance: {}, reports: [], selfAssessments: [], learningSituations: [],
    fichas: [], workSessions: [], seatingPlans: {}, classMarks: [], marksConfigs: {}, apoyo: APOYO_VACIO, ef: EF_VACIO,
    auditLog: [],
  };
}

/**
 * Los datos de ejemplo con la forma de un perfil guardado. Es lo que se
 * escribe en disco al «Explorar con datos de ejemplo», ANTES de abrir el
 * perfil: si se cargaran en memoria después de abrirlo, la lectura del disco
 * (asíncrona, y todavía vacía) terminaría más tarde y los borraría.
 */
export function demoSnapshot(lang: Lang = 'es'): ProfileSnapshot {
  const d = buildDemoData(lang);
  return {
    ...emptySnapshot(),
    tasks: d.tasks,
    classes: d.classes,
    students: d.students,
    blocks: d.scheduleBlocks,
    events: d.calEvents,
    rubrics: d.rubrics,
    dianas: d.dianas,
    evaluations: d.evaluations,
    dianaProfiles: d.dianaProfiles,
    gradeCategories: d.gradeCategories,
    gradeItems: d.gradeItems,
    grades: d.grades,
    classMarks: d.classMarks,
    marksConfigs: d.marksConfigs,
  };
}

/**
 * Recupera el trabajo guardado por versiones anteriores, que usaban
 * localStorage sin perfiles. Así nadie pierde su curso al actualizar.
 */
function readLegacyData(): Partial<ProfileSnapshot> | null {
  const read = <T,>(key: string): T | undefined => {
    try {
      const raw = localStorage.getItem('aulapro_' + key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  };
  const classes = read<Class[]>('classes');
  if (!classes || classes.length === 0) return null;

  return {
    tasks: read<Task[]>('tasks') ?? [],
    classes,
    students: read<Student[]>('students') ?? [],
    blocks: read<ScheduleBlock[]>('blocks') ?? [],
    events: read<CalEvent[]>('events') ?? [],
    rubrics: read<Rubric[]>('rubrics') ?? [],
    dianas: read<EvalDiana[]>('dianas') ?? [],
    evaluations: read<Evaluation[]>('evaluations') ?? [],
    gradeCategories: read<GradeCategory[]>('grade_categories') ?? [],
    gradeItems: read<GradeItem[]>('grade_items') ?? [],
    grades: read<GradeMap>('grades') ?? {},
    dianaProfiles: read<Record<string, DianaProfile>>('diana_profiles') ?? {},
  };
}

/** Un mapa «cosa → alumno → valor» sin las entradas de un alumno (las notas de cada columna, la lista de cada día). */
function sinAlumno<V>(mapa: Record<string, Record<string, V>>, alumnoId: string): Record<string, Record<string, V>> {
  let cambia = false;
  const out: Record<string, Record<string, V>> = {};
  for (const [k, fila] of Object.entries(mapa)) {
    if (fila && alumnoId in fila) { cambia = true; const f = { ...fila }; delete f[alumnoId]; out[k] = f; } else out[k] = fila;
  }
  return cambia ? out : mapa;
}

export function useAppState() {
  const [profileId, setProfileId] = useState<string | null>(() => store.getActiveProfileId());
  const [profile, setProfile]     = useState<TeacherProfile | null>(null);
  // Sin perfil activo no hay nada que cargar: la app está lista desde el principio.
  const [ready, setReady]         = useState(() => store.getActiveProfileId() === null);
  /**
   * Los datos del perfil están, pero no se han podido leer (auditoría del 1-11-2026): la app no se abre (`ready` sigue
   * en falso, así que el guardado automático no escribe nada) y la pantalla lo dice. Antes se abría el perfil vacío y
   * el guardado automático lo escribía encima de los datos buenos.
   */
  const [loadError, setLoadError] = useState<'lectura' | 'formato' | null>(null);

  const [tasks, setTasks]                     = useState<Task[]>([]);
  const [classes, setClasses]                 = useState<Class[]>([]);
  const [students, setStudents]               = useState<Student[]>([]);
  const [scheduleBlocks, setScheduleBlocks]   = useState<ScheduleBlock[]>([]);
  const [calEvents, setCalEvents]             = useState<CalEvent[]>([]);
  const [rubrics, setRubrics]                 = useState<Rubric[]>([]);
  const [dianas, setDianas]                   = useState<EvalDiana[]>([]);
  const [evaluations, setEvaluations]         = useState<Evaluation[]>([]);
  const [gradeCategories, setGradeCategories] = useState<GradeCategory[]>([]);
  const [gradeItems, setGradeItems]           = useState<GradeItem[]>([]);
  const [grades, setGrades]                   = useState<GradeMap>({});
  const [dianaProfiles, setDianaProfiles]     = useState<Record<string, DianaProfile>>({});
  const [attendance, setAttendance]           = useState<AttendanceMap>({});
  const [reports, setReports]                 = useState<CompetencyReport[]>([]);
  const [selfAssessments, setSelfAssessments] = useState<SelfAssessmentSession[]>([]);
  const [learningSituations, setLearningSituations] = useState<LearningSituation[]>([]);
  const [fichas, setFichas]                   = useState<Ficha[]>([]);
  const [workSessions, setWorkSessions]       = useState<WorkSession[]>([]);
  const [seatingPlans, setSeatingPlans]       = useState<Record<string, SeatingPlan>>({});
  const [classMarks, setClassMarks]           = useState<ClassMark[]>([]);
  const [marksConfigs, setMarksConfigs]       = useState<Record<string, MarksBlockConfig>>({});
  const [apoyo, setApoyo]                     = useState<ApoyoData>(APOYO_VACIO);
  const [ef, setEf]                           = useState<EfData>(EF_VACIO);
  const [auditLog, setAuditLog]               = useState<AuditEntry[]>([]);
  /** El último borrado, mientras se puede deshacer (más abajo, «Deshacer tras un borrado»). */
  const [borradoPendiente, setBorradoPendiente] = useState<BorradoPendiente<Reponible> | null>(null);

  // El documento de normativa (base64, puede ser enorme) solo vive en memoria
  const [lawDocument, setLawDocument] = useState<{ name: string; mimeType: string; base64: string } | null>(null);

  // La conversación con el asistente, también solo en memoria. Vive aquí y no
  // dentro de la página del cuaderno para que no se pierda al ir a mirar otra
  // sección y volver, que es justo lo que se hace mientras se pregunta.
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const hydrate = useCallback((d: Partial<ProfileSnapshot>) => {
    const s = { ...emptySnapshot(), ...d };
    setTasks(s.tasks);
    // Migración: las clases guardadas antes de que pudieran tener varias
    // asignaturas llegan sin `subjects`. Aquí se les rellena, de modo que el
    // resto del código no tiene que preocuparse por el formato antiguo.
    setClasses(s.classes.map(normalizeClass));
    setStudents(s.students);
    setScheduleBlocks(s.blocks);
    setCalEvents(s.events);
    setRubrics(s.rubrics);
    setDianas(s.dianas);
    setEvaluations(s.evaluations);
    setGradeCategories(s.gradeCategories);
    setGradeItems(s.gradeItems);
    setGrades(s.grades);
    setDianaProfiles(s.dianaProfiles);
    setAttendance(s.attendance);
    setReports(s.reports);
    setSelfAssessments(s.selfAssessments);
    setLearningSituations(s.learningSituations);
    setFichas(s.fichas);
    setWorkSessions(s.workSessions);
    setSeatingPlans(s.seatingPlans);
    setClassMarks(s.classMarks);
    setMarksConfigs(s.marksConfigs);
    // Puede venir de una copia editada a mano o de una versión anterior
    setApoyo(normalizarApoyo(s.apoyo));
    setEf(normalizarEF(s.ef));
    setAuditLog(s.auditLog);
    // La conversación con el asistente habla de los alumnos del perfil que se
    // acaba de dejar atrás: no puede seguir abierta en el siguiente.
    setChat([]);
    // Y un borrado de antes de cargar otros datos (otro perfil, una copia) ya no se puede deshacer
    setBorradoPendiente(null);
  }, []);

  /* ── Carga al entrar en un perfil ── */
  useEffect(() => {
    // Cerrar el perfil (sin id) ya limpia el estado en `closeProfile`, y
    // `ready` se pone a false al abrir uno: aquí solo queda la carga en sí.
    if (!profileId) return;
    let cancelled = false;
    (async () => {
      let list: TeacherProfile[], data: unknown;
      try {
        [list, data] = await Promise.all([store.listProfiles(), store.loadData(profileId)]);
      } catch (err) {
        // Nunca se abre vacío: se queda sin abrir y la pantalla ofrece volver a intentarlo o restaurar una copia
        if (!cancelled) setLoadError((err as { causa?: string })?.causa === 'formato' ? 'formato' : 'lectura');
        return;
      }
      if (cancelled) return;

      const found = list.find(p => p.id === profileId) ?? null;
      if (!found) {
        // El perfil ya no existe (borrado desde otro sitio)
        store.setActiveProfileId(null);
        setProfileId(null);
        setProfile(null);
        hydrate({});
        setReady(true);
        return;
      }
      setProfile(found);
      hydrate(data as Partial<ProfileSnapshot>);
      setReady(true);
      store.touchProfile(profileId);
    })();

    return () => { cancelled = true; };
  }, [profileId, hydrate]);

  /* ── Guardado diferido ── */
  const snapshot = useMemo<ProfileSnapshot>(() => ({
    tasks, classes, students, blocks: scheduleBlocks, events: calEvents,
    rubrics, dianas, evaluations, gradeCategories, gradeItems, grades,
    dianaProfiles, attendance, reports, selfAssessments, learningSituations, fichas,
    workSessions, seatingPlans, classMarks, marksConfigs, apoyo, ef, auditLog,
  }), [tasks, classes, students, scheduleBlocks, calEvents, rubrics, dianas,
      evaluations, gradeCategories, gradeItems, grades, dianaProfiles,
      attendance, reports, selfAssessments, learningSituations, fichas,
      workSessions, seatingPlans, classMarks, marksConfigs, apoyo, ef, auditLog]);

  const { saving, errorGuardado } = useGuardadoAutomatico({
    ready, profileId, snapshot, retardo: SAVE_DELAY_MS,
    guardar: (id, datos) => store.saveData(id, datos as unknown as store.ProfileData),
  });

  /* ── «Deshacer» tras un borrado (ver `lib/deshacer.ts`) ── */

  /** El perfil tal como se pintó por última vez: de aquí sale el «antes» de cada borrado. */
  const pintadoRef = useRef<Reponible>(snapshot);
  useEffect(() => { pintadoRef.current = snapshot; }, [snapshot]);

  // Ajuste durante el pintado: el primero tras un borrado fija cómo ha quedado todo; en los siguientes, si se ha
  // tocado algo de lo que el borrado cambió (o se ha cambiado de perfil), deja de poderse deshacer
  const borradoAhora = borradoAlPintar(borradoPendiente, profileId, snapshot as Reponible, REPONIBLES);
  if (borradoAhora !== borradoPendiente) setBorradoPendiente(borradoAhora);

  const numeroDeBorrado = useRef(0);
  /** Se llama justo antes de borrar, en el mismo gesto: guarda cómo está todo para poder reponerlo. */
  const apuntarBorrado = useCallback((...borrados: Borrado[]) => {
    const nuevo = { id: ++numeroDeBorrado.current, perfil: profileId, borrados, antes: pintadoRef.current };
    setBorradoPendiente(prev => anotarBorrado(prev, nuevo));
  }, [profileId]);

  /** Retira el aviso (pasó su tiempo o se cerró): ya no se puede deshacer. */
  const olvidarBorrado = useCallback(() => setBorradoPendiente(null), []);

  /* ── Copia de seguridad automática ── */
  useEffect(() => {
    if (!ready || !profileId) return;
    const id = setInterval(() => { store.backup(profileId); }, BACKUP_EVERY_MS);
    return () => clearInterval(id);
  }, [ready, profileId]);

  /* ── Perfiles ── */
  const openProfile = useCallback((id: string) => {
    store.setActiveProfileId(id);
    if (id === profileId) return;
    setReady(false);
    setLoadError(null);
    setProfileId(id);
  }, [profileId]);

  const createAndOpenProfile = useCallback(async (
    input: store.NewProfileInput,
    /** `lang`: el idioma de la aplicación, en el que salen los datos de ejemplo. */
    options: { importLegacy?: boolean; demo?: boolean; lang?: Lang } = {},
  ) => {
    const created = await store.createProfile(input);
    if (options.demo) {
      // El ejemplo de PT y AL es su alumnado de apoyo, sin clases; el de EF, sus clases de EF
      const lang = options.lang ?? 'es';
      const demo = input.especialidades?.length ? { ...emptySnapshot(), apoyo: buildDemoApoyo(new Date(), lang) }
        : input.tipoDocente === 'ef' ? { ...emptySnapshot(), ...buildDemoEF(new Date(), lang) }
        : demoSnapshot(lang);
      await store.saveData(created.id, demo as unknown as store.ProfileData);
    } else if (options.importLegacy) {
      const legacy = readLegacyData();
      if (legacy) {
        await store.saveData(created.id, { ...emptySnapshot(), ...legacy } as unknown as store.ProfileData);
      }
    }
    openProfile(created.id);
    return created;
  }, [openProfile]);

  const logout = useCallback(async () => {
    if (profileId) await store.backup(profileId);
    store.setActiveProfileId(null);
    setProfileId(null);
    setProfile(null);
    hydrate({});
    setReady(true);
  }, [profileId, hydrate]);

  const updateUser = useCallback(async (patch: Partial<TeacherProfile>) => {
    if (!profileId) return;
    await store.updateProfile(profileId, patch);
    setProfile(prev => (prev ? { ...prev, ...patch } : prev));
  }, [profileId]);

  /** Perfil en el formato que espera el resto de la interfaz. */
  const currentUser = useMemo(() => (profile ? {
    id: profile.id,
    email: '',
    full_name: profile.name,
    school: profile.school,
    subject: profile.subject,
    community: comunidadDePerfil(profile.community) ?? undefined,
    provincia: provinciaDePerfil(comunidadDePerfil(profile.community), profile.provincia) ?? undefined,
    especialidades: especialidadesDePerfil(profile.especialidades),
    tipo: tipoDePerfil(profile),
    tutor: tipoDePerfil(profile) === 'ef' && profile.tutor === true,
  } : null), [profile]);

  /* ── Registro de cambios ── */

  /**
   * Espejo del estado. Permite poner nombres legibles y el valor anterior en
   * cada línea del registro sin que las mutaciones dependan de medio hook: si
   * `setGrade` dependiera de `grades`, se recrearía en cada tecla.
   */
  const mirrorRef = useRef({ students, gradeItems, gradeCategories, classes, grades, attendance, rubrics, dianas, reports, selfAssessments, learningSituations, fichas, workSessions, seatingPlans, classMarks, evaluations });
  useEffect(() => {
    mirrorRef.current = { students, gradeItems, gradeCategories, classes, grades, attendance, rubrics, dianas, reports, selfAssessments, learningSituations, fichas, workSessions, seatingPlans, classMarks, evaluations };
  }, [students, gradeItems, gradeCategories, classes, grades, attendance, rubrics, dianas, reports, selfAssessments, learningSituations, fichas, workSessions, seatingPlans, classMarks, evaluations]);

  const whoRef = useRef('');
  useEffect(() => { whoRef.current = profile?.name ?? ''; }, [profile]);

  const log = useCallback((
    action: AuditAction, entity: AuditEntity, entityId: string, what: string, detail?: string,
  ) => {
    setAuditLog(prev => pushEntry(prev, newEntry(whoRef.current, action, entity, entityId, what, detail)));
  }, []);

  const studentName = useCallback((id: string) =>
    mirrorRef.current.students.find(s => s.id === id)?.name ?? 'un alumno', []);
  const itemName = useCallback((id: string) =>
    mirrorRef.current.gradeItems.find(i => i.id === id)?.name ?? 'una prueba', []);
  const className = useCallback((id: string) =>
    mirrorRef.current.classes.find(c => c.id === id)?.name ?? 'una clase', []);
  const rubricName = useCallback((id: string) =>
    mirrorRef.current.rubrics.find(r => r.id === id)?.name ?? 'una rúbrica', []);
  const dianaName = useCallback((id: string) =>
    mirrorRef.current.dianas.find(d => d.id === id)?.name ?? 'una diana', []);

  const clearAuditLog = useCallback(() => {
    setAuditLog([newEntry(whoRef.current, 'delete', 'system', 'audit', 'Vació el registro de cambios')]);
  }, []);

  /**
   * Deshace el último borrado: repone cada colección que cambió, tal como estaba antes (lo borrado vuelve con
   * todo lo que se fue con él). Solo mientras el aviso está a la vista; devuelve si se ha deshecho.
   */
  const deshacerBorrado = useCallback((): boolean => {
    const p = borradoPendiente;
    if (!p?.despues || p.perfil !== profileId) return false;
    // Una por colección (el tipo lo exige): una colección nueva del perfil sin su línea aquí no compila
    const reponer: { [K in keyof Reponible]: (valor: Reponible[K]) => void } = {
      tasks: setTasks, classes: setClasses, students: setStudents, blocks: setScheduleBlocks, events: setCalEvents,
      rubrics: setRubrics, dianas: setDianas, evaluations: setEvaluations, gradeCategories: setGradeCategories,
      gradeItems: setGradeItems, grades: setGrades, dianaProfiles: setDianaProfiles, attendance: setAttendance,
      reports: setReports, selfAssessments: setSelfAssessments, learningSituations: setLearningSituations,
      fichas: setFichas, workSessions: setWorkSessions, seatingPlans: setSeatingPlans, classMarks: setClassMarks,
      marksConfigs: setMarksConfigs, apoyo: setApoyo, ef: setEf,
    };
    const v = loQueVuelve(p, REPONIBLES);
    for (const k of REPONIBLES) if (k in v) (reponer[k] as (valor: unknown) => void)(v[k]);
    setBorradoPendiente(null);
    // El registro se escribe en castellano, como el resto de sus líneas
    log('create', 'system', 'deshacer', 'Deshizo un borrado', textoDeBorrados(p.borrados, (k, vars) => translate('es', k, vars)));
    return true;
  }, [borradoPendiente, profileId, log]);

  /* ── Tareas ── */
  const addTask = useCallback((text: string, priority: Task['priority']) => {
    setTasks(prev => [{ id: 'task' + Date.now(), text, priority, done: false }, ...prev]);
  }, []);
  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);
  const deleteTask = useCallback((id: string) => {
    apuntarBorrado({ tipo: 'tarea', nombre: pintadoRef.current.tasks.find(t => t.id === id)?.text });
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [apuntarBorrado]);

  /* ── Clases y alumnos ── */
  const addClass = useCallback((cls: Class) => {
    // El creador queda como dueño de la lista: al compartir con un compañero,
    // su versión será la que mande.
    const owned: Class = {
      ...cls,
      owner: cls.owner ?? profileId ?? undefined,
      owner_name: cls.owner_name ?? profile?.name,
    };
    setClasses(prev => [...prev, owned]);
    log('create', 'class', owned.id, `Clase «${owned.name}»`);
  }, [log, profileId, profile]);
  const updateClass = useCallback((cls: Class) => {
    setClasses(prev => prev.map(c => c.id === cls.id ? cls : c));
    log('update', 'class', cls.id, `Clase «${cls.name}»`);
  }, [log]);

  const deleteClass = useCallback((id: string) => {
    const goneName = className(id);
    const cascadeStudentIds  = students.filter(s => s.class_id === id).map(s => s.id);
    const cascadeItemIds     = gradeItems.filter(i => i.class_id === id).map(i => i.id);

    apuntarBorrado({ tipo: 'clase', nombre: goneName });
    setClasses(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.filter(s => s.class_id !== id));
    setApoyo(prev => sinAcsDeAula(prev, new Set(cascadeStudentIds)));
    setGradeCategories(prev => prev.filter(g => g.class_id !== id));
    setGradeItems(prev => prev.filter(i => i.class_id !== id));
    setEvaluations(prev => prev.filter(e => e.class_id !== id));
    setReports(prev => prev.filter(r => r.class_id !== id));
    setAttendance(prev => { const n = { ...prev }; delete n[id]; return n; });
    setClassMarks(prev => prev.filter(m => m.class_id !== id));
    setMarksConfigs(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(id + '|'))));
    setEf(prev => sinClaseEF(prev, id, cascadeStudentIds));
    if (cascadeItemIds.length) {
      const removed = new Set(cascadeItemIds);
      setGrades(g => {
        const next = { ...g };
        removed.forEach(itemId => delete next[itemId]);
        return next;
      });
    }
    log('delete', 'class', id, `Clase «${goneName}»`,
      cascadeStudentIds.length
        ? `arrastró ${cascadeStudentIds.length} alumnos y todas sus notas`
        : undefined);
  }, [students, gradeItems, log, className, apuntarBorrado]);

  const addStudent = useCallback((s: Student) => {
    // La ficha hereda el dueño de su clase: quien manda en la lista es quien
    // manda en cada alumno de esa lista.
    const owner = mirrorRef.current.classes.find(c => c.id === s.class_id)?.owner
              ?? profileId ?? undefined;
    const owned: Student = { ...s, owner: s.owner ?? owner };
    setStudents(prev => [...prev, owned]);
    log('create', 'student', owned.id, `Alumno ${owned.name} en ${className(owned.class_id)}`);
  }, [log, className, profileId]);
  const updateStudent = useCallback((s: Student) => {
    setStudents(prev => prev.map(x => x.id === s.id ? s : x));
    log('update', 'student', s.id, `Alumno ${s.name}`);
  }, [log]);
  const deleteStudent = useCallback((id: string) => {
    const goneName = studentName(id);
    apuntarBorrado({ tipo: 'alumno', nombre: goneName });
    setStudents(prev => prev.filter(s => s.id !== id));
    setClassMarks(prev => prev.filter(m => m.student_id !== id));
    setEf(prev => sinAlumnoEF(prev, id));
    setApoyo(prev => sinAcsDeAula(prev, new Set([id])));
    // Con el alumno se va todo lo suyo (19-11-2026; antes se quedaban sus notas, evaluaciones, faltas e
    // informes, que seguían contando en las medias y guardados en el perfil sin que nadie los viera)
    setGrades(prev => sinAlumno(prev, id));
    setEvaluations(prev => (prev.some(e => e.student_id === id) ? prev.filter(e => e.student_id !== id) : prev));
    setReports(prev => (prev.some(r => r.student_id === id) ? prev.filter(r => r.student_id !== id) : prev));
    setAttendance(prev => Object.fromEntries(Object.entries(prev).map(([clase, dias]) => [clase, sinAlumno(dias, id)])));
    setDianaProfiles(prev => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n; });
    setSeatingPlans(prev => Object.fromEntries(Object.entries(prev).map(([clase, plan]) => [clase, plan.groups.some(g => g.studentIds.includes(id))
      // El asiento se queda libre (cadena vacía): quitarlo de la lista movería de sitio a sus compañeros de mesa
      ? { ...plan, groups: plan.groups.map(g => ({ ...g, studentIds: g.studentIds.map(x => (x === id ? '' : x)) })) }
      : plan])));
    log('delete', 'student', id, `Alumno ${goneName}`, 'con sus notas, evaluaciones, asistencia e informes');
  }, [log, studentName, apuntarBorrado]);

  /* ── Horario y calendario ── */
  const addBlock       = useCallback((b: ScheduleBlock) => setScheduleBlocks(prev => [...prev, b]), []);
  const updateBlock    = useCallback((b: ScheduleBlock) => setScheduleBlocks(prev => prev.map(x => x.id === b.id ? b : x)), []);
  const deleteBlock    = useCallback((id: string) => {
    apuntarBorrado({ tipo: 'bloque', nombre: pintadoRef.current.blocks.find(b => b.id === id)?.subject });
    setScheduleBlocks(prev => prev.filter(b => b.id !== id));
  }, [apuntarBorrado]);
  /** Sustituye el horario entero: vacío para borrarlo, o el recién escaneado. */
  const replaceBlocks  = useCallback((blocks: ScheduleBlock[]) => {
    if (!blocks.length && pintadoRef.current.blocks.length) apuntarBorrado({ tipo: 'horario' });
    setScheduleBlocks(blocks);
  }, [apuntarBorrado]);
  const addCalEvent    = useCallback((ev: CalEvent) => setCalEvents(prev => [...prev, ev]), []);
  const updateCalEvent = useCallback((ev: CalEvent) => setCalEvents(prev => prev.map(x => x.id === ev.id ? ev : x)), []);
  const deleteCalEvent = useCallback((id: string) => {
    apuntarBorrado({ tipo: 'evento', nombre: pintadoRef.current.events.find(ev => ev.id === id)?.name });
    setCalEvents(prev => prev.filter(ev => ev.id !== id));
  }, [apuntarBorrado]);

  /* ── Rúbricas y dianas ── */
  const addRubric = useCallback((r: Rubric) => {
    setRubrics(prev => [r, ...prev]);
    log('create', 'rubric', r.id, `Rúbrica «${r.name}»`, `${r.criteria.length} criterios`);
  }, [log]);
  const updateRubric = useCallback((r: Rubric) => {
    setRubrics(prev => prev.map(x => x.id === r.id ? r : x));
    log('update', 'rubric', r.id, `Rúbrica «${r.name}»`);
  }, [log]);
  const deleteRubric = useCallback((id: string) => {
    const goneName = rubricName(id);
    apuntarBorrado({ tipo: 'rubrica', nombre: goneName });
    setRubrics(prev => prev.filter(r => r.id !== id));
    log('delete', 'rubric', id, `Rúbrica «${goneName}»`);
  }, [log, rubricName, apuntarBorrado]);

  const addDiana = useCallback((d: EvalDiana) => {
    setDianas(prev => [d, ...prev]);
    log('create', 'diana', d.id, `Diana «${d.name}»`, `${d.items.length} ítems`);
  }, [log]);
  const updateDiana = useCallback((d: EvalDiana) => {
    setDianas(prev => prev.map(x => x.id === d.id ? d : x));
    log('update', 'diana', d.id, `Diana «${d.name}»`);
  }, [log]);
  const deleteDiana = useCallback((id: string) => {
    const goneName = dianaName(id);
    // Una escala de registro se guarda como una diana (`tipo: 'registro'`), pero el docente la conoce por su nombre
    apuntarBorrado({ tipo: mirrorRef.current.dianas.find(d => d.id === id)?.tipo === 'registro' ? 'escala' : 'diana', nombre: goneName });
    setDianas(prev => prev.filter(d => d.id !== id));
    log('delete', 'diana', id, `Diana «${goneName}»`);
  }, [log, dianaName, apuntarBorrado]);

  /**
   * Lleva al cuaderno la nota que sale de evaluar con una rúbrica o una diana.
   *
   * Solo actúa si el instrumento declara clase y categoría. Si no las tiene
   * —los creados antes de esto, o los que se usan solo para el Historial— la
   * evaluación se guarda como siempre y el cuaderno no se toca.
   */
  const routeToNotebook = useCallback((ev: Evaluation) => {
    if (typeof ev.grade !== 'number' || !ev.student_id) return;

    const m = mirrorRef.current;
    const inst = m.rubrics.find(r => r.id === ev.rubric_id)
              ?? m.dianas.find(d => d.id === ev.rubric_id);
    if (!inst) return;
    // Cada clase del instrumento tiene su categoría y su columna; una SdA interdisciplinar, una por área
    const destinos = objetivoPara(inst, ev.class_id)
      ? destinosDe(inst, ev.class_id)
      : ev.class_id ? [] : destinosDe(inst, objetivosDe(inst)[0]?.class_id ?? '');
    for (const destino of destinos) {
      if (!destino.category_id) continue;

      // La categoría pudo borrarse después de crear el instrumento: sin ella la
      // nota no contaría para ninguna media, así que es mejor no escribirla y
      // dejar constancia de por qué.
      if (!m.gradeCategories.some(c => c.id === destino.category_id)) {
        log('update', 'system', inst.id,
          `No se pudo llevar al cuaderno la nota de ${ev.student_name}`,
          `la categoría de «${inst.name}» ya no existe`);
        continue;
      }

      const value = notaDeDestino(inst, destino, ev);
      if (typeof value !== 'number') continue;
      const itemId = destino.id;
      const isNew = !m.gradeItems.some(i => i.id === itemId);

      // El updater comprueba de nuevo la existencia: así evaluar a dos alumnos
      // seguidos no puede duplicar la columna.
      setGradeItems(prev => prev.some(i => i.id === itemId) ? prev : [...prev, {
        id: itemId,
        class_id: destino.class_id,
        category_id: destino.category_id as string,
        name: destino.subject && destinos.length > 1 ? `${inst.name} · ${destino.subject}` : inst.name,
        date: isoDate(),
      }]);

      setGrades(prev => ({ ...prev, [itemId]: { ...(prev[itemId] ?? {}), [ev.student_id]: value } }));

      if (isNew) {
        log('create', 'gradeItem', itemId, `Columna «${inst.name}» en el cuaderno`, 'creada al evaluar');
      }
      log('update', 'grade', `${itemId}:${ev.student_id}`,
        `Nota de ${ev.student_name} en «${inst.name}»`,
        `${formatGrade(value)} · desde la evaluación`);
    }
  }, [log]);

  /**
   * Guarda una evaluación. Con `sustituir`, quita antes la de ese mismo alumno, instrumento, clase y día
   * (19-11-2026): es una corrección, y antes se quedaban las dos y las medias por competencias contaban
   * también la equivocada. Si es una corrección o es otro trabajo evaluado con el mismo instrumento lo
   * decide quien llama (`guardarEvaluacion` en `App.tsx`, que pregunta al docente).
   */
  const addEvaluation = useCallback((ev: Evaluation, opciones: { sustituir?: boolean } = {}) => {
    const corrige = !!opciones.sustituir && mirrorRef.current.evaluations.some(e => mismaEvaluacionDelDia(ev, e));
    setEvaluations(prev => [ev, ...(opciones.sustituir ? prev.filter(e => !mismaEvaluacionDelDia(ev, e)) : prev)]);
    log(corrige ? 'update' : 'create', 'evaluation', ev.id, `Evaluación de ${ev.student_name} con «${ev.rubric_name}»`,
      (typeof ev.grade === 'number' ? `nota ${formatGrade(ev.grade)}` : '') + (corrige ? ' · sustituye a la de ese mismo día' : '') || undefined);
    routeToNotebook(ev);
  }, [log, routeToNotebook]);

  /**
   * Quita una evaluación (19-11-2026: antes no había forma de borrar una equivocada). El cuaderno solo se
   * toca si la borrada era la vigente, es decir, la más reciente con nota de ese alumno con ese instrumento
   * en esa clase: entonces su casilla pasa a la nota de la anterior o, si no hay otra, se queda vacía. Si
   * se borra una más antigua, el cuaderno se deja como está (puede llevar una nota retocada a mano).
   */
  const deleteEvaluation = useCallback((id: string) => {
    const m = mirrorRef.current;
    const ev = m.evaluations.find(e => e.id === id);
    if (!ev) return;
    apuntarBorrado({ tipo: 'evaluacion', nombre: ev.student_name });
    setEvaluations(prev => prev.filter(e => e.id !== id));
    log('delete', 'evaluation', id, `Evaluación de ${ev.student_name} con «${ev.rubric_name}»`,
      typeof ev.grade === 'number' ? `nota ${formatGrade(ev.grade)}` : undefined);
    if (!ev.student_id || typeof ev.grade !== 'number') return;
    // De la más reciente a la más antigua por fecha; a igual fecha, la lista ya va de nueva a antigua
    const conNota = m.evaluations
      .filter(e => e.rubric_id === ev.rubric_id && e.student_id === ev.student_id && e.class_id === ev.class_id && typeof e.grade === 'number')
      .map((e, i) => ({ e, i }))
      .sort((a, b) => b.e.date.localeCompare(a.e.date) || a.i - b.i)
      .map(x => x.e);
    if (conNota[0]?.id !== id) return;
    const anterior = conNota[1];
    if (anterior) { routeToNotebook(anterior); return; }
    const inst = m.rubrics.find(r => r.id === ev.rubric_id) ?? m.dianas.find(d => d.id === ev.rubric_id);
    if (!inst) return;
    const destinos = objetivoPara(inst, ev.class_id)
      ? destinosDe(inst, ev.class_id)
      : ev.class_id ? [] : destinosDe(inst, objetivosDe(inst)[0]?.class_id ?? '');
    const columnas = destinos.map(d => d.id).filter(c => m.grades[c]?.[ev.student_id] !== undefined);
    if (!columnas.length) return;
    setGrades(prev => {
      const next = { ...prev };
      for (const c of columnas) { const fila = { ...(next[c] ?? {}) }; delete fila[ev.student_id]; next[c] = fila; }
      return next;
    });
  }, [log, routeToNotebook, apuntarBorrado]);

  /**
   * Corrige una evaluación ya hecha (20-11-2026): la sustituye en su sitio, con su mismo id, en vez de crear
   * otra. La nota va al cuaderno con la regla de `deleteEvaluation`: solo si la corregida es la vigente (la
   * más reciente con nota de ese alumno con ese instrumento en esa clase, `evaluacionVigente`). Corregir una
   * más antigua no toca el cuaderno, que ya lleva la nota de otra posterior.
   */
  const updateEvaluation = useCallback((ev: Evaluation) => {
    const m = mirrorRef.current;
    const antes = m.evaluations.find(e => e.id === ev.id);
    if (!antes) return;
    setEvaluations(prev => prev.map(e => (e.id === ev.id ? ev : e)));
    log('update', 'evaluation', ev.id, `Evaluación de ${ev.student_name} con «${ev.rubric_name}»`,
      'corregida' + (typeof ev.grade === 'number'
        ? ` · nota ${typeof antes.grade === 'number' && antes.grade !== ev.grade ? `${formatGrade(antes.grade)} → ` : ''}${formatGrade(ev.grade)}`
        : ''));
    const eraVigente = evaluacionVigente(m.evaluations, antes)?.id === antes.id;
    const vigente = evaluacionVigente(m.evaluations.map(e => (e.id === ev.id ? ev : e)), ev);
    if (vigente && (vigente.id === ev.id || eraVigente)) routeToNotebook(vigente);
  }, [log, routeToNotebook]);

  /* ── Cuaderno ── */
  const addGradeCategory = useCallback((c: GradeCategory) => {
    setGradeCategories(prev => [...prev, c]);
    log('create', 'gradeCategory', c.id, `Categoría «${c.name}» en ${className(c.class_id)}`, `peso ${c.weight}%`);
  }, [log, className]);
  const updateGradeCategory = useCallback((c: GradeCategory) => {
    setGradeCategories(prev => prev.map(x => x.id === c.id ? c : x));
    log('update', 'gradeCategory', c.id, `Categoría «${c.name}»`, `peso ${c.weight}%`);
  }, [log]);
  const deleteGradeCategory = useCallback((id: string) => {
    const goneName = gradeCategories.find(c => c.id === id)?.name ?? id;
    const cascadeItemIds = gradeItems.filter(i => i.category_id === id).map(i => i.id);
    apuntarBorrado({ tipo: 'categoria', nombre: gradeCategories.find(c => c.id === id)?.name });
    setGradeCategories(prev => prev.filter(c => c.id !== id));
    setGradeItems(prev => prev.filter(i => i.category_id !== id));
    if (cascadeItemIds.length) {
      const removed = new Set(cascadeItemIds);
      setGrades(g => {
        const next = { ...g };
        removed.forEach(itemId => delete next[itemId]);
        return next;
      });
    }
    log('delete', 'gradeCategory', id, `Categoría «${goneName}»`,
      cascadeItemIds.length ? `arrastró ${cascadeItemIds.length} pruebas y sus notas` : undefined);
  }, [gradeItems, gradeCategories, log, apuntarBorrado]);

  const addGradeItem = useCallback((i: GradeItem) => {
    // Con un id que ya existe (las pruebas físicas de EF usan uno fijo por prueba y clase), la columna se actualiza y no se repite
    // (el nombre y la fecha que ya tenía se respetan: el docente pudo cambiarlos, y la fecha decide en qué evaluación cuenta)
    setGradeItems(prev => (prev.some(x => x.id === i.id) ? prev.map(x => (x.id === i.id ? { ...x, ...i, name: x.name, date: x.date } : x)) : [...prev, i]));
    log('create', 'gradeItem', i.id, `Prueba «${i.name}» en ${className(i.class_id)}`);
  }, [log, className]);
  const updateGradeItem = useCallback((i: GradeItem) => {
    setGradeItems(prev => prev.map(x => x.id === i.id ? i : x));
    log('update', 'gradeItem', i.id, `Prueba «${i.name}»`);
  }, [log]);
  const deleteGradeItem = useCallback((id: string) => {
    const goneName = itemName(id);
    const lost = Object.values(mirrorRef.current.grades[id] ?? {}).filter(v => typeof v === 'number').length;
    apuntarBorrado({ tipo: 'columna', nombre: goneName });
    setGradeItems(prev => prev.filter(i => i.id !== id));
    setGrades(g => { const next = { ...g }; delete next[id]; return next; });
    log('delete', 'gradeItem', id, `Prueba «${goneName}»`, lost ? `arrastró ${lost} notas` : undefined);
  }, [log, itemName, apuntarBorrado]);

  const setGrade = useCallback((itemId: string, studentId: string, value: number | null) => {
    const before = mirrorRef.current.grades[itemId]?.[studentId] ?? null;
    setGrades(prev => ({ ...prev, [itemId]: { ...(prev[itemId] ?? {}), [studentId]: value } }));
    // Sin cambio real no se ensucia el registro (pasa al salir de una celda
    // sin haberla tocado).
    if (before === value) return;
    log('update', 'grade', `${itemId}:${studentId}`,
      `Nota de ${studentName(studentId)} en «${itemName(itemId)}»`,
      `${formatGrade(before)} → ${formatGrade(value)}`);
  }, [log, studentName, itemName]);

  const saveDianaProfile = useCallback((studentId: string, p: DianaProfile) => {
    setDianaProfiles(prev => ({ ...prev, [studentId]: p }));
  }, []);

  /* ── Asistencia ── */
  const setAttendanceFor = useCallback((classId: string, date: string, studentId: string, status: AttendanceStatus | null) => {
    const before = mirrorRef.current.attendance[classId]?.[date]?.[studentId];
    setAttendance(prev => {
      const dia = { ...(prev[classId]?.[date] ?? {}) };
      // `null` quita la marca: volver a pulsar el estado puesto lo deja sin marcar
      if (status) dia[studentId] = status; else delete dia[studentId];
      const clase = { ...(prev[classId] ?? {}) };
      if (Object.keys(dia).length) clase[date] = dia; else delete clase[date];
      return { ...prev, [classId]: clase };
    });
    // Solo se registran las CORRECCIONES. Pasar lista por primera vez es
    // rutina y metería veinticinco líneas por sesión, tapando lo importante.
    if (before && before !== status) {
      log('update', 'attendance', `${classId}:${date}:${studentId}`,
        `Asistencia de ${studentName(studentId)} el ${formatDay(date)}`,
        `${ATT_LABEL[before]} → ${status ? ATT_LABEL[status] : 'sin marcar'}`);
    }
  }, [log, studentName]);

  /** Marca de golpe a toda la clase (para «todos presentes»). */
  const setAttendanceDay = useCallback((classId: string, date: string, map: Record<string, AttendanceStatus>) => {
    const existed = !!mirrorRef.current.attendance[classId]?.[date];
    setAttendance(prev => ({ ...prev, [classId]: { ...(prev[classId] ?? {}), [date]: map } }));
    log(existed ? 'update' : 'create', 'attendance', `${classId}:${date}`,
      `Lista de ${className(classId)} del ${formatDay(date)}`,
      `${Object.keys(map).length} alumnos`);
  }, [log, className]);

  const deleteAttendanceDay = useCallback((classId: string, date: string) => {
    apuntarBorrado({ tipo: 'lista', nombre: className(classId), fecha: date });
    setAttendance(prev => {
      const cls = { ...(prev[classId] ?? {}) };
      delete cls[date];
      return { ...prev, [classId]: cls };
    });
    log('delete', 'attendance', `${classId}:${date}`,
      `Lista de ${className(classId)} del ${formatDay(date)}`);
  }, [log, className, apuntarBorrado]);

  /* ── Informes competenciales ── */
  const addReport = useCallback((r: CompetencyReport) => {
    setReports(prev => [r, ...prev.filter(x => !(x.student_id === r.student_id && x.period === r.period))]);
    log('create', 'report', r.id, `Informe de ${r.student_name}`, r.period);
  }, [log]);
  const updateReport = useCallback((r: CompetencyReport) => {
    setReports(prev => prev.map(x => x.id === r.id ? r : x));
    log('update', 'report', r.id, `Informe de ${r.student_name}`, 'editado a mano');
  }, [log]);
  const deleteReport = useCallback((id: string) => {
    const gone = mirrorRef.current.reports.find(r => r.id === id);
    apuntarBorrado({ tipo: 'informe', nombre: gone?.student_name });
    setReports(prev => prev.filter(r => r.id !== id));
    log('delete', 'report', id, `Informe de ${gone?.student_name ?? 'un alumno'}`, gone?.period);
  }, [log, apuntarBorrado]);

  /* ── Autoevaluaciones de la Sala de alumnos ── */

  /**
   * Guarda lo que respondieron los alumnos. Se llama en cuanto hay
   * respuestas, sin preguntar: antes vivían en la memoria del servidor de la
   * sala y cerrarla las borraba. Si la sesión ya estaba guardada se
   * actualiza, para que ir recibiendo respuestas no cree una copia por cada
   * alumno que contesta.
   */
  const saveSelfAssessment = useCallback((session: SelfAssessmentSession) => {
    let esNueva = false;
    setSelfAssessments(prev => {
      const i = prev.findIndex(s => s.id === session.id);
      if (i < 0) { esNueva = true; return [session, ...prev]; }
      // No se pisa `included`: la decisión del docente manda sobre el volcado
      return prev.map((s, j) => (j === i ? { ...session, included: s.included } : s));
    });
    if (esNueva) {
      log('create', 'evaluation', session.id,
        `Autoevaluación «${session.title}» en ${session.class_name}`,
        `${session.rows.length} alumnos`);
    }
  }, [log]);

  const deleteSelfAssessment = useCallback((id: string) => {
    const gone = mirrorRef.current.selfAssessments.find(s => s.id === id);
    apuntarBorrado({ tipo: 'autoevaluacion', nombre: gone?.title });
    setSelfAssessments(prev => prev.filter(s => s.id !== id));
    log('delete', 'evaluation', id,
      `Autoevaluación «${gone?.title ?? id}»`, 'descartada sin incluirla');
  }, [log, apuntarBorrado]);

  /* ── Situaciones de aprendizaje ── */

  const saveLearningSituation = useCallback((sda: LearningSituation) => {
    let esNueva = false;
    setLearningSituations(prev => {
      const i = prev.findIndex(s => s.id === sda.id);
      if (i < 0) { esNueva = true; return [sda, ...prev]; }
      return prev.map((s, j) => (j === i ? sda : s));
    });
    log(esNueva ? 'create' : 'update', 'learningSituation', sda.id,
      `Situación de aprendizaje «${sda.title}»`,
      sda.class_name ? `para ${sda.class_name}` : undefined);
  }, [log]);

  const deleteLearningSituation = useCallback((id: string) => {
    const gone = mirrorRef.current.learningSituations.find(s => s.id === id);
    apuntarBorrado({ tipo: 'sda', nombre: gone?.title });
    setLearningSituations(prev => prev.filter(s => s.id !== id));
    log('delete', 'learningSituation', id,
      `Situación de aprendizaje «${gone?.title ?? id}»`);
  }, [log, apuntarBorrado]);

  /* ── Recursos: fichas de trabajo ── */

  const saveFicha = useCallback((f: Ficha) => {
    let esNueva = false;
    setFichas(prev => {
      const i = prev.findIndex(x => x.id === f.id);
      if (i < 0) { esNueva = true; return [f, ...prev]; }
      return prev.map((x, j) => (j === i ? f : x));
    });
    log(esNueva ? 'create' : 'update', 'ficha', f.id,
      `Ficha «${f.title}»`, f.class_name ? `para ${f.class_name}` : undefined);
  }, [log]);

  const deleteFicha = useCallback((id: string) => {
    const gone = mirrorRef.current.fichas.find(f => f.id === id);
    apuntarBorrado({ tipo: 'ficha', nombre: gone?.title });
    setFichas(prev => prev.filter(f => f.id !== id));
    log('delete', 'ficha', id, `Ficha «${gone?.title ?? id}»`);
  }, [log, apuntarBorrado]);

  /* ── Reuniones y formaciones ── */

  const saveWorkSession = useCallback((s: WorkSession) => {
    const previa = mirrorRef.current.workSessions.find(x => x.id === s.id);
    setWorkSessions(prev => {
      const i = prev.findIndex(x => x.id === s.id);
      return i < 0 ? [s, ...prev] : prev.map((x, j) => (j === i ? s : x));
    });
    const que = s.kind === 'meeting' ? 'Reunión' : 'Formación';
    // El salto de «sin documento» a «con documento» es el hito que interesa
    // ver en el registro; los retoques posteriores son un cambio más.
    const detalle = !previa?.document && s.document
      ? (s.kind === 'meeting' ? 'acta redactada por la IA' : 'memoria redactada por la IA')
      : undefined;
    log(previa ? 'update' : 'create', 'workSession', s.id, `${que} «${s.title}»`, detalle);
  }, [log]);

  const deleteWorkSession = useCallback((id: string) => {
    const gone = mirrorRef.current.workSessions.find(s => s.id === id);
    apuntarBorrado({ tipo: gone?.kind === 'training' ? 'formacion' : 'reunion', nombre: gone?.title });
    setWorkSessions(prev => prev.filter(s => s.id !== id));
    log('delete', 'workSession', id,
      `${gone?.kind === 'training' ? 'Formación' : 'Reunión'} «${gone?.title ?? id}»`);
  }, [log, apuntarBorrado]);

  /**
   * Distribución de aula: sustituye entera la de una clase. No hay CRUD de
   * ítems sueltos —añadir un alumno a una mesa, rotar los roles, regenerar
   * con la IA— todo pasa por aquí con el objeto ya actualizado, igual que
   * `setAttendanceDay` reemplaza el día entero en vez de alumno a alumno.
   */
  const setSeatingPlan = useCallback((classId: string, plan: SeatingPlan) => {
    const existed = !!mirrorRef.current.seatingPlans[classId];
    setSeatingPlans(prev => ({ ...prev, [classId]: plan }));
    log(existed ? 'update' : 'create', 'seating', classId,
      `Distribución de aula de ${className(classId)}`);
  }, [log, className]);

  /* ── Anotaciones del aula ── */

  const addClassMark = useCallback((m: ClassMark, label: string) => {
    setClassMarks(prev => [...prev, m]);
    log('create', 'classMark', m.id, `${label}: ${studentName(m.student_id)}`, `en ${className(m.class_id)}`);
  }, [log, studentName, className]);

  const deleteClassMark = useCallback((id: string, label: string) => {
    const gone = mirrorRef.current.classMarks.find(m => m.id === id);
    // Quitar una anotación de hoy es corregir un toque (en «Anotar actitud» ya es el botón de deshacer) y se
    // repone con otro toque: sin aviso. La de otro día no se puede volver a poner con su fecha: esa sí lo lleva
    if (gone && gone.date !== isoDate()) apuntarBorrado({ tipo: 'anotacion', nombre: studentName(gone.student_id) });
    setClassMarks(prev => prev.filter(m => m.id !== id));
    if (gone) log('delete', 'classMark', id, `${label}: ${studentName(gone.student_id)}`);
  }, [log, studentName, apuntarBorrado]);

  const setMarksConfig = useCallback((classId: string, subject: string, cfg: MarksBlockConfig) => {
    setMarksConfigs(prev => ({ ...prev, [`${classId}|${subject}`]: cfg }));
    log('update', 'gradeCategory', `${classId}|${subject}`,
      `Bloque «Trabajo diario y actitud» de ${className(classId)}`,
      cfg.enabled === false ? 'no cuenta en la nota' : `${String(Math.round(cfg.points * 100) / 10).replace('.', ',')}% de la nota`);
  }, [log, className]);

  /**
   * Pasa una sesión al Historial como evaluaciones.
   *
   * Se marcan con `rubric_id: 'autoeval'`, así que no escriben en el cuaderno:
   * lo que dice un alumno de sí mismo no es una calificación del docente.
   */
  const includeSelfAssessment = useCallback((id: string) => {
    const session = mirrorRef.current.selfAssessments.find(s => s.id === id);
    if (!session || session.included) return;

    session.rows.forEach(row => {
      addEvaluation({
        id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        rubric_id: 'autoeval',
        rubric_name: `${session.title} (autoevaluación)`,
        student_id: row.student_id ?? '',
        student_name: row.student_name,
        class_id: session.class_id,
        date: session.date,
        scores: row.scores,
        notes: 'Respuesta del propio alumno desde su móvil',
        instrument: 'diana',
        grade: row.grade ?? undefined,
      });
    });

    setSelfAssessments(prev => prev.map(s => (s.id === id ? { ...s, included: true } : s)));
  }, [addEvaluation]);

  /* ── PT y AL y Educación Física ── */

  /**
   * Sus pantallas cambian su parte del perfil con una función, sin un «borrar» por cada cosa. Aquí se mira si el
   * cambio borra algo (`borradoDeApoyo`, `borradoDeEF`) y, si es así, se apunta para poder deshacerlo, igual que
   * los borrados de arriba y sin tocar cada pantalla.
   */
  const cambiarApoyo = useCallback((cambio: SetStateAction<ApoyoData>) => {
    const antes = pintadoRef.current.apoyo;
    const despues = typeof cambio === 'function' ? cambio(antes) : cambio;
    const borrados = borradoDeApoyo(antes, despues, id => pintadoRef.current.students.find(s => s.id === id)?.name);
    if (borrados.length) apuntarBorrado(...borrados);
    setApoyo(cambio);
  }, [apuntarBorrado]);

  const cambiarEf = useCallback((cambio: SetStateAction<EfData>) => {
    const antes = pintadoRef.current.ef;
    const despues = typeof cambio === 'function' ? cambio(antes) : cambio;
    const borrados = borradoDeEF(antes, despues, id => pintadoRef.current.students.find(s => s.id === id)?.name);
    if (borrados.length) apuntarBorrado(...borrados);
    setEf(cambio);
  }, [apuntarBorrado]);

  /* ── Datos que llegan de otro docente (archivo cifrado, ver services/copiaCifrada.ts) ── */

  /** Lo propio con la forma de un paquete: lo que se comparte sale de aquí (ver `buildBundle`). */
  const syncSource = {
    classes, students, gradeCategories, gradeItems, grades, rubrics, dianas, evaluations,
    learningSituations, fichas,
    me: profileId ?? undefined,
  };

  /**
   * Mezcla en los datos propios un paquete que ha enviado otro docente. Nunca
   * borra nada: lo que ya hay se queda, y ante el mismo id manda `modo`.
   * Devuelve cuántas clases, alumnos, evaluaciones, situaciones de aprendizaje y fichas nuevos entran.
   */
  const importarPaquete = useCallback((remote: SharedBundle, modo: MergeMode) => {
    setBorradoPendiente(null);
    const merged = mergeBundle(
      { classes, students, gradeCategories, gradeItems, grades, rubrics, dianas, evaluations, learningSituations, fichas },
      remote, modo,
      // Sin saber quién soy, la fusión no puede distinguir lo propio y el
      // paquete acabaría sobrescribiendo la lista de la que soy dueño.
      profileId ?? undefined,
    );
    // El otro docente puede tener una versión anterior de la aplicación
    setClasses(merged.classes.map(normalizeClass));
    setStudents(merged.students);
    setGradeCategories(merged.gradeCategories);
    setGradeItems(merged.gradeItems);
    setGrades(merged.grades);
    setRubrics(merged.rubrics);
    setDianas(merged.dianas);
    setEvaluations(merged.evaluations);
    setLearningSituations(merged.learningSituations ?? []);
    setFichas(merged.fichas ?? []);

    const nuevas = {
      clases: merged.classes.length - classes.length,
      alumnos: merged.students.length - students.length,
      evaluaciones: merged.evaluations.length - evaluations.length,
      situaciones: (merged.learningSituations ?? []).length - learningSituations.length,
      fichas: (merged.fichas ?? []).length - fichas.length,
    };
    // Una línea por importación, no una por dato
    const cambios = (Object.entries(nuevas) as [string, number][]).filter(([, n]) => n !== 0)
      .map(([k, n]) => `${n > 0 ? '+' : ''}${n} ${k}`);
    log('update', 'sync', modo, 'Importó datos de otro docente', cambios.length ? cambios.join(', ') : 'sin cambios');
    return nuevas;
  }, [classes, students, gradeCategories, gradeItems, grades, rubrics, dianas, evaluations, learningSituations, fichas, log, profileId]);

  /* ── Datos de ejemplo y limpieza ── */
  const loadDemoData = useCallback((lang: Lang = 'es') => {
    const d = demoSnapshot(lang);
    setBorradoPendiente(null);
    setTasks(d.tasks);
    setClasses(d.classes.map(normalizeClass));
    setStudents(d.students);
    setScheduleBlocks(d.blocks);
    setCalEvents(d.events);
    setRubrics(d.rubrics);
    // Lo mismo que «Explorar con datos de ejemplo» (demoSnapshot): sin el
    // bloque, el cuaderno de ejemplo se quedaba al 10% y avisaba de que los
    // pesos no suman 100; sin las evaluaciones, Evaluar salía vacío.
    setDianas(d.dianas);
    setEvaluations(d.evaluations);
    setDianaProfiles(d.dianaProfiles);
    setGradeCategories(d.gradeCategories);
    setGradeItems(d.gradeItems);
    setGrades(d.grades);
    setClassMarks(d.classMarks);
    setMarksConfigs(d.marksConfigs);
  }, []);

  /** Copia de seguridad descargable como archivo. */
  const exportData = useCallback(() => ({
    _app: 'AulaPro', _version: 2, _date: new Date().toISOString(),
    _profile: profile ? { name: profile.name, school: profile.school, subject: profile.subject, course: profile.course } : null,
    data: snapshot,
  }), [snapshot, profile]);

  /**
   * Carga una copia descargada (sustituye todo el trabajo del perfil). La lee y valida `leerCopiaDeDatos` (una copia
   * dañada o vacía no se carga) y, antes de cargarla, lo de ahora se guarda en una copia «antes-de-cargar», que va
   * también al Drive u OneDrive (auditoría del 1-11-2026: antes no quedaba nada de lo anterior). La confirmación la pide
   * la pantalla (`pages/Profile.tsx`).
   */
  const importData = useCallback(async (raw: string): Promise<string | null> => {
    const copia = leerCopiaDeDatos(raw);
    if (!copia.ok) return copia.error;
    if (profileId) await store.backup(profileId, 'antes-de-cargar').catch(() => null);
    hydrate(copia.datos as Partial<ProfileSnapshot>);
    return null;
  }, [hydrate, profileId]);

  /**
   * Vaciado de fin de curso: se borra el trabajo del año (clases, alumnos,
   * notas, evaluaciones, asistencia e informes) y se conservan las rúbricas y
   * dianas, que sirven para el curso siguiente.
   *
   * Las reuniones y formaciones tampoco se tocan: las formaciones son el
   * historial de méritos del docente —se justifican años después— y las actas
   * de reunión son documentos del centro, no material de aula. Se borran una a
   * una desde su propia pantalla si sobran.
   */
  const clearSchoolYear = useCallback(async () => {
    if (profileId) await store.backup(profileId, 'antes-de-vaciar');
    // Vaciar el curso no se deshace con el aviso (tiene su copia «antes-de-vaciar»), y se lleva el que hubiera
    setBorradoPendiente(null);
    setTasks([]);
    setClasses([]);
    setStudents([]);
    setScheduleBlocks([]);
    setCalEvents([]);
    setEvaluations([]);
    setGradeCategories([]);
    setGradeItems([]);
    setGrades({});
    setDianaProfiles({});
    setAttendance({});
    setReports([]);
    setSelfAssessments([]);
    // Referencia alumnos y mesas concretas de este curso: sin ellos ya no
    // significa nada, a diferencia de rúbricas y dianas, que son plantillas
    // reutilizables sin datos de alumnado incrustados.
    setSeatingPlans({});
    setClassMarks([]);
    setMarksConfigs({});
    // El alumnado de apoyo sigue con el especialista: se queda con sus programas y agendas;
    // se van los registros, las coordinaciones, los cierres y los documentos del curso
    setApoyo(apoyoParaOtroCurso);
    // De EF se queda el material del docente: pruebas, baremos, actividades…
    setEf(efParaOtroCurso);
    // El registro del curso viejo se va con él (queda en la copia que se acaba
    // de hacer), pero dejamos constancia de que el vaciado ocurrió.
    setAuditLog([newEntry(whoRef.current, 'delete', 'system', 'year',
      'Vaciado de fin de curso', 'se conservan rúbricas y dianas')]);
  }, [profileId]);

  // Todas las pantallas reciben el alumnado en orden de lista (ver `lib/alumnado.ts`);
  // lo guardado sigue en el orden en que se dio de alta.
  const alumnadoEnOrden = useMemo(() => ordenarAlumnado(students), [students]);

  return {
    ready, saving, errorGuardado, loadError, profile, currentUser, profileId,
    openProfile, createAndOpenProfile, logout, updateUser,

    tasks, classes, students: alumnadoEnOrden,
    scheduleBlocks, calEvents,
    rubrics, dianas, evaluations,
    gradeCategories, gradeItems, grades,
    attendance, reports,
    lawDocument, setLawDocument,
    chat, setChat,

    addTask, toggleTask, deleteTask,
    addClass, updateClass, deleteClass,
    addStudent, updateStudent, deleteStudent,
    addBlock, updateBlock, deleteBlock, replaceBlocks,
    addCalEvent, updateCalEvent, deleteCalEvent,
    addRubric, updateRubric, deleteRubric,
    addDiana, updateDiana, deleteDiana,
    addEvaluation, updateEvaluation, deleteEvaluation,
    addGradeCategory, updateGradeCategory, deleteGradeCategory,
    addGradeItem, updateGradeItem, deleteGradeItem,
    setGrade,
    dianaProfiles, saveDianaProfile,
    setAttendanceFor, setAttendanceDay, deleteAttendanceDay,
    addReport, updateReport, deleteReport,
    selfAssessments, saveSelfAssessment, deleteSelfAssessment, includeSelfAssessment,
    learningSituations, saveLearningSituation, deleteLearningSituation,
    fichas, saveFicha, deleteFicha,
    workSessions, saveWorkSession, deleteWorkSession,
    seatingPlans, setSeatingPlan,
    classMarks, addClassMark, deleteClassMark,
    marksConfigs, setMarksConfig,
    apoyo, setApoyo: cambiarApoyo,
    ef, setEf: cambiarEf,
    borradoPendiente: borradoPendiente?.despues ? borradoPendiente : null, deshacerBorrado, olvidarBorrado,
    syncSource, importarPaquete,
    auditLog, clearAuditLog,
    loadDemoData, exportData, importData, clearSchoolYear,
  };
}
