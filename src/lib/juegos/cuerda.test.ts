import { describe, expect, it } from 'vitest';
import {
  MAX_NOMBRE, MAX_RESPUESTA, MENOS, NIVELES, azarConSemilla, enunciado, escribirNombre, escribirRespuesta, esEso, firma,
  ejemploDeCifras, generarPregunta, nivelDeClase, nombreFinal, nuevaPartida, operacionesDe, reducirPartida, resuelta,
  signoEnPantalla, tipoParaNivel, usaCifras, valorEscrito, vistaPara, vistasPosibles,
  type CifrasCuerda, type NivelCuerda, type Partida, type Pregunta, type Tecla, type TipoCuerda,
} from './cuerda';

/** Evalúa lo que se enseña, con la jerarquía de operaciones de verdad, para comprobar la respuesta. */
function evaluar(texto: string): number {
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  let e = texto.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => `**${[...m].map(c => SUP.indexOf(c)).join('')}`);
  e = e.replace(new RegExp(MENOS, 'g'), '-').replace(/×|·/g, '*').replace(/:/g, '/');
  e = e.replace(/∛\(?(-?\d+)\)?/g, 'Math.cbrt($1)').replace(/√(\d+)/g, 'Math.sqrt($1)');
  // «−2⁴» es −(2⁴): en JavaScript, «-2**4» es un error, así que se escribe como el resto de la expresión
  e = e.replace(/(^|[^\d)])-(\d+)\*\*(\d+)/g, '$1-($2**$3)');
  return Function(`"use strict"; return (${e});`)() as number;
}

function evaluarPorcentaje(p: Pregunta): number {
  const v = p.plantilla!.valores as Record<string, number>;
  switch (p.plantilla!.clave) {
    case '{p} % de {n}': return (v.p * v.n) / 100;
    case '{n} aumentado un {p} %': return v.n * (1 + v.p / 100);
    case '{n} rebajado un {p} %': return v.n * (1 - v.p / 100);
    case '{p} % de ? = {n}': return (v.n * 100) / v.p;
    case '{n} aumentado un {p} % y luego rebajado un {q} %': return v.n * (1 + v.p / 100) * (1 - v.q / 100);
    default: throw new Error(p.plantilla!.clave);
  }
}

const MUESTRAS = 1500;
function muestras(nivel: NivelCuerda, tipo: TipoCuerda, semilla = 7, cifras: CifrasCuerda = 1): Pregunta[] {
  const { azar } = azarConSemilla(semilla);
  return Array.from({ length: MUESTRAS }, () => generarPregunta(nivel, tipo, azar, [], { cifras }));
}
const numeros = (p: Pregunta) => (p.texto.match(/\d+/g) ?? []).map(Number);
/** Los dos números de una suma, una resta, una multiplicación o una división, con su signo: «312 · (−24)» da [312, −24]. */
function operandos(p: Pregunta): [number, number] {
  const m = p.texto.match(new RegExp(`^(${MENOS}?\\d+) [+${MENOS}×·:] \\(?(${MENOS}?\\d+)\\)?$`));
  if (!m) throw new Error(`No es una operación de dos números: ${p.texto}`);
  const n = (x: string) => Number(x.replace(MENOS, '-'));
  return [n(m[1]), n(m[2])];
}
const cifrasDe = (n: number) => String(Math.abs(n)).length;
const entreLos = (n: number, min: number, max: number) => n >= min && n <= max;
/** La parte de las muestras que cumple algo. */
const parte = (xs: Pregunta[], f: (p: Pregunta) => boolean) => xs.filter(f).length / xs.length;

