/**
 * El informe de seguimiento para las familias, por reglas y sin IA (20-11-2026, mejora elegida por el dueño
 * tras la revisión a fondo: sin clave de Gemini la pantalla de Informes no servía para nada).
 *
 * Una hoja con lo que ya sabe la app del alumno en una evaluación: las notas por categoría, la asistencia,
 * la tabla de competencias clave (la valoración la fija el código, `lib/tablaCompetencias.ts`) y las frases
 * de «Lo positivo» y «A mejorar», que salen de las mismas reglas que «Lo más relevante» de la ficha
 * (`lib/resumenAlumno.ts`). Sale al instante, sin clave ni cupo, y nada sale del dispositivo.
 *
 * Cada regla tiene aquí su frase para la familia: respetuosa, concreta, sin jerga y sin comparar con el
 * resto de la clase. Las reglas que comparan («por encima de la media de la clase») no tienen frase y no
 * entran. El docente ve de qué dato sale cada frase (`FraseSeguimiento.origen`); la familia, no.
 *
 * El periodo es la evaluación elegida en toda la app (`lib/periodos.ts`): las notas son las del cuaderno
 * de esa evaluación (`lib/cuadernoEvaluacion.ts`) y la asistencia, las anotaciones y las evaluaciones con
 * rúbricas y dianas se filtran con `cuentaEn`.
 */
import type {
  AttendanceMap, Class, CompetencyReport, Evaluation, FraseSeguimiento, InformeSeguimiento, NotasSeguimiento,
  SeccionSeguimiento, Student,
} from '../types';
import { blockConfig, blockKey, isMarksCategory, nombreDelBloque, type MarksInput } from '../services/classMarks';
import { aUnDecimal, categoriasDe, cuadernoDe, notasDeCurso, reglaFinal, type VistaDeCuaderno, type NotasDeCurso } from './cuadernoEvaluacion';
import { CURSO_ENTERO, cuentaEn, EVALUACIONES, rangoDe, rangosGuardados, type RangoDeFechas } from './periodos';
import { mediaDeCategoria, mediaPonderada } from './ponderacion';
import { datosDelAlumno, textoDeDato, type Cuentas, type DatoResumen, type TipoDato } from './resumenAlumno';
import { notasPorClave, valoracionDeNota, type FilaCompetencia } from './tablaCompetencias';
import { LOMLOE_COMPETENCES } from './utils';

type T = (clave: string, vars?: Record<string, string | number>) => string;

/** Cuántas frases lleva el informe como mucho a cada lado, como «Lo más relevante». */
export const MAX_FRASES = 5;
/** Y cuántas de ellas pueden ser de competencias clave: con siete competencias flojas, el informe sería una lista. */
export const MAX_DE_COMPETENCIAS = 2;

const NOMBRE_TIPO: Record<TipoDato, string> = {
  notas: 'Notas', asistencia: 'Asistencia', actitud: 'Actitud y trabajo diario', competencias: 'Competencias',
};

/* ── Las frases para la familia ── */

/**
 * Cada competencia clave dicha con palabras corrientes, para una frase que empieza por «Destaca en» o
 * «Necesita reforzar». El nombre oficial ya sale en la tabla de competencias del informe.
 */
export const ASPECTO_DE_COMPETENCIA: Record<string, string> = {
  CCL: 'la comunicación, de palabra y por escrito',
  CP: 'el uso de otras lenguas',
  STEM: 'el razonamiento matemático y científico',
  CD: 'el uso de las herramientas digitales',
  CPSAA: 'la organización del trabajo y la autonomía para aprender',
  CC: 'la convivencia y la participación en el grupo',
  CE: 'la iniciativa para llevar adelante sus ideas',
  CCEC: 'la expresión artística y cultural',
};

/**
 * Las anotaciones de clase dichas para una familia. «Sin aseo» o «Mal comportamiento» son etiquetas rápidas
 * del docente; en un informe se dice qué pasó, sin calificar al alumno.
 */
