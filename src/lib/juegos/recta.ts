/**
 * «La recta numérica» (26-11-2026): el segundo juego de matemáticas. Sale un número; cada equipo arrastra su marcador
 * por su propia recta hasta donde cree que está y lo fija; al revelarlo, gana la ronda quien quedó más cerca. Aquí
 * está todo lo que no es pantalla: las rectas y los números de cada tramo, cómo se escriben, la distancia y la
 * partida como un reductor puro (el azar va con semilla dentro del estado). La pantalla es
 * `components/juegos/LaRectaNumerica.tsx`.
 *
 * Tramos (`lib/juegos/tramos.ts`):
 *   - 1.º y 2.º de Primaria: del 0 al 10 y del 0 al 20, con todas las marcas numeradas; el número se enseña también
 *     con puntos en marcos de diez. El marcador se queda en el número entero más cercano al soltarlo (`iman`).
 *   - 3.º y 4.º: del 0 al 100 (marcas de 10 en 10) y del 0 al 1000 (de 100 en 100); el número casi nunca cae en
 *     una marca.
 *   - 5.º y 6.º: decimales con una cifra decimal (del 0 al 1 y del 0 al 10) y fracciones sencillas (medios,
 *     tercios, cuartos, quintos y décimos) del 0 al 1 y del 0 al 2.
 *   - 1.º y 2.º de ESO: enteros de −20 a 20 y de −100 a 100, y fracciones y decimales con negativos (de −2 a 2).
 *   - 3.º y 4.º de ESO: fracciones y decimales mezclados de −3 a 3, raíces no exactas del 0 al 10 (√50), y
 *     expresiones (2,5 · 4, 35 % de 40, ¾ de 12) o un decimal o una fracción en una recta del 0 al 100 %.
 * La cercanía se mide en proporción a la longitud de la recta (`distanciaRelativa`), así que vale lo mismo en
 * cualquier tramo. Los dos equipos reciben siempre el mismo número.
 */
import { azarConSemilla, entre, type Azar } from './cuerda';
import type { Tramo } from './tramos';

export type IndiceEquipo = 0 | 1;

/* ── Las rectas ── */

export interface Recta {
  min: number;
  max: number;
  /** Cada cuánto va una marca pequeña (0: ninguna). */
  menor: number;
  /** Cada cuánto va una marca con su número. */
  mayor: number;
  /** Cómo se escriben los números de las marcas. */
  etiquetas: 'entero' | 'decimal' | 'porcentaje';
  /** Al soltar el marcador, se queda en el múltiplo de esto más cercano (1.º y 2.º de Primaria). */
  iman?: number;
}

/** Lo que se enseña del número que hay que encontrar. El valor de verdad va aparte (`Objetivo.valor`). */
export type Muestra =
  | { tipo: 'numero'; n: number; decimales: number }
  | { tipo: 'fraccion'; num: number; den: number }
  | { tipo: 'raiz'; radicando: number }
  | { tipo: 'producto'; a: number; b: number }
  | { tipo: 'cociente'; a: number; b: number }
  | { tipo: 'cuadrado'; a: number }
  | { tipo: 'porcentajeDe'; p: number; n: number }
  | { tipo: 'fraccionDe'; num: number; den: number; n: number }
  /** En una recta del 0 al 100 %: el número es un decimal o una fracción y su sitio, su porcentaje. */
  | { tipo: 'enPorcentaje'; muestra: { tipo: 'numero'; n: number; decimales: number } | { tipo: 'fraccion'; num: number; den: number } };

export interface Objetivo {
  /** Dónde está de verdad, en las unidades de la recta. */
  valor: number;
  muestra: Muestra;
  recta: Recta;
  /** Con puntos en marcos de diez (1.º y 2.º de Primaria). */
  conPuntos?: boolean;
  /** Para no repetir el mismo número enseguida. */
  clave: string;
}

/* ── Las variantes de cada tramo ── */

export interface Variante { id: string; nombre: string; ejemplo: string }