describe('las preguntas de cada nivel y tipo', () => {
  for (const nivel of NIVELES) {
    for (const tipo of [...operacionesDe(nivel.id).map(o => o.id), 'mezcla' as const]) {
      it(`${nivel.nombre}, ${tipo}: respuestas enteras y correctas que caben en el teclado`, () => {
        for (const p of muestras(nivel.id, tipo)) {
          expect(Number.isInteger(p.respuesta), p.texto).toBe(true);
          expect(String(p.respuesta).length, p.texto).toBeLessThanOrEqual(MAX_RESPUESTA);
          const calculada = p.plantilla ? evaluarPorcentaje(p) : evaluar(p.texto);
          expect(Math.abs(calculada - p.respuesta), p.texto).toBeLessThan(1e-9);
          if (tipo !== 'mezcla') expect(p.operacion).toBe(tipo);
          // El signo menos es el tipográfico, nunca el guion
          expect(p.texto.includes('-'), p.texto).toBe(false);
        }
      });
    }
  }

  it('en Primaria no hay negativos, ni en la respuesta ni en lo que se ve; las restas dan 0 solo en 1.º y 2.º, y poco', () => {
    for (const nivel of ['p12', 'p34', 'p56'] as const) {
      for (const tipo of ['suma', 'resta', 'multiplicacion', 'division', 'mezcla'] as const) {
        for (const cifras of [1, 2] as const) {
          for (const p of muestras(nivel, tipo, 7, cifras)) {
            expect(p.respuesta, p.texto).toBeGreaterThanOrEqual(0);
            if (p.operacion === 'resta' && nivel !== 'p12') expect(p.respuesta, p.texto).toBeGreaterThanOrEqual(1);
            expect(/\(/.test(p.texto), p.texto).toBe(false);
            expect(p.texto.includes(MENOS) && p.operacion !== 'resta', p.texto).toBe(false);
          }
        }
      }
    }
    const ceros = parte(muestras('p12', 'resta'), p => p.respuesta === 0);
    expect(ceros).toBeGreaterThan(0);
    expect(ceros).toBeLessThan(0.1);
  });

  it('las divisiones son siempre exactas', () => {
    for (const nivel of NIVELES) {
      if (nivel.id === 'p12') continue;
      for (const cifras of [1, 2] as const) {
        for (const p of muestras(nivel.id, 'division', 7, cifras)) {
          const [a, b] = operandos(p);
          expect(Math.abs(a % b), p.texto).toBe(0);
          expect(a / b, p.texto).toBe(p.respuesta);
        }
      }
    }
    for (const nivel of ['e12', 'e34'] as const) {
      for (const p of muestras(nivel, 'enteros')) {
        // Cada cociente que aparece se hace con un dividendo múltiplo del divisor
        const sinSignos = p.texto.replace(new RegExp(MENOS, 'g'), '-');
        // Solo las divisiones de un número entre otro: «(−2 − 5) : (−7)» lo comprueba `evaluar` arriba
        for (const m of sinSignos.matchAll(/(?:^|[+·:-] )(\(-\d+\)|-?\d+) : (\(-\d+\)|\d+)/g)) {
          const n = (x: string) => Number(x.replace(/[()]/g, ''));
          expect(Math.abs(n(m[1]) % n(m[2])), p.texto).toBe(0);
        }
      }
    }
  });

  it('las operaciones de cada nivel: en 1.º y 2.º de Primaria, solo suma y resta; en ESO, también las cuatro de siempre', () => {
    expect(operacionesDe('p12').map(o => o.id)).toEqual(['suma', 'resta']);
    for (const n of ['p34', 'p56'] as const) expect(operacionesDe(n).map(o => o.id)).toEqual(['suma', 'resta', 'multiplicacion', 'division']);
    for (const n of ['e12', 'e34'] as const) {
      expect(operacionesDe(n).map(o => o.id))
        .toEqual(['suma', 'resta', 'multiplicacion', 'division', 'enteros', 'potencias', 'porcentajes']);
      // En ESO se multiplica con «·», como en sus libros
      expect(operacionesDe(n).find(o => o.id === 'multiplicacion')?.signo).toBe('·');
    }
    expect(operacionesDe('p34').find(o => o.id === 'multiplicacion')?.signo).toBe('×');
    expect(tipoParaNivel('p12', 'multiplicacion')).toBe('mezcla');
    expect(tipoParaNivel('p12', 'division')).toBe('mezcla');
    for (const p of muestras('p12', 'mezcla')) expect(['suma', 'resta']).toContain(p.operacion);
  });

  it('1.º y 2.º de Primaria: cada número de 1 a 10 y resultados de 0 a 20', () => {
    for (const p of muestras('p12', 'suma')) {
      const [a, b] = operandos(p);
      expect(entreLos(a, 1, 10) && entreLos(b, 1, 10), p.texto).toBe(true);
      expect(entreLos(p.respuesta, 0, 20), p.texto).toBe(true);
    }
    for (const p of muestras('p12', 'resta')) {
      const [a, b] = operandos(p);
      expect(entreLos(a, 1, 10) && entreLos(b, 1, 10), p.texto).toBe(true);
      expect(a, p.texto).toBeGreaterThanOrEqual(b);
      expect(entreLos(p.respuesta, 0, 20), p.texto).toBe(true);
    }
    // Llegan hasta el 10 y hasta el 20
    expect(Math.max(...muestras('p12', 'suma').map(p => p.respuesta))).toBe(20);
  });

  it('1.º y 2.º de Primaria: las restas, variadas (no casi todas «x − 1» ni «2 − 1»)', () => {
    const restas = muestras('p12', 'resta', 11);
    const cuantas = new Map<string, number>();
    for (const p of restas) cuantas.set(p.texto, (cuantas.get(p.texto) ?? 0) + 1);
    // Salen todas las parejas posibles (45 sin las «x − x») y ninguna más del 5 % de las veces
    expect(cuantas.size).toBeGreaterThanOrEqual(45);
    expect(Math.max(...cuantas.values()) / restas.length).toBeLessThan(0.05);
    expect(parte(restas, p => operandos(p)[1] === 1)).toBeLessThan(0.17);
    expect(parte(restas, p => p.respuesta === 1)).toBeLessThan(0.17);
  });

  it('3.º y 4.º de Primaria: sumas hasta 50, restas con el minuendo hasta 25 y cuentas de una cifra por una cifra', () => {
    for (const p of muestras('p34', 'suma')) {
      const [a, b] = operandos(p);
      expect(a > 1 && b > 1, p.texto).toBe(true);
      expect(p.respuesta, p.texto).toBeLessThanOrEqual(50);
    }
    expect(Math.max(...muestras('p34', 'suma').map(p => p.respuesta))).toBe(50);
    for (const p of muestras('p34', 'resta')) {
      const [a, b] = operandos(p);
      expect(a, p.texto).toBeLessThanOrEqual(25);
      expect(b, p.texto).toBeGreaterThan(1);
      expect(p.respuesta, p.texto).toBeGreaterThanOrEqual(1);
    }
    expect(Math.max(...muestras('p34', 'resta').map(p => operandos(p)[0]))).toBe(25);
    for (const p of muestras('p34', 'multiplicacion')) {
      const [a, b] = operandos(p);
      expect(entreLos(a, 2, 9) && entreLos(b, 2, 9), p.texto).toBe(true);
      expect(p.texto.includes('×'), p.texto).toBe(true);
    }
    for (const p of muestras('p34', 'division')) {
      const [, d] = operandos(p);
      expect(entreLos(d, 2, 9) && entreLos(p.respuesta, 2, 9), p.texto).toBe(true);
    }
  });

  it('5.º y 6.º de Primaria: sumas y restas de dos cifras, sean cuales sean las cifras elegidas', () => {
    for (const cifras of [1, 2] as const) {
      for (const p of muestras('p56', 'suma', 7, cifras)) {
        const [a, b] = operandos(p);
        expect(cifrasDe(a) === 2 && cifrasDe(b) === 2, p.texto).toBe(true);
        expect(p.respuesta, p.texto).toBeLessThanOrEqual(198);
      }
      for (const p of muestras('p56', 'resta', 7, cifras)) {
        const [a, b] = operandos(p);
        expect(cifrasDe(a) === 2 && cifrasDe(b) === 2, p.texto).toBe(true);
        expect(p.respuesta, p.texto).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('5.º y 6.º de Primaria con una cifra: 12 × 7 y 84 : 6 (cociente de dos cifras)', () => {
    for (const tipo of ['multiplicacion', 'mezcla'] as const) {
      for (const p of muestras('p56', tipo, 7, 1).filter(q => q.operacion === 'multiplicacion')) {
        const [a, b] = operandos(p);
        expect(cifrasDe(a) === 2 && entreLos(b, 2, 9), p.texto).toBe(true);
      }
    }
    for (const tipo of ['division', 'mezcla'] as const) {
      for (const p of muestras('p56', tipo, 7, 1).filter(q => q.operacion === 'division')) {
        const [a, d] = operandos(p);
        expect(entreLos(d, 2, 9), p.texto).toBe(true);
        expect(entreLos(cifrasDe(a), 2, 3), p.texto).toBe(true);
        expect(cifrasDe(p.respuesta), p.texto).toBe(2);
      }
    }
  });

  it('5.º y 6.º de Primaria con dos cifras: 23 × 14 y 312 : 24 (cociente de una o de dos cifras)', () => {
    for (const tipo of ['multiplicacion', 'mezcla'] as const) {
      for (const p of muestras('p56', tipo, 7, 2).filter(q => q.operacion === 'multiplicacion')) {
        const [a, b] = operandos(p);
        expect(cifrasDe(a) === 2 && cifrasDe(b) === 2, p.texto).toBe(true);
      }
    }
    for (const tipo of ['division', 'mezcla'] as const) {
      for (const p of muestras('p56', tipo, 7, 2).filter(q => q.operacion === 'division')) {
        const [a, d] = operandos(p);
        expect(cifrasDe(d), p.texto).toBe(2);
        // El dividendo, de tres cifras como mucho: los de cuatro son de 1.º y 2.º de ESO
        expect(entreLos(cifrasDe(a), 2, 3), p.texto).toBe(true);
        expect(p.respuesta, p.texto).toBeGreaterThan(1);
        expect(cifrasDe(p.respuesta), p.texto).toBeLessThanOrEqual(2);
      }
    }
    // En la mezcla, las sumas y las restas siguen siendo las del nivel
    for (const p of muestras('p56', 'mezcla', 7, 2).filter(q => q.operacion === 'suma' || q.operacion === 'resta')) {
      expect(operandos(p).every(n => cifrasDe(n) === 2), p.texto).toBe(true);
    }
  });

  it('el ejemplo de cada cifra es de la operación elegida, y en inglés los signos son los del juego', () => {
    expect(ejemploDeCifras(1, 'multiplicacion')).toBe('12 × 7');
    expect(ejemploDeCifras(2, 'multiplicacion')).toBe('23 × 14');
    expect(ejemploDeCifras(1, 'division')).toBe('84 : 6');
    expect(ejemploDeCifras(2, 'division')).toBe('312 : 24');
    expect(ejemploDeCifras(2, 'mezcla')).toBe('23 × 14, 312 : 24');
    expect(signoEnPantalla('·', true)).toBe('×');
    expect(signoEnPantalla(':', true)).toBe('÷');
    expect(signoEnPantalla('84 : 6', true)).toBe('84 ÷ 6');
    expect(signoEnPantalla('·', false)).toBe('·');
    expect(signoEnPantalla(':', false)).toBe(':');
  });

  it('«Cifras del segundo número» solo cuenta en 5.º y 6.º, con multiplicaciones, divisiones o la mezcla', () => {
    expect(usaCifras('p56', 'multiplicacion')).toBe(true);
    expect(usaCifras('p56', 'division')).toBe(true);
    expect(usaCifras('p56', 'mezcla')).toBe(true);
    expect(usaCifras('p56', 'suma')).toBe(false);
    expect(usaCifras('p56', 'resta')).toBe(false);
    for (const n of ['p12', 'p34', 'e12', 'e34'] as const) expect(usaCifras(n, 'mezcla')).toBe(false);
    // En los otros niveles, elegir dos cifras no cambia nada
    for (const n of ['p34', 'e12', 'e34'] as const) {
      expect(muestras(n, 'mezcla', 5, 2).map(p => p.texto)).toEqual(muestras(n, 'mezcla', 5, 1).map(p => p.texto));
    }
  });

  it('ESO: sumas y restas de números naturales de hasta tres cifras; las restas, a veces negativas', () => {
    for (const nivel of ['e12', 'e34'] as const) {
      for (const p of muestras(nivel, 'suma')) {
        const [a, b] = operandos(p);
        expect(entreLos(a, 1, 999) && entreLos(b, 1, 999), p.texto).toBe(true);
        expect(cifrasDe(a) === 3 || cifrasDe(b) === 3, p.texto).toBe(true);
      }
      for (const p of muestras(nivel, 'resta')) {
        const [a, b] = operandos(p);
        expect(entreLos(a, 1, 999) && entreLos(b, 1, 999), p.texto).toBe(true);
        expect(p.respuesta, p.texto).not.toBe(0);
      }
    }
    const negE12 = parte(muestras('e12', 'resta'), p => p.respuesta < 0);
    const negE34 = parte(muestras('e34', 'resta'), p => p.respuesta < 0);
    expect(negE12).toBeGreaterThan(0.1);
    expect(negE12).toBeLessThan(0.3);
    expect(negE34).toBeGreaterThan(0.3);
    expect(negE34).toBeLessThan(0.5);
  });

  it('1.º y 2.º de ESO: tres cifras por una o dos por dos, y divisiones de tres o cuatro cifras entre una o dos', () => {
    for (const p of muestras('e12', 'multiplicacion')) {
      const [a, b] = operandos(p);
      expect(a > 0 && b > 1, p.texto).toBe(true);
      expect((cifrasDe(a) === 3 && cifrasDe(b) === 1) || (cifrasDe(a) === 2 && cifrasDe(b) === 2), p.texto).toBe(true);
      expect(p.texto.includes('·'), p.texto).toBe(true);
    }
    const tresPorUna = parte(muestras('e12', 'multiplicacion'), p => cifrasDe(operandos(p)[1]) === 1);
    expect(tresPorUna).toBeGreaterThan(0.3);
    expect(tresPorUna).toBeLessThan(0.7);
    for (const p of muestras('e12', 'division')) {
      const [a, d] = operandos(p);
      expect(a > 0 && d > 1, p.texto).toBe(true);
      expect(entreLos(cifrasDe(a), 3, 4), p.texto).toBe(true);
      expect(entreLos(cifrasDe(d), 1, 2), p.texto).toBe(true);
    }
  });

  it('3.º y 4.º de ESO: tres cifras por dos, divisiones entre dos cifras con cociente de dos o tres, y algún negativo', () => {
    const mult = muestras('e34', 'multiplicacion');
    for (const p of mult) {
      const [a, b] = operandos(p);
      expect(cifrasDe(a) === 3 && cifrasDe(b) === 2, p.texto).toBe(true);
      // Como mucho un factor negativo
      expect(a < 0 && b < 0, p.texto).toBe(false);
    }
    const div = muestras('e34', 'division');
    for (const p of div) {
      const [a, d] = operandos(p);
      expect(cifrasDe(d), p.texto).toBe(2);
      expect(entreLos(cifrasDe(p.respuesta), 2, 3), p.texto).toBe(true);
      expect(a < 0 && d < 0, p.texto).toBe(false);
    }
    for (const xs of [mult, div]) {
      const negativas = parte(xs, p => p.respuesta < 0);
      expect(negativas).toBeGreaterThan(0.1);
      expect(negativas).toBeLessThan(0.3);
    }
    // 1.º y 2.º no lleva negativos en estas cuatro
    for (const tipo of ['suma', 'multiplicacion', 'division'] as const) {
      for (const p of muestras('e12', tipo)) expect(p.texto.includes(MENOS), p.texto).toBe(false);
    }
  });

  it('una pregunta con molde tiene la misma forma, también con las cifras elegidas', () => {
    for (const nivel of NIVELES) {
      for (const tipo of [...operacionesDe(nivel.id).map(o => o.id), 'mezcla' as const]) {
        for (const cifras of [1, 2] as const) {
          const { azar } = azarConSemilla(29);
          let iguales = 0;
          for (let i = 0; i < 100; i++) {
            const a = generarPregunta(nivel.id, tipo, azar, [], { cifras });
            const b = generarPregunta(nivel.id, tipo, azar, [a.texto], { molde: firma(a), cifras });
            if (firma(b) === firma(a)) iguales++;
          }
          // Las cuatro operaciones casan casi siempre; enteros y potencias tienen formas raras (∛, tres factores) que
          // a veces no encuentran pareja y se quedan con la operación y el tamaño de la respuesta
          const basica = ['suma', 'resta', 'multiplicacion', 'division'].includes(tipo) || !esEso(nivel.id);
          expect(iguales, `${nivel.id} ${tipo} ${cifras}`).toBeGreaterThanOrEqual(basica ? 95 : 80);
        }
      }
    }
    // Una resta negativa no se empareja con una positiva
    expect(firma({ texto: `718 ${MENOS} 523`, respuesta: 195, operacion: 'resta' }))
      .not.toBe(firma({ texto: `523 ${MENOS} 718`, respuesta: -195, operacion: 'resta' }));
  });

  it('nada trivial: sin «× 1», sin «x : x», sin factores ±1 y con algún negativo en los números enteros', () => {
    for (const nivel of ['p34', 'p56'] as const) {
      for (const p of muestras(nivel, 'multiplicacion')) expect(Math.min(...numeros(p)), p.texto).toBeGreaterThan(1);
      for (const p of muestras(nivel, 'division')) expect(p.respuesta, p.texto).toBeGreaterThan(1);
    }
    for (const p of muestras('e12', 'enteros')) expect(p.texto.includes(MENOS), p.texto).toBe(true);
    // Nada de «60 × 11» ni de «420 : 20»: los factores y los divisores de varias cifras no acaban en 0
    for (const nivel of ['p56', 'e12', 'e34'] as const) {
      for (const cifras of [1, 2] as const) {
        for (const p of muestras(nivel, 'multiplicacion', 7, cifras)) {
          expect(operandos(p).every(n => cifrasDe(n) === 1 || n % 10 !== 0), p.texto).toBe(true);
        }
        for (const p of muestras(nivel, 'division', 7, cifras)) expect(operandos(p)[1] % 10 !== 0, p.texto).toBe(true);
      }
    }
    for (const p of muestras('e34', 'enteros')) {
      if (/^[^()]*·[^()]*·/.test(p.texto)) expect(numeros(p).every(n => n > 1), p.texto).toBe(true);
    }
  });

  it('en los productos y cocientes de 1.º y 2.º de ESO, el signo no se adivina', () => {
    const simples = muestras('e12', 'enteros', 21).filter(p => /^\S+ [·:] \S+$/.test(p.texto));
    const negativos = simples.filter(p => p.respuesta < 0).length / simples.length;
    expect(negativos).toBeGreaterThan(0.4);
    expect(negativos).toBeLessThan(0.6);
  });

  it('las potencias y los porcentajes se calculan de cabeza', () => {
    for (const nivel of ['e12', 'e34'] as const) {
      for (const p of muestras(nivel, 'potencias')) {
        expect(Math.abs(p.respuesta) <= 1000 || /^10*$/.test(String(p.respuesta)), p.texto).toBe(true);
      }
      for (const p of muestras(nivel, 'porcentajes')) {
        // Las cantidades, redondas: de 20 en 20 o de 25 en 25
        const v = p.plantilla!.valores as Record<string, number>;
        if (p.plantilla!.clave === '{p} % de {n}') expect(v.n % 20 === 0 || v.n % 25 === 0, p.texto).toBe(true);
      }
    }
  });

  it('3.º y 4.º de ESO es más difícil que 1.º y 2.º: números más grandes y más operaciones', () => {
    const media = (xs: Pregunta[], f: (p: Pregunta) => number) => xs.reduce((s, p) => s + f(p), 0) / xs.length;
    const operaciones = (p: Pregunta) => (p.texto.match(/ [+·:−] /g) ?? []).length;
    expect(media(muestras('e34', 'enteros'), operaciones)).toBeGreaterThan(media(muestras('e12', 'enteros'), operaciones));
    expect(media(muestras('e34', 'porcentajes'), p => Math.abs(p.respuesta)))
      .toBeGreaterThan(media(muestras('e12', 'porcentajes'), p => Math.abs(p.respuesta)));
    // En 1.º y 2.º las potencias se calculan de cabeza: hasta 1000, salvo las de 10
    for (const p of muestras('e12', 'potencias')) {
      expect(Math.abs(p.respuesta) <= 1000 || /^10*$/.test(String(p.respuesta)), p.texto).toBe(true);
    }
    // Lo que solo sale en 3.º y 4.º: raíces cúbicas, el porcentaje inverso y los encadenados
    const e34 = [...muestras('e34', 'potencias'), ...muestras('e34', 'porcentajes')].map(p => p.texto).join('\n');
    const e12 = [...muestras('e12', 'potencias'), ...muestras('e12', 'porcentajes')].map(p => p.texto).join('\n');
    for (const s of ['∛', '% de ?', 'y luego']) { expect(e34).toContain(s); expect(e12).not.toContain(s); }
  });

  it('en ESO salen respuestas negativas en enteros (y en potencias de 3.º y 4.º), con los negativos entre paréntesis detrás de una operación', () => {
    expect(muestras('e12', 'enteros').some(p => p.respuesta < 0)).toBe(true);
    expect(muestras('e34', 'potencias').some(p => p.respuesta < 0)).toBe(true);
    for (const p of [...muestras('e12', 'enteros'), ...muestras('e34', 'enteros')]) {
      // Nunca «· −3» ni «+ −3»: detrás de una operación, el negativo va entre paréntesis
      expect(new RegExp(`[+·:${MENOS}] ${MENOS}`).test(p.texto), p.texto).toBe(false);
    }
  });

  it('la mezcla trae todas las operaciones del nivel', () => {
    for (const nivel of NIVELES) {
      const vistas = new Set(muestras(nivel.id, 'mezcla').map(p => p.operacion));
      expect([...vistas].sort()).toEqual(operacionesDe(nivel.id).map(o => o.id).sort());
    }
  });

  it('no repite la pregunta que se le pide evitar', () => {
    const { azar } = azarConSemilla(3);
    for (let i = 0; i < 400; i++) {
      const a = generarPregunta('p34', 'division', azar);
      const b = generarPregunta('p34', 'division', azar, [a.texto]);
      expect(b.texto).not.toBe(a.texto);
    }
  });

  it('con un molde, la pregunta tiene su misma forma (y no la que se evita)', () => {
    const { azar } = azarConSemilla(17);
    for (const nivel of NIVELES) {
      for (let i = 0; i < 150; i++) {
        const a = generarPregunta(nivel.id, 'mezcla', azar);
        const b = generarPregunta(nivel.id, 'mezcla', azar, [a.texto], { molde: firma(a) });
        expect(b.texto).not.toBe(a.texto);
        expect(b.operacion, `${a.texto} / ${b.texto}`).toBe(a.operacion);
        expect(String(Math.abs(b.respuesta)).length, `${a.texto} / ${b.texto}`).toBe(String(Math.abs(a.respuesta)).length);
      }
    }
    expect(firma({ texto: '57 + 17', respuesta: 74, operacion: 'suma' })).toBe(firma({ texto: '34 + 25', respuesta: 59, operacion: 'suma' }));
    expect(firma({ texto: '7 + 9', respuesta: 16, operacion: 'suma' })).not.toBe(firma({ texto: '85 + 12', respuesta: 97, operacion: 'suma' }));
  });

  it('lo que se enseña lleva un solo «=»', () => {
    expect(enunciado('7 + 9')).toBe('7 + 9 = ?');
    expect(enunciado('15 % de ? = 30')).toBe('15 % de ? = 30');
    expect(resuelta('7 + 9', 16)).toBe('7 + 9 = 16');
    expect(resuelta('15 % de ? = 30', 200)).toBe('15 % de 200 = 30');
    expect(resuelta(`5 ${MENOS} 9`, -4)).toBe(`5 ${MENOS} 9 = ${MENOS}4`);
    for (const p of [...muestras('e34', 'porcentajes'), ...muestras('e34', 'mezcla')]) {
      expect((enunciado(p.texto).match(/=/g) ?? []).length, p.texto).toBe(1);
    }
  });

  it('un tipo que no existe en el nivel se vuelve mezcla', () => {
    expect(tipoParaNivel('e12', 'suma')).toBe('suma');
    expect(tipoParaNivel('e34', 'division')).toBe('division');
    expect(tipoParaNivel('p34', 'porcentajes')).toBe('mezcla');
    expect(tipoParaNivel('p12', 'multiplicacion')).toBe('mezcla');
    expect(tipoParaNivel('p34', 'resta')).toBe('resta');
    expect(tipoParaNivel('p34', 'otra cosa')).toBe('mezcla');
    // Y la partida no se rompe con él: sale la mezcla del nivel
    const p = nuevaPartida('p12', 'multiplicacion' as TipoCuerda, 3, 1);
    expect(p.tipo).toBe('mezcla');
    expect(['suma', 'resta']).toContain(p.equipos[0].pregunta.operacion);
  });
});

describe('el teclado de las respuestas', () => {
  it('escribe cifras, borra con C y no pasa del máximo', () => {
    let s = '';
    for (const c of ['1', '2', '3', '4', '5', '6', '7'] as const) s = escribirRespuesta(s, c, false);
    expect(s).toBe('123456');
    expect(escribirRespuesta(s, 'C', false)).toBe('');
    expect(escribirRespuesta(escribirRespuesta('', '0', false), '7', false)).toBe('7');
  });
  it('el signo menos solo en ESO, y pone y quita el signo', () => {
    expect(escribirRespuesta('12', '-', false)).toBe('12');
    expect(escribirRespuesta('12', '-', true)).toBe('-12');
    expect(escribirRespuesta('-12', '-', true)).toBe('12');
    expect(escribirRespuesta(escribirRespuesta('', '-', true), '5', true)).toBe('-5');
    expect(valorEscrito('-')).toBeNull();
    expect(valorEscrito('')).toBeNull();
    expect(valorEscrito('-40')).toBe(-40);
  });
});

describe('el nombre de los equipos', () => {
  it('en mayúsculas, con Ñ y tildes, sin espacios dobles ni más de 12 letras', () => {
    let n = '';
    for (const c of ['ñ', 'á', ' ', ' ', 'b']) n = escribirNombre(n, c);
    expect(n).toBe('ÑÁ B');
    expect(escribirNombre('', ' ')).toBe('');
    expect(escribirNombre(n, 'borrar')).toBe('ÑÁ ');
    let largo = '';
    for (let i = 0; i < 20; i++) largo = escribirNombre(largo, 'a');
    expect(largo.length).toBe(MAX_NOMBRE);
    expect(escribirNombre('A', '<')).toBe('A');
    expect(nombreFinal('  ')).toBeNull();
    expect(nombreFinal(' LOS LINCES ')).toBe('LOS LINCES');
  });
});

describe('el nivel de la clase y la vista', () => {
  it('por la etapa y el curso o, sin ellos, por el nombre', () => {
    expect(nivelDeClase({ etapa: 'primaria', curso: 2 })).toBe('p12');
    expect(nivelDeClase({ etapa: 'primaria', curso: 4 })).toBe('p34');
    expect(nivelDeClase({ etapa: 'primaria', curso: 6 })).toBe('p56');
    expect(nivelDeClase({ etapa: 'eso', curso: 1 })).toBe('e12');
    expect(nivelDeClase({ etapa: 'eso', curso: 4 })).toBe('e34');
    expect(nivelDeClase({ name: '3º ESO B' })).toBe('e34');
    expect(nivelDeClase({ name: '1.º de Primaria A' })).toBe('p12');
    expect(nivelDeClase({ name: '2n de Primària' })).toBe('p12');
    expect(nivelDeClase({ name: '5.º A' })).toBe('p56');
    expect(nivelDeClase({ name: '3.º A' })).toBeNull();
    expect(nivelDeClase({ name: 'Grupo 12' })).toBeNull();
    expect(nivelDeClase(null)).toBeNull();
  });
  it('en vertical, cara a cara; en horizontal, en tres columnas', () => {
    expect(vistaPara(390, 844)).toBe('cara');
    expect(vistaPara(768, 1024)).toBe('cara');
    expect(vistaPara(844, 390)).toBe('columnas');
    expect(vistaPara(1920, 1080)).toBe('columnas');
  });
  it('en un móvil solo cabe su vista; en una tableta o una pantalla grande, las dos', () => {
    expect(vistasPosibles(390, 844)).toEqual(['cara']);
    expect(vistasPosibles(844, 390)).toEqual(['columnas']);
    expect(vistasPosibles(667, 375)).toEqual(['columnas']);
    expect(vistasPosibles(1024, 768)).toEqual(['columnas', 'cara']);
    expect(vistasPosibles(768, 1024)).toEqual(['columnas', 'cara']);
    expect(vistasPosibles(1920, 1080)).toEqual(['columnas', 'cara']);
  });
});

describe('la partida', () => {
  const teclear = (p: Partida, equipo: 0 | 1, texto: string): Partida => {
    let q = p;
    for (const c of texto) q = reducirPartida(q, { tipo: 'tecla', equipo, tecla: c as Tecla });
    return reducirPartida(q, { tipo: 'tecla', equipo, tecla: 'go' });
  };
  const acertar = (p: Partida, equipo: 0 | 1) => teclear(p, equipo, String(p.equipos[equipo].pregunta.respuesta));

  it('los dos equipos empiezan con preguntas distintas', () => {
    for (let s = 1; s < 200; s++) {
      const p = nuevaPartida('p12', 'suma', 3, s);
      expect(p.equipos[0].pregunta.texto).not.toBe(p.equipos[1].pregunta.texto);
    }
  });

  it('cada acierto tira hacia su lado; el fallo no mueve la cuerda; gana quien llega a la meta', () => {
    let p = nuevaPartida('p34', 'mezcla', 3, 42);
    p = acertar(p, 0);
    expect(p.balance).toBe(-1);
    p = acertar(p, 1);
    expect(p.balance).toBe(0);
    const antes = p.equipos[1].pregunta.texto;
    p = teclear(p, 1, String(p.equipos[1].pregunta.respuesta + 1));
    expect(p.balance).toBe(0);
    expect(p.equipos[1].fallos).toBe(1);
    expect(p.equipos[1].pregunta.texto).not.toBe(antes);
    expect(p.ultima).toMatchObject({ equipo: 1, acierto: false });
    p = acertar(acertar(acertar(p, 1), 1), 1);
    expect(p.ganador).toBe(1);
    // Acabada, nada cuenta
    expect(acertar(p, 0)).toBe(p);
  });

  it('los dos equipos reciben la misma secuencia de dificultad, cada uno a su ritmo', () => {
    const casos = [...NIVELES.map(n => [n.id, 1] as const), ['p56', 2] as const];
    for (const [nivel, cifras] of casos) {
      let iguales = 0, total = 0;
      for (let s = 1; s < 30; s++) {
        let p = nuevaPartida(nivel, 'mezcla', 7, s, cifras);
        expect(p.cifras).toBe(cifras);
        const formas: [string[], string[]] = [[firma(p.equipos[0].pregunta)], [firma(p.equipos[1].pregunta)]];
        // El rojo va más deprisa que el azul, y fallan a veces: la partida no se acaba (aciertos de los dos)
        for (let i = 0; i < 18; i++) {
          const equipo = (i % 3 === 2 ? 1 : 0) as 0 | 1;
          const r = p.equipos[equipo].pregunta.respuesta;
          p = teclear(p, equipo, String(i % 4 === 0 ? r + 1 : r));
          if (p.ganador !== null) break;
          formas[equipo].push(firma(p.equipos[equipo].pregunta));
        }
        const n = Math.min(formas[0].length, formas[1].length);
        for (let k = 0; k < n; k++) if (formas[0][k] === formas[1][k]) iguales++;
        total += n;
      }
      expect(iguales / total, `${nivel} ${cifras}`).toBeGreaterThan(0.95);
    }
  });

  it('la pregunta n.º k de un equipo no es la misma que la n.º k del otro (nadie copia), tampoco en las potencias', () => {
    for (const [nivel, tipo] of [['e34', 'potencias'], ['e12', 'potencias'], ['p12', 'suma'], ['p12', 'resta'], ['e34', 'mezcla']] as const) {
      let mismas = 0, total = 0;
      for (let s = 1; s < 120; s++) {
        let p = nuevaPartida(nivel, tipo, 7, s);
        const textos: [string[], string[]] = [[p.equipos[0].pregunta.texto], [p.equipos[1].pregunta.texto]];
        for (let i = 0; i < 18; i++) {
          const equipo = (i % 3 === 2 ? 1 : 0) as 0 | 1;
          const r = p.equipos[equipo].pregunta.respuesta;
          p = teclear(p, equipo, String(i % 4 === 0 ? r + 1 : r));
          if (p.ganador !== null) break;
          textos[equipo].push(p.equipos[equipo].pregunta.texto);
        }
        const n = Math.min(textos[0].length, textos[1].length);
        for (let k = 0; k < n; k++) if (textos[0][k] === textos[1][k]) mismas++;
        total += n;
      }
      expect(mismas / total, `${nivel} ${tipo}`).toBeLessThan(0.01);
    }
  });

  it('con la partida ganada, el equipo se queda con la pregunta que ha respondido; con un fallo, se sabe cuál era', () => {
    let p = nuevaPartida('p34', 'suma', 3, 4);
    const fallada = p.equipos[0].pregunta;
    p = teclear(p, 0, String(fallada.respuesta + 1));
    expect(p.ultima?.fallada).toEqual(fallada);
    p = acertar(acertar(p, 0), 0);
    const ultimaPregunta = p.equipos[0].pregunta;
    p = acertar(p, 0);
    expect(p.ganador).toBe(0);
    expect(p.equipos[0].pregunta).toEqual(ultimaPregunta);
  });

  it('«Go» sin nada escrito no hace nada (dos toques seguidos en «Go» no cuentan dos veces)', () => {
    let p = nuevaPartida('p12', 'suma', 5, 9);
    p = acertar(p, 0);
    const despues = reducirPartida(p, { tipo: 'tecla', equipo: 0, tecla: 'go' });
    expect(despues).toBe(p);
    expect(p.balance).toBe(-1);
  });

  it('las teclas de un equipo no tocan lo escrito por el otro', () => {
    let p = nuevaPartida('e12', 'enteros', 5, 11);
    p = reducirPartida(p, { tipo: 'tecla', equipo: 0, tecla: '4' });
    p = reducirPartida(p, { tipo: 'tecla', equipo: 1, tecla: '-' });
    p = reducirPartida(p, { tipo: 'tecla', equipo: 1, tecla: '7' });
    p = reducirPartida(p, { tipo: 'tecla', equipo: 0, tecla: '2' });
    expect(p.equipos[0].escrito).toBe('42');
    expect(p.equipos[1].escrito).toBe('-7');
  });

  it('es repetible con la misma semilla', () => {
    const a = acertar(nuevaPartida('e34', 'mezcla', 7, 5), 0);
    const b = acertar(nuevaPartida('e34', 'mezcla', 7, 5), 0);
    expect(a).toEqual(b);
    expect(esEso('e34')).toBe(true);
  });
});
