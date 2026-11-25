/**
 * «Tirar de la cuerda» (25-11-2026, el juego del dueño, adaptado a AulaPro): dos equipos responden cuentas en su
 * teclado y cada acierto tira de la cuerda hacia su lado. Aquí está todo lo que no es pantalla: los niveles, las
 * preguntas, lo que se escribe en el teclado, el nombre de los equipos, qué vista toca y la partida entera como un
 * reductor puro (el azar va con semilla dentro del estado, así que dos toques a la vez se atienden en orden y se
 * puede probar). La pantalla es `components/juegos/TirarDeLaCuerda.tsx`.
 *
 * Niveles (indicaciones del dueño del 25-11-2026, que mandan sobre los rangos anteriores; ver docs/PIZARRA.md):
 *   - 1.º y 2.º de Primaria: solo sumas y restas, con cada número entre 1 y 10 (resultados de 0 a 20; las restas,
 *     nunca negativas, y alguna vez 0). El RD 157/2022 solo pone la suma y la resta en el «Sentido de las
 *     operaciones» del primer ciclo; la multiplicación y la división son del segundo.
 *   - 3.º y 4.º: sumas con resultado hasta 50, restas con el minuendo hasta 25, tablas de una cifra por una cifra
 *     (de 2 a 9) y divisiones exactas con divisor y cociente de una cifra (de 2 a 9).
 *   - 5.º y 6.º: sumas y restas de números de dos cifras, y multiplicación y división con «Cifras del segundo
 *     número» a elegir (`CifrasCuerda`): con una, 12 × 7 y 84 : 6 (cociente de dos cifras); con dos, 23 × 14 y
 *     312 : 24 (cociente de una o dos cifras).
 *   - ESO: suma y resta de números de hasta tres cifras (la resta puede dar negativo: alguna vez en 1.º y 2.º, más a
 *     menudo en 3.º y 4.º), multiplicación (tres cifras por una o dos por dos en 1.º y 2.º; tres por dos en 3.º y
 *     4.º, con algún factor negativo) y división exacta (dividendo de tres o cuatro cifras entre una o dos cifras en
 *     1.º y 2.º; entre dos cifras con cociente de dos o tres en 3.º y 4.º, con algún negativo). Además:
 *   - 1.º y 2.º de ESO: números enteros (sumas, restas, productos y cocientes con negativos, y la jerarquía con dos
 *     operaciones), potencias de exponente natural, raíces cuadradas exactas y las propiedades de las potencias con
 *     resultado numérico, y porcentajes (de una cantidad, aumentos y descuentos con los porcentajes de siempre).
 *     Tantos resultados negativos como positivos, para que el signo no se adivine.
 *   - 3.º y 4.º de ESO: jerarquía con paréntesis y tres operaciones, potencias de exponente 0 y la diferencia entre
 *     −2⁴ y (−2)⁴, raíces cúbicas, propiedades encadenadas, porcentajes menos redondos, el porcentaje inverso y los
 *     aumentos y descuentos encadenados. Es más difícil por la forma, no por números enormes: todo se calcula de
 *     cabeza (las potencias, hasta 1000 salvo las de 10).
 * Los dos equipos reciben preguntas distintas de la misma dificultad: la pregunta n.º k de un equipo tiene la misma
 * forma (operación, cuántas cifras tiene cada número y la respuesta) que la n.º k del otro (`firma`, `Partida.moldes`).
 * Todas las respuestas son números enteros que caben en el teclado (`MAX_RESPUESTA` caracteres, con el signo).
 * Las divisiones son siempre exactas y, en Primaria, ninguna resta da negativo.
 */

export type NivelCuerda = 'p12' | 'p34' | 'p56' | 'e12' | 'e34';
export type OperacionPrimaria = 'suma' | 'resta' | 'multiplicacion' | 'division';
export type OperacionEso = 'enteros' | 'potencias' | 'porcentajes';
export type Operacion = OperacionPrimaria | OperacionEso;
/** Lo que se elige: una operación o todas mezcladas. */
export type TipoCuerda = Operacion | 'mezcla';

export const NIVELES: readonly { id: NivelCuerda; nombre: string; etapa: 'primaria' | 'eso' }[] = [
  { id: 'p12', nombre: '1.º y 2.º de Primaria', etapa: 'primaria' },
  { id: 'p34', nombre: '3.º y 4.º de Primaria', etapa: 'primaria' },
  { id: 'p56', nombre: '5.º y 6.º de Primaria', etapa: 'primaria' },
  { id: 'e12', nombre: '1.º y 2.º de ESO', etapa: 'eso' },
  { id: 'e34', nombre: '3.º y 4.º de ESO', etapa: 'eso' },
];

export const OPERACIONES_PRIMARIA: readonly { id: OperacionPrimaria; nombre: string; signo: string }[] = [
  { id: 'suma', nombre: 'Suma', signo: '+' },
  { id: 'resta', nombre: 'Resta', signo: '−' },
  { id: 'multiplicacion', nombre: 'Multiplicación', signo: '×' },
  { id: 'division', nombre: 'División', signo: ':' },
];

export const OPERACIONES_ESO: readonly { id: OperacionEso; nombre: string; signo: string }[] = [
  { id: 'enteros', nombre: 'Números enteros', signo: '±' },
  { id: 'potencias', nombre: 'Potencias y raíces', signo: 'xⁿ' },
  { id: 'porcentajes', nombre: 'Porcentajes', signo: '%' },
];

/** Puntos de ventaja para ganar: la cuerda tiene que llegar hasta ahí. */
export const PUNTOS_PARA_GANAR = [3, 5, 7] as const;
export type PuntosParaGanar = typeof PUNTOS_PARA_GANAR[number];

/** Lo más largo que se puede escribir en el teclado, contando el signo menos. */
export const MAX_RESPUESTA = 6;
/** Lo más largo del nombre de un equipo. */
export const MAX_NOMBRE = 12;

export const esEso = (n: NivelCuerda): boolean => n.startsWith('e');
export const esNivel = (x: unknown): x is NivelCuerda => NIVELES.some(n => n.id === x);

