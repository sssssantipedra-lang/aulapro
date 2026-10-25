import type { Class, Student, GradeCategory, GradeItem, GradeMap, Rubric, EvalDiana, Evaluation } from '../types';

/**
 * El paquete que un docente comparte con otro (ver `docs/COMPARTIR.md`).
 *
 * Desde el 25-10-2026 no hay conexión entre equipos: el paquete se guarda en
 * un archivo cifrado con contraseña (`copiaCifrada.ts`), se lo lleva quien lo
 * quiera enviar y el otro docente lo abre, ve qué trae y decide si lo importa.
 * Aquí viven dos cosas: qué entra en el paquete y cómo se mezcla al importarlo.
 */

/**
 * Qué datos comparte el docente. Solo viaja lo que se marca aquí:
 * nunca el perfil, nunca la clave de la IA.
 */
export interface ShareScope {
  classIds: string[];
  grades: boolean;
  rubrics: boolean;
  evaluations: boolean;
  /**
   * Lo que se deja fuera dentro de las clases elegidas (25-10-2026, petición del
   * dueño: «poder elegir qué exactamente se quiere enviar»). Por defecto no se
   * deja nada fuera, y lo que se cree después entra solo: se guarda lo que
   * SE QUITA, no lo que se marca.
   */
  sinAlumnos?: string[];
  /** Columnas del cuaderno (ids de `GradeItem`). */
  sinColumnas?: string[];
  /** Rúbricas, dianas y escalas de registro. */
  sinInstrumentos?: string[];
  /** Ids de rúbrica o diana cuyas evaluaciones no van. */
  sinEvaluacionesDe?: string[];
}

export const EMPTY_SCOPE: ShareScope = { classIds: [], grades: true, rubrics: true, evaluations: true };

export interface SharedBundle {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  rubrics: Rubric[];
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  /** Perfil que envía este paquete. Permite saber qué es suyo al fusionar. */
  from?: string;
}

export interface SyncSource {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  rubrics: Rubric[];
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  /** Id del perfil de quien comparte. */
  me?: string;
}

export function emptyBundle(): SharedBundle {
  return {
    classes: [], students: [], gradeCategories: [], gradeItems: [],
    grades: {}, rubrics: [], dianas: [], evaluations: [],
  };
}

/** ¿El instrumento se usa en alguna de estas clases? (la principal o las otras en las que se comparte) */
export function usadoEn(t: { class_id?: string; otras_clases?: { class_id: string }[] }, ids: Set<string>): boolean {
  if (t.class_id && ids.has(t.class_id)) return true;
  return (t.otras_clases ?? []).some(o => ids.has(o.class_id));
}

/** Extrae del estado solo lo que el docente ha elegido compartir. */
export function buildBundle(src: SyncSource, scope: ShareScope): SharedBundle {
  const ids = new Set(scope.classIds);
  const sinAlumnos = new Set(scope.sinAlumnos ?? []);
  const sinColumnas = new Set(scope.sinColumnas ?? []);
  const sinInstrumentos = new Set(scope.sinInstrumentos ?? []);
  const sinEvaluacionesDe = new Set(scope.sinEvaluacionesDe ?? []);

  const classes = src.classes.filter(c => ids.has(c.id));
  const students = src.students.filter(s => ids.has(s.class_id) && !sinAlumnos.has(s.id));
  const alumnosQueVan = new Set(students.map(s => s.id));

  const gradeItems = scope.grades ? src.gradeItems.filter(i => ids.has(i.class_id) && !sinColumnas.has(i.id)) : [];
  // Una categoría va si alguna de sus columnas va, o si nunca tuvo ninguna (solo es estructura)
  const categoriasConColumnas = new Set(src.gradeItems.map(i => i.category_id));
  const categoriasQueVan = new Set(gradeItems.map(i => i.category_id));
  const gradeCategories = scope.grades
    ? src.gradeCategories.filter(c => ids.has(c.class_id) && (categoriasQueVan.has(c.id) || !categoriasConColumnas.has(c.id)))
    : [];

  const grades: GradeMap = {};
  if (scope.grades) {
    const itemIds = new Set(gradeItems.map(i => i.id));
    for (const [itemId, row] of Object.entries(src.grades)) {
      if (!itemIds.has(itemId)) continue;
      // Sin las notas del alumnado que se deja fuera
      grades[itemId] = Object.fromEntries(Object.entries(row).filter(([studentId]) => alumnosQueVan.has(studentId)));
    }
  }

  return {
    classes,
    students,
    gradeCategories,
    gradeItems,
    grades,
    // Solo las rúbricas y dianas que se usan en las clases elegidas: antes iban
    // todas, y con ellas la biblioteca entera del docente.
    rubrics: scope.rubrics ? src.rubrics.filter(r => usadoEn(r, ids) && !sinInstrumentos.has(r.id)) : [],
    dianas:  scope.rubrics ? src.dianas.filter(d => usadoEn(d, ids) && !sinInstrumentos.has(d.id)) : [],
    evaluations: scope.evaluations
      ? src.evaluations.filter(e => ids.has(e.class_id) && !sinAlumnos.has(e.student_id) && !sinEvaluacionesDe.has(e.rubric_id))
      : [],
    from: src.me,
  };
}

/**
 * Las evaluaciones de las clases elegidas, juntas por instrumento (una línea por
 * rúbrica o diana, con cuántas son), para que el docente elija de cuáles manda.
 */
