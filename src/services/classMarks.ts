/**
 * Anotaciones del aula → cuaderno de notas.
 *
 * Desde la Distribución de aula el docente apunta en un toque cosas del día a
 * día («no ha traído la tarea», «buen comportamiento», «participa»). Aquí se
 * convierten en un BLOQUE de la nota final —por defecto, 1 punto de 10— con
 * tres partes que ponderan un tercio cada una:
 *
 *   - Tareas          ← «Sin tarea»
 *   - Comportamiento  ← «Sin material», «Mal comportamiento», «Buen comportamiento»
 *   - Participación   ← «Participa»
 *
 * Cada parte es una nota de 0 a 10: todos parten de la misma (10 en Tareas y
 * Comportamiento, 5 en Participación, que solo suma) y cada anotación suma o
 * resta 0,5. El docente puede cambiar los puntos del bloque, el peso de cada
 * parte, las notas de partida y lo que vale cada anotación.
 *
 * El bloque se añade como una categoría «virtual» con una columna y sus
 * notas, sin guardarse nunca: así cuenta igual en la media del cuaderno, en
 * los informes, las actas, el inicio y lo que ve la IA, sin que cada pantalla
 * tenga que saber que existen las anotaciones. Su peso se calcula para que
 * valga exactamente esos puntos sobre la nota final, sumen lo que sumen las
 * demás categorías.
 */
import type {
  Class, ClassMark, ClassMarkType, GradeCategory, GradeItem, GradeMap, Student, MarksBlockConfig, MarkTarget,
} from '../types';

export type { MarkTarget, MarksBlockConfig };

export interface MarkTypeInfo {
  id: ClassMarkType;
  label: string;
  positive: boolean;
  target: MarkTarget;
}

export const MARK_TYPES: readonly MarkTypeInfo[] = [
  { id: 'homework',      label: 'Sin tarea',           positive: false, target: 'homework' },
  { id: 'material',      label: 'Sin material',        positive: false, target: 'behavior' },
  { id: 'behavior-bad',  label: 'Mal comportamiento',  positive: false, target: 'behavior' },
  { id: 'behavior-good', label: 'Buen comportamiento', positive: true,  target: 'behavior' },
  { id: 'participation', label: 'Participa',           positive: true,  target: 'participation' },
];

export const markTypeInfo = (id: ClassMarkType): MarkTypeInfo | undefined =>
  MARK_TYPES.find(m => m.id === id);

export const TARGETS: readonly MarkTarget[] = ['homework', 'behavior', 'participation'];

export const TARGET_LABEL: Record<MarkTarget, string> = {
  homework: 'Tareas',
  behavior: 'Comportamiento',
  participation: 'Participación',
};

export const BLOCK_NAME = 'Trabajo diario y actitud';

export const DEFAULT_BLOCK: MarksBlockConfig = {
  points: 1,
  weights: { homework: 33.33, behavior: 33.33, participation: 33.34 },
  bases: { homework: 10, behavior: 10, participation: 5 },
  step: 0.5,
};

/** Tope de puntos del bloque: por encima dejaría de ser un complemento de la nota. */
export const MAX_BLOCK_POINTS = 5;

export const BLOCK_CATEGORY_PREFIX = 'marksblock:';
export const BLOCK_ITEM_PREFIX = 'marks:';
export const isMarksCategory = (id: string) => id.startsWith(BLOCK_CATEGORY_PREFIX);
export const isMarksItem = (id: string) => id.startsWith(BLOCK_ITEM_PREFIX);

export const blockKey = (classId: string, subject: string) => `${classId}|${subject}`;

/** La configuración del bloque de una clase y asignatura, con los valores por defecto donde falten. */
export function blockConfig(
  configs: Record<string, MarksBlockConfig> | undefined, classId: string, subject: string,
): MarksBlockConfig {
  const c = configs?.[blockKey(classId, subject)];
  return {
    ...DEFAULT_BLOCK,
    ...c,
    weights: { ...DEFAULT_BLOCK.weights, ...c?.weights },
    bases: { ...DEFAULT_BLOCK.bases, ...c?.bases },
  };
}

/**
 * Si el bloque cuenta en la nota. Sin decisión del docente, cuenta en cuanto
 * hay alguna anotación: así nadie ve cambiar las medias por una función que
 * no usa.
 */
export function blockActive(cfg: MarksBlockConfig, marksCount: number): boolean {
  if (cfg.enabled === false) return false;
  return cfg.enabled === true || marksCount > 0;
}

const clamp10 = (v: number) => Math.min(10, Math.max(0, Math.round(v * 100) / 100));

