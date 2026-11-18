/**
 * Lo más relevante de un alumno, en positivo y en negativo, para la ficha de
 * «Mis clases» (18-11-2026, petición del dueño: «que al clicar sobre el alumno
 * salte la información más relevante, tanto positiva como negativa»).
 *
 * Lo decide el código con reglas fijas, sin IA: sale al instante, sin clave y
 * siempre igual. Mira cuatro cosas del periodo elegido (las últimas 4 semanas,
 * el trimestre o el curso): las notas del cuaderno, la asistencia, las
 * anotaciones de actitud y trabajo diario (también las de «En la pista» de EF)
 * y las competencias clave de las evaluaciones con rúbricas y dianas.
 *
 * Cada dato es un texto en castellano con variables, que la pantalla traduce,
 * y un peso para ordenar: lo que más pesa sale primero.
 */
import type { AttendanceMap, Class, ClassMark, ClassMarkType, Evaluation, GradeCategory, GradeItem, GradeMap, Student } from '../types';
import { mediaDeCategoria } from './ponderacion';
import { EF_MARK_TYPES, esAsignaturaEF, isMarksCategory, MARK_TYPES, markTypeInfo } from '../services/classMarks';
import { racha } from './racha';
import { LOMLOE_COMPETENCES } from './utils';

export type PeriodoResumen = 'semanas' | 'trimestre' | 'curso';
export const PERIODOS: readonly { id: PeriodoResumen; label: string }[] = [
  { id: 'semanas', label: 'Últimas 4 semanas' },
  { id: 'trimestre', label: 'Este trimestre' },
  { id: 'curso', label: 'Todo el curso' },
];

export type TipoDato = 'notas' | 'asistencia' | 'actitud' | 'competencias';

export interface DatoResumen {
  tipo: TipoDato;
  /** El texto, en castellano y con {variables}: la pantalla lo traduce. */
  clave: string;
  vars?: Record<string, string | number>;
  /** Variables cuyo valor es un texto de la app que también se traduce (el nombre de una competencia). */
  traducir?: string[];
  /** El desglose: «Sin tarea ×3», «Participa ×2». */
  detalle?: { etiqueta: string; n: number }[];
  /** Para ordenar: lo que más pesa, primero. */
  peso: number;
}

export interface ResumenAlumno {
  positivos: DatoResumen[];
  atencion: DatoResumen[];
  /** Si en el periodo hay algo anotado del alumno (una nota, un día de asistencia, una anotación o una evaluación). */
  hayDatos: boolean;
}