export const ANOTACION_PARA_FAMILIA: Record<string, string> = {
  'Sin tarea': 'tarea sin hacer',
  'Sin material': 'material sin traer',
  'Mal comportamiento': 'comportamiento que debe mejorar',
  'Buen comportamiento': 'buen comportamiento',
  'Participa': 'participación',
  'Se esfuerza': 'esfuerzo',
  'No participa': 'falta de participación',
  'Juego limpio': 'juego limpio',
  'Mala actitud': 'actitud que debe mejorar',
  'Sin equipación': 'equipación sin traer',
  'Sin aseo': 'bolsa de aseo sin traer',
};

/**
 * La frase para la familia de cada regla de `lib/resumenAlumno.ts`, por la clave del dato. `null` es que
 * la regla no se le dice a la familia (compara con el resto de la clase). Una regla nueva que no esté aquí
 * tampoco sale en el informe: hay que escribirle su frase (una prueba avisa).
 */
export const FRASE_FAMILIA: Record<string, string | { una: string; varias: string } | null> = {
  // Notas
  'Media de {nota} en {asignatura}': 'En {asignatura} su nota es de {nota} sobre 10, un buen resultado.',
  'Media de {nota} en {asignatura}, por debajo del 5': 'En {asignatura} su nota es de {nota} sobre 10: todavía no llega al 5 y conviene reforzar la materia.',
  '{d} puntos por encima de la media de la clase en {asignatura}': null,
  '{d} puntos por debajo de la media de la clase en {asignatura}': null,
  'Ha subido {d} puntos en {asignatura} respecto al periodo anterior': {
    una: 'Su nota en {asignatura} ha subido 1 punto respecto a la evaluación anterior.',
    varias: 'Su nota en {asignatura} ha subido {d} puntos respecto a la evaluación anterior.',
  },
  'Ha bajado {d} puntos en {asignatura} respecto al periodo anterior': {
    una: 'Su nota en {asignatura} ha bajado 1 punto respecto a la evaluación anterior.',
    varias: 'Su nota en {asignatura} ha bajado {d} puntos respecto a la evaluación anterior.',
  },
  'Mejor nota: {nota} en «{actividad}»': 'Su mejor resultado ha sido un {nota} en «{actividad}».',
  '{n} de {total} notas por debajo de 5': '{n} de sus {total} calificaciones de este periodo están por debajo del 5.',
  'Nota más baja: {nota} en «{actividad}»': 'Su calificación más baja ha sido un {nota} en «{actividad}».',
  'Sin nota en «{actividad}», que la clase ya tiene calificada': 'Tiene pendiente «{actividad}», que todavía no está calificada.',
  'Sin nota en {n} actividades que la clase ya tiene calificadas': 'Tiene {n} actividades pendientes, que todavía no están calificadas.',
  // Asistencia
  '1 falta sin justificar': 'Ha faltado a clase 1 día sin justificante.',
  '{n} faltas sin justificar': 'Ha faltado a clase {n} días sin justificante.',
  '{n} retrasos': 'Ha llegado tarde a clase {n} veces.',
  '{n} faltas justificadas': 'Ha faltado a clase {n} días con justificante: conviene que se ponga al día con lo trabajado esos días.',
  'Asistencia completa: {n} días sin faltas ni retrasos': 'Ha asistido a todas las clases y con puntualidad ({n} días registrados).',
  // Actitud y trabajo diario
  '1 anotación positiva': 'En clase se ha recogido 1 anotación positiva sobre su trabajo y su actitud: {detalle}.',
  '{n} anotaciones positivas': 'En clase se han recogido {n} anotaciones positivas sobre su trabajo y su actitud: {detalle}.',
  '1 anotación negativa': 'En clase se ha recogido 1 anotación sobre algo que debe mejorar: {detalle}.',
  '{n} anotaciones negativas': 'En clase se han recogido {n} anotaciones sobre aspectos que debe mejorar: {detalle}.',
  'Racha de {n} días de clase seguidos con buena actitud': 'Lleva {n} días de clase seguidos con buena actitud.',
  // Competencias clave
  'Destaca en la competencia {competencia} (nivel {nivel} de 4)': 'Destaca en {aspecto}.',
  'Tiene que mejorar la competencia {competencia} (nivel {nivel} de 4)': 'Necesita reforzar {aspecto}.',
};