/**
 * Las operaciones de cada nivel, con el nombre y el signo que se enseñan en los ajustes. En 1.º y 2.º de Primaria,
 * solo la suma y la resta (la multiplicación y la división son del segundo ciclo); en ESO, las cuatro de siempre
 * (con «·» para multiplicar, como en sus libros) y además los números enteros, las potencias y los porcentajes.
 */
export const operacionesDe = (n: NivelCuerda): readonly { id: Operacion; nombre: string; signo: string }[] =>
  esEso(n)
    ? [...OPERACIONES_PRIMARIA.map(o => (o.id === 'multiplicacion' ? { ...o, signo: '·' } : o)), ...OPERACIONES_ESO]
    : n === 'p12' ? OPERACIONES_PRIMARIA.slice(0, 2) : OPERACIONES_PRIMARIA;
/** El tipo, si vale en ese nivel; si no (la multiplicación en 1.º y 2.º, los porcentajes en Primaria), la mezcla. */
export function tipoParaNivel(n: NivelCuerda, tipo: unknown): TipoCuerda {
  return tipo === 'mezcla' || operacionesDe(n).some(o => o.id === tipo) ? tipo as TipoCuerda : 'mezcla';
}

/** Cuántas cifras tiene el segundo número de las multiplicaciones y las divisiones de 5.º y 6.º (se elige). */
export type CifrasCuerda = 1 | 2;
export const CIFRAS: readonly { id: CifrasCuerda; nombre: string }[] = [
  { id: 1, nombre: 'Una cifra' },
  { id: 2, nombre: 'Dos cifras' },
];
export const esCifras = (x: unknown): x is CifrasCuerda => x === 1 || x === 2;
/** La elección «Cifras del segundo número» solo existe en 5.º y 6.º, con multiplicaciones o divisiones (o la mezcla). */
export const usaCifras = (n: NivelCuerda, tipo: TipoCuerda): boolean =>
  n === 'p56' && (tipo === 'multiplicacion' || tipo === 'division' || tipo === 'mezcla');

/** El ejemplo de cada elección en los ajustes, de la operación elegida (en la mezcla, las dos). */
export function ejemploDeCifras(cifras: CifrasCuerda, tipo: TipoCuerda): string {
  const por = cifras === 1 ? '12 × 7' : '23 × 14', entreN = cifras === 1 ? '84 : 6' : '312 : 24';
  return tipo === 'division' ? entreN : tipo === 'multiplicacion' ? por : `${por}, ${entreN}`;
}

/* ── Azar con semilla ── */

export type Azar = () => number;

/** Mulberry32: un azar pequeño y repetible. Devuelve el azar y la semilla con la que seguir. */
export function azarConSemilla(semilla: number): { azar: Azar; semilla: () => number } {
  let s = semilla >>> 0;
  return {
    azar: () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    semilla: () => s,
  };
}

/** Un entero entre `min` y `max`, los dos incluidos. */
export const entre = (azar: Azar, min: number, max: number): number => min + Math.floor(azar() * (max - min + 1));
const unoDe = <T>(azar: Azar, xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)];
/** Un entero entre `min` y `max` que no es 0. */
const sinCero = (azar: Azar, min: number, max: number): number => {
  for (;;) { const n = entre(azar, min, max); if (n !== 0) return n; }
};
/** Un entero entre `min` y `max` que no es 0, ni 1 ni −1 (multiplicar por 1 no practica nada). */
const sinUno = (azar: Azar, min: number, max: number): number => {
  for (;;) { const n = entre(azar, min, max); if (Math.abs(n) > 1) return n; }
};
/** Dos factores con el signo repartido: tantos productos negativos como positivos, y siempre algún negativo. */
function signos(azar: Azar, a: number, b: number): [number, number] {
  const [x, y] = [Math.abs(a), Math.abs(b)];
  return conPesos<[number, number]>(azar, [[1, [-x, y]], [1, [x, -y]], [2, [-x, -y]]]);
}
/** Elige con pesos: `[[peso, valor], …]`. */
function conPesos<T>(azar: Azar, opciones: readonly (readonly [number, T])[]): T {
  const total = opciones.reduce((s, [p]) => s + p, 0);
  let r = azar() * total;
  for (const [p, v] of opciones) { if (r < p) return v; r -= p; }
  return opciones[opciones.length - 1][1];
}

/* ── Cómo se escriben los números ── */

/** El signo menos de verdad (U+2212), no el guion. */
export const MENOS = '−';
/** Un número, con el signo menos tipográfico. */
export const num = (n: number): string => (n < 0 ? `${MENOS}${-n}` : String(n));
/** Un número que va detrás de una operación: si es negativo, entre paréntesis («5 · (−3)»). */
export const par = (n: number): string => (n < 0 ? `(${num(n)})` : String(n));
const SUPER: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Un exponente en superíndice. */
export const sup = (n: number): string => String(n).split('').map(c => SUPER[c] ?? c).join('');

/* ── Las preguntas ── */

export interface Pregunta {
  /** Lo que se enseña, en castellano. Con `plantilla`, la pantalla lo traduce. */
  texto: string;
  /** La respuesta: siempre un número entero. */
  respuesta: number;
  operacion: Operacion;
  /** Las de porcentajes llevan palabras: la plantilla (en castellano, para `t()`) y sus valores. */
  plantilla?: { clave: string; valores: Record<string, string | number> };
}

const P = (texto: string, respuesta: number, operacion: Operacion, plantilla?: Pregunta['plantilla']): Pregunta =>
  // `+ 0` deja el −0 de «(−6 + 6) · (−6)» en 0
  ({ texto, respuesta: respuesta + 0, operacion, ...(plantilla ? { plantilla } : {}) });

/** Lo que se enseña: «7 + 9 = ?», salvo que la pregunta ya lleve su «?» («15 % de ? = 30»). */
export const enunciado = (texto: string): string => (texto.includes('?') ? texto : `${texto} = ?`);
/** La pregunta con su respuesta, para enseñarla tras un fallo: «7 + 9 = 16», «15 % de 200 = 30». */
export const resuelta = (texto: string, respuesta: number): string =>
  (texto.includes('?') ? texto.replace('?', num(respuesta)) : `${texto} = ${num(respuesta)}`);

