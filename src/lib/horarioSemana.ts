/**
 * El horario semanal como una cuadrícula con la hora en vertical (decisión del
 * dueño, 19-10-2026, tras ver su horario escaneado: el patio de las 11:15
 * salía debajo de la clase de las 11:45).
 *
 * Antes cada bloque se metía en la fila de la hora en la que empezaba y se
 * apilaban en el orden en que se habían creado, sin importar su hora ni su
 * duración. Ahora cada bloque va donde le toca: su posición es proporcional
 * a la hora de inicio y su alto, a su duración; los que coinciden en el
 * tiempo van lado a lado. Esta parte es la lógica, sin pantalla.
 */
import type { ScheduleBlock } from '../types';

/** Píxeles por minuto: una hora son 78 px, y una clase de 45 minutos, 58 px. */
export const PX_POR_MIN = 1.3;
/** Los bloques se mueven de 5 en 5 minutos. */
export const PASO_MIN = 5;
export const MIN_DIA = 24 * 60;

export const aMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const deMin = (min: number): string => {
  const m = Math.max(0, Math.min(MIN_DIA, Math.round(min)));
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * De qué hora a qué hora se dibuja la semana, en minutos: de las 8:00 a las
 * 14:00 como mínimo, y hasta donde llegue el último bloque (también las
 * clases de la tarde), o desde donde empiece el primero si es antes de las 8.
 */
export function rangoHorario(blocks: readonly ScheduleBlock[]): { desde: number; hasta: number } {
  let desde = 8 * 60;
  let hasta = 14 * 60;
  for (const b of blocks) {
    const ini = aMin(b.time_start);
    const fin = aMin(b.time_end);
    if (ini < desde) desde = Math.floor(ini / 60) * 60;
    if (fin > hasta) hasta = Math.ceil(fin / 60) * 60;
  }
  return { desde, hasta: Math.min(hasta, MIN_DIA) };
}

export interface BloqueColocado<T extends ScheduleBlock = ScheduleBlock> {
  bloque: T;
  /** Minutos desde el inicio de la cuadrícula. */
  arriba: number;
  alto: number;
  /** Columna dentro de su grupo de bloques que coinciden, y cuántas hay. */
  carril: number;
  carriles: number;
}

/**
 * Coloca los bloques de un día: de arriba abajo por su hora y, si dos
 * coinciden en el tiempo (aunque sea un minuto), cada uno en su carril, lado
 * a lado y del mismo ancho dentro del grupo que se pisa.
 */
export function colocarDia<T extends ScheduleBlock>(blocks: readonly T[], desde: number): BloqueColocado<T>[] {
  const orden = [...blocks]
    .map(bloque => ({ bloque, ini: aMin(bloque.time_start), fin: Math.max(aMin(bloque.time_end), aMin(bloque.time_start) + 1) }))
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin);
  const resultado: BloqueColocado<T>[] = [];
  let grupo: typeof orden = [];
  let finGrupo = -1;

  const cerrar = () => {
    const finCarril: number[] = [];
    const puestos = grupo.map(g => {
      let c = finCarril.findIndex(f => f <= g.ini);
      if (c === -1) { c = finCarril.length; finCarril.push(g.fin); } else finCarril[c] = g.fin;
      return { g, c };
    });
    for (const { g, c } of puestos) {
      resultado.push({ bloque: g.bloque, arriba: g.ini - desde, alto: g.fin - g.ini, carril: c, carriles: finCarril.length });
    }
    grupo = [];
  };

  for (const g of orden) {
    if (grupo.length && g.ini >= finGrupo) cerrar();
    grupo.push(g);
    finGrupo = grupo.length === 1 ? g.fin : Math.max(finGrupo, g.fin);
  }
  if (grupo.length) cerrar();
  return resultado;
}

/**
 * El bloque, cambiado de día y de hora sin cambiar lo que dura. Se ajusta a
 * los pasos de 5 minutos y se queda dentro de la semana (de lunes a viernes) y
 * del día (no sale de la cuadrícula).
 */
export function moverBloque<T extends ScheduleBlock>(
  b: T, cambio: { dias?: number; minutos?: number }, limites: { desde: number; hasta: number },
): T {
  const dur = Math.max(PASO_MIN, aMin(b.time_end) - aMin(b.time_start));
  const dia = Math.max(1, Math.min(5, b.day + Math.round(cambio.dias ?? 0)));
  const bruto = aMin(b.time_start) + (cambio.minutos ?? 0);
  const ajustado = Math.round(bruto / PASO_MIN) * PASO_MIN;
  const ini = Math.max(limites.desde, Math.min(ajustado, limites.hasta - dur));
  return { ...b, day: dia, time_start: deMin(ini), time_end: deMin(ini + dur) };
}

/**
 * Lo que ha movido un arrastre: los minutos por lo que bajó (o subió) el
 * puntero, y los días por la columna sobre la que está. `columnas` son los
 * bordes izquierdo y derecho de cada día, en pantalla.
 */
export function cambioDeArrastre(
  dy: number, xPuntero: number, columnas: readonly { izq: number; der: number }[], diaInicial: number,
): { dias: number; minutos: number } {
  const minutos = dy / PX_POR_MIN;
  if (columnas.length === 0) return { dias: 0, minutos };
  let i = columnas.findIndex(c => xPuntero >= c.izq && xPuntero < c.der);
  if (i === -1) i = xPuntero < columnas[0].izq ? 0 : columnas.length - 1;
  return { dias: i + 1 - diaInicial, minutos };
}
