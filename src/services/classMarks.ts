/**
 * Anotaciones del aula → cuaderno de notas.
 *
 * Desde la Distribución de aula el docente apunta en un toque cosas del día a
 * día («no ha traído la tarea», «buen comportamiento», «participa»). Aquí se
 * convierten en una columna automática, de solo lectura, dentro de la
 * categoría del cuaderno que les corresponde:
 *
 *   - «Sin tarea»            → Tareas
 *   - «Sin material», «Mal comportamiento», «Buen comportamiento» → Comportamiento
 *   - «Participa»            → Participación
 *
 * Todos los alumnos de la clase parten de la misma nota (10 si la categoría
 * recibe anotaciones negativas; 5 si solo positivas) y cada anotación suma o
 * resta 0,5, siempre entre 0 y 10. El docente puede cambiar ambos valores al
 * editar la categoría.
 *
 * La columna se añade como un `GradeItem` «virtual» más las notas que le
 * tocan, sin guardarse nunca: así cuenta igual en la media del cuaderno, en
 * los informes, las actas, el inicio y lo que ve la IA, sin que cada pantalla
 * tenga que saber que existen las anotaciones.
 */
import type { Class, ClassMark, ClassMarkType, GradeCategory, GradeItem, GradeMap, Student } from '../types';

export type MarkTarget = 'homework' | 'behavior' | 'participation';

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

/** Nombre con el que se crea la categoría si el docente aún no la tiene. */
export const TARGET_CATEGORY: Record<MarkTarget, { es: string; en: string }> = {
  homework:      { es: 'Tareas',         en: 'Homework' },
  behavior:      { es: 'Comportamiento', en: 'Behaviour' },
  participation: { es: 'Participación',  en: 'Participation' },
};

/** Palabras que, dentro del nombre de una categoría, la ligan a cada tipo. */
const TARGET_WORDS: Record<MarkTarget, string[]> = {
  homework:      ['tarea', 'deberes', 'homework'],
  behavior:      ['comportamiento', 'actitud', 'conducta', 'convivencia', 'behaviour', 'behavior', 'attitude', 'conduct'],
  participation: ['participacion', 'participation'],
};

export const DEFAULT_MARK_STEP = 0.5;
export const MARKS_ITEM_PREFIX = 'marks:';
export const MARKS_ITEM_NAME = 'Anotaciones del aula';

export const isMarksItem = (itemId: string) => itemId.startsWith(MARKS_ITEM_PREFIX);

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Qué tipos de anotación recoge una categoría por su nombre («Actitud y participación» recoge dos). */
export function targetsOfCategory(name: string): MarkTarget[] {
  const n = plain(name);
  return (Object.keys(TARGET_WORDS) as MarkTarget[]).filter(t => TARGET_WORDS[t].some(w => n.includes(w)));
}

/**
 * A qué categoría va cada tipo. Si dos categorías encajan con el mismo tipo,
 * gana la primera: una anotación nunca cuenta dos veces.
 */
export function linkTargets(categories: readonly GradeCategory[]): Map<MarkTarget, GradeCategory> {
  const out = new Map<MarkTarget, GradeCategory>();
  for (const cat of categories) {
    for (const t of targetsOfCategory(cat.name)) if (!out.has(t)) out.set(t, cat);
  }
  return out;
}

/** Nota de partida por defecto: 10 si la categoría recibe algo negativo; 5 si solo positivo. */
export function defaultMarksBase(cat: Pick<GradeCategory, 'name'>): number {
  const targets = targetsOfCategory(cat.name);
  const anyNegative = MARK_TYPES.some(m => !m.positive && targets.includes(m.target));
  return anyNegative ? 10 : 5;
}

export function marksBaseOf(cat: GradeCategory): number {
  return typeof cat.marksBase === 'number' ? cat.marksBase : defaultMarksBase(cat);
}
export function marksStepOf(cat: GradeCategory): number {
  return typeof cat.marksStep === 'number' ? cat.marksStep : DEFAULT_MARK_STEP;
}