/** Rellena una plantilla («{p} % de {n}»). */
export const rellenar = (clave: string, valores: Record<string, string | number>): string =>
  clave.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? `{${k}}`));

const conPlantilla = (clave: string, valores: Record<string, string | number>, respuesta: number): Pregunta =>
  P(rellenar(clave, valores), respuesta, 'porcentajes', { clave, valores });

/**
 * Cómo se escribe la pregunta en pantalla: en inglés, «×» y «÷» (en un aula inglesa «:» es una razón); y sin cortes
 * de línea dentro de un paréntesis, entre un número y su «%» ni antes del «= ?», con espacios que no se parten.
 */
/** El signo de una operación en los ajustes, como se verá en el juego: en inglés, «×» y «÷». */
export const signoEnPantalla = (signo: string, ingles: boolean): string =>
  (ingles ? signo.replace(/·/g, '×').replace(/:/g, '÷') : signo);

export function preguntaEnPantalla(texto: string, ingles: boolean): string {
  let s = ingles ? texto.replace(/ · /g, ' × ').replace(/ : /g, ' ÷ ') : texto;
  let nivel = 0, fuera = '';
  for (const c of s) {
    if (c === '(') nivel++;
    else if (c === ')') nivel = Math.max(0, nivel - 1);
    fuera += c === ' ' && nivel > 0 ? '\u00a0' : c;
  }
  s = fuera.replace(/ %/g, '\u00a0%');
  const igual = s.lastIndexOf(' = ');
  return igual >= 0 ? `${s.slice(0, igual)}\u00a0=\u00a0${s.slice(igual + 3)}` : s;
}

/*
 * Las cuatro operaciones. En Primaria la multiplicación se escribe «×» y la división «:», como en los libros de texto;
 * en ESO, «·» y «:». El segundo número es el que lleva las cifras elegidas en 5.º y 6.º («Cifras del segundo número»),
 * así que no se cambia de sitio.
 */

/**
 * Un número de varias cifras que no acaba en 0: «60 × 11» o «420 : 20» se hacen quitando el cero y no practican
 * la cuenta que se pide.
 */
const noRedondo = (azar: Azar, min: number, max: number): number => {
  for (;;) { const n = entre(azar, min, max); if (n % 10 !== 0) return n; }
};
const signoPor = (nivel: NivelCuerda) => (esEso(nivel) ? '·' : '×');
/** Una de cada dos, los dos sumandos cambian de sitio (los dos órdenes salen en los libros). */
const quizaCambiados = (azar: Azar, a: number, b: number): [number, number] => (azar() < 0.5 ? [b, a] : [a, b]);

function suma(nivel: NivelCuerda, azar: Azar): Pregunta {
  let a: number, b: number;
  if (nivel === 'p12') { a = entre(azar, 1, 10); b = entre(azar, 1, 10); }
  else if (nivel === 'p34') {
    // Resultado hasta 50: un número de dos cifras y otro de una o de dos
    a = entre(azar, 10, 45); b = entre(azar, 2, 50 - a);
    [a, b] = quizaCambiados(azar, a, b);
  } else if (nivel === 'p56') { a = entre(azar, 10, 99); b = entre(azar, 10, 99); }
  else if (nivel === 'e12') {
    a = entre(azar, 100, 999); b = azar() < 0.4 ? entre(azar, 10, 99) : entre(azar, 100, 999);
    [a, b] = quizaCambiados(azar, a, b);
  } else { a = entre(azar, 100, 999); b = entre(azar, 100, 999); }
  return P(`${a} + ${b}`, a + b, 'suma');
}

/** En ESO, cuántas restas dan negativo: alguna vez en 1.º y 2.º, más a menudo en 3.º y 4.º. */
export const RESTAS_NEGATIVAS: Record<'e12' | 'e34', number> = { e12: 0.2, e34: 0.4 };

function resta(nivel: NivelCuerda, azar: Azar): Pregunta {
  let a: number, b: number;
  if (nivel === 'p12') {
    // Cada número de 1 a 10 y nunca negativa; un resultado 0, poco (x − x no practica casi nada). Las demás, todas
    // las parejas con la misma probabilidad salvo «x − 1» y las que dan 1, a la mitad: si se elige primero el
    // minuendo, «2 − 1» sale una de cada diez y casi un tercio de las restas son «x − 1»
    if (azar() < 0.05) { a = entre(azar, 1, 10); b = a; }
    else {
      for (;;) {
        a = entre(azar, 2, 10); b = entre(azar, 1, 9);
        if (b < a && ((b !== 1 && a - b !== 1) || azar() < 0.5)) break;
      }
    }
  } else if (nivel === 'p34') { a = entre(azar, 11, 25); b = entre(azar, 2, a - 1); }
  else if (nivel === 'p56') { a = entre(azar, 20, 99); b = entre(azar, 10, a - 1); }
  else {
    // Dos números distintos de hasta tres cifras; el grande delante salvo cuando toca un resultado negativo
    const x = entre(azar, 100, 999);
    let y = azar() < 0.4 ? entre(azar, 10, 99) : entre(azar, 100, 999);
    if (y === x) y = x - entre(azar, 1, 99);
    const [mayor, menor] = x > y ? [x, y] : [y, x];
    [a, b] = azar() < RESTAS_NEGATIVAS[nivel] ? [menor, mayor] : [mayor, menor];
  }
  return P(`${a} ${MENOS} ${b}`, a - b, 'resta');
}

/** En 3.º y 4.º de ESO, cuántas multiplicaciones y divisiones llevan un número negativo. */
export const NEGATIVOS_E34 = 0.2;
/** Un número negativo de vez en cuando (solo en 3.º y 4.º de ESO): el primero o el segundo, al azar. */
function conAlgunNegativo(nivel: NivelCuerda, azar: Azar, a: number, b: number): [number, number] {
  if (nivel !== 'e34' || azar() >= NEGATIVOS_E34) return [a, b];
  return azar() < 0.5 ? [-a, b] : [a, -b];
}