export interface PartScore { score: number; pos: number; neg: number }
export interface StudentBlock { parts: Record<MarkTarget, PartScore>; total: number }

/** Nota de cada parte y del bloque para un alumno, a partir de sus anotaciones. */
export function studentBlock(marks: readonly ClassMark[], cfg: MarksBlockConfig): StudentBlock {
  const count = { homework: { pos: 0, neg: 0 }, behavior: { pos: 0, neg: 0 }, participation: { pos: 0, neg: 0 } };
  for (const m of marks) {
    const info = markTypeInfo(m.type);
    if (!info) continue;
    if (info.positive) count[info.target].pos++; else count[info.target].neg++;
  }
  const parts = Object.fromEntries(TARGETS.map(t => [t, {
    ...count[t],
    score: clamp10(cfg.bases[t] + cfg.step * (count[t].pos - count[t].neg)),
  }])) as Record<MarkTarget, PartScore>;

  const wSum = TARGETS.reduce((a, t) => a + Math.max(0, cfg.weights[t]), 0);
  const total = wSum > 0
    ? TARGETS.reduce((a, t) => a + parts[t].score * Math.max(0, cfg.weights[t]), 0) / wSum
    : TARGETS.reduce((a, t) => a + parts[t].score, 0) / TARGETS.length;
  return { parts, total: clamp10(total) };
}

/**
 * Peso que ha de tener la categoría del bloque para valer `points` sobre 10,
 * dadas las demás. Con las demás sumando 100 y 1 punto, pesa 11,11: la media
 * queda en 0,9 × resto + 0,1 × bloque.
 */
export function blockCategoryWeight(otherWeightsSum: number, points: number): number {
  const share = Math.min(MAX_BLOCK_POINTS, Math.max(0, points)) / 10;
  if (share <= 0) return 0;
  if (otherWeightsSum <= 0) return 100;
  return Math.round((otherWeightsSum * share / (1 - share)) * 10000) / 10000;
}

const subjectsOf = (c: Class) => (c.subjects?.length ? c.subjects : [c.subject]);
const mainSubject = (c: Class) => subjectsOf(c)[0] ?? '';

/** Anotaciones de una clase y asignatura (las que no llevan asignatura son de la principal). */
export function marksFor(marks: readonly ClassMark[], cls: Class, subject: string): ClassMark[] {
  const main = mainSubject(cls);
  return marks.filter(m => m.class_id === cls.id && (m.subject ?? main) === subject);
}

export interface MarksInput {
  classes: readonly Class[];
  students: readonly Student[];
  gradeCategories: readonly GradeCategory[];
  gradeItems: readonly GradeItem[];
  grades: GradeMap;
  classMarks: readonly ClassMark[];
  marksConfigs: Record<string, MarksBlockConfig>;
}

/** Categorías, columnas y notas del cuaderno con el bloque de anotaciones ya incluido. */
export function applyClassMarks(d: MarksInput): {
  gradeCategories: GradeCategory[]; gradeItems: GradeItem[]; grades: GradeMap;
} {
  const cats: GradeCategory[] = [...d.gradeCategories];
  const items: GradeItem[] = [...d.gradeItems];
  const grades: GradeMap = { ...d.grades };

  for (const cls of d.classes) {
    for (const subject of subjectsOf(cls)) {
      const cfg = blockConfig(d.marksConfigs, cls.id, subject);
      const marks = marksFor(d.classMarks, cls, subject);
      if (!blockActive(cfg, marks.length)) continue;

      const main = mainSubject(cls);
      const others = d.gradeCategories
        .filter(c => c.class_id === cls.id && (c.subject ?? main) === subject)
        .reduce((a, c) => a + c.weight, 0);
      const weight = blockCategoryWeight(others, cfg.points);
      if (weight <= 0) continue;

      const key = blockKey(cls.id, subject);
      const catId = BLOCK_CATEGORY_PREFIX + key;
      const itemId = BLOCK_ITEM_PREFIX + key;
      cats.push({ id: catId, class_id: cls.id, name: BLOCK_NAME, weight, subject });
      items.push({
        id: itemId, class_id: cls.id, category_id: catId, name: BLOCK_NAME,
        date: marks.reduce((a, m) => (m.date > a ? m.date : a), ''),
      });
      // Todos los de la clase tienen nota, no solo los anotados: quien no
      // tiene ninguna anotación se queda con las notas de partida.
      grades[itemId] = Object.fromEntries(
        d.students
          .filter(s => s.class_id === cls.id)
          .map(s => [s.id, studentBlock(marks.filter(m => m.student_id === s.id), cfg).total]),
      );
    }
  }
  return { gradeCategories: cats, gradeItems: items, grades };
}