/** Todos los textos de este archivo que la pantalla traduce (una prueba exige que estén en inglés y en catalán). */
export function textosParaTraducir(): string[] {
  const frases = Object.values(FRASE_FAMILIA).flatMap(f => (f === null ? [] : typeof f === 'string' ? [f] : [f.una, f.varias]));
  return [...frases, ...Object.values(ASPECTO_DE_COMPETENCIA), ...Object.values(ANOTACION_PARA_FAMILIA), '{cosa} ({n} veces)'];
}

/** El desglose de unas anotaciones, para dentro de una frase: «participación (2 veces), esfuerzo». */
function detalleParaFamilia(d: DatoResumen, t: T): string {
  return (d.detalle ?? [])
    .map(x => {
      const cosa = t(ANOTACION_PARA_FAMILIA[x.etiqueta] ?? x.etiqueta);
      return x.n > 1 ? t('{cosa} ({n} veces)', { cosa, n: x.n }) : cosa;
    })
    .join(', ');
}

/**
 * La frase de un dato escrita para la familia, o `null` si esa regla no se le dice (compara con la clase,
 * o es una regla sin frase todavía).
 */
export function fraseParaFamilia(d: DatoResumen, t: T, locale: string): string | null {
  const f = FRASE_FAMILIA[d.clave];
  if (!f) return null;
  const vars: Record<string, string | number> = Object.fromEntries(Object.entries(d.vars ?? {}).map(([k, v]) => [
    k, typeof v === 'number' ? v.toLocaleString(locale, { maximumFractionDigits: 1 }) : v,
  ]));
  if (d.tipo === 'competencias') {
    const codigo = LOMLOE_COMPETENCES.find(c => c.label === d.vars?.competencia)?.key ?? String(d.vars?.competencia ?? '');
    const aspecto = ASPECTO_DE_COMPETENCIA[codigo];
    if (!aspecto) return null;
    vars.aspecto = t(aspecto);
  }
  if (d.tipo === 'actitud' && d.detalle?.length) vars.detalle = detalleParaFamilia(d, t);
  const clave = typeof f === 'string' ? f : (d.vars?.d === 1 ? f.una : f.varias);
  // Una frase que pide el desglose y no lo tiene se quedaría con «{detalle}» a la vista
  if (clave.includes('{detalle}') && !vars.detalle) return null;
  return t(clave, vars);
}

/** De qué dato sale una frase, para el docente: «Notas: Media de 8,2 en Matemáticas». */
export const origenDe = (d: DatoResumen, t: T, locale: string): string => `${t(NOMBRE_TIPO[d.tipo])}: ${textoDeDato(d, t, locale)}`;

function frasesDe(datos: DatoResumen[], t: T, locale: string): FraseSeguimiento[] {
  const out: FraseSeguimiento[] = [];
  let deCompetencias = 0;
  for (const d of datos) {
    // Las competencias ya van todas en su tabla: en frases, solo las que más pesan
    if (d.tipo === 'competencias' && deCompetencias === MAX_DE_COMPETENCIAS) continue;
    const texto = fraseParaFamilia(d, t, locale);
    if (!texto) continue;
    out.push({ texto, origen: origenDe(d, t, locale) });
    if (d.tipo === 'competencias') deCompetencias++;
    if (out.length === MAX_FRASES) break;
  }
  return out;
}

/* ── Los datos del periodo ── */

const asignaturasDe = (c: Class) => (c.subjects?.length ? c.subjects : [c.subject]).filter(Boolean);

/** La evaluación anterior a una, para ver si el alumno sube o baja; ni la 1.ª ni «Final de curso» la tienen. */
export function periodoAnterior(periodo: string): string | null {
  const n = EVALUACIONES.indexOf(periodo);
  return n > 0 ? EVALUACIONES[n - 1] : null;
}

/** Qué fechas cuentan en el informe de una evaluación, con las mismas reglas que el cuaderno y el acta. */
export function cuentasDePeriodo(periodo: string, hoy: string, rangos: Record<string, RangoDeFechas> = rangosGuardados(hoy)): Cuentas {
  const anterior = periodoAnterior(periodo);
  return {
    actual: f => cuentaEn(f, periodo, hoy, rangos),
    // Lo que no tiene fecha cuenta en todas las evaluaciones: no sirve para comparar una con otra
    anterior: anterior ? (f => !!f && cuentaEn(f, anterior, hoy, rangos)) : null,
  };
}