export const VARIANTES: Record<Tramo, readonly Variante[]> = {
  p12: [
    { id: 'diez', nombre: 'Del 0 al 10', ejemplo: '0 … 10' },
    { id: 'veinte', nombre: 'Del 0 al 20', ejemplo: '0 … 20' },
  ],
  p34: [
    { id: 'cien', nombre: 'Del 0 al 100', ejemplo: '0 … 100' },
    { id: 'mil', nombre: 'Del 0 al 1000', ejemplo: '0 … 1000' },
  ],
  p56: [
    { id: 'decimales', nombre: 'Decimales', ejemplo: '0,7  6,4' },
    { id: 'fracciones', nombre: 'Fracciones', ejemplo: '¾  ⁷⁄₅' },
  ],
  e12: [
    { id: 'enteros', nombre: 'Números enteros', ejemplo: '−13  48' },
    { id: 'racionales', nombre: 'Fracciones y decimales', ejemplo: '−¾  1,4' },
  ],
  e34: [
    { id: 'racionales', nombre: 'Fracciones y decimales', ejemplo: '−⁷⁄₄  2,35' },
    { id: 'raices', nombre: 'Raíces', ejemplo: '√50' },
    { id: 'expresiones', nombre: 'Expresiones y porcentajes', ejemplo: '2,5 · 4' },
  ],
};

export const MEZCLA = 'mezcla';
/** La variante, si existe en el tramo; si no, la mezcla. */
export const varianteParaTramo = (t: Tramo, v: unknown): string =>
  (v === MEZCLA || VARIANTES[t].some(x => x.id === v) ? (v as string) : MEZCLA);

/* ── Los números de cada variante ── */

const RECTAS = {
  diez: { min: 0, max: 10, menor: 1, mayor: 1, etiquetas: 'entero', iman: 1 },
  veinte: { min: 0, max: 20, menor: 1, mayor: 1, etiquetas: 'entero', iman: 1 },
  cien: { min: 0, max: 100, menor: 10, mayor: 10, etiquetas: 'entero' },
  mil: { min: 0, max: 1000, menor: 100, mayor: 100, etiquetas: 'entero' },
  uno: { min: 0, max: 1, menor: 0.1, mayor: 0.5, etiquetas: 'decimal' },
  diezDec: { min: 0, max: 10, menor: 0.5, mayor: 1, etiquetas: 'entero' },
  fraccion1: { min: 0, max: 1, menor: 0, mayor: 1, etiquetas: 'entero' },
  fraccion2: { min: 0, max: 2, menor: 0, mayor: 1, etiquetas: 'entero' },
  veinteNeg: { min: -20, max: 20, menor: 1, mayor: 5, etiquetas: 'entero' },
  cienNeg: { min: -100, max: 100, menor: 10, mayor: 50, etiquetas: 'entero' },
  dosNeg: { min: -2, max: 2, menor: 0.5, mayor: 1, etiquetas: 'entero' },
  tresNeg: { min: -3, max: 3, menor: 0, mayor: 1, etiquetas: 'entero' },
  raiz: { min: 0, max: 10, menor: 0, mayor: 1, etiquetas: 'entero' },
  veinteExp: { min: 0, max: 20, menor: 1, mayor: 5, etiquetas: 'entero' },
  porcentaje: { min: 0, max: 100, menor: 0, mayor: 25, etiquetas: 'porcentaje' },
} as const satisfies Record<string, Recta>;

const unoDe = <T>(azar: Azar, xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)];
const mcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : mcd(b, a % b));
/** Sin el error de coma flotante: 0,1 + 0,2 es 0,3. */
const limpio = (x: number): number => Math.round(x * 1e9) / 1e9 + 0;

const numero = (n: number, decimales = 0, recta: Recta, extra: Partial<Objetivo> = {}): Objetivo =>
  ({ valor: limpio(n), muestra: { tipo: 'numero', n: limpio(n), decimales }, recta, clave: `n${limpio(n)}|${recta.max}`, ...extra });

/** Una fracción irreducible num/den (con signo en el numerador) que no es entera, con su valor dentro de (lo, hi). */
function fraccion(azar: Azar, dens: readonly number[], lo: number, hi: number, recta: Recta, negativas: boolean): Objetivo {
  for (;;) {
    const den = unoDe(azar, dens);
    const signo = negativas && azar() < 0.5 ? -1 : 1;
    const num = signo * entre(azar, 1, Math.floor(Math.max(Math.abs(lo), Math.abs(hi)) * den));
    const v = num / den;
    if (v <= lo || v >= hi || num % den === 0 || mcd(num, den) !== 1) continue;
    return { valor: limpio(v), muestra: { tipo: 'fraccion', num, den }, recta, clave: `f${num}/${den}|${recta.max}` };
  }
}

