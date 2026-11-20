/**
 * Generadores al instante, por código y sin IA (20-11-2026): una sopa de letras o un crucigrama
 * desde una lista de palabras, una hoja de operaciones con su solucionario exacto y fracciones
 * con pizzas. Salen como una ficha «Cuaderno» normal: se retoca en el editor, se guarda y se
 * imprime igual que las demás.
 *
 * Las reglas de las fichas se cumplen aquí, no en la pantalla: las hojas con tres ejercicios o
 * más van de menos a más en los tres bloques de la escalera (las operaciones se ordenan por lo
 * que cuestan y las fracciones pasan de leer a colorear y a unir), y toda cuenta y toda solución
 * las calcula el código. Nada sale del dispositivo.
 *
 * Puro: de `services/` solo usa tipos.
 */
import type { FichaActivity, FichaContent, FichaExercise } from '../services/resources';
import type { Lang } from '../i18n';
import { buildWordSearchGrid, normalizeLetters, type WordSearchPlacement } from './wordSearch';
import { buildCrossword, type Crossword } from './crossword';
import { fraccionesParaEjercicio, type ModoFracciones } from './fraccionesDibujo';
import { DIFICULTADES, perfilDeCurso, type Dificultad } from './escalera';

type Tr = (k: string, vars?: Record<string, string | number>) => string;

export type GeneradorInstante = 'sopa' | 'crucigrama' | 'operaciones' | 'fracciones';
export const GENERADORES_INSTANTE: readonly GeneradorInstante[] = ['sopa', 'crucigrama', 'operaciones', 'fracciones'];

/** Lo que devuelve un generador: la ficha y, si algo de lo pedido no ha podido entrar, qué. */
export interface FichaInstante {
  content: FichaContent;
  /** Palabras que no han cabido en la sopa o no cruzan con ninguna en el crucigrama. */
  fuera: string[];
}

const base = (titulo: string): Pick<FichaContent, 'titulo' | 'explicacion' | 'instrucciones' | 'estilo' | 'formato'> =>
  ({ titulo, explicacion: '', instrucciones: '', estilo: 'cuaderno', formato: 'ficha' });

/* ── Palabras ── */

export const MIN_PALABRAS_SOPA = 3;
export const MAX_PALABRAS_SOPA = 16;
/** La rejilla más grande de la sopa mide 16: una palabra más larga no cabe. */
export const MAX_LETRAS_PALABRA = 15;
export const MIN_PALABRAS_CRUCIGRAMA = 2;
export const MAX_PALABRAS_CRUCIGRAMA = 14;

/** Una lista de palabras escrita a mano: una por línea, o separadas por comas o punto y coma; sin repetidas. */
export function palabrasDeTexto(texto: string): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const trozo of texto.split(/[\n,;]+/)) {
    const palabra = trozo.trim().replace(/\s+/g, ' ');
    const clave = normalizeLetters(palabra);
    if (clave.length < 2 || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(palabra);
  }
  return out;
}

export interface PistaEscrita { palabra: string; pista: string }

/**
 * Las líneas «palabra: pista» de un crucigrama. La palabra va antes de los dos puntos (o de un guion
 * o un tabulador, como al pegar dos columnas de una hoja de cálculo); las líneas sin pista se devuelven
 * aparte, porque una palabra sin pista no se puede adivinar.
 */
export function pistasDeTexto(texto: string): { pistas: PistaEscrita[]; sinPista: string[] } {
  const vistas = new Set<string>();
  const pistas: PistaEscrita[] = [];
  const sinPista: string[] = [];
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    if (!l) continue;
    const m = /^([^:\t]+?)\s*(?::|\t|\s[-–—]\s)\s*(.*)$/.exec(l);
    const palabra = (m ? m[1] : l).trim();
    const pista = (m ? m[2] : '').trim();
    const clave = normalizeLetters(palabra);
    if (clave.length < 2 || vistas.has(clave)) continue;
    vistas.add(clave);
    if (pista) pistas.push({ palabra, pista });
    else sinPista.push(palabra);
  }
  return { pistas, sinPista };
}

const FLECHA: Record<string, string> = { '0,1': '→', '1,0': '↓', '1,1': '↘', '1,-1': '↙' };

/** Dónde está cada palabra de la sopa, para el docente: «SOL: fila 3, columna 5 →». */
export function solucionSopa(posiciones: WordSearchPlacement[], t: Tr): string {
  return posiciones.map(p => t('{palabra}: fila {f}, columna {c} {flecha}', {
    palabra: p.palabra, f: p.fila + 1, c: p.columna + 1, flecha: FLECHA[p.dir.join(',')] ?? '',
  })).join('; ');
}