/** Lo que se calcula una vez por clase y periodo, para hacer después el informe de cada alumno. */
export interface ClaseDelPeriodo {
  cls: Class;
  periodo: string;
  hoy: string;
  rangos: Record<string, RangoDeFechas>;
  /** El cuaderno completo de la clase (sin filtrar por fechas), del que parten las reglas. */
  entrada: MarksInput;
  /** El cuaderno de la evaluación: sus actividades y el bloque de anotaciones de sus fechas. */
  vista: VistaDeCuaderno;
  /** El cuaderno de la evaluación anterior, para decir si la nota sube o baja; `null` en la 1.ª y en «Final de curso». */
  vistaAnterior: VistaDeCuaderno | null;
  /** En «Final de curso», las notas de cada evaluación y la final de cada asignatura. */
  deCurso: Map<string, Map<string, NotasDeCurso>> | null;
  cuentas: Cuentas;
}

export function claseDelPeriodo(
  d: MarksInput, cls: Class, periodo: string, hoy: string, rangos: Record<string, RangoDeFechas> = rangosGuardados(hoy),
): ClaseDelPeriodo {
  const entrada: MarksInput = {
    ...d, classes: [cls], students: d.students.filter(s => s.class_id === cls.id),
    gradeCategories: d.gradeCategories.filter(c => c.class_id === cls.id),
    gradeItems: d.gradeItems.filter(i => i.class_id === cls.id),
    classMarks: d.classMarks.filter(m => m.class_id === cls.id),
  };
  const vista = cuadernoDe(entrada, periodo, hoy, rangos);
  let deCurso: ClaseDelPeriodo['deCurso'] = null;
  if (periodo === CURSO_ENTERO) {
    deCurso = new Map();
    for (const asignatura of asignaturasDe(cls)) {
      const regla = reglaFinal(d.marksConfigs[blockKey(cls.id, asignatura)]);
      deCurso.set(asignatura, notasDeCurso(entrada, cls, asignatura, regla, hoy, rangos).notas);
    }
  }
  const anterior = periodoAnterior(periodo);
  const vistaAnterior = anterior ? cuadernoDe(entrada, anterior, hoy, rangos) : null;
  return { cls, periodo, hoy, rangos, entrada, vista, vistaAnterior, deCurso, cuentas: cuentasDePeriodo(periodo, hoy, rangos) };
}

/** La nota de un alumno en una asignatura en una vista del cuaderno; `null` si solo tiene el bloque de anotaciones. */
function notaEnVista(vista: VistaDeCuaderno, cls: Class, asignatura: string, alumno: string): number | null {
  const cats = categoriasDe(vista, cls, asignatura);
  const propias = new Set(cats.filter(c => !isMarksCategory(c.id)).map(c => c.id));
  const tieneNotas = vista.gradeItems.some(i => propias.has(i.category_id) && typeof vista.grades[i.id]?.[alumno] === 'number');
  return tieneNotas ? aUnDecimal(mediaPonderada(cats, vista.gradeItems, vista.grades, alumno)) : null;
}

/**
 * Las reglas de `lib/resumenAlumno.ts` que hablan de la nota media de una asignatura la calculan sin el
 * bloque «Trabajo diario y actitud» y con sus propias fechas. En el informe la frase va al lado de la tabla
 * de calificaciones, así que tiene que decir la misma nota que ella (la del cuaderno de la evaluación, con
 * el bloque y con la regla de la nota final): esas reglas se cambian por estas, con los mismos umbrales y
 * los mismos pesos, hechas con la nota a un decimal que la familia lee.
 */
const REGLAS_DE_MEDIA = new Set([
  'Media de {nota} en {asignatura}', 'Media de {nota} en {asignatura}, por debajo del 5',
  'Ha subido {d} puntos en {asignatura} respecto al periodo anterior', 'Ha bajado {d} puntos en {asignatura} respecto al periodo anterior',
  '{d} puntos por encima de la media de la clase en {asignatura}', '{d} puntos por debajo de la media de la clase en {asignatura}',
]);