export function gruposDeEvaluaciones(evaluaciones: Evaluation[], classIds: string[]): { id: string; nombre: string; n: number }[] {
  const ids = new Set(classIds);
  const grupos = new Map<string, { id: string; nombre: string; n: number }>();
  for (const e of evaluaciones) {
    if (!ids.has(e.class_id)) continue;
    const g = grupos.get(e.rubric_id);
    if (g) g.n += 1;
    else grupos.set(e.rubric_id, { id: e.rubric_id, nombre: e.rubric_id === 'autoeval' ? 'Autoevaluaciones' : e.rubric_name, n: 1 });
  }
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Cómo se mezcla lo que llega con lo que ya hay:
 * - `conservar`: ante un mismo id se queda lo mío. Nadie pierde su trabajo.
 * - `actualizar`: ante un mismo id se queda lo que llega.
 * En los dos casos lo que solo está en un lado se añade, y nunca se borra nada.
 */
export type MergeMode = 'conservar' | 'actualizar';

function mergeById<T extends { id: string }>(local: T[], remote: T[], remoteWins: boolean): T[] {
  const out = new Map<string, T>();
  local.forEach(x => out.set(x.id, x));
  remote.forEach(x => {
    if (!out.has(x.id) || remoteWins) out.set(x.id, x);
  });
  return [...out.values()];
}

/**
 * Une listas cuyos elementos tienen dueño: la lista de alumnos y las clases.
 *
 * El dueño manda sobre lo suyo **en cualquier modo**: si eres el tutor, tu
 * lista de alumnos es la buena aunque importes un paquete del especialista; y
 * si un compañero te manda su clase, sus cambios entran sin que los tuyos la
 * sobrescriban. Lo que no tiene dueño se comporta según el modo.
 */
function mergeOwned<T extends { id: string; owner?: string }>(
  local: T[], remote: T[], remoteWins: boolean,
  me: string | undefined, peer: string | undefined,
): T[] {
  const out = new Map<string, T>();
  local.forEach(x => out.set(x.id, x));

  remote.forEach(x => {
    const mine = out.get(x.id);
    if (!mine) { out.set(x.id, x); return; }

    // Si las dos copias declaran dueño y no coinciden, vale la del propio dato
    const owner = mine.owner ?? x.owner;
    if (owner && me && owner === me) return;                 // es mío: no se toca
    if (owner && peer && owner === peer) { out.set(x.id, x); return; }  // es suyo: manda él
    if (remoteWins) out.set(x.id, x);                        // sin dueño: manda el modo
  });

  return [...out.values()];
}

function mergeGrades(local: GradeMap, remote: GradeMap, remoteWins: boolean): GradeMap {
  const out: GradeMap = {};
  for (const [itemId, row] of Object.entries(local)) out[itemId] = { ...row };
  for (const [itemId, row] of Object.entries(remote)) {
    const target = out[itemId] ?? (out[itemId] = {});
    for (const [studentId, value] of Object.entries(row)) {
      // La clave debe existir localmente (aunque su valor sea null, es decir,
      // una nota borrada a propósito) para que no la resucite el paquete.
      const hasLocal = studentId in target;
      if (!hasLocal || remoteWins) target[studentId] = value;
    }
  }
  return out;
}

/** El estado propio, con la misma forma que un paquete, para mezclarlo con otro. */
export type LocalState = Omit<SharedBundle, 'from'>;

/**
 * @param me Id del perfil local. Sin él no se puede saber qué es propio, y la
 *           fusión se comporta como antes de que existieran los dueños.
 */
export function mergeBundle(
  local: LocalState, remote: SharedBundle, mode: MergeMode, me?: string,
): LocalState {
  const rw = mode === 'actualizar';
  const peer = remote.from;

  return {
    // La clase y su lista de alumnos son lo único que dos docentes tienen
    // de verdad en común, así que son lo único que necesita un dueño.
    classes:         mergeOwned(local.classes, remote.classes, rw, me, peer),
    students:        mergeOwned(local.students, remote.students, rw, me, peer),
    gradeCategories: mergeById(local.gradeCategories, remote.gradeCategories, rw),
    gradeItems:      mergeById(local.gradeItems, remote.gradeItems, rw),
    grades:          mergeGrades(local.grades, remote.grades, rw),
    rubrics:         mergeById(local.rubrics, remote.rubrics, rw),
    dianas:          mergeById(local.dianas, remote.dianas, rw),
    evaluations:     mergeById(local.evaluations, remote.evaluations, rw),
  };
}

export function bundleCounts(b: SharedBundle) {
  const cells = Object.values(b.grades).reduce(
    (n, row) => n + Object.values(row).filter(v => typeof v === 'number').length, 0);
  return {
    classes: b.classes.length,
    students: b.students.length,
    grades: cells,
    rubrics: b.rubrics.length + b.dianas.length,
    evaluations: b.evaluations.length,
  };
}

/** ¿Es un paquete con la forma esperada? Se mira antes de tocar nada, por si el archivo viene de otra versión o está mal. */
export function esPaquete(x: unknown): x is SharedBundle {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as Record<string, unknown>;
  const listas = ['classes', 'students', 'gradeCategories', 'gradeItems', 'rubrics', 'dianas', 'evaluations'];
  if (!listas.every(k => Array.isArray(b[k]))) return false;
  return typeof b.grades === 'object' && b.grades !== null && !Array.isArray(b.grades);
}
