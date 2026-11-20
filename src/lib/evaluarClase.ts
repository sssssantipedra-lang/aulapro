/**
 * Evaluar a toda la clase seguido con una rúbrica o una diana, y corregir una evaluación ya hecha
 * (20-11-2026). Aquí va lo que no pinta nada: qué clase se propone, quién está evaluado, a quién le toca
 * después, qué evaluación es la vigente para el cuaderno y qué se guarda. Las ventanas (`EvalModal` y
 * `DianaEvalModal`) lo usan a través de `hooks/useEvaluarClase.ts`.
 */
import type { Class, Evaluation, ScheduleBlock } from '../types';
import { bloqueQueToca } from './claseQueToca';
import { clasesDe } from './objetivos';
import { mismaEvaluacion } from './periodos';
import type { GradeTarget } from '../types';

/** Lo marcado a un alumno: el nivel de cada criterio o ítem y las observaciones. */
export interface Marcado {
  scores: Record<string, number>;
  notes: string;
}

/**
 * Lo marcado a un alumno y todavía sin guardar.
 *
 * `editId` dice qué se hará al guardar: sin él, lo de siempre (corregir la evaluación de hoy si la hay; si
 * no, una nueva); con un id, corregir esa evaluación; con `null`, una evaluación nueva aunque hoy ya tenga
 * una (otro trabajo evaluado con el mismo instrumento). `deTodos` marca lo puesto con «Poner a todos este
 * nivel» y aún sin tocar: cambiar de nivel o quitarlo solo afecta a esos.
 */
export interface Borrador extends Marcado {
  editId?: string | null;
  deTodos?: boolean;
}

/** `hoy`: evaluado hoy; `antes`: evaluado otro día; `pendiente`: sin evaluación con este instrumento en esta clase. */
export type EstadoDeAlumno = 'hoy' | 'antes' | 'pendiente';

const esDeInstrumento = (e: Evaluation, instrumentoId: string, tipo: 'rubric' | 'diana') =>
  e.rubric_id === instrumentoId && (e.instrument ?? 'rubric') === tipo;

/**
 * La evaluación más reciente de cada alumno con ese instrumento en esa clase. A igual fecha, la que va antes
 * en la lista, que es la última guardada (las evaluaciones se guardan de nueva a antigua).
 */
export function ultimasPorAlumno(
  evaluations: readonly Evaluation[], instrumentoId: string, tipo: 'rubric' | 'diana', claseId: string,
): Record<string, Evaluation> {
  const out: Record<string, Evaluation> = {};
  for (const e of evaluations) {
    if (!e.student_id || e.class_id !== claseId || !esDeInstrumento(e, instrumentoId, tipo)) continue;
    const ya = out[e.student_id];
    if (!ya || e.date > ya.date) out[e.student_id] = e;
  }
  return out;
}

/** En qué punto está cada alumno de la lista con ese instrumento. */
export function estadoDe(ultima: Evaluation | undefined, hoy: string): EstadoDeAlumno {
  return !ultima ? 'pendiente' : ultima.date === hoy ? 'hoy' : 'antes';
}

/**
 * Si se abre la ventana para volver a evaluar a la clase: todos tienen ya una evaluación con ese instrumento
 * (la del trimestre pasado, la de otra tarea) y no todas son de hoy. Entonces «hecho» es estar evaluado hoy:
 * si contaran las de antes, la ventana se abriría con «25 de 25 evaluados» y sin «Poner a todos este nivel».
 * Con alguien todavía sin evaluar no lo es: se está terminando la primera vuelta, quizá en varios días.
 */
export function esRondaNueva(orden: readonly string[], ultimas: Record<string, Evaluation | undefined>, hoy: string): boolean {
  return orden.length > 0 && orden.every(id => !!ultimas[id]) && orden.some(id => ultimas[id]!.date !== hoy);
}