export function datosDeLaNota(c: ClaseDelPeriodo, alumno: string, notas: readonly NotasSeguimiento[]): { pos: DatoResumen[]; neg: DatoResumen[] } {
  const pos: DatoResumen[] = [], neg: DatoResumen[] = [];
  for (const { asignatura, media } of notas) {
    if (media === null) continue;
    if (media >= 7) pos.push({ tipo: 'notas', clave: 'Media de {nota} en {asignatura}', vars: { nota: media, asignatura }, peso: 60 + (media - 7) * 10 });
    if (media < 5) neg.push({ tipo: 'notas', clave: 'Media de {nota} en {asignatura}, por debajo del 5', vars: { nota: media, asignatura }, peso: 90 + (5 - media) * 10 });
    const previa = c.vistaAnterior ? notaEnVista(c.vistaAnterior, c.cls, asignatura, alumno) : null;
    if (previa === null) continue;
    const dif = Math.round((media - previa) * 10) / 10;
    if (dif >= 1) pos.push({ tipo: 'notas', clave: 'Ha subido {d} puntos en {asignatura} respecto al periodo anterior', vars: { d: dif, asignatura }, peso: 75 + dif * 2 });
    if (dif <= -1) neg.push({ tipo: 'notas', clave: 'Ha bajado {d} puntos en {asignatura} respecto al periodo anterior', vars: { d: -dif, asignatura }, peso: 85 - dif * 2 });
  }
  return { pos, neg };
}

/** Las notas del alumno en cada asignatura de la clase, con sus categorías; solo las asignaturas en las que tiene alguna. */
export function notasDelPeriodo(c: ClaseDelPeriodo, alumno: string, t: T = k => k): NotasSeguimiento[] {
  const out: NotasSeguimiento[] = [];
  for (const asignatura of asignaturasDe(c.cls)) {
    const cats = categoriasDe(c.vista, c.cls, asignatura);
    const total = cats.reduce((a, x) => a + x.weight, 0);
    const categorias = cats.map(cat => ({
      nombre: isMarksCategory(cat.id) ? nombreDelBloque(blockConfig(c.entrada.marksConfigs, c.cls.id, asignatura), t, asignatura) : cat.name,
      peso: total > 0 ? Math.round((cat.weight / total) * 100) : 0,
      media: aUnDecimal(mediaDeCategoria(c.vista.gradeItems.filter(i => i.category_id === cat.id), c.vista.grades, alumno)),
      ...(isMarksCategory(cat.id) ? { bloque: true } : {}),
    }));
    // Solo con el bloque de anotaciones (todo el alumnado parte de la misma nota) no hay nada que contar
    if (!categorias.some(x => x.media !== null && !x.bloque)) continue;
    const curso = c.deCurso?.get(asignatura)?.get(alumno);
    const media = curso ? curso.final : mediaPonderada(cats, c.vista.gradeItems, c.vista.grades, alumno);
    out.push({
      asignatura, media: aUnDecimal(media), categorias,
      ...(curso ? { evaluaciones: curso.evaluaciones.map(aUnDecimal) } : {}),
    });
  }
  return out;
}

/** La asistencia anotada del alumno en el periodo; `null` si no hay ningún día. */
export function asistenciaDelPeriodo(
  attendance: AttendanceMap, claseId: string, alumno: string, cuenta: (fecha: string) => boolean,
): InformeSeguimiento['asistencia'] {
  let dias = 0, faltas = 0, justificadas = 0, retrasos = 0;
  for (const [fecha, porAlumno] of Object.entries(attendance[claseId] ?? {})) {
    const estado = porAlumno[alumno];
    if (!estado || !cuenta(fecha)) continue;
    dias++;
    if (estado === 'absent') faltas++;
    else if (estado === 'justified') justificadas++;
    else if (estado === 'late') retrasos++;
  }
  return dias > 0 ? { dias, faltas, justificadas, retrasos } : null;
}

/** La tabla de competencias clave por reglas: la valoración sale de las notas y el comentario queda para el docente. */
export function tablaPorReglas(evaluaciones: readonly Evaluation[]): FilaCompetencia[] {
  const notas = notasPorClave(evaluaciones);
  return LOMLOE_COMPETENCES
    .filter(c => c.key in notas)
    .map(c => ({ clave: c.key, valoracion: valoracionDeNota(notas[c.key]), comentario: '' }));
}