/** Las palabras del crucigrama por su número, para el docente: «Horizontales: 1. SOL; 3. LUNA. Verticales: 2. MAR». */
export function solucionCrucigrama(cw: Crossword, t: Tr): string {
  const de = (dir: 'H' | 'V') => cw.entradas.filter(e => e.dir === dir).map(e => `${e.numero}. ${e.palabra}`).join('; ');
  const h = de('H'), v = de('V');
  return [h ? `${t('Horizontales')}: ${h}` : '', v ? `${t('Verticales')}: ${v}` : ''].filter(Boolean).join('. ');
}

export interface PedidoSopa { titulo?: string; palabras: string[] }

/** Una ficha con una sopa de letras: las palabras que caben, su rejilla y dónde está cada una. */
export function fichaSopa(p: PedidoSopa, t: Tr): FichaInstante {
  const validas = p.palabras.map(x => x.trim()).filter(x => normalizeLetters(x).length >= 2);
  // Una palabra que no cabe ni en la rejilla más grande no se intenta: la haría crecer para nada
  const pedidas = validas.filter(x => normalizeLetters(x).length <= MAX_LETRAS_PALABRA).slice(0, MAX_PALABRAS_SOPA);
  // Con espacios o guiones («arco iris») se busca todo seguido: en la lista sale como se escribió
  const { rejilla, posiciones } = buildWordSearchGrid(pedidas);
  const colocadas = new Set(posiciones.map(x => x.palabra));
  const palabras = pedidas.map(x => x.toUpperCase()).filter(x => colocadas.has(x));
  const fuera = validas.filter(x => !colocadas.has(x.toUpperCase()));
  const ex: FichaExercise = {
    tipo: 'sopa_letras',
    enunciado: t('Busca estas {n} palabras en la sopa de letras. Pueden estar en horizontal, en vertical o en diagonal.', { n: palabras.length }),
    palabras, rejilla, posiciones,
    solucion: solucionSopa(posiciones, t),
  };
  return {
    content: { ...base(p.titulo?.trim() || t('Sopa de letras')), actividades: [{ titulo: t('Sopa de letras'), ejercicios: [ex] }] },
    fuera,
  };
}

const INTENTOS_CRUCIGRAMA = 30;

export interface PedidoCrucigrama { titulo?: string; pistas: PistaEscrita[] }

/** Una ficha con un crucigrama: la cuadrícula la monta el código y las palabras que no cruzan con ninguna se quedan fuera. */
export function fichaCrucigrama(p: PedidoCrucigrama, t: Tr, rand: () => number = Math.random): FichaInstante {
  const pedidas = p.pistas.filter(x => normalizeLetters(x.palabra).length >= 2 && x.pista.trim()).slice(0, MAX_PALABRAS_CRUCIGRAMA);
  // El orden de los cruces se sortea: de varios intentos se queda el que más palabras coloca y, a igualdad, el más recogido
  let crucigrama = buildCrossword(pedidas, rand);
  for (let intento = 1; intento < INTENTOS_CRUCIGRAMA && crucigrama.entradas.length < pedidas.length; intento++) {
    const otro = buildCrossword(pedidas, rand);
    const mejor = otro.entradas.length > crucigrama.entradas.length
      || (otro.entradas.length === crucigrama.entradas.length && otro.filas * otro.columnas < crucigrama.filas * crucigrama.columnas);
    if (mejor) crucigrama = otro;
  }
  const dentro = new Set(crucigrama.entradas.map(e => e.palabra));
  const pistas = pedidas.filter(x => dentro.has(normalizeLetters(x.palabra)));
  const fuera = pedidas.filter(x => !dentro.has(normalizeLetters(x.palabra))).map(x => x.palabra);
  const ex: FichaExercise = {
    tipo: 'crucigrama',
    enunciado: t('Lee las pistas y completa el crucigrama.'),
    pistas, crucigrama,
    solucion: solucionCrucigrama(crucigrama, t),
  };
  return {
    content: { ...base(p.titulo?.trim() || t('Crucigrama')), actividades: [{ titulo: t('Crucigrama'), ejercicios: [ex] }] },
    fuera,
  };
}

/* ── Operaciones ── */

export type Operacion = 'suma' | 'resta' | 'multiplicacion' | 'division';
export const OPERACIONES: readonly Operacion[] = ['suma', 'resta', 'multiplicacion', 'division'];

/** Las claves (en castellano) del nombre de cada operación, en plural. */
export const NOMBRE_OPERACION: Record<Operacion, string> = {
  suma: 'Sumas', resta: 'Restas', multiplicacion: 'Multiplicaciones', division: 'Divisiones',
};