/** Si un alumno cuenta como hecho: evaluado alguna vez o, cuando se vuelve a evaluar a la clase, evaluado hoy. */
export function hechoEnRonda(estado: EstadoDeAlumno, rondaNueva: boolean): boolean {
  return rondaNueva ? estado === 'hoy' : estado !== 'pendiente';
}

/**
 * La evaluación que manda en el cuaderno para el alumno, el instrumento y la clase de `ev`: la más reciente
 * con nota (a igual fecha, la que va antes en la lista) **de su misma evaluación del curso** (20-11-2026: la
 * columna del cuaderno es por evaluación, así que la del segundo trimestre no le quita el sitio a la del
 * primero). Es la regla de `deleteEvaluation` y la que usa `updateEvaluation`: una corrección solo lleva su
 * nota al cuaderno si la corregida es la vigente.
 */
export function evaluacionVigente(evaluations: readonly Evaluation[], ev: Evaluation): Evaluation | undefined {
  let mejor: Evaluation | undefined;
  for (const e of evaluations) {
    if (e.rubric_id !== ev.rubric_id || e.student_id !== ev.student_id || e.class_id !== ev.class_id) continue;
    if (typeof e.grade !== 'number' || !mismaEvaluacion(e.date, ev.date)) continue;
    if (!mejor || e.date > mejor.date) mejor = e;
  }
  return mejor;
}

/**
 * La clase con la que se abre la ventana, para elegirla una sola vez: la que se pide (la de la sesión de EF,
 * por ejemplo) si el instrumento es de esa clase; si solo hay una posible, esa; la que toca ahora por el
 * horario; la última en la que se evaluó con ese instrumento; la principal del instrumento; y si no, la primera.
 */
export function claseDePartida(o: {
  instrumento: GradeTarget & { id: string };
  classes: readonly Class[];
  evaluations?: readonly Evaluation[];
  scheduleBlocks?: readonly ScheduleBlock[];
  pedida?: string;
  ahora?: Date;
  /**
   * La regla de la clase activa de toda la app (`lib/claseActiva.ts`), aplicada a las clases del
   * instrumento: con ella manda la clase de ahora (con calendario escolar y margen) o la que pidió
   * quien llevó hasta aquí, y la última con la que se trabajó desempata detrás de la última en la
   * que se usó el instrumento. Sin ella (una prueba, una pantalla suelta), el horario a secas.
   */
  regla?: (posibles: Class[]) => { id: string; motivo: string };
}): string {
  const suyas = clasesDe(o.instrumento);
  const posibles = suyas.length ? o.classes.filter(c => suyas.includes(c.id)) : [...o.classes];
  const vale = (id: string | undefined): id is string => !!id && posibles.some(c => c.id === id);
  if (vale(o.pedida)) return o.pedida;
  if (posibles.length === 1) return posibles[0].id;
  const activa = o.regla?.(posibles);
  if (activa) {
    if ((activa.motivo === 'pedida' || activa.motivo === 'ahora') && vale(activa.id)) return activa.id;
  } else {
    const toca = bloqueQueToca(posibles, [...(o.scheduleBlocks ?? [])], o.ahora)?.class_id;
    if (vale(toca)) return toca;
  }
  const reciente = [...(o.evaluations ?? [])]
    .filter(e => e.rubric_id === o.instrumento.id && vale(e.class_id))
    .reduce<Evaluation | undefined>((m, e) => (!m || e.date > m.date ? e : m), undefined)?.class_id;
  if (vale(reciente)) return reciente;
  if (activa?.motivo === 'ultima' && vale(activa.id)) return activa.id;
  if (vale(o.instrumento.class_id)) return o.instrumento.class_id;
  return posibles[0]?.id ?? '';
}

/**
 * A quién le toca después de `actual`, en orden de lista y dando la vuelta: el siguiente que no esté hecho.
 * `undefined` si no queda nadie. `actual` no se devuelve nunca (acaba de guardarse); con `actual` vacío o
 * fuera de la lista, el primero que falte.
 */