/** Un decimal con `dec` cifras decimales que no es entero, dentro de (lo, hi). */
function decimal(azar: Azar, dec: number, lo: number, hi: number, recta: Recta): Objetivo {
  const k = 10 ** dec;
  for (;;) {
    const n = entre(azar, Math.ceil(lo * k) + 1, Math.floor(hi * k) - 1);
    if (n % k === 0) continue;
    // Con dos cifras decimales, que la segunda no sea 0 (2,30 es 2,3)
    if (dec === 2 && n % 10 === 0) continue;
    return numero(n / k, dec, recta);
  }
}

type Generador = (azar: Azar) => Objetivo;

const GENERADORES: Record<Tramo, Record<string, Generador>> = {
  p12: {
    diez: azar => numero(entre(azar, 1, 9), 0, RECTAS.diez, { conPuntos: true }),
    veinte: azar => numero(entre(azar, 1, 19), 0, RECTAS.veinte, { conPuntos: true }),
  },
  p34: {
    // Casi nunca en una marca: una de cada diez, sí
    cien: azar => numero(azar() < 0.1 ? 10 * entre(azar, 1, 9) : sinMultiplo(azar, 1, 99, 10), 0, RECTAS.cien),
    mil: azar => numero(azar() < 0.1 ? 100 * entre(azar, 1, 9)
      : azar() < 0.5 ? 10 * sinMultiplo(azar, 1, 99, 10) : sinMultiplo(azar, 1, 999, 10), 0, RECTAS.mil),
  },
  p56: {
    decimales: azar => (azar() < 0.5
      ? numero(unoDe(azar, [1, 2, 3, 4, 6, 7, 8, 9]) / 10, 1, RECTAS.uno)
      : decimal(azar, 1, 0, 10, RECTAS.diezDec)),
    fracciones: azar => (azar() < 0.5
      ? fraccion(azar, [2, 3, 4, 5, 10], 0, 1, RECTAS.fraccion1, false)
      : fraccion(azar, [2, 3, 4, 5, 10], 0, 2, RECTAS.fraccion2, false)),
  },
  e12: {
    enteros: azar => (azar() < 0.5
      ? numero(sinCero(azar, -19, 19), 0, RECTAS.veinteNeg)
      : numero(azar() < 0.15 ? 10 * sinCero(azar, -9, 9) : sinMultiplo(azar, -99, 99, 10), 0, RECTAS.cienNeg)),
    racionales: azar => (azar() < 0.5
      ? fraccion(azar, [2, 3, 4, 5], -2, 2, RECTAS.dosNeg, true)
      : decimal(azar, 1, -2, 2, RECTAS.dosNeg)),
  },
  e34: {
    racionales: azar => (azar() < 0.5
      ? fraccion(azar, [2, 3, 4, 5, 6, 8], -3, 3, RECTAS.tresNeg, true)
      : decimal(azar, 2, -3, 3, RECTAS.tresNeg)),
    raices: azar => {
      let n: number;
      do n = entre(azar, 2, 99); while (Number.isInteger(Math.sqrt(n)));
      return { valor: limpio(Math.sqrt(n)), muestra: { tipo: 'raiz', radicando: n }, recta: RECTAS.raiz, clave: `r${n}` };
    },
    expresiones: azar => expresion(azar),
  },
};

function sinMultiplo(azar: Azar, min: number, max: number, k: number): number {
  for (;;) { const n = entre(azar, min, max); if (n % k !== 0) return n; }
}
function sinCero(azar: Azar, min: number, max: number): number {
  for (;;) { const n = entre(azar, min, max); if (n !== 0) return n; }
}

