import type { Class, Student, GradeCategory, GradeItem, GradeMap, Rubric, EvalDiana, Evaluation } from '../types';

/**
 * Qué datos comparte el docente. Solo viaja lo que se marca aquí:
 * nunca el perfil, nunca la clave de la IA.
 */
export interface ShareScope {
  classIds: string[];
  grades: boolean;
  rubrics: boolean;
  evaluations: boolean;
}

export const EMPTY_SCOPE: ShareScope = { classIds: [], grades: true, rubrics: true, evaluations: true };

/**
 * Registro de ids eliminados («lápidas»). Al conectarse dos equipos, cualquier
 * id que aparezca aquí se elimina en el otro lado aunque siga presente en sus
 * datos: un borrado siempre se propaga, en cualquier sentido.
 */
export interface Tombstones {
  classes: string[];
  students: string[];
  gradeCategories: string[];
  gradeItems: string[];
  rubrics: string[];
  dianas: string[];
  evaluations: string[];
}

export function emptyTombstones(): Tombstones {
  return { classes: [], students: [], gradeCategories: [], gradeItems: [], rubrics: [], dianas: [], evaluations: [] };
}

export interface SharedBundle {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  rubrics: Rubric[];
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  tombstones: Tombstones;
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
  tombstones: Tombstones;
  /** Id del perfil de quien comparte. */
  me?: string;
}

export function emptyBundle(): SharedBundle {
  return {
    classes: [], students: [], gradeCategories: [], gradeItems: [],
    grades: {}, rubrics: [], dianas: [], evaluations: [], tombstones: emptyTombstones(),
  };
}

/** Extrae del estado solo lo que el docente ha elegido compartir. */
export function buildBundle(src: SyncSource, scope: ShareScope): SharedBundle {
  const ids = new Set(scope.classIds);
  const classes = src.classes.filter(c => ids.has(c.id));
  const students = src.students.filter(s => ids.has(s.class_id));

  const gradeCategories = scope.grades ? src.gradeCategories.filter(c => ids.has(c.class_id)) : [];
  const gradeItems      = scope.grades ? src.gradeItems.filter(i => ids.has(i.class_id)) : [];

  const grades: GradeMap = {};
  if (scope.grades) {
    const itemIds = new Set(gradeItems.map(i => i.id));
    for (const [itemId, row] of Object.entries(src.grades)) {
      if (itemIds.has(itemId)) grades[itemId] = { ...row };
    }
  }

  return {
    classes,
    students,
    gradeCategories,
    gradeItems,
    grades,
    rubrics: scope.rubrics ? src.rubrics : [],
    dianas:  scope.rubrics ? src.dianas : [],
    evaluations: scope.evaluations ? src.evaluations.filter(e => ids.has(e.class_id)) : [],
    // Las lápidas siempre viajan enteras: son solo ids, no datos de alumnos,
    // y hace falta el registro completo para que un borrado llegue aunque
    // la clase afectada ya no esté marcada para compartir.
    tombstones: src.tombstones,
    from: src.me,
  };
}

/**
 * Une dos listas por id.
 * - `remoteWins = false` (reconciliación inicial): ante un mismo id se conserva
 *   la versión local, así nadie pierde su trabajo al conectarse.
 * - `remoteWins = true` (edición en vivo): el cambio del compañero se aplica,
 *   porque es una acción deliberada que acaba de hacer.
 * Los ids marcados como eliminados (`dead`) se excluyen siempre, sea cual sea
 * el modo: un borrado se respeta en ambos lados.
 */
function mergeById<T extends { id: string }>(local: T[], remote: T[], remoteWins: boolean, dead: Set<string>): T[] {
  const out = new Map<string, T>();
  local.forEach(x => out.set(x.id, x));
  remote.forEach(x => {
    if (!out.has(x.id) || remoteWins) out.set(x.id, x);
  });
  dead.forEach(id => out.delete(id));
  return [...out.values()];
}

