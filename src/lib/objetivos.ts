/**
 * Las clases de una rúbrica o una diana (decisión del dueño, 19-10-2026: «hay
 * veces que la misma rúbrica se puede gastar para 2 o 3 clases; así no hay
 * que duplicarla continuamente»).
 *
 * Un instrumento tiene una clase principal (`class_id`, `subject` y
 * `category_id`, como siempre) y, si hace falta, otras (`otras_clases`). Cada
 * clase tiene su asignatura, su categoría del cuaderno y su propia columna:
 * la de la principal conserva el id de siempre y las demás llevan el de su
 * clase (`gradeItemIdFor`). Sin clases, funciona como antes: la evaluación se
 * guarda en el Historial y el cuaderno no se toca.
 */
import { gradeFromLevels, gradeItemIdFor, levelsOf, type ClassTarget, type Evaluation, type EvalDiana, type GradeTarget, type Rubric } from '../types';

/** Todas las clases del instrumento, la principal primero. */
export function objetivosDe(inst: GradeTarget): ClassTarget[] {
  const primera: ClassTarget[] = inst.class_id
    ? [{ class_id: inst.class_id, subject: inst.subject, category_id: inst.category_id }]
    : [];
  if (primera.length === 0) return [];
  const vistas = new Set([inst.class_id]);
  const otras = (inst.otras_clases ?? []).filter(o => o.class_id && !vistas.has(o.class_id) && vistas.add(o.class_id));
  return [...primera, ...otras];
}

/** Los ids de las clases en las que se usa. */
export const clasesDe = (inst: GradeTarget): string[] => objetivosDe(inst).map(o => o.class_id);

/** Dónde cae la nota de un alumno de esa clase, o `undefined` si el instrumento no es de esa clase. */
export const objetivoPara = (inst: GradeTarget, classId: string): ClassTarget | undefined =>
  objetivosDe(inst).find(o => o.class_id === classId);

/** La columna del cuaderno de ese instrumento en esa clase. */
export function idColumna(inst: GradeTarget & { id: string }, classId: string): string {
  return classId === inst.class_id ? gradeItemIdFor(inst.id) : gradeItemIdFor(inst.id, classId);
}

/** Lo que se guarda: sin `otras_clases` vacío ni repetidas. */
export function conObjetivos<T extends GradeTarget>(t: T): T {
  if (!t.class_id) { const { otras_clases: _o, ...resto } = t; void _o; return resto as T; }
  const otras = objetivosDe(t).slice(1);
  const { otras_clases: _o, ...resto } = t;
  void _o;
  return (otras.length ? { ...resto, otras_clases: otras } : resto) as T;
}

/** Una columna del cuaderno donde cae la nota de un alumno: su id, su categoría y, si reparte por criterios, su materia. */
export interface Destino { id: string; class_id: string; subject?: string; category_id?: string; materia?: string }

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, '_');

/**
 * Las columnas del cuaderno a las que va la nota de una evaluación de esa clase:
 * una, como siempre, o una por área si es una situación interdisciplinar y la
 * clase es la principal. La del área principal conserva el id de siempre.
 */
export function destinosDe(inst: GradeTarget & { id: string }, classId: string): Destino[] {
  const base = objetivoPara(inst, classId);
  if (!base) return [];
  const areas = inst.areas ?? [];
  if (classId !== inst.class_id || areas.length < 2) return [{ ...base, id: idColumna(inst, classId) }];
  return areas.map(a => ({
    id: a.subject === inst.subject ? idColumna(inst, classId) : gradeItemIdFor(inst.id, `${classId}~${slug(a.subject)}`),
    class_id: classId, subject: a.subject, category_id: a.category_id, materia: a.materia,
  }));
}

/**
 * La nota que va a esa columna: la de la evaluación, o, si el instrumento reparte
 * por criterios, la de los criterios o ítems de esa materia (sin ninguno, la general).
 */
export function notaDeDestino(inst: Rubric | EvalDiana, d: Destino, ev: Pick<Evaluation, 'scores' | 'grade'>): number | undefined {
  if (inst.modo_areas !== 'criterio' || !d.materia) return ev.grade;
  const items: { id: string; weight?: number; officialCriteria?: { materia: string }[] }[] = 'criteria' in inst ? inst.criteria : inst.items;
  const suyos = items.filter(i => i.officialCriteria?.some(r => r.materia === d.materia));
  if (suyos.length === 0) return ev.grade;
  const pesos = Object.fromEntries(suyos.map(i => [i.id, i.weight ?? 1]));
  return gradeFromLevels(ev.scores, suyos.map(i => i.id), levelsOf(inst), 'criteria' in inst ? undefined : pesos) ?? undefined;
}