export const MIN_OPERACIONES = 6;
export const MAX_OPERACIONES = 60;
export const MAX_NUMERO = 999999;
/** El otro número de una multiplicación y el divisor de una división: de una cifra o 10, como en las tablas. */
export const FACTOR_MIN = 2;
export const FACTOR_MAX = 10;

export interface PedidoOperaciones {
  titulo?: string;
  operaciones: Operacion[];
  /** Entre qué números se mueven los datos (los dos incluidos). */
  min: number;
  max: number;
  /** Cuántas cuentas en total. */
  cantidad: number;
  /** Sumas sin llevar y restas sin pedir prestado. */
  sinLlevadas?: boolean;
  /** Dónde se escribe el resultado. Sin él, en una caja. */
  respuesta?: 'linea' | 'caja';
}

export interface Cuenta {
  op: Operacion;
  a: number;
  b: number;
  resultado: number;
}

/**
 * Entre qué números propone la hoja moverse según el curso («2º Primaria», «1º ESO A»): es solo el punto de
 * partida del formulario, que el docente cambia. Sin curso reconocible, del 1 al 20.
 */
export function rangoSugerido(nivel: string | undefined): { min: number; max: number } {
  const p = perfilDeCurso(nivel);
  if (p.banda === 'ciclo1') return p.curso <= 1 ? { min: 1, max: 10 } : { min: 1, max: 50 };
  if (p.banda === 'ciclo2') return p.curso <= 3 ? { min: 10, max: 200 } : { min: 10, max: 999 };
  if (p.banda === 'ciclo3') return { min: 100, max: 9999 };
  if (p.banda === 'eso' || p.banda === 'bachillerato') return { min: 10, max: 999 };
  return { min: 1, max: 20 };
}

/** El signo de cada operación tal como se escribe en un cuaderno: la división, con dos puntos (en inglés, ÷). */
export function signoDe(op: Operacion, lang: Lang = 'es'): string {
  return op === 'suma' ? '+' : op === 'resta' ? '−' : op === 'multiplicacion' ? '×' : lang === 'en' ? '÷' : ':';
}

export const cuentaTexto = (c: Cuenta, lang: Lang = 'es'): string => `${c.a} ${signoDe(c.op, lang)} ${c.b}`;

/** El resultado de una cuenta, calculado aquí y solo aquí. */
export function resultadoDe(op: Operacion, a: number, b: number): number {
  return op === 'suma' ? a + b : op === 'resta' ? a - b : op === 'multiplicacion' ? a * b : a / b;
}

const cifras = (n: number): number[] => String(Math.abs(Math.trunc(n))).split('').reverse().map(Number);

/** Cuántas veces hay que llevarse una al sumar (o pedir prestado al restar), columna a columna. */
export function llevadas(op: Operacion, a: number, b: number): number {
  if (op !== 'suma' && op !== 'resta') return 0;
  const x = cifras(a), y = cifras(b);
  let n = 0, acarreo = 0;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0, q = y[i] ?? 0;
    if (op === 'suma') {
      acarreo = p + q + acarreo >= 10 ? 1 : 0;
    } else {
      acarreo = p - acarreo < q ? 1 : 0;
    }
    n += acarreo;
  }
  return n;
}

/**
 * Lo que cuesta una cuenta, para ordenarlas de menos a más: pesan las cifras del número más grande,
 * las llevadas y la operación (sumar antes que restar, y multiplicar y dividir después).
 */
export function pesoDeCuenta(c: Cuenta): number {
  const mayor = Math.max(c.a, c.b, c.resultado);
  const orden: Record<Operacion, number> = { suma: 0, resta: 2, multiplicacion: 5, division: 7 };
  return String(mayor).length * 10 + llevadas(c.op, c.a, c.b) * 4 + orden[c.op] + Math.min(0.99, mayor / (MAX_NUMERO * 10));
}

const limpiarRango = (min: number, max: number): [number, number] => {
  const a = Math.max(0, Math.min(MAX_NUMERO, Math.round(Number(min) || 0)));
  const b = Math.max(0, Math.min(MAX_NUMERO, Math.round(Number(max) || 0)));
  return a <= b ? [a, b] : [b, a];
};

/** Un segundo número que no obliga a llevarse nada: cada cifra, a lo sumo la que le falta a la del primero para llegar a 9 (o, al restar, la suya). */
function sinLlevarCon(op: 'suma' | 'resta', a: number, entre: (lo: number, hi: number) => number): number {
  const b = cifras(a).map(d => entre(0, op === 'suma' ? 9 - d : d)).reverse().join('');
  return Number(b);
}

