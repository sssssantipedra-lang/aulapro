/**
 * Las fechas de cada evaluación (19-11-2026). Hasta ahora el periodo del acta
 * («1ª evaluación», «2ª evaluación»…) era solo una etiqueta: el acta de la
 * segunda llevaba la media de todo el curso. Ahora cada evaluación tiene un
 * rango de fechas y el acta cuenta las notas y las evaluaciones de ese rango.
 *
 * De partida van los trimestres naturales (septiembre a diciembre, enero a
 * marzo y abril en adelante, los mismos que usa «Lo más relevante»); como
 * cada centro cierra sus evaluaciones cuando quiere, el docente puede cambiar
 * las fechas, y se recuerdan en el dispositivo para ese curso. «Final de
 * curso» es todo el curso, sin filtro.
 */
import { PERIODS } from './utils';

export interface RangoDeFechas { desde: string; hasta: string }

const CLAVE = 'aulapro_evaluaciones_fechas';

/** El año en que empezó el curso al que pertenece un día (el curso va de septiembre a agosto). */
export function inicioDeCurso(hoy: string): number {
  const anio = Number(hoy.slice(0, 4));
  return Number(hoy.slice(5, 7)) >= 9 ? anio : anio - 1;
}

/** Las fechas de partida de una evaluación; `null` en «Final de curso», que es todo el curso. */
export function rangoDePartida(periodo: string, hoy: string): RangoDeFechas | null {
  const a = inicioDeCurso(hoy);
  if (periodo === PERIODS[0]) return { desde: `${a}-09-01`, hasta: `${a}-12-31` };
  if (periodo === PERIODS[1]) return { desde: `${a + 1}-01-01`, hasta: `${a + 1}-03-31` };
  if (periodo === PERIODS[2]) return { desde: `${a + 1}-04-01`, hasta: `${a + 1}-08-31` };
  return null;
}

const esFecha = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Las fechas que el docente cambió en este dispositivo, por evaluación, para el curso de `hoy`. */
export function rangosGuardados(hoy: string): Record<string, RangoDeFechas> {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Record<string, Record<string, unknown>>;
    const delCurso = todo?.[String(inicioDeCurso(hoy))] ?? {};
    const out: Record<string, RangoDeFechas> = {};
    for (const [periodo, r] of Object.entries(delCurso)) {
      const x = r as Partial<RangoDeFechas> | null;
      if (x && esFecha(x.desde) && esFecha(x.hasta) && x.desde <= x.hasta) out[periodo] = { desde: x.desde, hasta: x.hasta };
    }
    return out;
  } catch { return {}; }
}

export function guardarRango(periodo: string, rango: RangoDeFechas, hoy: string): void {
  try {
    const curso = String(inicioDeCurso(hoy));
    // Solo se guarda el curso en marcha: las fechas del anterior ya no sirven
    localStorage.setItem(CLAVE, JSON.stringify({ [curso]: { ...rangosGuardados(hoy), [periodo]: rango } }));
  } catch { /* sin almacenamiento: valen las de partida */ }
}

/** El rango que cuenta en una evaluación: el que cambió el docente o el de partida. `null` = todo el curso. */
export function rangoDe(periodo: string, hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): RangoDeFechas | null {
  const partida = rangoDePartida(periodo, hoy);
  return partida ? (guardados[periodo] ?? partida) : null;
}

/** Si una fecha cae en el rango. Sin rango cuenta todo, y lo que no tiene fecha cuenta siempre. */
export function enRango(fecha: string | undefined | null, rango: RangoDeFechas | null): boolean {
  if (!rango || !fecha) return true;
  const dia = fecha.slice(0, 10);
  return dia >= rango.desde && dia <= rango.hasta;
}

/** En qué evaluación del curso cae un día («2026-1», «2026-2», «2026-3»), con las fechas de cada una. */
export function evaluacionDe(dia: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(dia)): string {
  const n = PERIODS.slice(0, 3).findIndex(p => enRango(dia, rangoDe(p, dia, guardados)));
  // Un día que no cae en ninguna (hueco entre dos, verano): la primera que empiece después, o la última
  const siguiente = n >= 0 ? n : PERIODS.slice(0, 3).findIndex(p => (rangoDe(p, dia, guardados)?.desde ?? '') > dia);
  return `${inicioDeCurso(dia)}-${(siguiente >= 0 ? siguiente : 2) + 1}`;
}

