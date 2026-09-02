import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Class, Student, ScheduleBlock, CalEvent, Task, Rubric, Evaluation,
  GradeCategory, GradeItem, GradeMap, DianaProfile, EvalDiana,
  AttendanceMap, AttendanceStatus, CompetencyReport, SelfAssessmentSession,
  LearningSituation, Ficha, WorkSession,
} from '../types';
import { normalizeClass, gradeItemIdFor } from '../types';
import { isoDate } from '../lib/utils';
import { buildDemoData } from '../lib/demoData';
import { mergeBundle, EMPTY_SCOPE, emptyTombstones, type SharedBundle, type ShareScope, type MergeMode, type Tombstones } from '../services/sync';
import type { ChatMessage } from '../services/aiContext';
import * as store from '../services/storage';
import type { TeacherProfile } from '../services/storage';
import {
  pushEntry, newEntry, formatGrade, formatDay,
  type AuditEntry, type AuditAction, type AuditEntity,
} from '../services/audit';

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
  tombstones: Tombstones;
  shareScope: ShareScope;
  auditLog: AuditEntry[];
}

function emptySnapshot(): ProfileSnapshot {
  return {
    tasks: [], classes: [], students: [], blocks: [], events: [],
    rubrics: [], dianas: [], evaluations: [],
    gradeCategories: [], gradeItems: [], grades: {},
    dianaProfiles: {}, attendance: {}, reports: [], selfAssessments: [], learningSituations: [],
    fichas: [], workSessions: [],
    tombstones: emptyTombstones(), shareScope: EMPTY_SCOPE, auditLog: [],
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

export function useAppState() {
  const [profileId, setProfileId] = useState<string | null>(() => store.getActiveProfileId());
  const [profile, setProfile]     = useState<TeacherProfile | null>(null);
  const [ready, setReady]         = useState(false);

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
  const [tombstones, setTombstones]           = useState<Tombstones>(emptyTombstones());
  const [shareScope, setShareScope]           = useState<ShareScope>(EMPTY_SCOPE);
  const [auditLog, setAuditLog]               = useState<AuditEntry[]>([]);

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
    setTombstones(s.tombstones);
    setShareScope(s.shareScope);
    setAuditLog(s.auditLog);
    // La conversación con el asistente habla de los alumnos del perfil que se
    // acaba de dejar atrás: no puede seguir abierta en el siguiente.
    setChat([]);
  }, []);

  /* ── Carga al entrar en un perfil ── */
  useEffect(() => {
    let cancelled = false;
    if (!profileId) { setProfile(null); hydrate({}); setReady(true); return; }

    setReady(false);
    (async () => {
      const [list, data] = await Promise.all([store.listProfiles(), store.loadData(profileId)]);
      if (cancelled) return;

      const found = list.find(p => p.id === profileId) ?? null;
      if (!found) {
        // El perfil ya no existe (borrado desde otro sitio)
        store.setActiveProfileId(null);
        setProfileId(null);
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
    workSessions, tombstones, shareScope, auditLog,
  }), [tasks, classes, students, scheduleBlocks, calEvents, rubrics, dianas,
      evaluations, gradeCategories, gradeItems, grades, dianaProfiles,
      attendance, reports, selfAssessments, learningSituations, fichas,
      workSessions, tombstones, shareScope, auditLog]);

  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef('');

  useEffect(() => {
    if (!ready || !profileId) return;

    // Serializar es lo caro de todo esto: recorre el curso entero. Va DENTRO
    // del temporizador a propósito, para que se pague una vez por pausa de
    // escritura y no en cada tecla; hacerlo fuera ponía todo el cuaderno en el
    // camino de cada pulsación y se notaba al escribir.
    const timer = setTimeout(async () => {
      const json = JSON.stringify(snapshot);
      if (json === lastSavedRef.current) return;
      setSaving(true);
      await store.saveData(profileId, snapshot as unknown as store.ProfileData);
      lastSavedRef.current = json;
      setSaving(false);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot, ready, profileId]);

  /* ── Copia de seguridad automática ── */
  useEffect(() => {
    if (!ready || !profileId) return;
    const id = setInterval(() => { store.backup(profileId); }, BACKUP_EVERY_MS);
    return () => clearInterval(id);
  }, [ready, profileId]);

  /* ── Perfiles ── */
  const openProfile = useCallback((id: string) => {
    store.setActiveProfileId(id);
    setProfileId(id);
  }, []);

  const createAndOpenProfile = useCallback(async (
    input: { name: string; school: string; subject: string; course: string },
    options: { importLegacy?: boolean } = {},
  ) => {
    const created = await store.createProfile(input);
    if (options.importLegacy) {
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
  }, [profileId]);

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
  } : null), [profile]);

  /* ── Lápidas para que los borrados se propaguen ── */
  const markDeleted = useCallback((patch: Partial<Tombstones>) => {
    setTombstones(prev => {
      const next = { ...prev };
      (Object.keys(patch) as (keyof Tombstones)[]).forEach(key => {
        const ids = patch[key];
        if (!ids || ids.length === 0) return;
        next[key] = [...new Set([...prev[key], ...ids])];
      });
      return next;
    });
  }, []);

  /* ── Registro de cambios ── */

  /**
   * Espejo del estado. Permite poner nombres legibles y el valor anterior en
   * cada línea del registro sin que las mutaciones dependan de medio hook: si
   * `setGrade` dependiera de `grades`, se recrearía en cada tecla.
   */
  const mirrorRef = useRef({ students, gradeItems, gradeCategories, classes, grades, attendance, rubrics, dianas, reports, selfAssessments, learningSituations, fichas, workSessions });
  useEffect(() => {
    mirrorRef.current = { students, gradeItems, gradeCategories, classes, grades, attendance, rubrics, dianas, reports, selfAssessments, learningSituations, fichas, workSessions };
  }, [students, gradeItems, gradeCategories, classes, grades, attendance, rubrics, dianas, reports, selfAssessments, learningSituations, fichas, workSessions]);

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

  /* ── Tareas ── */
  const addTask = useCallback((text: string, priority: Task['priority']) => {
    setTasks(prev => [{ id: 'task' + Date.now(), text, priority, done: false }, ...prev]);
  }, []);
  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);
  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

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
    const cascadeCategoryIds = gradeCategories.filter(c => c.class_id === id).map(c => c.id);
    const cascadeItemIds     = gradeItems.filter(i => i.class_id === id).map(i => i.id);
    const cascadeEvalIds     = evaluations.filter(e => e.class_id === id).map(e => e.id);

    setClasses(prev => prev.filter(c => c.id !== id));
    setStudents(prev => prev.filter(s => s.class_id !== id));
    setGradeCategories(prev => prev.filter(g => g.class_id !== id));
    setGradeItems(prev => prev.filter(i => i.class_id !== id));
    setEvaluations(prev => prev.filter(e => e.class_id !== id));
    setReports(prev => prev.filter(r => r.class_id !== id));
    setAttendance(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (cascadeItemIds.length) {
      const removed = new Set(cascadeItemIds);
      setGrades(g => {
        const next = { ...g };
        removed.forEach(itemId => delete next[itemId]);
        return next;
      });
    }
    markDeleted({
      classes: [id], students: cascadeStudentIds,
      gradeCategories: cascadeCategoryIds, gradeItems: cascadeItemIds,
      evaluations: cascadeEvalIds,
    });
    log('delete', 'class', id, `Clase «${goneName}»`,
      cascadeStudentIds.length
        ? `arrastró ${cascadeStudentIds.length} alumnos y todas sus notas`
        : undefined);
  }, [students, gradeCategories, gradeItems, evaluations, markDeleted, log, className]);

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
    setStudents(prev => prev.filter(s => s.id !== id));
    markDeleted({ students: [id] });
    log('delete', 'student', id, `Alumno ${goneName}`);
  }, [markDeleted, log, studentName]);

  /* ── Horario y calendario ── */
  const addBlock       = useCallback((b: ScheduleBlock) => setScheduleBlocks(prev => [...prev, b]), []);
  const updateBlock    = useCallback((b: ScheduleBlock) => setScheduleBlocks(prev => prev.map(x => x.id === b.id ? b : x)), []);
  const deleteBlock    = useCallback((id: string) => setScheduleBlocks(prev => prev.filter(b => b.id !== id)), []);
  const addCalEvent    = useCallback((ev: CalEvent) => setCalEvents(prev => [...prev, ev]), []);
  const updateCalEvent = useCallback((ev: CalEvent) => setCalEvents(prev => prev.map(x => x.id === ev.id ? ev : x)), []);
  const deleteCalEvent = useCallback((id: string) => setCalEvents(prev => prev.filter(ev => ev.id !== id)), []);

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
    setRubrics(prev => prev.filter(r => r.id !== id));
    markDeleted({ rubrics: [id] });
    log('delete', 'rubric', id, `Rúbrica «${goneName}»`);
  }, [markDeleted, log, rubricName]);

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
    setDianas(prev => prev.filter(d => d.id !== id));
    markDeleted({ dianas: [id] });
    log('delete', 'diana', id, `Diana «${goneName}»`);
  }, [markDeleted, log, dianaName]);

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
    if (!inst?.class_id || !inst.category_id) return;

    // La categoría pudo borrarse después de crear el instrumento: sin ella la
    // nota no contaría para ninguna media, así que es mejor no escribirla y
    // dejar constancia de por qué.
    if (!m.gradeCategories.some(c => c.id === inst.category_id)) {
      log('update', 'system', inst.id,
        `No se pudo llevar al cuaderno la nota de ${ev.student_name}`,
        `la categoría de «${inst.name}» ya no existe`);
      return;
    }

    const itemId = gradeItemIdFor(inst.id);
    const isNew = !m.gradeItems.some(i => i.id === itemId);

    // El updater comprueba de nuevo la existencia: así evaluar a dos alumnos
    // seguidos no puede duplicar la columna.
    setGradeItems(prev => prev.some(i => i.id === itemId) ? prev : [...prev, {
      id: itemId,
      class_id: inst.class_id as string,
      category_id: inst.category_id as string,
      name: inst.name,
      date: isoDate(),
    }]);

    const value = ev.grade;
    setGrades(prev => ({ ...prev, [itemId]: { ...(prev[itemId] ?? {}), [ev.student_id]: value } }));

    if (isNew) {
      log('create', 'gradeItem', itemId, `Columna «${inst.name}» en el cuaderno`, 'creada al evaluar');
    }
    log('update', 'grade', `${itemId}:${ev.student_id}`,
      `Nota de ${ev.student_name} en «${inst.name}»`,
      `${formatGrade(value)} · desde la evaluación`);
  }, [log]);

  const addEvaluation = useCallback((ev: Evaluation) => {
    setEvaluations(prev => [ev, ...prev]);
    log('create', 'evaluation', ev.id, `Evaluación de ${ev.student_name} con «${ev.rubric_name}»`,
      typeof ev.grade === 'number' ? `nota ${formatGrade(ev.grade)}` : undefined);
    routeToNotebook(ev);
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
    markDeleted({ gradeCategories: [id], gradeItems: cascadeItemIds });
    log('delete', 'gradeCategory', id, `Categoría «${goneName}»`,
      cascadeItemIds.length ? `arrastró ${cascadeItemIds.length} pruebas y sus notas` : undefined);
  }, [gradeItems, gradeCategories, markDeleted, log]);

  const addGradeItem = useCallback((i: GradeItem) => {
    setGradeItems(prev => [...prev, i]);
    log('create', 'gradeItem', i.id, `Prueba «${i.name}» en ${className(i.class_id)}`);
  }, [log, className]);
  const updateGradeItem = useCallback((i: GradeItem) => {
    setGradeItems(prev => prev.map(x => x.id === i.id ? i : x));
    log('update', 'gradeItem', i.id, `Prueba «${i.name}»`);
  }, [log]);
  const deleteGradeItem = useCallback((id: string) => {
    const goneName = itemName(id);
    const lost = Object.values(mirrorRef.current.grades[id] ?? {}).filter(v => typeof v === 'number').length;
    setGradeItems(prev => prev.filter(i => i.id !== id));
    setGrades(g => { const next = { ...g }; delete next[id]; return next; });
    markDeleted({ gradeItems: [id] });
    log('delete', 'gradeItem', id, `Prueba «${goneName}»`, lost ? `arrastró ${lost} notas` : undefined);
  }, [markDeleted, log, itemName]);

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
  const setAttendanceFor = useCallback((classId: string, date: string, studentId: string, status: AttendanceStatus) => {
    const before = mirrorRef.current.attendance[classId]?.[date]?.[studentId];
    setAttendance(prev => ({
      ...prev,
      [classId]: {
        ...(prev[classId] ?? {}),
        [date]: { ...(prev[classId]?.[date] ?? {}), [studentId]: status },
      },
    }));
    // Solo se registran las CORRECCIONES. Pasar lista por primera vez es
    // rutina y metería veinticinco líneas por sesión, tapando lo importante.
    if (before && before !== status) {
      log('update', 'attendance', `${classId}:${date}:${studentId}`,
        `Asistencia de ${studentName(studentId)} el ${formatDay(date)}`,
        `${ATT_LABEL[before]} → ${ATT_LABEL[status]}`);
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
    setAttendance(prev => {
      const cls = { ...(prev[classId] ?? {}) };
      delete cls[date];
      return { ...prev, [classId]: cls };
    });
    log('delete', 'attendance', `${classId}:${date}`,
      `Lista de ${className(classId)} del ${formatDay(date)}`);
  }, [log, className]);

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
    setReports(prev => prev.filter(r => r.id !== id));
    log('delete', 'report', id, `Informe de ${gone?.student_name ?? 'un alumno'}`, gone?.period);
  }, [log]);

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
    setSelfAssessments(prev => prev.filter(s => s.id !== id));
    log('delete', 'evaluation', id,
      `Autoevaluación «${gone?.title ?? id}»`, 'descartada sin incluirla');
  }, [log]);

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
    setLearningSituations(prev => prev.filter(s => s.id !== id));
    log('delete', 'learningSituation', id,
      `Situación de aprendizaje «${gone?.title ?? id}»`);
  }, [log]);

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
    setFichas(prev => prev.filter(f => f.id !== id));
    log('delete', 'ficha', id, `Ficha «${gone?.title ?? id}»`);
  }, [log]);

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
    setWorkSessions(prev => prev.filter(s => s.id !== id));
    log('delete', 'workSession', id,
      `${gone?.kind === 'training' ? 'Formación' : 'Reunión'} «${gone?.title ?? id}»`);
  }, [log]);

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

  /* ── Sincronización entre docentes ── */
  const syncSource = {
    classes, students, gradeCategories, gradeItems, grades, rubrics, dianas, evaluations, tombstones,
    me: profileId ?? undefined,
  };

  const applyBundle = useCallback((remote: SharedBundle, mode: MergeMode) => {
    const merged = mergeBundle(
      { classes, students, gradeCategories, gradeItems, grades, rubrics, dianas, evaluations, tombstones },
      remote, mode,
      // Sin saber quién soy, la fusión no puede distinguir lo propio y el
      // compañero acabaría sobrescribiendo la lista de la que soy dueño.
      profileId ?? undefined,
    );
    // El compañero puede tener una versión anterior de la aplicación
    setClasses(merged.classes.map(normalizeClass));
    setStudents(merged.students);
    setGradeCategories(merged.gradeCategories);
    setGradeItems(merged.gradeItems);
    setGrades(merged.grades);
    setRubrics(merged.rubrics);
    setDianas(merged.dianas);
    setEvaluations(merged.evaluations);
    setTombstones(merged.tombstones);

    // Una línea por fusión, no una por dato: si no, una sesión compartida
    // sepultaría el resto del registro.
    const delta = (a: number, b: number) => b - a;
    const changes = [
      ['alumnos', delta(students.length, merged.students.length)],
      ['clases', delta(classes.length, merged.classes.length)],
      ['evaluaciones', delta(evaluations.length, merged.evaluations.length)],
    ].filter(([, n]) => (n as number) !== 0)
     .map(([k, n]) => `${(n as number) > 0 ? '+' : ''}${n} ${k}`);
    log('update', 'sync', mode,
      mode === 'reconcile' ? 'Conectó con otro docente' : 'Recibió un cambio de otro docente',
      changes.length ? changes.join(', ') : 'sin cambios');
  }, [classes, students, gradeCategories, gradeItems, grades, rubrics, dianas, evaluations, tombstones, log, profileId]);

  /* ── Datos de ejemplo y limpieza ── */
  const loadDemoData = useCallback(() => {
    const d = buildDemoData();
    setTasks(d.tasks);
    setClasses(d.classes.map(normalizeClass));
    setStudents(d.students);
    setScheduleBlocks(d.scheduleBlocks);
    setCalEvents(d.calEvents);
    setRubrics(d.rubrics);
    setGradeCategories(d.gradeCategories);
    setGradeItems(d.gradeItems);
    setGrades(d.grades);
  }, []);

  /** Copia de seguridad descargable como archivo. */
  const exportData = useCallback(() => ({
    _app: 'AulaPro', _version: 2, _date: new Date().toISOString(),
    _profile: profile ? { name: profile.name, school: profile.school, subject: profile.subject, course: profile.course } : null,
    data: snapshot,
  }), [snapshot, profile]);

  const importData = useCallback((raw: string): string | null => {
    let parsed: { _app?: string; data?: unknown } & Record<string, unknown>;
    try { parsed = JSON.parse(raw); } catch { return 'El archivo no es una copia de seguridad válida.'; }
    if (parsed._app !== 'AulaPro') return 'El archivo no parece una copia de seguridad de Aula Pro.';

    // La versión 2 anida los datos; la 1 los tenía sueltos con otros nombres
    if (parsed.data) {
      hydrate(parsed.data as Partial<ProfileSnapshot>);
    } else {
      hydrate({
        tasks: parsed.tasks as Task[], classes: parsed.classes as Class[],
        students: parsed.students as Student[], blocks: parsed.blocks as ScheduleBlock[],
        events: parsed.events as CalEvent[], rubrics: parsed.rubrics as Rubric[],
        dianas: parsed.dianas as EvalDiana[], evaluations: parsed.evaluations as Evaluation[],
        gradeCategories: parsed.grade_categories as GradeCategory[],
        gradeItems: parsed.grade_items as GradeItem[], grades: parsed.grades as GradeMap,
        dianaProfiles: parsed.diana_profiles as Record<string, DianaProfile>,
      });
    }
    return null;
  }, [hydrate]);

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
    if (profileId) await store.backup(profileId);
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
    setTombstones(emptyTombstones());
    setShareScope(EMPTY_SCOPE);
    // El registro del curso viejo se va con él (queda en la copia que se acaba
    // de hacer), pero dejamos constancia de que el vaciado ocurrió.
    setAuditLog([newEntry(whoRef.current, 'delete', 'system', 'year',
      'Vaciado de fin de curso', 'se conservan rúbricas y dianas')]);
  }, [profileId]);

  return {
    ready, saving, profile, currentUser, profileId,
    openProfile, createAndOpenProfile, logout, updateUser,

    tasks, classes, students,
    scheduleBlocks, calEvents,
    rubrics, dianas, evaluations,
    gradeCategories, gradeItems, grades,
    attendance, reports,
    lawDocument, setLawDocument,
    chat, setChat,

    addTask, toggleTask, deleteTask,
    addClass, updateClass, deleteClass,
    addStudent, updateStudent, deleteStudent,
    addBlock, updateBlock, deleteBlock,
    addCalEvent, updateCalEvent, deleteCalEvent,
    addRubric, updateRubric, deleteRubric,
    addDiana, updateDiana, deleteDiana,
    addEvaluation,
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
    shareScope, setShareScope, syncSource, applyBundle,
    auditLog, clearAuditLog,
    loadDemoData, exportData, importData, clearSchoolYear,
  };
}