function multiplicacion(nivel: NivelCuerda, azar: Azar, cifras: CifrasCuerda = 1): Pregunta {
  let a: number, b: number;
  if (nivel === 'p12' || nivel === 'p34') { a = entre(azar, 2, 9); b = entre(azar, 2, 9); }
  else if (nivel === 'p56') {
    if (cifras === 1) { a = noRedondo(azar, 12, 99); b = entre(azar, 2, 9); }
    else { a = noRedondo(azar, 11, 99); b = noRedondo(azar, 11, 39); }
  } else if (nivel === 'e12') {
    if (azar() < 0.5) { a = noRedondo(azar, 101, 999); b = entre(azar, 2, 9); }
    else { a = noRedondo(azar, 11, 99); b = noRedondo(azar, 11, 59); }
  } else { a = noRedondo(azar, 101, 899); b = noRedondo(azar, 11, 49); }
  [a, b] = conAlgunNegativo(nivel, azar, a, b);
  return P(`${num(a)} ${signoPor(nivel)} ${par(b)}`, a * b, 'multiplicacion');
}

function division(nivel: NivelCuerda, azar: Azar, cifras: CifrasCuerda = 1): Pregunta {
  let d: number, c: number;
  if (nivel === 'p12' || nivel === 'p34') { d = entre(azar, 2, 9); c = entre(azar, 2, 9); }
  else if (nivel === 'p56') {
    // Con una cifra, 84 : 6 (cociente de dos cifras); con dos, 312 : 24 (cociente de una o de dos)
    if (cifras === 1) { d = entre(azar, 2, 9); c = noRedondo(azar, 11, 99); }
    // El dividendo, de tres cifras como mucho (los de cuatro cifras son de 1.º y 2.º de ESO)
    else { d = noRedondo(azar, 11, 49); c = noRedondo(azar, 2, Math.min(25, Math.floor(999 / d))); }
  } else if (nivel === 'e12') {
    // Un dividendo de tres o cuatro cifras entre una cifra o entre dos
    if (azar() < 0.5) { d = entre(azar, 2, 9); c = noRedondo(azar, Math.ceil(100 / d), 999); }
    else { d = noRedondo(azar, 11, 49); c = noRedondo(azar, Math.max(3, Math.ceil(100 / d)), 60); }
  } else { d = noRedondo(azar, 11, 49); c = noRedondo(azar, 12, 299); }
  // Siempre exacta: el dividendo sale del divisor por el cociente
  let dividendo = d * c;
  [dividendo, d] = conAlgunNegativo(nivel, azar, dividendo, d);
  return P(`${num(dividendo)} : ${par(d)}`, dividendo / d, 'division');
}

/* ESO: «·» para multiplicar y «:» para dividir, como en los libros de Secundaria. */

function enteros(nivel: NivelCuerda, azar: Azar): Pregunta {
  if (nivel === 'e12') {
    return conPesos<() => Pregunta>(azar, [
      [3, () => {
        let a = sinCero(azar, -20, 20), b = sinCero(azar, -20, 20);
        // Algún negativo siempre: «7 + 12» no son números enteros
        if (a > 0 && b > 0) [a, b] = signos(azar, a, b);
        const restar = azar() < 0.5;
        return P(`${num(a)} ${restar ? MENOS : '+'} ${par(b)}`, restar ? a - b : a + b, 'enteros');
      }],
      [2, () => {
        // La regla de los signos, con tantos resultados negativos como positivos
        const [a, b] = signos(azar, sinUno(azar, 2, 10), sinUno(azar, 2, 10));
        return P(`${num(a)} · ${par(b)}`, a * b, 'enteros');
      }],
      [2, () => {
        // El signo del dividendo y del divisor, repartido como en el producto: la mitad de los cocientes, negativos
        const [sa, sb] = signos(azar, 1, 1);
        const d = sb * entre(azar, 2, 9), c = sa * sb * entre(azar, 2, 10);
        return P(`${num(d * c)} : ${par(d)}`, c, 'enteros');
      }],
      [3, () => {
        // Jerarquía con dos operaciones: primero el producto, o primero el paréntesis
        let a = sinCero(azar, -15, 15), b = sinUno(azar, -6, 6), c = sinUno(azar, -6, 6);
        if (a > 0 && b > 0 && c > 0) { const k = entre(azar, 0, 2); if (k === 0) a = -a; else if (k === 1) b = -b; else c = -c; }
        return conPesos<Pregunta>(azar, [
          [1, P(`${num(a)} + ${par(b)} · ${par(c)}`, a + b * c, 'enteros')],
          [1, P(`${num(a)} ${MENOS} ${par(b)} · ${par(c)}`, a - b * c, 'enteros')],
          [1, P(`(${num(a)} + ${par(b)}) · ${par(c)}`, (a + b) * c, 'enteros')],
          [1, P(`${num(b)} · ${par(c)} ${MENOS} ${par(a)}`, b * c - a, 'enteros')],
        ]);
      }],
    ])();
  }
  return conPesos<() => Pregunta>(azar, [
    [2, () => {
      const a = sinUno(azar, -6, 6), b = sinUno(azar, -6, 6), c = sinUno(azar, -5, 5);
      return P(`${num(a)} · ${par(b)} · ${par(c)}`, a * b * c, 'enteros');
    }],
    [3, () => {
      const a = sinUno(azar, -12, 12), b = sinCero(azar, -12, 12), c = sinCero(azar, -12, 12), d = sinCero(azar, -20, 20);
      return P(`${num(a)} · (${num(b)} ${MENOS} ${par(c)}) + ${par(d)}`, a * (b - c) + d, 'enteros');
    }],
    [3, () => {
      const a = sinCero(azar, -20, 20), b = sinUno(azar, -9, 9), c = sinCero(azar, -9, 9), d = sinCero(azar, -9, 9);
      return P(`${num(a)} ${MENOS} ${par(b)} · (${num(c)} + ${par(d)})`, a - b * (c + d), 'enteros');
    }],
    [2, () => {
      // (a − b) : c + d, exacta: a − b sale de c por un cociente
      let c = sinCero(azar, -9, 9); if (Math.abs(c) === 1) c = c * entre(azar, 2, 9);
      const q = sinCero(azar, -9, 9), b = sinCero(azar, -15, 15), a = c * q + b, d = sinCero(azar, -15, 15);
      return P(`(${num(a)} ${MENOS} ${par(b)}) : ${par(c)} + ${par(d)}`, q + d, 'enteros');
    }],
  ])();
}

