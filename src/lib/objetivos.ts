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
import { gradeFromLevels, gradeItemIdFor, levelsOf, type ClassTarget, type Evaluation, type EvalDiana, type GradeItem, type GradeTarget, type Rubric } from '../types';
import { evaluacionDe, mismaEvaluacion } from './periodos';

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

/**
 * Las columnas del cuaderno de un destino (20-11-2026): la de siempre (`base`, el id de `destinosDe`) y las
 * que se han ido abriendo en otras evaluaciones (`base@2026-2`). La de siempre va primero.
 */
export function columnasDeDestino(base: string, gradeItems: readonly GradeItem[]): GradeItem[] {
  return gradeItems.filter(i => i.id === base || i.id.startsWith(base + '@'))
    .sort((a, b) => Number(b.id === base) - Number(a.id === base) || (a.date || '').localeCompare(b.date || ''));
}

/**
 * La columna del cuaderno en la que cae una evaluación con ese instrumento hecha el día `fecha`. La columna
 * es por evaluación (como las pruebas físicas de EF): usar la rúbrica en el segundo trimestre no cambia la
 * nota del primero. Manda la fecha de la columna, como en el resto del cuaderno: es de la evaluación en la
 * que cae su fecha, así que una columna de antes de este cambio sigue valiendo para la suya, y si el docente
 * le cambia la fecha (o cambia las fechas de las evaluaciones) pasa a contar donde caiga.
 *
 * Si ninguna columna del destino es de esa evaluación, dice con qué id crearla: la primera conserva el id de
 * siempre y las siguientes llevan la evaluación detrás.
 */
export function columnaDeEvaluacion(base: string, fecha: string, gradeItems: readonly GradeItem[]): { id: string; existe: boolean } {
  const suyas = columnasDeDestino(base, gradeItems);
  const hay = suyas.find(i => mismaEvaluacion(i.date, fecha));
  if (hay) return { id: hay.id, existe: true };
  if (!suyas.some(i => i.id === base)) return { id: base, existe: false };
  const ocupados = new Set(suyas.map(i => i.id));
  const clave = /^\d{4}-\d{2}-\d{2}/.test(fecha) ? evaluacionDe(fecha.slice(0, 10)) : 'otra';
  let id = `${base}@${clave}`;
  // Ese id puede estar ocupado por una columna a la que después se le cambió la fecha a otra evaluación
  for (let n = 2; ocupados.has(id); n++) id = `${base}@${clave}-${n}`;
  return { id, existe: false };
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