/** 3.º y 4.º de ESO: una cuenta corta cuyo resultado se busca en una recta del 0 al 20, o un número en una del 0 al 100 %. */
function expresion(azar: Azar): Objetivo {
  const r = RECTAS.veinteExp;
  const con = (valor: number, muestra: Muestra, clave: string, recta: Recta = r): Objetivo =>
    ({ valor: limpio(valor), muestra, recta, clave });
  for (;;) {
    const k = entre(azar, 0, 5);
    let o: Objetivo;
    if (k === 0) {
      // 2,5 · 4, 1,5 · 6, 0,5 · 13…
      const a = unoDe(azar, [0.5, 1.5, 2.5, 3.5, 0.25, 0.75, 1.2]), b = entre(azar, 2, 12);
      o = con(a * b, { tipo: 'producto', a, b }, `p${a}*${b}`);
    } else if (k === 1) {
      const b = unoDe(azar, [4, 5, 8]), a = entre(azar, 5, 19 * b);
      if (a % b === 0) continue;
      o = con(a / b, { tipo: 'cociente', a, b }, `c${a}/${b}`);
    } else if (k === 2) {
      const a = unoDe(azar, [1.5, 2.5, 3.5, 1.2, 0.5, 1.1, 1.3, 4.5]);
      o = con(a * a, { tipo: 'cuadrado', a }, `q${a}`);
    } else if (k === 3) {
      const p = unoDe(azar, [5, 15, 25, 35, 45, 55, 65, 75, 12, 40]), n = unoDe(azar, [20, 30, 40, 60, 80]);
      o = con((p * n) / 100, { tipo: 'porcentajeDe', p, n }, `%${p}/${n}`);
    } else if (k === 4) {
      const den = unoDe(azar, [3, 4, 5, 8]), num = entre(azar, 1, den - 1), n = unoDe(azar, [12, 16, 20, 15, 10, 18]);
      if (mcd(num, den) !== 1) continue;
      o = con((num * n) / den, { tipo: 'fraccionDe', num, den, n }, `fd${num}/${den}/${n}`);
    } else {
      // Un decimal o una fracción en una recta del 0 al 100 %: hay que pasarlo a porcentaje
      if (azar() < 0.5) {
        const n = sinMultiplo(azar, 3, 97, 5) / 100;
        o = con(n * 100, { tipo: 'enPorcentaje', muestra: { tipo: 'numero', n, decimales: 2 } }, `ep${n}`, RECTAS.porcentaje);
      } else {
        const den = unoDe(azar, [3, 5, 6, 8]), num = entre(azar, 1, den - 1);
        if (mcd(num, den) !== 1) continue;
        o = con((num / den) * 100, { tipo: 'enPorcentaje', muestra: { tipo: 'fraccion', num, den } }, `ef${num}/${den}`, RECTAS.porcentaje);
      }
    }
    // Dentro de la recta y sin caer en un extremo
    if (o.valor > o.recta.min && o.valor < o.recta.max) return o;
  }
}

/** Un número del tramo y la variante (en la mezcla, de cualquiera de las del tramo), que no sea de `recientes` si se puede. */
export function generarObjetivo(tramo: Tramo, variante: string, azar: Azar, recientes: readonly string[] = []): Objetivo {
  const v = varianteParaTramo(tramo, variante);
  const ids = v === MEZCLA ? VARIANTES[tramo].map(x => x.id) : [v];
  let o: Objetivo | null = null;
  for (let i = 0; i < 40; i++) {
    o = GENERADORES[tramo][unoDe(azar, ids)](azar);
    if (!recientes.includes(o.clave)) return o;
  }
  return o!;
}

/* ── Posiciones y distancias ── */

export const longitud = (r: Recta): number => r.max - r.min;
/** De la posición en la recta (0 el principio, 1 el final) a su valor, y al revés. */
export const valorEn = (r: Recta, fraccionDeRecta: number): number =>
  r.min + Math.min(1, Math.max(0, fraccionDeRecta)) * longitud(r);
export const fraccionDe = (r: Recta, valor: number): number => (valor - r.min) / longitud(r);
/** Dentro de la recta y redondeado a la milésima de su longitud (dos marcadores pueden quedar empatados). */
export function ajustar(r: Recta, valor: number): number {
  const paso = longitud(r) / 1000;
  return limpio(Math.min(r.max, Math.max(r.min, Math.round((valor - r.min) / paso) * paso + r.min)));
}
/** Con imán, al múltiplo más cercano. */
export const conIman = (r: Recta, valor: number): number =>
  (r.iman ? limpio(Math.round(valor / r.iman) * r.iman) : valor);
/** Lo lejos que queda del número, en proporción a la longitud de la recta (0: en el sitio; 1: de punta a punta). */
export const distanciaRelativa = (r: Recta, pos: number, valor: number): number => Math.abs(pos - valor) / longitud(r);
/** Menos de esto (un 1 % de la recta) es una «¡Diana!». */
export const DIANA = 0.01;

/**
 * Quién gana la ronda: el que quedó más cerca; empatados, los dos. Un equipo que no ha puesto su marcador no puntúa
 * (el otro gana aunque esté lejos); si ninguno lo ha puesto, nadie.
 */
export function ganadoresDeRonda(d: readonly [number | null, number | null]): IndiceEquipo[] {
  const [a, b] = d;
  if (a === null && b === null) return [];
  if (a === null) return [1];
  if (b === null) return [0];
  if (Math.abs(a - b) < 1e-9) return [0, 1];
  return a < b ? [0] : [1];
}

/* ── La partida ── */