export interface DatosDeSeguimiento {
  clase: ClaseDelPeriodo;
  student: Student;
  attendance: AttendanceMap;
  /** Las evaluaciones con rúbricas, dianas y escalas (todas: aquí se filtran por alumno y por fechas). */
  evaluations: readonly Evaluation[];
  t: T;
  locale: string;
}

export interface SeguimientoCompuesto {
  seguimiento: InformeSeguimiento;
  tabla: FilaCompetencia[];
  /** Si en el periodo hay algo anotado del alumno: sin nada, el informe sería una hoja vacía. */
  hayDatos: boolean;
}

/** El informe de seguimiento de un alumno, recién calculado: lo que el docente revisa antes de guardarlo. */
export function componerSeguimiento({ clase, student, attendance, evaluations, t, locale }: DatosDeSeguimiento): SeguimientoCompuesto {
  const { cls, periodo, hoy, rangos, entrada, cuentas } = clase;
  const suyas = evaluations.filter(e => e.student_id === student.id && e.class_id === cls.id);
  const datos = datosDelAlumno({
    student, cls, companeros: entrada.students.map(s => s.id),
    gradeCategories: [...entrada.gradeCategories], gradeItems: [...entrada.gradeItems], grades: entrada.grades,
    attendance, classMarks: [...entrada.classMarks], evaluations: suyas,
    hoy, periodo: periodo === CURSO_ENTERO ? 'curso' : 'trimestre', cuenta: cuentas,
  });
  const rango = rangoDe(periodo, hoy, rangos);
  const notas = notasDelPeriodo(clase, student.id, t);
  const deLaNota = datosDeLaNota(clase, student.id, notas);
  const conLaNota = (xs: DatoResumen[], suyos: DatoResumen[]) => [...xs.filter(x => !REGLAS_DE_MEDIA.has(x.clave)), ...suyos].sort((a, b) => b.peso - a.peso);
  const asistencia = asistenciaDelPeriodo(attendance, cls.id, student.id, cuentas.actual);
  const tabla = tablaPorReglas(suyas.filter(e => cuentas.actual(e.date)));
  return {
    seguimiento: {
      ...(rango ? { desde: rango.desde, hasta: rango.hasta } : {}),
      notas, asistencia,
      positivos: frasesDe(conLaNota(datos.positivos, deLaNota.pos), t, locale),
      mejorar: frasesDe(conLaNota(datos.atencion, deLaNota.neg), t, locale),
      observacion: '',
    },
    tabla,
    hayDatos: datos.hayDatos || notas.length > 0 || asistencia !== null || tabla.length > 0,
  };
}

/* ── Guardar y recalcular ── */

const limpias = (xs: readonly FraseSeguimiento[]): FraseSeguimiento[] =>
  xs.map(f => ({ ...f, texto: f.texto.replace(/\s+/g, ' ').trim() })).filter(f => f.texto);

/** La hoja como se guarda: sin frases vacías y con la observación recortada. */
export function seguimientoLimpio(s: InformeSeguimiento): InformeSeguimiento {
  const ocultar = (s.ocultar ?? []).filter((x, i, xs) => xs.indexOf(x) === i);
  const { ocultar: _antes, ...resto } = s;
  void _antes;
  return {
    ...resto,
    positivos: limpias(s.positivos), mejorar: limpias(s.mejorar), observacion: s.observacion.trim(),
    ...(ocultar.length ? { ocultar } : {}),
  };
}

/**
 * La hoja recalculada con los datos de ahora, sin perder lo que el docente escribió: su observación, las
 * partes que decidió no entregar, las frases que añadió a mano (las que no salen de ningún dato), los
 * comentarios de la tabla de competencias y la redacción que dio a una frase cuyo dato sigue igual (mismo
 * `origen`: si cambió «Ha faltado a clase 3 días sin justificante» por sus palabras y las faltas siguen
 * siendo 3, se quedan sus palabras). Las frases cuyo dato ha cambiado se cambian por las nuevas.
 */