/**
 * Hasta dónde llegan las potencias: un resultado que se calcula de cabeza en un juego de velocidad, hasta 1000 en los
 * dos niveles (nada de 6⁵ ni de 3⁸). Las de 10, más: hasta 10 000 en 1.º y 2.º y hasta 100 000 en 3.º y 4.º.
 */
const LIMITE_POTENCIA = 1000;
const maxPotenciaDe10 = (nivel: NivelCuerda) => (nivel === 'e12' ? 10000 : 100000);
const pot = (b: number, e: number) => b ** e;
const esPotenciaDe10 = (v: number) => /^10*$/.test(String(Math.abs(v)));
export const potenciaQueCabe = (nivel: NivelCuerda, v: number): boolean =>
  Math.abs(v) <= LIMITE_POTENCIA || (esPotenciaDe10(v) && Math.abs(v) <= maxPotenciaDe10(nivel));

function potencias(nivel: NivelCuerda, azar: Azar): Pregunta {
  const limite = LIMITE_POTENCIA;
  const potencia = (minE: number, negativas: number, cero: boolean): Pregunta => {
    const base = unoDe(azar, [2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10]);
    let maxE = 2;
    while (pot(base, maxE + 1) <= (base === 10 ? maxPotenciaDe10(nivel) : limite) && maxE < 10) maxE++;
    const e = cero && azar() < 0.15 ? 0 : entre(azar, minE, Math.min(maxE, base <= 3 ? 6 : 4));
    if (azar() < negativas && base <= 6) {
      const ee = e === 0 ? 0 : entre(azar, 2, Math.min(4, maxE));
      // En 3.º y 4.º, también −2⁴ (que es −16) frente a (−2)⁴ (que es 16)
      if (nivel === 'e34' && azar() < 0.4) return P(`${MENOS}${base}${sup(ee)}`, -pot(base, ee), 'potencias');
      return P(`(${MENOS}${base})${sup(ee)}`, pot(-base, ee), 'potencias');
    }
    return P(`${base}${sup(e)}`, pot(base, e), 'potencias');
  };
  const raiz = (): Pregunta => {
    if (nivel === 'e34' && azar() < 0.4) {
      const n = sinCero(azar, -10, 10);
      const r = Math.abs(n) === 1 ? n * 2 : n;
      return P(`∛${r < 0 ? `(${num(r ** 3)})` : r ** 3}`, r, 'potencias');
    }
    const n = entre(azar, 2, nivel === 'e12' ? 15 : 25);
    return P(`√${n * n}`, n, 'potencias');
  };
  const propiedad = (): Pregunta => {
    for (;;) {
      const base = unoDe(azar, nivel === 'e12' ? [2, 3, 5, 10] : [2, 3, 4, 5, 6, 10]);
      const m = entre(azar, 2, 6), n = entre(azar, 1, 4);
      const forma = entre(azar, 0, nivel === 'e12' ? 2 : 4);
      let p: Pregunta;
      if (forma === 0) p = P(`${base}${sup(m)} · ${base}${sup(n)}`, pot(base, m + n), 'potencias');
      else if (forma === 1) {
        const mm = m + n; // el exponente de arriba es mayor: el resultado es entero
        p = P(`${base}${sup(mm)} : ${base}${sup(n)}`, pot(base, m), 'potencias');
      } else if (forma === 2) {
        const e1 = entre(azar, 2, 3), e2 = entre(azar, 2, 3);
        p = P(`(${base}${sup(e1)})${sup(e2)}`, pot(base, e1 * e2), 'potencias');
      } else if (forma === 3) {
        // Mismo exponente y distinta base: (a · b)ⁿ
        const [a, b] = unoDe(azar, [[2, 5], [4, 5], [2, 3], [5, 20], [25, 4]] as const);
        const e = entre(azar, 2, 3);
        p = P(`${a}${sup(e)} · ${b}${sup(e)}`, pot(a * b, e), 'potencias');
      } else {
        const a = entre(azar, 3, 5), b = entre(azar, 2, 4), c = entre(azar, 2, a + b - 1);
        p = P(`${base}${sup(a)} · ${base}${sup(b)} : ${base}${sup(c)}`, pot(base, a + b - c), 'potencias');
      }
      if (potenciaQueCabe(nivel, p.respuesta)) return p;
    }
  };
  // Con base negativa el exponente se elige aparte: se repite hasta que el resultado se calcula de cabeza
  const unaPotencia = (negativas: number, cero: boolean) => () => {
    for (;;) { const p = potencia(2, negativas, cero); if (potenciaQueCabe(nivel, p.respuesta)) return p; }
  };
  return nivel === 'e12'
    ? conPesos<() => Pregunta>(azar, [[4, unaPotencia(0.25, false)], [3, raiz], [3, propiedad]])()
    : conPesos<() => Pregunta>(azar, [[3, unaPotencia(0.4, true)], [3, raiz], [4, propiedad]])();
}

/**
 * Las cantidades con las que un porcentaje da entero: múltiplos de 100 / mcd(p, 100). Y redondas: de 20 en 20 como
 * mínimo, así que «el p % de la cantidad» es siempre una cuenta sencilla por un número pequeño (35 % de 260 = 7 · 13).
 */
const mcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : mcd(b, a % b));
const paso = (p: number) => 100 / mcd(p, 100);
function cantidad(azar: Azar, p: number, min: number, max: number): number {
  const k0 = paso(p);
  const k = k0 * Math.ceil(20 / k0);
  return k * entre(azar, Math.max(1, Math.ceil(min / k)), Math.floor(max / k));
}