/**
 * Une listas cuyos elementos tienen dueño: la lista de alumnos y las clases.
 *
 * El dueño manda sobre lo suyo **en cualquier modo**. Es lo que permite que
 * dos docentes compartan un grupo sin pisarse: si eres el tutor, tu lista de
 * alumnos es la buena aunque el especialista sincronice después; y si un
 * compañero te comparte su clase, sus cambios llegan sin que los tuyos la
 * sobrescriban.
 *
 * Lo que no tiene dueño (creado antes de esto) se comporta como siempre.
 */
function mergeOwned<T extends { id: string; owner?: string }>(
  local: T[], remote: T[], remoteWins: boolean, dead: Set<string>,
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
    if (remoteWins) out.set(x.id, x);                        // sin dueño: como antes
  });

  dead.forEach(id => out.delete(id));
  return [...out.values()];
}

function mergeGrades(local: GradeMap, remote: GradeMap, remoteWins: boolean, deadItems: Set<string>): GradeMap {
  const out: GradeMap = {};
  for (const [itemId, row] of Object.entries(local)) {
    if (deadItems.has(itemId)) continue;
    out[itemId] = { ...row };
  }
  for (const [itemId, row] of Object.entries(remote)) {
    if (deadItems.has(itemId)) continue;
    const target = out[itemId] ?? (out[itemId] = {});
    for (const [studentId, value] of Object.entries(row)) {
      // La clave debe existir localmente (aunque su valor sea null, es decir,
      // una nota borrada a propósito) para que no la resucite el remoto.
      const hasLocal = studentId in target;
      if (!hasLocal || remoteWins) target[studentId] = value;
    }
  }
  return out;
}

function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return {
    classes:         union(a.classes, b.classes),
    students:        union(a.students, b.students),
    gradeCategories: union(a.gradeCategories, b.gradeCategories),
    gradeItems:      union(a.gradeItems, b.gradeItems),
    rubrics:         union(a.rubrics, b.rubrics),
    dianas:          union(a.dianas, b.dianas),
    evaluations:     union(a.evaluations, b.evaluations),
  };
}

export type MergeMode = 'reconcile' | 'live';

/**
 * @param me Id del perfil local. Sin él no se puede saber qué es propio, y la
 *           fusión se comporta como antes de que existieran los dueños.
 */
export function mergeBundle(
  local: SharedBundle, remote: SharedBundle, mode: MergeMode, me?: string,
): SharedBundle {
  const rw = mode === 'live';
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const deadGradeItems = new Set(tombstones.gradeItems);
  const peer = remote.from;

  return {
    // La clase y su lista de alumnos son lo único que los dos docentes tienen
    // de verdad en común, así que son lo único que necesita un dueño.
    classes:         mergeOwned(local.classes, remote.classes, rw, new Set(tombstones.classes), me, peer),
    students:        mergeOwned(local.students, remote.students, rw, new Set(tombstones.students), me, peer),
    gradeCategories: mergeById(local.gradeCategories, remote.gradeCategories, rw, new Set(tombstones.gradeCategories)),
    gradeItems:      mergeById(local.gradeItems, remote.gradeItems, rw, deadGradeItems),
    grades:          mergeGrades(local.grades, remote.grades, rw, deadGradeItems),
    rubrics:         mergeById(local.rubrics, remote.rubrics, rw, new Set(tombstones.rubrics)),
    dianas:          mergeById(local.dianas, remote.dianas, rw, new Set(tombstones.dianas)),
    evaluations:     mergeById(local.evaluations, remote.evaluations, rw, new Set(tombstones.evaluations)),
    tombstones,
    from: local.from,
  };
}

/**
 * Huella del contenido, para detectar cambios sin comparar objeto a objeto.
 * `from` se excluye: identifica al emisor, no a los datos, y si contara
 * bastaría con cambiar de perfil para que pareciera que hay novedades.
 */
export function hashBundle(b: SharedBundle): string {
  const { from: _ignored, ...content } = b;
  const json = JSON.stringify(content);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  return `${json.length}:${h}`;
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

/* ── Mensajes que viajan por el canal ── */
export type SyncMessage =
  | { t: 'hello'; name: string }
  | { t: 'snapshot'; data: SharedBundle }
  | { t: 'patch'; data: SharedBundle };

export function isSyncMessage(x: unknown): x is SyncMessage {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string';
}