export const RONDAS = [5, 7, 10] as const;
export type RondasRecta = typeof RONDAS[number];
/** Segundos para poner el marcador; 0, sin tiempo (la ronda acaba cuando los dos lo fijan). */
export const TIEMPOS = [10, 15, 20, 30, 0] as const;
export type TiempoRecta = typeof TIEMPOS[number];
/** El tiempo de partida de cada tramo: más en Primaria y más ritmo en ESO. */
export const tiempoDeTramo = (t: Tramo): TiempoRecta => (t.startsWith('e') ? 15 : 20);
/** Rondas de desempate como mucho: después, empate. */
export const MAX_DESEMPATES = 3;

export interface EquipoRecta {
  /** Dónde está su marcador; `null` si aún no lo ha tocado. */
  pos: number | null;
  fijado: boolean;
  puntos: number;
}

export interface RondaJugada {
  objetivo: Objetivo;
  pos: [number | null, number | null];
  distancias: [number | null, number | null];
  ganadores: IndiceEquipo[];
}

export interface PartidaRecta {
  tramo: Tramo;
  variante: string;
  rondas: RondasRecta;
  semilla: number;
  /** La ronda en juego, desde 0. */
  n: number;
  objetivo: Objetivo;
  equipos: [EquipoRecta, EquipoRecta];
  /** Apuntando (se mueven los marcadores), revelada (se ve el número y quién ha ganado) o fin de la partida. */
  fase: 'apuntando' | 'revelada' | 'fin';
  historial: RondaJugada[];
  recientes: string[];
  /** Al acabar: quién gana (los dos, si siguen empatados tras los desempates). */
  ganador: IndiceEquipo[] | null;
  /** La ronda en juego es de desempate. */
  desempate: boolean;
}

export type AccionRecta =
  | { tipo: 'mover'; equipo: IndiceEquipo; valor: number }
  | { tipo: 'soltar'; equipo: IndiceEquipo }
  | { tipo: 'fijar'; equipo: IndiceEquipo }
  | { tipo: 'tiempo' }
  | { tipo: 'siguiente' };

const RECIENTES = 12;

const equipoNuevo = (puntos = 0): EquipoRecta => ({ pos: null, fijado: false, puntos });

export function nuevaPartidaRecta(tramo: Tramo, variante: string, rondas: RondasRecta, semilla: number): PartidaRecta {
  const r = azarConSemilla(semilla);
  const v = varianteParaTramo(tramo, variante);
  const objetivo = generarObjetivo(tramo, v, r.azar);
  return {
    tramo, variante: v, rondas, semilla: r.semilla(), n: 0, objetivo, equipos: [equipoNuevo(), equipoNuevo()],
    fase: 'apuntando', historial: [], recientes: [objetivo.clave], ganador: null, desempate: false,
  };
}

function conEquipo(p: PartidaRecta, i: IndiceEquipo, eq: EquipoRecta): PartidaRecta {
  return { ...p, equipos: i === 0 ? [eq, p.equipos[1]] : [p.equipos[0], eq] };
}

function revelar(p: PartidaRecta): PartidaRecta {
  const { recta, valor } = p.objetivo;
  const pos: [number | null, number | null] = [p.equipos[0].pos, p.equipos[1].pos];
  const distancias = pos.map(x => (x === null ? null : distanciaRelativa(recta, x, valor))) as [number | null, number | null];
  const ganadores = ganadoresDeRonda(distancias);
  const equipos = p.equipos.map((e, i) => ({ ...e, fijado: true, puntos: e.puntos + (ganadores.includes(i as IndiceEquipo) ? 1 : 0) })) as [EquipoRecta, EquipoRecta];
  return { ...p, equipos, fase: 'revelada', historial: [...p.historial, { objetivo: p.objetivo, pos, distancias, ganadores }] };
}