function porcentajes(nivel: NivelCuerda, azar: Azar): Pregunta {
  if (nivel === 'e12') {
    const p = unoDe(azar, [10, 20, 25, 50, 75, 5, 30, 40]);
    const n = cantidad(azar, p, 20, 300);
    return conPesos<Pregunta>(azar, [
      [2, conPlantilla('{p} % de {n}', { p, n }, (p * n) / 100)],
      [1, conPlantilla('{n} aumentado un {p} %', { p, n }, n + (p * n) / 100)],
      [1, conPlantilla('{n} rebajado un {p} %', { p, n }, n - (p * n) / 100)],
    ]);
  }
  return conPesos<() => Pregunta>(azar, [
    [2, () => {
      const p = unoDe(azar, [12, 15, 35, 8, 16, 45, 60, 120, 150]);
      const n = cantidad(azar, p, 20, 500);
      return conPlantilla('{p} % de {n}', { p, n }, (p * n) / 100);
    }],
    [2, () => {
      const p = unoDe(azar, [12, 15, 35, 8, 16, 45, 60, 21]);
      const n = cantidad(azar, p, 50, 500);
      return azar() < 0.5
        ? conPlantilla('{n} aumentado un {p} %', { p, n }, n + (p * n) / 100)
        : conPlantilla('{n} rebajado un {p} %', { p, n }, n - (p * n) / 100);
    }],
    [2, () => {
      // El porcentaje inverso: el p % de ? es n. La cantidad buscada es la respuesta.
      const p = unoDe(azar, [5, 10, 15, 20, 25, 40, 75]);
      const total = cantidad(azar, p, 20, 600);
      return conPlantilla('{p} % de ? = {n}', { p, n: (p * total) / 100 }, total);
    }],
    [2, () => {
      // Aumento y después descuento: cada paso, entero
      for (;;) {
        const p = unoDe(azar, [10, 20, 25, 50]), q = unoDe(azar, [10, 20, 25, 50]);
        // Hasta 700: con 800 solo «800 aumentado un 50 % y luego rebajado un 10 %» daba cuatro cifras, y el otro
        // equipo casi nunca encontraba una pregunta de su misma forma
        const n = 100 * entre(azar, 1, 7);
        const tras = n + (p * n) / 100, fin = tras - (q * tras) / 100;
        if (Number.isInteger(tras) && Number.isInteger(fin)) {
          return conPlantilla('{n} aumentado un {p} % y luego rebajado un {q} %', { n, p, q }, fin);
        }
      }
    }],
  ])();
}

const GENERADORES: Record<Operacion, (nivel: NivelCuerda, azar: Azar, cifras: CifrasCuerda) => Pregunta> = {
  suma, resta, multiplicacion, division, enteros, potencias, porcentajes,
};

/** Las operaciones de la mezcla de cada nivel. */
const PESOS_MEZCLA: Record<NivelCuerda, readonly (readonly [number, Operacion])[]> = {
  p12: [[50, 'suma'], [50, 'resta']],
  p34: [[25, 'suma'], [25, 'resta'], [25, 'multiplicacion'], [25, 'division']],
  p56: [[25, 'suma'], [25, 'resta'], [25, 'multiplicacion'], [25, 'division']],
  e12: [[10, 'suma'], [10, 'resta'], [10, 'multiplicacion'], [10, 'division'], [25, 'enteros'], [20, 'potencias'], [15, 'porcentajes']],
  e34: [[10, 'suma'], [10, 'resta'], [10, 'multiplicacion'], [10, 'division'], [25, 'enteros'], [20, 'potencias'], [15, 'porcentajes']],
};

/**
 * La forma de una pregunta, para dar al otro equipo una de la misma dificultad: la operación, cómo se escribe con
 * cuántas cifras tiene cada número (sin el exponente), cuántos números negativos lleva y cuántas cifras tiene la
 * respuesta (y, en las cuatro operaciones, si es negativa).
 * «57 + 17» y «34 + 25» tienen la misma forma; «7 + 9» y «85 + 12», no; «718 − 523» y «523 − 718», tampoco.
 */
const BASICAS: readonly Operacion[] = ['suma', 'resta', 'multiplicacion', 'division'];
export function firma(p: Pregunta): string {
  const forma = p.plantilla
    ? `${p.plantilla.clave}:${Object.keys(p.plantilla.valores).sort().map(k => `${k}${String(p.plantilla!.valores[k]).length}`).join('')}`
    : p.texto
      .replace(new RegExp(`\\((${MENOS}\\d+)\\)`, 'g'), '$1')
      .replace(new RegExp(`${MENOS}(?=\\d)`, 'g'), '')
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, 'ᵉ')
      .replace(/\d+/g, m => 'n'.repeat(m.length));
  // Cuántos números negativos lleva: «(11 + 5) · (−3)» es más fácil que «(−11 + (−5)) · (−4)»
  const negativos = (p.texto.match(new RegExp(`${MENOS}(?=\\d)`, 'g')) ?? []).length;
  // En las cuatro operaciones, también si la respuesta es negativa: «523 − 718» es más difícil que «718 − 523». En
  // enteros, potencias y porcentajes ya lo dicen la forma y los negativos, y pedirlo dejaba muchas sin pareja.
  const signo = p.respuesta < 0 && BASICAS.includes(p.operacion) ? '-' : '';
  return `${p.operacion}|${forma}|${negativos}|${signo}${String(Math.abs(p.respuesta)).length}`;
}

export interface OpcionesPregunta {
  /** La firma que tiene que tener (la de la pregunta del mismo número del otro equipo). */
  molde?: string;
  /** Las que han salido hace poco en la partida: se evitan si se puede. */
  recientes?: readonly string[];
  /** Las cifras del segundo número en las multiplicaciones y las divisiones de 5.º y 6.º (de partida, una). */
  cifras?: CifrasCuerda;
  /**
   * La pregunta n.º k del otro equipo: no sale aunque sea la única de su forma (una potencia como «10⁴»), para que
   * los dos equipos no tengan la misma y uno no copie la respuesta del otro.
   */
  pareja?: string;
}

/**
 * Una pregunta del nivel y el tipo. `evitar` son los textos que no pueden salir (la que el equipo acaba de responder y
 * la que tiene el otro equipo); con `molde`, de esa misma forma; y, si se puede, ninguna de `recientes`. Se prueba
 * otra vez hasta dar con ella y, en el peor caso, se queda la que más se acerca.
 */
