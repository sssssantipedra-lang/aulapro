import { describe, expect, it } from 'vitest';
import {
  MAX_NOMBRE, MAX_RESPUESTA, MENOS, NIVELES, azarConSemilla, enunciado, escribirNombre, escribirRespuesta, esEso, firma,
  generarPregunta, nivelDeClase, nombreFinal, nuevaPartida, operacionesDe, reducirPartida, resuelta, tipoParaNivel,
  valorEscrito, vistaPara, vistasPosibles,
  type NivelCuerda, type Partida, type Pregunta, type Tecla, type TipoCuerda,
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
function muestras(nivel: NivelCuerda, tipo: TipoCuerda, semilla = 7): Pregunta[] {
  const { azar } = azarConSemilla(semilla);
  return Array.from({ length: MUESTRAS }, () => generarPregunta(nivel, tipo, azar));
}
const numeros = (p: Pregunta) => (p.texto.match(/\d+/g) ?? []).map(Number);

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

  it('en Primaria no hay negativos, ni en la respuesta ni en lo que se ve; las restas dan al menos 1', () => {
    for (const nivel of ['p12', 'p34', 'p56'] as const) {
      for (const tipo of ['suma', 'resta', 'multiplicacion', 'division', 'mezcla'] as const) {
        for (const p of muestras(nivel, tipo)) {
          expect(p.respuesta, p.texto).toBeGreaterThanOrEqual(0);
          if (p.operacion === 'resta') expect(p.respuesta, p.texto).toBeGreaterThanOrEqual(1);
          expect(/\(/.test(p.texto), p.texto).toBe(false);
        }
      }
    }
  });

  it('las divisiones son siempre exactas', () => {
    for (const nivel of ['p34', 'p56'] as const) {
      for (const p of muestras(nivel, 'division')) {
        const [a, b] = numeros(p);
        expect(a % b, p.texto).toBe(0);
        expect(a / b).toBe(p.respuesta);
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

  it('1.º y 2.º de Primaria: solo sumas y restas hasta 100 (la multiplicación y la división son del segundo ciclo)', () => {
    expect(operacionesDe('p12').map(o => o.id)).toEqual(['suma', 'resta']);
    expect(tipoParaNivel('p12', 'multiplicacion')).toBe('mezcla');
    for (const p of muestras('p12', 'suma')) expect(p.respuesta).toBeLessThanOrEqual(100);
    for (const p of muestras('p12', 'resta')) expect(Math.max(...numeros(p))).toBeLessThanOrEqual(99);
    for (const p of muestras('p12', 'mezcla')) expect(['suma', 'resta']).toContain(p.operacion);
  });

  it('nada trivial: sin «× 1», sin «x : x», sin factores ±1 y con algún negativo en los números enteros', () => {
    for (const nivel of ['p34', 'p56'] as const) {
      for (const p of muestras(nivel, 'multiplicacion')) expect(Math.min(...numeros(p)), p.texto).toBeGreaterThan(1);
      for (const p of muestras(nivel, 'division')) expect(p.respuesta, p.texto).toBeGreaterThan(1);
    }
    for (const p of muestras('e12', 'enteros')) expect(p.texto.includes(MENOS), p.texto).toBe(true);
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

  it('los rangos de 3.º y 4.º y de 5.º y 6.º de Primaria', () => {
    for (const p of muestras('p34', 'suma')) expect(p.respuesta).toBeLessThanOrEqual(999);
    for (const p of muestras('p34', 'resta')) expect(Math.max(...numeros(p))).toBeLessThanOrEqual(999);
    for (const p of muestras('p34', 'multiplicacion')) expect(Math.min(...numeros(p))).toBeLessThanOrEqual(10);
    for (const p of muestras('p34', 'division')) { expect(numeros(p)[1]).toBeLessThanOrEqual(9); expect(p.respuesta).toBeLessThanOrEqual(25); }
    for (const p of muestras('p56', 'suma')) expect(p.respuesta).toBeLessThan(10000);
    for (const p of muestras('p56', 'resta')) expect(Math.max(...numeros(p))).toBeLessThanOrEqual(9999);
    for (const p of muestras('p56', 'multiplicacion')) expect(p.respuesta).toBeLessThan(10000);
    for (const p of muestras('p56', 'division')) expect(numeros(p)[1]).toBeLessThanOrEqual(25);
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

  it('un tipo de otra etapa se vuelve mezcla', () => {
    expect(tipoParaNivel('e12', 'suma')).toBe('mezcla');
    expect(tipoParaNivel('p34', 'porcentajes')).toBe('mezcla');
    expect(tipoParaNivel('p34', 'resta')).toBe('resta');
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
    for (const nivel of NIVELES) {
      let iguales = 0, total = 0;
      for (let s = 1; s < 30; s++) {
        let p = nuevaPartida(nivel.id, 'mezcla', 7, s);
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
      expect(iguales / total, nivel.id).toBeGreaterThan(0.95);
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