/** Una cuenta de `op` con los números entre `min` y `max`; `null` si en ese rango no hay ninguna. */
function unaCuenta(op: Operacion, min: number, max: number, sinLlevadas: boolean, rand: () => number): Cuenta | null {
  const entre = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  if (op === 'suma' || op === 'resta') {
    for (let intento = 0; intento < 60; intento++) {
      let a = entre(min, max), b = entre(min, max);
      if (op === 'resta' && a < b) [a, b] = [b, a];
      if (!sinLlevadas || llevadas(op, a, b) === 0) return { op, a, b, resultado: resultadoDe(op, a, b) };
    }
    if (!sinLlevadas) return null;
    // En ese rango casi no hay cuentas sin llevar: el segundo número se monta cifra a cifra, aunque quede por debajo del mínimo
    for (let intento = 0; intento < 60; intento++) {
      const a = entre(min, max);
      const b = sinLlevarCon(op, a, entre);
      if (b > 0 && b <= max) return { op, a, b, resultado: resultadoDe(op, a, b) };
    }
    return null;
  }
  if (op === 'multiplicacion') {
    const a = entre(min, max), b = entre(FACTOR_MIN, FACTOR_MAX);
    return { op, a, b, resultado: a * b };
  }
  // División exacta: el dividendo, dentro del rango, es un múltiplo del divisor
  for (let intento = 0; intento < 60; intento++) {
    const b = entre(FACTOR_MIN, FACTOR_MAX);
    const qMin = Math.max(1, Math.ceil(min / b)), qMax = Math.floor(max / b);
    if (qMax < qMin) continue;
    const q = entre(qMin, qMax);
    return { op, a: b * q, b, resultado: q };
  }
  return null;
}

/**
 * Las cuentas de una hoja: repartidas entre las operaciones pedidas, sin repetir mientras el rango dé
 * para ello, y ordenadas de la que menos cuesta a la que más. Puede devolver menos de las pedidas si en
 * el rango no hay tantas distintas (del 1 al 3 solo hay nueve sumas).
 */
export function generarCuentas(p: PedidoOperaciones, rand: () => number = Math.random): Cuenta[] {
  const ops = OPERACIONES.filter(o => p.operaciones.includes(o));
  if (!ops.length) return [];
  const [min, max] = limpiarRango(p.min, p.max);
  const cantidad = Math.max(1, Math.min(MAX_OPERACIONES, Math.round(Number(p.cantidad) || 0)));
  const vistas = new Set<string>();
  const out: Cuenta[] = [];
  for (let i = 0; i < cantidad; i++) {
    const op = ops[i % ops.length];
    let elegida: Cuenta | null = null;
    for (let intento = 0; intento < 40; intento++) {
      const c = unaCuenta(op, min, max, !!p.sinLlevadas, rand);
      if (!c) break;
      const clave = `${c.op}:${c.a}:${c.b}`;
      // Una cuenta que ya está, o trivial (sumar o restar 0, restar un número de sí mismo), se evita si hay otra
      const trivial = (c.op === 'suma' || c.op === 'resta') && (c.b === 0 || c.a === 0 || (c.op === 'resta' && c.a === c.b));
      if (!vistas.has(clave) && !trivial) { elegida = c; break; }
      if (intento === 39 && !vistas.has(clave)) elegida = c;
    }
    if (!elegida) continue;
    vistas.add(`${elegida.op}:${elegida.a}:${elegida.b}`);
    out.push(elegida);
  }
  return out.map((c, i) => ({ c, i, peso: pesoDeCuenta(c) })).sort((x, y) => x.peso - y.peso || x.i - y.i).map(x => x.c);
}

/**
 * Una lista en tres partes seguidas y parejas: los tres peldaños de la escalera. Lo que sobra al repartir va a las
 * primeras; con `giro`, a las siguientes (para que, al juntar varias listas, no se lleve todo lo que sobra el primer bloque).
 */
export function enTresPartes<X>(lista: X[], giro = 0): X[][] {
  const n = lista.length;
  const a = Math.ceil(n / 3), b = Math.ceil((n - a) / 2);
  const medidas = [a, b, n - a - b];
  const g = ((giro % 3) + 3) % 3;
  const [x, y] = [...medidas.slice(3 - g), ...medidas.slice(0, 3 - g)];
  return [lista.slice(0, x), lista.slice(x, x + y), lista.slice(x + y)];
}