export function recalcular(
  antes: Pick<CompetencyReport, 'seguimiento' | 'tabla'>, ahora: SeguimientoCompuesto,
): { seguimiento: InformeSeguimiento; tabla: FilaCompetencia[] } {
  const prev = antes.seguimiento;
  const aMano = (xs: readonly FraseSeguimiento[] | undefined) => (xs ?? []).filter(f => !f.origen && f.texto.trim());
  const comentario = new Map((antes.tabla ?? []).map(f => [f.clave, f.comentario]));
  const conSuRedaccion = (nuevas: readonly FraseSeguimiento[], viejas: readonly FraseSeguimiento[] | undefined) => {
    const escrito = new Map((viejas ?? []).filter(f => f.origen && f.texto.trim()).map(f => [f.origen, f.texto]));
    return nuevas.map(f => (f.origen && escrito.has(f.origen) ? { ...f, texto: escrito.get(f.origen) as string } : f));
  };
  return {
    seguimiento: {
      ...ahora.seguimiento,
      positivos: [...conSuRedaccion(ahora.seguimiento.positivos, prev?.positivos), ...aMano(prev?.positivos)],
      mejorar: [...conSuRedaccion(ahora.seguimiento.mejorar, prev?.mejorar), ...aMano(prev?.mejorar)],
      observacion: prev?.observacion ?? '',
      ...(prev?.ocultar?.length ? { ocultar: prev.ocultar } : {}),
    },
    tabla: ahora.tabla.map(f => ({ ...f, comentario: comentario.get(f.clave) ?? '' })),
  };
}

/**
 * Quién firma el texto de un informe al guardarlo, para el pie del documento: sin texto, nadie (`reglas`);
 * el que la IA redactó sigue siendo suyo aunque el docente lo corrija (el pie dice «con asistencia de
 * inteligencia artificial y revisado por el docente») y deja de serlo si el docente lo vacía y escribe otro
 * en una edición posterior; lo demás lo ha escrito el docente.
 */
export function origenDelTexto(texto: string, previo?: Pick<CompetencyReport, 'text' | 'origen'>): NonNullable<CompetencyReport['origen']> {
  if (!texto.trim()) return 'reglas';
  const antes = previo?.text.trim() ? (previo.origen ?? 'ia') : null;
  return antes === 'ia' ? 'ia' : 'mano';
}

/**
 * Si los números de la hoja guardada ya no son los de ahora (se puso una nota, se pasó lista o se evaluó
 * después de hacer el informe, o cambiaron las fechas de la evaluación): la pantalla lo avisa y ofrece
 * «Actualizar los datos». Solo mira los datos que el docente no escribe: calificaciones, asistencia y la
 * valoración de cada competencia.
 */
export function datosCambiados(guardado: Pick<CompetencyReport, 'seguimiento' | 'tabla'>, ahora: SeguimientoCompuesto): boolean {
  const s = guardado.seguimiento;
  if (!s) return false;
  const notas = (xs: readonly NotasSeguimiento[]) => xs.map(n => [n.asignatura, n.media, n.evaluaciones ?? null, n.categorias.map(c => [c.peso, c.media, !!c.bloque])]);
  const tabla = (xs: readonly FilaCompetencia[] | undefined) => (xs ?? []).map(f => [f.clave, f.valoracion === 'mal' ? 'mejorable' : f.valoracion]);
  const de = (x: Pick<InformeSeguimiento, 'notas' | 'asistencia' | 'desde' | 'hasta'>, t: readonly FilaCompetencia[] | undefined) =>
    JSON.stringify([notas(x.notas), x.asistencia, x.desde ?? null, x.hasta ?? null, tabla(t)]);
  return de(s, guardado.tabla) !== de(ahora.seguimiento, ahora.tabla);
}

/** Si una parte de la hoja se entrega (el docente puede quitar las notas, la asistencia o las competencias). */
export const seVe = (s: Pick<InformeSeguimiento, 'ocultar'>, parte: SeccionSeguimiento): boolean => !(s.ocultar ?? []).includes(parte);

/** Si la hoja tiene algo que entregar además de la cabecera. */
export function tieneContenido(r: Pick<CompetencyReport, 'seguimiento' | 'tabla' | 'text'>): boolean {
  const s = r.seguimiento;
  if (r.text.trim()) return true;
  if (!s) return false;
  return (seVe(s, 'notas') && s.notas.length > 0) || (seVe(s, 'asistencia') && !!s.asistencia)
    || (seVe(s, 'competencias') && (r.tabla?.length ?? 0) > 0)
    || s.positivos.length > 0 || s.mejorar.length > 0 || !!s.observacion.trim();
}