export function generarPregunta(
  nivel: NivelCuerda, tipo: TipoCuerda, azar: Azar, evitar: readonly string[] = [], opciones: OpcionesPregunta = {},
): Pregunta {
  const t = tipoParaNivel(nivel, tipo);
  const { molde, recientes = [], pareja } = opciones;
  const cifras: CifrasCuerda = opciones.cifras === 2 ? 2 : 1;
  const opMolde = molde ? (molde.split('|')[0] as Operacion) : null;
  const tamMolde = molde ? molde.slice(molde.lastIndexOf('|')) : '';
  let mejor: Pregunta | null = null;
  let notaMejor = -1;
  for (let i = 0; i < (molde ? 1500 : 60); i++) {
    const op: Operacion = opMolde && GENERADORES[opMolde] ? opMolde : t === 'mezcla' ? conPesos(azar, PESOS_MEZCLA[nivel]) : t;
    const p = GENERADORES[op](nivel, azar, cifras);
    if (String(p.respuesta).length > MAX_RESPUESTA) continue;
    const f = molde ? firma(p) : '';
    // Primero, una pregunta distinta de la que se evita y de la del otro equipo; después, su misma forma (o, si no se
    // puede, el mismo tamaño de respuesta); al final, que no haya salido hace poco. Con una forma que solo tiene una
    // pregunta («∛8», «10⁴»), el otro equipo recibe otra de la misma operación antes que la misma
    const nota = (evitar.includes(p.texto) ? 0 : 16) + (p.texto === pareja ? 0 : 8) + (!molde || f === molde ? 4 : 0)
      + (!molde || f.endsWith(tamMolde) ? 2 : 0) + (recientes.includes(p.texto) ? 0 : 1);
    if (nota === 31) return p;
    if (nota > notaMejor) { mejor = p; notaMejor = nota; }
  }
  return mejor ?? GENERADORES[t === 'mezcla' ? PESOS_MEZCLA[nivel][0][1] : t](nivel, azar, cifras);
}

/* ── El teclado de las respuestas ── */

export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'C' | '-' | 'go';

/** Lo escrito tras pulsar una tecla (sin «Go», que no escribe). El signo menos, solo en ESO: pone o quita el signo. */
export function escribirRespuesta(escrito: string, tecla: Exclude<Tecla, 'go'>, conSigno: boolean): string {
  if (tecla === 'C') return '';
  if (tecla === '-') {
    if (!conSigno) return escrito;
    if (escrito.startsWith('-')) return escrito.slice(1);
    return escrito.length < MAX_RESPUESTA ? `-${escrito}` : escrito;
  }
  if (escrito.length >= MAX_RESPUESTA) return escrito;
  // Sin ceros a la izquierda: «07» se queda en «7»
  const cifras = escrito.replace('-', '');
  const signo = escrito.startsWith('-') ? '-' : '';
  return cifras === '0' ? `${signo}${tecla}` : `${escrito}${tecla}`;
}

/** Lo escrito, como número; `null` si aún no hay ninguna cifra. */
export const valorEscrito = (escrito: string): number | null => (/^-?\d+$/.test(escrito) ? Number(escrito) : null);

/* ── El nombre de los equipos ── */

/** Lo que se acepta en un nombre: letras (también Ñ, tildes, Ç), cifras y espacios. */
export const caracterDeNombre = (c: string): boolean => /^[\p{L}\p{N} ]$/u.test(c);

/** El nombre tras pulsar una tecla del teclado de nombres: una letra, «borrar» o el espacio. */
export function escribirNombre(nombre: string, tecla: string): string {
  if (tecla === 'borrar') return [...nombre].slice(0, -1).join('');
  if (!caracterDeNombre(tecla)) return nombre;
  if (tecla === ' ' && (nombre === '' || nombre.endsWith(' '))) return nombre;
  if ([...nombre].length >= MAX_NOMBRE) return nombre;
  return nombre + tecla.toLocaleUpperCase('es');
}

/** El nombre que se queda al acabar de escribir: sin espacios a los lados; vacío, el de siempre (`null`). */
export const nombreFinal = (nombre: string): string | null => nombre.trim() || null;

/* ── El nivel de la clase ── */

/** El nivel que toca a una clase por su etapa y su curso o, si no los tiene, por su nombre («3.º ESO B»). */
export function nivelDeClase(c: { etapa?: string; curso?: number; name?: string } | null | undefined): NivelCuerda | null {
  if (!c) return null;
  let etapa = c.etapa;
  let curso = c.curso;
  const nombre = (c.name ?? '').toLowerCase();
  if (!etapa) {
    if (/\b(eso|secundaria)\b/.test(nombre)) etapa = 'eso';
    else if (/prim[aà]ria|\bep\b|\bprim\b/.test(nombre)) etapa = 'primaria';
  }
  if (!curso) {
    const m = nombre.match(/(?:^|\D)([1-6])\s*(?:\.?\s*[ºª°o]|r|n|t|st|nd|rd|th)?(?=\D|$)/);
    if (m) curso = Number(m[1]);
  }
  if (!curso) return null;
  if (!etapa && curso >= 5) etapa = 'primaria';
  if (etapa === 'eso') return curso <= 2 ? 'e12' : curso <= 4 ? 'e34' : null;
  if (etapa === 'primaria') return curso <= 2 ? 'p12' : curso <= 4 ? 'p34' : 'p56';
  return null;
}

/* ── Los dibujos y la música ── */

/** Van dentro de la app (`public/juegos/cuerda/`), nunca de un tercero. La música se pide al abrir el juego. */
const RECURSO = (n: string) => `juegos/cuerda/${n}`;
export const IMAGENES_CUERDA = {
  rojo: RECURSO('rojo.webp'), azul: RECURSO('azul.webp'),
  neutral: RECURSO('neutral.webp'), izquierda: RECURSO('izquierda.webp'), derecha: RECURSO('derecha.webp'),
} as const;
export const MUSICA_CUERDA = RECURSO('musica.mp3');

/* ── La vista ── */

export type Vista = 'columnas' | 'cara';

/** En vertical, cara a cara (el equipo azul arriba y girado); en horizontal, en tres columnas. */
export const vistaPara = (ancho: number, alto: number): Vista => (alto > ancho ? 'cara' : 'columnas');