export function marksScore(positives: number, negatives: number, base: number, step: number): number {
  const v = base + step * (positives - negatives);
  return Math.min(10, Math.max(0, Math.round(v * 100) / 100));
}

const subjectsOf = (c: Class) => (c.subjects?.length ? c.subjects : [c.subject]);

/** Asignatura efectiva de una anotación: la suya o, si no lleva, la principal de la clase. */
const markSubject = (m: ClassMark, cls: Class) => m.subject ?? subjectsOf(cls)[0] ?? '';
const catSubject = (c: GradeCategory, cls: Class) => c.subject ?? subjectsOf(cls)[0] ?? '';

export interface MarksInput {
  classes: readonly Class[];
  students: readonly Student[];
  gradeCategories: readonly GradeCategory[];
  gradeItems: readonly GradeItem[];
  grades: GradeMap;
  classMarks: readonly ClassMark[];
}

/** Las columnas y notas del cuaderno con las anotaciones del aula ya incluidas. */
export function applyClassMarks(d: MarksInput): { gradeItems: GradeItem[]; grades: GradeMap } {
  if (d.classMarks.length === 0) return { gradeItems: [...d.gradeItems], grades: d.grades };

  const items: GradeItem[] = [...d.gradeItems];
  const grades: GradeMap = { ...d.grades };

  for (const cls of d.classes) {
    const marksOfClass = d.classMarks.filter(m => m.class_id === cls.id);
    if (marksOfClass.length === 0) continue;
    const roster = d.students.filter(s => s.class_id === cls.id);

    for (const subject of subjectsOf(cls)) {
      const cats = d.gradeCategories.filter(c => c.class_id === cls.id && catSubject(c, cls) === subject);
      const links = linkTargets(cats);

      // Anotaciones de cada categoría, contadas por alumno
      const byCat = new Map<string, { cat: GradeCategory; pos: Map<string, number>; neg: Map<string, number>; last: string }>();
      for (const m of marksOfClass) {
        if (markSubject(m, cls) !== subject) continue;
        const info = markTypeInfo(m.type);
        const cat = info && links.get(info.target);
        if (!info || !cat) continue;
        let entry = byCat.get(cat.id);
        if (!entry) { entry = { cat, pos: new Map(), neg: new Map(), last: '' }; byCat.set(cat.id, entry); }
        const bucket = info.positive ? entry.pos : entry.neg;
        bucket.set(m.student_id, (bucket.get(m.student_id) ?? 0) + 1);
        if (m.date > entry.last) entry.last = m.date;
      }

      for (const { cat, pos, neg, last } of byCat.values()) {
        const id = MARKS_ITEM_PREFIX + cat.id;
        items.push({ id, class_id: cls.id, category_id: cat.id, name: MARKS_ITEM_NAME, date: last });
        const base = marksBaseOf(cat);
        const step = marksStepOf(cat);
        // Todos los de la clase tienen nota, no solo los anotados: quien no
        // tiene ninguna anotación se queda con la nota de partida.
        grades[id] = Object.fromEntries(
          roster.map(s => [s.id, marksScore(pos.get(s.id) ?? 0, neg.get(s.id) ?? 0, base, step)]),
        );
      }
    }
  }
  return { gradeItems: items, grades };
}

/**
 * Tipos con anotaciones en esta clase y asignatura que no cuentan en ningún
 * sitio porque no hay categoría que las recoja. El cuaderno lo avisa y ofrece
 * crearla.
 */
export function orphanTargets(
  cls: Class, subject: string,
  gradeCategories: readonly GradeCategory[], classMarks: readonly ClassMark[],
): MarkTarget[] {
  const cats = gradeCategories.filter(c => c.class_id === cls.id && catSubject(c, cls) === subject);
  const links = linkTargets(cats);
  const found = new Set<MarkTarget>();
  for (const m of classMarks) {
    if (m.class_id !== cls.id || markSubject(m, cls) !== subject) continue;
    const info = markTypeInfo(m.type);
    if (info && !links.has(info.target)) found.add(info.target);
  }
  return [...found];
}