export function siguientePendiente(orden: readonly string[], actual: string, hecho: (id: string) => boolean): string | undefined {
  const i = orden.indexOf(actual);
  for (let k = 1; k <= orden.length; k++) {
    const id = orden[(i + k + orden.length) % orden.length];
    if (id !== actual && !hecho(id)) return id;
  }
  return undefined;
}

/** Lo marcado, sin los ceros con los que la diana apunta «sin marcar». */
export function sinCeros(scores: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) if (typeof v === 'number' && v > 0) out[k] = v;
  return out;
}

/**
 * Lo marcado en una evaluación ya hecha que todavía vale con el instrumento de ahora: solo los criterios o
 * ítems que sigue teniendo y solo los niveles de su escala. Si el instrumento cambió después (se quitó un
 * criterio, se pasó de cinco niveles a cuatro), lo que ya no existe se queda sin marcar al corregir: un 5 en
 * una escala que ahora llega a 4 daría una nota por encima de 10, que además iría al cuaderno.
 */
export function marcasValidas(scores: Record<string, number>, ids: readonly string[], niveles?: readonly number[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const v = scores[id];
    if (typeof v === 'number' && v > 0 && (!niveles || niveles.includes(v))) out[id] = v;
  }
  return out;
}

/** Cuántos de esos criterios o ítems tienen nivel. */
export const marcados = (scores: Record<string, number>, ids: readonly string[]): number =>
  ids.filter(id => typeof scores[id] === 'number' && scores[id] > 0).length;

/** El mismo nivel en todos los criterios o ítems: el punto de partida de «Poner a todos este nivel». */
export function marcasATodos(ids: readonly string[], nivel: number): Record<string, number> {
  return Object.fromEntries(ids.map(id => [id, nivel]));
}

/** Si lo marcado es lo mismo (mismos niveles y mismas observaciones): entonces no hay nada que guardar. */
export function mismasMarcas(a: Marcado, b: Marcado): boolean {
  const x = sinCeros(a.scores), y = sinCeros(b.scores);
  const kx = Object.keys(x);
  return kx.length === Object.keys(y).length && kx.every(k => x[k] === y[k]) && a.notes.trim() === b.notes.trim();
}

/**
 * La evaluación que un borrador corrige, si corrige alguna: la que dice su `editId` o, sin él, la de hoy.
 * Con `editId: null` no corrige ninguna (es otro trabajo).
 */
export function evaluacionQueCorrige(
  borrador: Borrador | undefined, ultima: Evaluation | undefined, hoy: string, evaluations: readonly Evaluation[],
): Evaluation | undefined {
  if (borrador?.editId === null) return undefined;
  if (borrador?.editId) return evaluations.find(e => e.id === borrador.editId);
  return ultima && ultima.date === hoy ? ultima : undefined;
}

/** Si un borrador tiene algo que guardar: algún nivel marcado y, si corrige una evaluación, algo distinto de ella. */
export function porGuardar(borrador: Borrador | undefined, corrige: Evaluation | undefined, ids: readonly string[]): boolean {
  if (!borrador || marcados(borrador.scores, ids) === 0) return false;
  return !corrige || !mismasMarcas(borrador, corrige);
}

/**
 * Una corrección: la evaluación recién construida con lo marcado, pero con el id, la fecha, la clase y el
 * alumno de la que corrige. Así se actualiza esa y no aparece otra.
 */
export function comoCorreccion(nueva: Evaluation, original: Evaluation): Evaluation {
  return { ...nueva, id: original.id, date: original.date, class_id: original.class_id, student_id: original.student_id };
}

/** Un id que no se repite al guardar a varios alumnos en el mismo instante. */
export function idDeEvaluacion(): string {
  return 'ev' + Date.now() + Math.random().toString(36).slice(2, 7);
}