/**
 * Las vistas que caben: en tres columnas hace falta ancho (tres tarjetas con teclas de 44 px), y cara a cara, alto
 * (dos tarjetas una encima de otra). En un móvil solo cabe la suya, y el botón de cambiar la vista no sale.
 */
export function vistasPosibles(ancho: number, alto: number): Vista[] {
  const v: Vista[] = [];
  if (ancho >= 640 && alto >= 340) v.push('columnas');
  if (alto >= 560 && ancho >= 300) v.push('cara');
  return v.length > 0 ? v : [vistaPara(ancho, alto)];
}

/* ── La partida ── */

export type IndiceEquipo = 0 | 1;

export interface EquipoEnJuego {
  pregunta: Pregunta;
  /** Lo escrito en su teclado. */
  escrito: string;
  aciertos: number;
  fallos: number;
}

export interface Partida {
  nivel: NivelCuerda;
  tipo: TipoCuerda;
  meta: PuntosParaGanar;
  /** Las cifras del segundo número de las multiplicaciones y las divisiones (solo cuentan en 5.º y 6.º). */
  cifras: CifrasCuerda;
  /** Hacia dónde va la cuerda: negativo, hacia el equipo rojo (0); positivo, hacia el azul (1). */
  balance: number;
  equipos: [EquipoEnJuego, EquipoEnJuego];
  ganador: IndiceEquipo | null;
  /** La semilla del azar, para que la partida sea un reductor puro. */
  semilla: number;
  /** La firma de la pregunta n.º k: la n.º k del otro equipo tiene la misma (preguntas de la misma dificultad). */
  moldes: string[];
  /** El texto de la pregunta n.º k del primer equipo que la tuvo: el otro equipo no recibe la misma. */
  textos: string[];
  /** Las últimas preguntas de la partida, de los dos equipos: no vuelven enseguida. */
  recientes: string[];
  /**
   * Lo último que ha pasado, para los efectos de la pantalla (tirar o temblar). Cuenta cada respuesta. Con un fallo,
   * la pregunta que se ha fallado, para enseñar su respuesta.
   */
  ultima: { equipo: IndiceEquipo; acierto: boolean; n: number; fallada?: Pregunta } | null;
}

/** Cuántas preguntas recientes se evitan. */
const RECIENTES = 16;

export type AccionPartida = { tipo: 'tecla'; equipo: IndiceEquipo; tecla: Tecla };

export function nuevaPartida(
  nivel: NivelCuerda, tipo: TipoCuerda, meta: PuntosParaGanar, semilla: number, cifras: CifrasCuerda = 1,
): Partida {
  const r = azarConSemilla(semilla);
  const t = tipoParaNivel(nivel, tipo);
  const c: CifrasCuerda = cifras === 2 ? 2 : 1;
  const a = generarPregunta(nivel, t, r.azar, [], { cifras: c });
  const b = generarPregunta(nivel, t, r.azar, [a.texto], { molde: firma(a), cifras: c });
  return {
    nivel, tipo: t, meta, cifras: c, balance: 0, ganador: null, ultima: null, semilla: r.semilla(),
    moldes: [firma(a)], textos: [a.texto], recientes: [a.texto, b.texto],
    equipos: [
      { pregunta: a, escrito: '', aciertos: 0, fallos: 0 },
      { pregunta: b, escrito: '', aciertos: 0, fallos: 0 },
    ],
  };
}

/**
 * Una tecla de un equipo. Con la partida acabada no cuenta nada. «Go» sin nada escrito no hace nada (dos toques
 * seguidos en «Go» no restan ni tiran dos veces). Tras responder, bien o mal, el equipo recibe otra pregunta.
 */
export function reducirPartida(p: Partida, a: AccionPartida): Partida {
  if (p.ganador !== null) return p;
  const i = a.equipo;
  const eq = p.equipos[i];
  if (a.tecla !== 'go') {
    const escrito = escribirRespuesta(eq.escrito, a.tecla, esEso(p.nivel));
    if (escrito === eq.escrito) return p;
    return conEquipo(p, i, { ...eq, escrito });
  }
  const valor = valorEscrito(eq.escrito);
  if (valor === null) return p;
  const acierto = valor === eq.pregunta.respuesta;
  const balance = acierto ? p.balance + (i === 0 ? -1 : 1) : p.balance;
  const ganador: IndiceEquipo | null = balance <= -p.meta ? 0 : balance >= p.meta ? 1 : null;
  const aciertos = eq.aciertos + (acierto ? 1 : 0), fallos = eq.fallos + (acierto ? 0 : 1);
  const ultima = { equipo: i, acierto, n: (p.ultima?.n ?? 0) + 1, ...(acierto ? {} : { fallada: eq.pregunta }) };
  // Con la partida ganada no hace falta otra pregunta: la tarjeta se queda con la que acaba de responder
  if (ganador !== null) return { ...conEquipo(p, i, { ...eq, escrito: '', aciertos, fallos }), balance, ganador, ultima };
  const r = azarConSemilla(p.semilla);
  const otro = p.equipos[i === 0 ? 1 : 0];
  // La pregunta n.º k de este equipo: con la forma de la n.º k del otro, si ya la ha tenido
  const k = aciertos + fallos;
  const molde = p.moldes[k];
  const pregunta = generarPregunta(
    p.nivel, p.tipo, r.azar, [eq.pregunta.texto, otro.pregunta.texto],
    { molde, recientes: p.recientes, cifras: p.cifras, pareja: p.textos[k] },
  );
  const siguiente = conEquipo(p, i, { pregunta, escrito: '', aciertos, fallos });
  return {
    ...siguiente, balance, ganador, semilla: r.semilla(), ultima,
    moldes: molde ? p.moldes : [...p.moldes, firma(pregunta)],
    textos: molde ? p.textos : [...p.textos, pregunta.texto],
    recientes: [...p.recientes, pregunta.texto].slice(-RECIENTES),
  };
}

function conEquipo(p: Partida, i: IndiceEquipo, eq: EquipoEnJuego): Partida {
  const equipos: [EquipoEnJuego, EquipoEnJuego] = i === 0 ? [eq, p.equipos[1]] : [p.equipos[0], eq];
  return { ...p, equipos };
}
