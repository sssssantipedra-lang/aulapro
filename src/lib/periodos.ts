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
