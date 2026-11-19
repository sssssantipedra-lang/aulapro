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