export interface DatosParaResumen {
  student: Student;
  cls: Class;
  /** Los ids del alumnado de la clase, para comparar con su media. */
  companeros: string[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  attendance: AttendanceMap;
  classMarks: ClassMark[];
  evaluations: Evaluation[];
  /** Hoy, YYYY-MM-DD. */
  hoy: string;
  periodo: PeriodoResumen;
}

/** Cuántos datos se enseñan como mucho a cada lado. */
export const MAX_POR_LADO = 5;

/* ── Fechas ── */

const sumarDias = (iso: string, dias: number): string => {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
};

export interface Rango { desde: string; hasta: string }

/**
 * Las fechas del periodo y las del anterior, para ver si sube o baja. El
 * trimestre va sin calendario escolar, como en PT y AL: de septiembre a
 * diciembre, de enero a marzo y de abril en adelante. El curso empieza el 1 de
 * septiembre y no tiene periodo anterior.
 */
export function rangoDe(periodo: PeriodoResumen, hoy: string): { actual: Rango; anterior: Rango | null } {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const inicio = mes >= 9 ? anio : anio - 1;   // el año en que empezó el curso
  if (periodo === 'semanas') {
    const desde = sumarDias(hoy, -27);
    return { actual: { desde, hasta: hoy }, anterior: { desde: sumarDias(desde, -28), hasta: sumarDias(desde, -1) } };
  }
  if (periodo === 'curso') return { actual: { desde: `${inicio}-09-01`, hasta: `${inicio + 1}-08-31` }, anterior: null };
  const t1 = { desde: `${inicio}-09-01`, hasta: `${inicio}-12-31` };
  const t2 = { desde: `${inicio + 1}-01-01`, hasta: `${inicio + 1}-03-31` };
  const t3 = { desde: `${inicio + 1}-04-01`, hasta: `${inicio + 1}-08-31` };
  if (mes >= 9) return { actual: t1, anterior: null };
  if (mes <= 3) return { actual: t2, anterior: t1 };
  return { actual: t3, anterior: t2 };
}

const dentro = (fecha: string, r: Rango) => fecha >= r.desde && fecha <= r.hasta;
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ── Notas ── */

const asignaturasDe = (c: Class) => (c.subjects?.length ? c.subjects : [c.subject]).filter(Boolean);

/** La media del alumno en una asignatura con las notas dadas: cada categoría con su peso, y dentro de ella, cada nota con el suyo. */
function mediaDeAsignatura(
  d: Pick<DatosParaResumen, 'cls' | 'gradeCategories' | 'grades'>, asignatura: string, items: GradeItem[], alumno: string,
): number | null {
  const principal = asignaturasDe(d.cls)[0] ?? '';
  const cats = d.gradeCategories.filter(c => c.class_id === d.cls.id && !isMarksCategory(c.id) && (c.subject ?? principal) === asignatura);
  let suma = 0, pesos = 0;
  const medias: number[] = [];
  for (const c of cats) {
    const m = mediaDeCategoria(items.filter(i => i.category_id === c.id), d.grades, alumno);
    if (m === null) continue;
    medias.push(m);
    suma += m * c.weight;
    pesos += c.weight;
  }
  if (!medias.length) return null;
  return pesos > 0 ? suma / pesos : medias.reduce((a, b) => a + b, 0) / medias.length;
}

function datosDeNotas(d: DatosParaResumen, actual: Rango, anterior: Rango | null): { pos: DatoResumen[]; neg: DatoResumen[]; hay: boolean } {
  const pos: DatoResumen[] = [], neg: DatoResumen[] = [];
  const alumno = d.student.id;
  const cats = new Set(d.gradeCategories.filter(c => c.class_id === d.cls.id && !isMarksCategory(c.id)).map(c => c.id));
  const deLaClase = d.gradeItems.filter(i => i.class_id === d.cls.id && cats.has(i.category_id));
  // Una nota sin fecha solo cuenta al mirar todo el curso
  const enRango = (r: Rango) => deLaClase.filter(i => (i.date ? dentro(i.date, r) : d.periodo === 'curso'));
  const items = enRango(actual);
  const antes = anterior ? enRango(anterior) : [];

  for (const asignatura of asignaturasDe(d.cls)) {
    const media = mediaDeAsignatura(d, asignatura, items, alumno);
    if (media === null) continue;
    const nota = r1(media);
    if (media >= 7) pos.push({ tipo: 'notas', clave: 'Media de {nota} en {asignatura}', vars: { nota, asignatura }, peso: 60 + (media - 7) * 10 });
    if (media < 5) neg.push({ tipo: 'notas', clave: 'Media de {nota} en {asignatura}, por debajo del 5', vars: { nota, asignatura }, peso: 90 + (5 - media) * 10 });

    // Frente a la clase, si hay con quién comparar y la media no lo ha dicho ya (para no repetir lo mismo dos veces)
    const otras = d.companeros.map(id => mediaDeAsignatura(d, asignatura, items, id)).filter((m): m is number => m !== null);
    if (otras.length >= 3) {
      const dif = r1(media - otras.reduce((a, b) => a + b, 0) / otras.length);
      if (dif >= 1 && media < 7) pos.push({ tipo: 'notas', clave: '{d} puntos por encima de la media de la clase en {asignatura}', vars: { d: dif, asignatura }, peso: 50 + dif * 5 });
      if (dif <= -1 && media >= 5) neg.push({ tipo: 'notas', clave: '{d} puntos por debajo de la media de la clase en {asignatura}', vars: { d: -dif, asignatura }, peso: 70 - dif * 5 });
    }

    // Frente al periodo anterior
    const previa = antes.length ? mediaDeAsignatura(d, asignatura, antes, alumno) : null;
    if (previa !== null) {
      const dif = r1(media - previa);
      if (dif >= 1) pos.push({ tipo: 'notas', clave: 'Ha subido {d} puntos en {asignatura} respecto al periodo anterior', vars: { d: dif, asignatura }, peso: 75 + dif * 2 });
      if (dif <= -1) neg.push({ tipo: 'notas', clave: 'Ha bajado {d} puntos en {asignatura} respecto al periodo anterior', vars: { d: -dif, asignatura }, peso: 85 - dif * 2 });
    }
  }

  // La mejor y la peor nota, y cuántas no llegan al 5
  const suyas = items
    .map(i => ({ i, v: d.grades[i.id]?.[alumno] }))
    .filter((x): x is { i: GradeItem; v: number } => typeof x.v === 'number');
  if (suyas.length) {
    const mejor = suyas.reduce((a, b) => (b.v > a.v ? b : a));
    const peor = suyas.reduce((a, b) => (b.v < a.v ? b : a));
    if (mejor.v >= 8) pos.push({ tipo: 'notas', clave: 'Mejor nota: {nota} en «{actividad}»', vars: { nota: r1(mejor.v), actividad: mejor.i.name }, peso: 40 + (mejor.v - 8) * 5 });
    const bajas = suyas.filter(x => x.v < 5).length;
    if (bajas >= 2) neg.push({ tipo: 'notas', clave: '{n} de {total} notas por debajo de 5', vars: { n: bajas, total: suyas.length }, peso: 80 + bajas });
    // Con una sola nota baja se dice cuál; con varias, ya lo dice la cuenta
    if (bajas === 1) neg.push({ tipo: 'notas', clave: 'Nota más baja: {nota} en «{actividad}»', vars: { nota: r1(peor.v), actividad: peor.i.name }, peso: 65 + (5 - peor.v) * 2 });
  }

  // Lo que la clase ya tiene calificado y él no: puede ser un trabajo sin entregar
  const sinNota = items.filter(i => {
    if (typeof d.grades[i.id]?.[alumno] === 'number') return false;
    const conNota = d.companeros.filter(id => typeof d.grades[i.id]?.[id] === 'number').length;
    return d.companeros.length >= 2 && conNota >= Math.ceil((d.companeros.length - 1) / 2) && conNota > 0;
  });
  if (sinNota.length === 1) neg.push({ tipo: 'notas', clave: 'Sin nota en «{actividad}», que la clase ya tiene calificada', vars: { actividad: sinNota[0].name }, peso: 58 });
  if (sinNota.length > 1) neg.push({ tipo: 'notas', clave: 'Sin nota en {n} actividades que la clase ya tiene calificadas', vars: { n: sinNota.length }, peso: 58 + sinNota.length * 3 });

  return { pos, neg, hay: suyas.length > 0 };
}

/* ── Asistencia ── */

function datosDeAsistencia(d: DatosParaResumen, actual: Rango): { pos: DatoResumen[]; neg: DatoResumen[]; hay: boolean } {
  const pos: DatoResumen[] = [], neg: DatoResumen[] = [];
  let dias = 0, faltas = 0, retrasos = 0, justificadas = 0;
  for (const [fecha, porAlumno] of Object.entries(d.attendance[d.cls.id] ?? {})) {
    const estado = porAlumno[d.student.id];
    if (!estado || !dentro(fecha, actual)) continue;
    dias++;
    if (estado === 'absent') faltas++;
    else if (estado === 'late') retrasos++;
    else if (estado === 'justified') justificadas++;
  }
  if (faltas === 1) neg.push({ tipo: 'asistencia', clave: '1 falta sin justificar', peso: 72 });
  if (faltas > 1) neg.push({ tipo: 'asistencia', clave: '{n} faltas sin justificar', vars: { n: faltas }, peso: Math.min(98, 72 + faltas * 6) });
  if (retrasos >= 2) neg.push({ tipo: 'asistencia', clave: '{n} retrasos', vars: { n: retrasos }, peso: Math.min(90, 50 + retrasos * 5) });
  if (justificadas >= 3) neg.push({ tipo: 'asistencia', clave: '{n} faltas justificadas', vars: { n: justificadas }, peso: 35 + justificadas });
  if (dias >= 5 && faltas + retrasos + justificadas === 0) {
    pos.push({ tipo: 'asistencia', clave: 'Asistencia completa: {n} días sin faltas ni retrasos', vars: { n: dias }, peso: 55 });
  }
  return { pos, neg, hay: dias > 0 };
}

/* ── Actitud y trabajo diario ── */

const suma = (tipo: ClassMarkType) => markTypeInfo(tipo)?.positive ?? false;

function datosDeActitud(d: DatosParaResumen, actual: Rango): { pos: DatoResumen[]; neg: DatoResumen[]; hay: boolean } {
  const pos: DatoResumen[] = [], neg: DatoResumen[] = [];
  const principal = asignaturasDe(d.cls)[0] ?? '';
  const deLaClase = d.classMarks.filter(m => m.class_id === d.cls.id);
  const suyas = deLaClase.filter(m => m.student_id === d.student.id && dentro(m.date, actual));

  // En EF las mismas anotaciones se llaman de otra manera («Juego limpio», «Mala actitud»)
  const etiqueta = (m: ClassMark) =>
    ((esAsignaturaEF(m.subject ?? principal) ? EF_MARK_TYPES : MARK_TYPES).find(x => x.id === m.type) ?? markTypeInfo(m.type))?.label ?? m.type;
  const desglose = (marcas: ClassMark[]) => {
    const n = new Map<string, number>();
    for (const m of marcas) n.set(etiqueta(m), (n.get(etiqueta(m)) ?? 0) + 1);
    return [...n].map(([e, c]) => ({ etiqueta: e, n: c })).sort((a, b) => b.n - a.n);
  };
  const buenas = suyas.filter(m => suma(m.type));
  const malas = suyas.filter(m => !suma(m.type));
  if (buenas.length === 1) pos.push({ tipo: 'actitud', clave: '1 anotación positiva', detalle: desglose(buenas), peso: 45 });
  if (buenas.length > 1) pos.push({ tipo: 'actitud', clave: '{n} anotaciones positivas', vars: { n: buenas.length }, detalle: desglose(buenas), peso: Math.min(80, 45 + buenas.length * 4) });
  if (malas.length === 1) neg.push({ tipo: 'actitud', clave: '1 anotación negativa', detalle: desglose(malas), peso: 60 });
  if (malas.length > 1) neg.push({ tipo: 'actitud', clave: '{n} anotaciones negativas', vars: { n: malas.length }, detalle: desglose(malas), peso: Math.min(96, 60 + malas.length * 6) });

  const dias = racha(deLaClase, d.student.id, d.hoy, suma);
  if (dias >= 3) pos.push({ tipo: 'actitud', clave: 'Racha de {n} días de clase seguidos con buena actitud', vars: { n: dias }, peso: 70 + Math.min(dias, 10) });

  return { pos, neg, hay: suyas.length > 0 };
}

/* ── Competencias clave ── */

function datosDeCompetencias(d: DatosParaResumen, actual: Rango): { pos: DatoResumen[]; neg: DatoResumen[]; hay: boolean } {
  const pos: DatoResumen[] = [], neg: DatoResumen[] = [];
  const evs = d.evaluations.filter(e => e.student_id === d.student.id && dentro(e.date, actual));
  // Sobre 4, como en el acta y los informes: una rúbrica de tres niveles también se pasa a esa escala
  const acum = new Map<string, { s: number; n: number }>();
  for (const ev of evs) {
    const max = ev.max_level && ev.max_level > 0 ? ev.max_level : 4;
    for (const [codigo, v] of Object.entries(ev.competencyScores ?? {})) {
      if (typeof v !== 'number' || !(v > 0)) continue;
      const a = acum.get(codigo.toUpperCase()) ?? { s: 0, n: 0 };
      a.s += (v / max) * 4; a.n++;
      acum.set(codigo.toUpperCase(), a);
    }
  }
  for (const [codigo, a] of acum) {
    const nivel = r1(a.s / a.n);
    const competencia = LOMLOE_COMPETENCES.find(c => c.key === codigo)?.label ?? codigo;
    // Los mismos cortes que los informes: excelente desde 3,5 y necesita mejorar por debajo de 2,5
    if (nivel >= 3.5) pos.push({ tipo: 'competencias', clave: 'Destaca en la competencia {competencia} (nivel {nivel} de 4)', vars: { competencia, nivel }, traducir: ['competencia'], peso: 50 + (nivel - 3.5) * 20 });
    if (nivel < 2.5) neg.push({ tipo: 'competencias', clave: 'Tiene que mejorar la competencia {competencia} (nivel {nivel} de 4)', vars: { competencia, nivel }, traducir: ['competencia'], peso: 60 + (2.5 - nivel) * 20 });
  }
  return { pos, neg, hay: evs.length > 0 };
}

/* ── Todo junto ── */

export function resumenAlumno(d: DatosParaResumen): ResumenAlumno {
  const { actual, anterior } = rangoDe(d.periodo, d.hoy);
  const partes = [datosDeNotas(d, actual, anterior), datosDeAsistencia(d, actual), datosDeActitud(d, actual), datosDeCompetencias(d, actual)];
  const ordenar = (xs: DatoResumen[]) => [...xs].sort((a, b) => b.peso - a.peso).slice(0, MAX_POR_LADO);
  return {
    positivos: ordenar(partes.flatMap(p => p.pos)),
    atencion: ordenar(partes.flatMap(p => p.neg)),
    hayDatos: partes.some(p => p.hay),
  };
}

/** El texto de un dato: traducido, con los decimales como se escriben en el idioma y el desglose detrás. */
export function textoDeDato(d: DatoResumen, t: (clave: string, vars?: Record<string, string | number>) => string, locale: string): string {
  const vars = Object.fromEntries(Object.entries(d.vars ?? {}).map(([k, v]) => [
    k, typeof v === 'number' ? v.toLocaleString(locale, { maximumFractionDigits: 1 }) : d.traducir?.includes(k) ? t(v) : v,
  ]));
  const detalle = d.detalle?.length ? `: ${d.detalle.map(x => (x.n > 1 ? `${t(x.etiqueta)} ×${x.n}` : t(x.etiqueta))).join(', ')}` : '';
  return t(d.clave, vars) + detalle;
}