const otroDia = (iso: string, dias: number) => {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Las fechas de las tres evaluaciones tras cambiar las de una, sin dejar días en medio: si se adelanta el
 * último día de una, la siguiente empieza al día siguiente, y si se retrasa el primero de una, la anterior
 * acaba la víspera. Así una nota del 10 de diciembre no se queda fuera de la 1.ª y de la 2.ª a la vez. El
 * vecino solo se mueve si con ello sigue teniendo al menos un día.
 */
export function conVecinos(periodo: string, rango: RangoDeFechas, hoy: string, guardados: Record<string, RangoDeFechas>): Record<string, RangoDeFechas> {
  const i = PERIODS.slice(0, 3).findIndex(p => p === periodo);
  const out = { ...guardados, [periodo]: rango };
  if (i < 0) return out;
  const de = (k: number) => rangoDe(PERIODS[k], hoy, out) as RangoDeFechas;
  if (i < 2) {
    const sig = de(i + 1), desde = otroDia(rango.hasta, 1);
    if (desde !== sig.desde && desde <= sig.hasta) out[PERIODS[i + 1]] = { desde, hasta: sig.hasta };
  }
  if (i > 0) {
    const ant = de(i - 1), hasta = otroDia(rango.desde, -1);
    if (hasta !== ant.hasta && hasta >= ant.desde) out[PERIODS[i - 1]] = { desde: ant.desde, hasta };
  }
  return out;
}

/** Guarda de una vez las fechas de varias evaluaciones del curso de `hoy`. */
export function guardarRangos(rangos: Record<string, RangoDeFechas>, hoy: string): void {
  try { localStorage.setItem(CLAVE, JSON.stringify({ [String(inicioDeCurso(hoy))]: rangos })); } catch { /* sin almacenamiento */ }
}

/* ── Una sola noción de evaluación para toda la app (20-11-2026) ──
 * El cuaderno, las actas y lo que venga después (informes, competencias) eligen la evaluación con el mismo
 * selector («1.ª · 2.ª · 3.ª · Curso»), la recuerdan en el dispositivo y deciden con `cuentaEn` qué entra
 * en cada una. */

/** Las tres evaluaciones del curso, sin «Final de curso». */
export const EVALUACIONES: readonly string[] = PERIODS.slice(0, 3);
/** «Final de curso»: todo el curso, sin filtro de fechas. */
export const CURSO_ENTERO: string = PERIODS[3];

/** La clave de una evaluación del curso de `hoy` («2026-2»), la misma forma que da `evaluacionDe`; `null` en «Final de curso». */
export function claveDe(periodo: string, hoy: string): string | null {
  const n = EVALUACIONES.indexOf(periodo);
  return n < 0 ? null : `${inicioDeCurso(hoy)}-${n + 1}`;
}

/** La evaluación en la que cae hoy. */
export function periodoDeHoy(hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): string {
  return EVALUACIONES[Number(evaluacionDe(hoy, guardados).slice(-1)) - 1] ?? EVALUACIONES[0];
}

/**
 * La evaluación del curso de `hoy` en la que cuenta algo con esa fecha, o `null` si no tiene fecha o es de
 * otro curso. Un día que no cae en ningún rango (antes del primer día de la 1.ª, después del último de la
 * 3.ª) cuenta en la evaluación más cercana, como en `evaluacionDe`: nada de este curso se queda sin evaluación.
 */
export function periodoDeFecha(fecha: string | undefined | null, hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): string | null {
  if (!fecha || !esFecha(fecha.slice(0, 10))) return null;
  const dia = fecha.slice(0, 10);
  if (inicioDeCurso(dia) !== inicioDeCurso(hoy)) return null;
  return EVALUACIONES[Number(evaluacionDe(dia, guardados).slice(-1)) - 1] ?? null;
}

/**
 * Si algo con esa fecha (una actividad del cuaderno, una anotación, una evaluación con rúbrica) cuenta en
 * `periodo`. En «Final de curso» cuenta todo. Lo que no tiene fecha cuenta siempre: no se puede saber de
 * cuándo es y esconderlo sería perderlo de vista. Lo de otro curso no cuenta en ninguna evaluación de este.
 */
export function cuentaEn(fecha: string | undefined | null, periodo: string, hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): boolean {
  if (!EVALUACIONES.includes(periodo)) return true;
  if (!fecha || !esFecha(fecha.slice(0, 10))) return true;
  return periodoDeFecha(fecha, hoy, guardados) === periodo;
}

/**
 * Si dos fechas caen en la misma evaluación del mismo curso. Es lo que decide si una rúbrica usada otra vez
 * escribe en la columna que ya tenía o en una nueva. Sin alguna de las dos fechas no se puede distinguir:
 * cuentan como la misma.
 */
export function mismaEvaluacion(a: string | undefined | null, b: string | undefined | null): boolean {
  const da = (a ?? '').slice(0, 10), db = (b ?? '').slice(0, 10);
  if (!esFecha(da) || !esFecha(db)) return true;
  return evaluacionDe(da) === evaluacionDe(db);
}

const CLAVE_ELEGIDA = 'aulapro_evaluacion_elegida';

/**
 * La evaluación que se está viendo, la misma en el cuaderno y en las actas. De entrada es la de hoy; lo que
 * elige el docente se recuerda en el dispositivo mientras dure la evaluación en la que lo eligió: al empezar
 * la siguiente, la app vuelve a abrir la que toca (si en enero se quedó mirando la 1.ª para cerrar notas, en
 * abril no sigue ahí).
 */
export function periodoElegido(hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): string {
  const deHoy = periodoDeHoy(hoy, guardados);
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE_ELEGIDA) ?? 'null') as { periodo?: unknown; cuando?: unknown } | null;
    if (x && x.cuando === evaluacionDe(hoy, guardados) && typeof x.periodo === 'string' && (PERIODS as readonly string[]).includes(x.periodo)) return x.periodo;
  } catch { /* sin almacenamiento o con algo que no se entiende: la de hoy */ }
  return deHoy;
}

export function guardarPeriodoElegido(periodo: string, hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): void {
  try { localStorage.setItem(CLAVE_ELEGIDA, JSON.stringify({ periodo, cuando: evaluacionDe(hoy, guardados) })); } catch { /* sin almacenamiento */ }
}

/**
 * El día que se propone a una actividad nueva para que caiga en la evaluación que se está viendo: hoy si hoy
 * es de esa evaluación; si ya pasó, su último día, y si aún no ha empezado, el primero. En «Final de curso», hoy.
 */
export function diaParaNueva(periodo: string, hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy)): string {
  const rango = rangoDe(periodo, hoy, guardados);
  if (!rango || cuentaEn(hoy, periodo, hoy, guardados)) return hoy;
  return hoy > rango.hasta ? rango.hasta : rango.desde;
}