export function reducirRecta(p: PartidaRecta, a: AccionRecta): PartidaRecta {
  const r = p.objetivo.recta;
  switch (a.tipo) {
    case 'mover': {
      const eq = p.equipos[a.equipo];
      if (p.fase !== 'apuntando' || eq.fijado || !Number.isFinite(a.valor)) return p;
      const pos = ajustar(r, a.valor);
      return pos === eq.pos ? p : conEquipo(p, a.equipo, { ...eq, pos });
    }
    case 'soltar': {
      const eq = p.equipos[a.equipo];
      if (p.fase !== 'apuntando' || eq.fijado || eq.pos === null) return p;
      const pos = conIman(r, eq.pos);
      return pos === eq.pos ? p : conEquipo(p, a.equipo, { ...eq, pos });
    }
    case 'fijar': {
      const eq = p.equipos[a.equipo];
      if (p.fase !== 'apuntando' || eq.fijado || eq.pos === null) return p;
      const q = conEquipo(p, a.equipo, { ...eq, pos: conIman(r, eq.pos), fijado: true });
      return q.equipos[0].fijado && q.equipos[1].fijado ? revelar(q) : q;
    }
    case 'tiempo': {
      if (p.fase !== 'apuntando') return p;
      // Lo que cada uno tenía puesto, con imán
      const equipos = p.equipos.map(e => (e.pos === null ? e : { ...e, pos: conIman(r, e.pos) })) as [EquipoRecta, EquipoRecta];
      return revelar({ ...p, equipos });
    }
    case 'siguiente': {
      if (p.fase !== 'revelada') return p;
      const [a0, a1] = [p.equipos[0].puntos, p.equipos[1].puntos];
      const jugadas = p.n + 1;
      if (jugadas >= p.rondas && (a0 !== a1 || jugadas >= p.rondas + MAX_DESEMPATES)) {
        const ganador: IndiceEquipo[] = a0 === a1 ? [0, 1] : a0 > a1 ? [0] : [1];
        return { ...p, fase: 'fin', ganador };
      }
      const az = azarConSemilla(p.semilla);
      const objetivo = generarObjetivo(p.tramo, p.variante, az.azar, p.recientes);
      return {
        ...p, n: jugadas, objetivo, semilla: az.semilla(), fase: 'apuntando', desempate: jugadas >= p.rondas,
        equipos: [equipoNuevo(a0), equipoNuevo(a1)], recientes: [...p.recientes, objetivo.clave].slice(-RECIENTES),
      };
    }
  }
}

/* ── Cómo se escriben ── */

export const MENOS = '−';

/** Un número con sus decimales, con coma (castellano y catalán) o punto (inglés) y el signo menos de verdad. */
export function escribir(n: number, decimales: number, ingles: boolean): string {
  const s = Math.abs(n).toFixed(decimales);
  return `${n < 0 && Number(s) !== 0 ? MENOS : ''}${ingles ? s : s.replace('.', ',')}`;
}

/** Cuántos decimales hacen falta para escribir un número de una marca (0,5 lleva uno; 1, ninguno). */
export const decimalesDe = (x: number): number => {
  const s = String(limpio(x));
  return s.includes('.') ? s.split('.')[1].length : 0;
};

/** El número de una marca de la recta. */
export function etiquetaDeMarca(r: Recta, x: number, ingles: boolean): string {
  if (r.etiquetas === 'porcentaje') return `${escribir(x, 0, ingles)}${ingles ? '%' : ' %'}`;
  return escribir(x, r.etiquetas === 'decimal' ? decimalesDe(x) : decimalesDe(x), ingles);
}

/** Las marcas de una recta: su valor y si llevan número. */
export function marcasDe(r: Recta): { x: number; mayor: boolean }[] {
  const paso = r.menor > 0 ? r.menor : r.mayor;
  const n = Math.round(longitud(r) / paso);
  const out: { x: number; mayor: boolean }[] = [];
  for (let k = 0; k <= n; k++) {
    const x = limpio(r.min + k * paso);
    const q = (x - r.min) / r.mayor;
    out.push({ x, mayor: Math.abs(q - Math.round(q)) < 1e-6 });
  }
  return out;
}

/** La distancia en las unidades de la recta, para enseñarla («a 3», «a 0,25»). */
export function distanciaEnTexto(r: Recta, pos: number, valor: number, ingles: boolean): string {
  const d = Math.abs(pos - valor);
  const dec = r.iman ? 0 : longitud(r) >= 100 ? 0 : longitud(r) > 10 ? 1 : 2;
  const s = escribir(d, dec, ingles);
  return r.etiquetas === 'porcentaje' ? `${s}${ingles ? '%' : ' %'}` : s;
}

/** El número de verdad en las unidades de la recta, para la bandera que se revela. */
export function valorEnTexto(o: Objetivo, ingles: boolean): string {
  const v = o.valor;
  const exacto = Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
  const dec = Number.isInteger(limpio(v)) ? 0 : exacto ? decimalesDe(Math.round(v * 100) / 100) : 2;
  const s = `${exacto ? '' : '≈ '}${escribir(v, dec, ingles)}`;
  return o.recta.etiquetas === 'porcentaje' ? `${s}${ingles ? '%' : ' %'}` : s;
}