/**
 * Las cuentas en los tres peldaños de la escalera. Cada operación sube por su cuenta: sus cuentas, de la que menos
 * cuesta a la que más, se parten en tres, y cada bloque junta la parte que le toca de todas (primero las sumas,
 * después las restas…). Así en una hoja de sumas y multiplicaciones los tres bloques tienen de las dos, cada vez
 * más difíciles, en vez de dejar todas las multiplicaciones para el final.
 */
export function enEscalera(cuentas: Cuenta[]): Cuenta[][] {
  const bloques: Cuenta[][] = [[], [], []];
  let giro = 0;
  for (const op of OPERACIONES) {
    const suyas = cuentas.filter(c => c.op === op).map((c, i) => ({ c, i, peso: pesoDeCuenta(c) })).sort((x, y) => x.peso - y.peso || x.i - y.i).map(x => x.c);
    if (!suyas.length) continue;
    enTresPartes(suyas, giro++).forEach((parte, k) => bloques[k].push(...parte));
  }
  return bloques;
}

/** El ejercicio «Lista de cálculos» de unas cuentas, con su solución exacta. */
export function ejercicioDeCuentas(cuentas: Cuenta[], t: Tr, lang: Lang, respuesta: 'linea' | 'caja' = 'caja'): FichaExercise {
  return {
    tipo: 'calculos',
    enunciado: t('Calcula.'),
    lineas: cuentas.map(c => cuentaTexto(c, lang)),
    respuesta,
    solucion: cuentas.map((c, i) => `${i + 1}. ${cuentaTexto(c, lang)} = ${c.resultado}`).join('; '),
  };
}

/** «Sumas», «Sumas y restas», «Sumas, restas y divisiones». */
export function tituloDeOperaciones(ops: Operacion[], t: Tr): string {
  const nombres = OPERACIONES.filter(o => ops.includes(o)).map(o => t(NOMBRE_OPERACION[o]));
  if (nombres.length <= 1) return nombres[0] ?? t('Operaciones');
  const resto = nombres.slice(1, -1).map(x => x.toLowerCase());
  return [nombres[0], ...resto].join(', ') + ` ${t('y@@lista')} ` + nombres[nombres.length - 1].toLowerCase();
}

/**
 * Una hoja de operaciones. Con seis cuentas o más va de menos a más: se reparten en los tres bloques de
 * la escalera (`enEscalera`), cada uno con su lista de cálculos y su solución. `null` si en ese rango no
 * sale ninguna cuenta.
 */
export function fichaOperaciones(p: PedidoOperaciones, t: Tr, lang: Lang = 'es', rand: () => number = Math.random): FichaInstante | null {
  const cuentas = generarCuentas(p, rand);
  if (!cuentas.length) return null;
  const escalera = cuentas.length >= MIN_OPERACIONES ? enEscalera(cuentas) : [];
  // Con muy pocas de alguna operación un peldaño podría quedarse vacío: entonces, un solo bloque
  const partes = escalera.length && escalera.every(b => b.length) ? escalera : [cuentas];
  const actividades: FichaActivity[] = partes.map((parte, i) => ({
    titulo: '',
    ...(partes.length === 3 ? { dificultad: DIFICULTADES[i] } : {}),
    ejercicios: [ejercicioDeCuentas(parte, t, lang, p.respuesta ?? 'caja')],
  }));
  return { content: { ...base(p.titulo?.trim() || tituloDeOperaciones(p.operaciones, t)), actividades }, fuera: [] };
}

/* ── Fracciones con pizzas ── */

export interface PedidoFracciones {
  titulo?: string;
  /** Pizzas por ejercicio: 3 o 4. */
  figuras?: number;
  /** En el último bloque se une cada pizza con su decimal (y no con su fracción). */
  decimal?: boolean;
}

/** De menos a más: primero se lee la fracción de cada pizza, después se colorea la que se da y, al final, se unen. */
const MODO_POR_NIVEL: Record<Dificultad, ModoFracciones> = { 1: 'leer', 2: 'colorear', 3: 'unir' };

/** Una ficha de fracciones con pizzas dibujadas por el código, en los tres bloques de la escalera. */
export function fichaFracciones(p: PedidoFracciones, t: Tr, lang: Lang = 'es', rand: () => number = Math.random): FichaInstante {
  const n = p.figuras === 3 ? 3 : 4;
  const actividades: FichaActivity[] = DIFICULTADES.map(d => ({
    titulo: '',
    dificultad: d,
    ejercicios: [fraccionesParaEjercicio(MODO_POR_NIVEL[d], lang, { n, rand, decimal: d === 3 && !!p.decimal })],
  }));
  return { content: { ...base(p.titulo?.trim() || t('Fracciones con pizzas')), actividades }, fuera: [] };
}
