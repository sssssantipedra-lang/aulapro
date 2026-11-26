import { describe, it, expect } from 'vitest';
import { azarConSemilla } from './cuerda';
import { TRAMOS, type Tramo } from './tramos';
import {
  DIANA, MAX_DESEMPATES, VARIANTES, ajustar, conIman, distanciaEnTexto, distanciaRelativa, escribir, etiquetaDeMarca, fraccionDe,
  ganadoresDeRonda, generarObjetivo, marcasDe, nuevaPartidaRecta, reducirRecta, valorEn, valorEnTexto, varianteParaTramo,
  type Objetivo, type PartidaRecta,
} from './recta';

const muchos = (tramo: Tramo, variante: string, n = 800): Objetivo[] => {
  const { azar } = azarConSemilla(1234 + n + tramo.charCodeAt(1));
  return Array.from({ length: n }, () => generarObjetivo(tramo, variante, azar));
};
const esMultiplo = (x: number, k: number) => Math.abs(x / k - Math.round(x / k)) < 1e-9;

describe('los números de cada tramo', () => {
  it('siempre dentro de su recta, sin caer en un extremo, y con un valor que cuadra con lo que se enseña', () => {
    for (const t of TRAMOS) {
      for (const v of [...VARIANTES[t.id].map(x => x.id), 'mezcla']) {
        for (const o of muchos(t.id, v)) {
          expect(o.valor, `${t.id} ${v} ${o.clave}`).toBeGreaterThan(o.recta.min);
          expect(o.valor).toBeLessThan(o.recta.max);
          const m = o.muestra;
          const calc = m.tipo === 'numero' ? m.n : m.tipo === 'fraccion' ? m.num / m.den : m.tipo === 'raiz' ? Math.sqrt(m.radicando)
            : m.tipo === 'producto' ? m.a * m.b : m.tipo === 'cociente' ? m.a / m.b : m.tipo === 'cuadrado' ? m.a * m.a
              : m.tipo === 'porcentajeDe' ? (m.p * m.n) / 100 : m.tipo === 'fraccionDe' ? (m.num * m.n) / m.den
                : (m.muestra.tipo === 'numero' ? m.muestra.n : m.muestra.num / m.muestra.den) * 100;
          expect(Math.abs(calc - o.valor), o.clave).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('1.º y 2.º: enteros del 1 al 9 en la del 0 al 10 y del 1 al 19 en la del 0 al 20, con puntos e imán', () => {
    for (const o of muchos('p12', 'diez')) { expect(Number.isInteger(o.valor)).toBe(true); expect(o.recta.max).toBe(10); expect(o.conPuntos).toBe(true); expect(o.recta.iman).toBe(1); }
    const veinte = muchos('p12', 'veinte');
    expect(veinte.every(o => o.recta.max === 20 && o.valor >= 1 && o.valor <= 19)).toBe(true);
    expect(new Set(veinte.map(o => o.valor)).size).toBe(19);
  });

  it('3.º y 4.º: casi nunca en una marca', () => {
    const cien = muchos('p34', 'cien');
    expect(cien.filter(o => esMultiplo(o.valor, 10)).length / cien.length).toBeLessThan(0.2);
    const mil = muchos('p34', 'mil');
    expect(mil.every(o => o.recta.max === 1000 && Number.isInteger(o.valor))).toBe(true);
    expect(mil.filter(o => esMultiplo(o.valor, 100)).length / mil.length).toBeLessThan(0.2);
  });

  it('5.º y 6.º: decimales de una cifra y fracciones de medios, tercios, cuartos, quintos y décimos, irreducibles', () => {
    for (const o of muchos('p56', 'decimales')) {
      expect(o.muestra.tipo).toBe('numero');
      expect(esMultiplo(o.valor, 0.1)).toBe(true);
      expect(Number.isInteger(o.valor)).toBe(false);
    }
    for (const o of muchos('p56', 'fracciones')) {
      if (o.muestra.tipo !== 'fraccion') throw new Error('no es una fracción');
      expect([2, 3, 4, 5, 10]).toContain(o.muestra.den);
      expect(o.muestra.num).toBeGreaterThan(0);
      expect([1, 2]).toContain(o.recta.max);
    }
  });

  it('1.º y 2.º de ESO: enteros con negativos y positivos, y fracciones y decimales con negativos', () => {
    const e = muchos('e12', 'enteros');
    expect(e.some(o => o.valor < 0) && e.some(o => o.valor > 0)).toBe(true);
    expect(e.every(o => Number.isInteger(o.valor) && o.valor !== 0)).toBe(true);
    expect(e.some(o => o.recta.min === -100) && e.some(o => o.recta.min === -20)).toBe(true);
    const r = muchos('e12', 'racionales');
    expect(r.some(o => o.valor < 0 && o.muestra.tipo === 'fraccion') && r.some(o => o.valor < 0 && o.muestra.tipo === 'numero')).toBe(true);
  });

  it('3.º y 4.º de ESO: raíces no exactas del 0 al 10 y expresiones', () => {
    for (const o of muchos('e34', 'raices')) {
      if (o.muestra.tipo !== 'raiz') throw new Error('no es una raíz');
      expect(Number.isInteger(Math.sqrt(o.muestra.radicando))).toBe(false);
      expect(o.recta.max).toBe(10);
    }
    const ex = muchos('e34', 'expresiones');
    const tipos = new Set(ex.map(o => o.muestra.tipo));
    for (const k of ['producto', 'cociente', 'cuadrado', 'porcentajeDe', 'fraccionDe', 'enPorcentaje']) expect(tipos.has(k as never), k).toBe(true);
    expect(ex.filter(o => o.recta.etiquetas === 'porcentaje').every(o => o.muestra.tipo === 'enPorcentaje')).toBe(true);
  });

  it('no repite un número reciente si puede', () => {
    const { azar } = azarConSemilla(7);
    const recientes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const o = generarObjetivo('p12', 'diez', azar, recientes);
      expect(recientes).not.toContain(o.clave);
      recientes.push(o.clave);
    }
  });

  it('una variante que no existe en el tramo es la mezcla', () => {
    expect(varianteParaTramo('p12', 'raices')).toBe('mezcla');
    expect(varianteParaTramo('e34', 'raices')).toBe('raices');
  });
});

describe('posiciones, distancias y quién gana', () => {
  const r = { min: -20, max: 20, menor: 1, mayor: 5, etiquetas: 'entero' as const };
  it('de la posición al valor y al revés, dentro de la recta', () => {
    expect(valorEn(r, 0.5)).toBe(0);
    expect(valorEn(r, 2)).toBe(20);
    expect(fraccionDe(r, -10)).toBe(0.25);
    expect(ajustar(r, 25)).toBe(20);
    expect(ajustar(r, 3.01234)).toBe(3);
    expect(conIman({ ...r, iman: 1 }, 6.6)).toBe(7);
    expect(conIman(r, 6.6)).toBe(6.6);
  });

  it('la cercanía, en proporción a la recta: un 1 en la del 0 al 10 vale como un 100 en la del 0 al 1000', () => {
    expect(distanciaRelativa({ ...r, min: 0, max: 10 }, 4, 5)).toBeCloseTo(distanciaRelativa({ ...r, min: 0, max: 1000 }, 400, 500));
    expect(distanciaRelativa(r, -3, 1)).toBeCloseTo(0.1);
    expect(DIANA).toBe(0.01);
  });

  it('gana el más cerca; empate exacto, los dos; sin marcador, no puntúa', () => {
    expect(ganadoresDeRonda([0.1, 0.2])).toEqual([0]);
    expect(ganadoresDeRonda([0.3, 0.2])).toEqual([1]);
    expect(ganadoresDeRonda([0.2, 0.2])).toEqual([0, 1]);
    expect(ganadoresDeRonda([null, 0.9])).toEqual([1]);
    expect(ganadoresDeRonda([null, null])).toEqual([]);
  });

  it('se escribe con coma en castellano y con punto en inglés, con el signo menos de verdad', () => {
    expect(escribir(-1.5, 1, false)).toBe('−1,5');
    expect(escribir(2.35, 2, true)).toBe('2.35');
    expect(escribir(-0.001, 0, false)).toBe('0');
    expect(etiquetaDeMarca({ ...r, etiquetas: 'porcentaje' }, 50, false)).toBe('50 %');
    expect(etiquetaDeMarca({ ...r, etiquetas: 'decimal' }, 0.5, false)).toBe('0,5');
    expect(distanciaEnTexto({ ...r, min: 0, max: 1 }, 0.3, 0.75, false)).toBe('0,45');
    expect(valorEnTexto({ valor: Math.sqrt(50), muestra: { tipo: 'raiz', radicando: 50 }, recta: { ...r, min: 0, max: 10 }, clave: '' }, false)).toBe('≈ 7,07');
  });

  it('las marcas: de 1 en 1 con número cada 5 de −20 a 20; en la del 0 al 1, décimas con 0, 0,5 y 1', () => {
    const m = marcasDe(r);
    expect(m).toHaveLength(41);
    expect(m.filter(x => x.mayor).map(x => x.x)).toEqual([-20, -15, -10, -5, 0, 5, 10, 15, 20]);
    const u = marcasDe({ min: 0, max: 1, menor: 0.1, mayor: 0.5, etiquetas: 'decimal' });
    expect(u).toHaveLength(11);
    expect(u.filter(x => x.mayor).map(x => x.x)).toEqual([0, 0.5, 1]);
  });
});

describe('la partida', () => {
  const nueva = (rondas: 5 | 7 | 10 = 5) => nuevaPartidaRecta('p34', 'cien', rondas, 99);
  const jugarRonda = (p: PartidaRecta, gana: 0 | 1 | 'empate'): PartidaRecta => {
    const v = p.objetivo.valor, len = p.objetivo.recta.max - p.objetivo.recta.min;
    const cerca = v, lejos = v + (v < 50 ? 1 : -1) * len * 0.3;
    p = reducirRecta(p, { tipo: 'mover', equipo: 0, valor: gana === 1 ? lejos : cerca });
    p = reducirRecta(p, { tipo: 'mover', equipo: 1, valor: gana === 0 ? lejos : cerca });
    p = reducirRecta(p, { tipo: 'fijar', equipo: 0 });
    p = reducirRecta(p, { tipo: 'fijar', equipo: 1 });
    expect(p.fase).toBe('revelada');
    return reducirRecta(p, { tipo: 'siguiente' });
  };

  it('los dos mueven a la vez; fijado, no se mueve; cuando fijan los dos, se revela', () => {
    let p = nueva();
    p = reducirRecta(p, { tipo: 'mover', equipo: 0, valor: 30 });
    p = reducirRecta(p, { tipo: 'mover', equipo: 1, valor: 70 });
    expect([p.equipos[0].pos, p.equipos[1].pos]).toEqual([30, 70]);
    p = reducirRecta(p, { tipo: 'fijar', equipo: 0 });
    p = reducirRecta(p, { tipo: 'mover', equipo: 0, valor: 50 });
    expect(p.equipos[0].pos).toBe(30);
    expect(p.fase).toBe('apuntando');
    p = reducirRecta(p, { tipo: 'fijar', equipo: 1 });
    expect(p.fase).toBe('revelada');
    expect(p.historial).toHaveLength(1);
    expect(p.equipos[0].puntos + p.equipos[1].puntos).toBeGreaterThanOrEqual(1);
  });

  it('sin marcador no se puede fijar; al acabar el tiempo se revela con lo que hay y quien no lo puso no puntúa', () => {
    let p = nueva();
    expect(reducirRecta(p, { tipo: 'fijar', equipo: 0 })).toBe(p);
    p = reducirRecta(p, { tipo: 'mover', equipo: 1, valor: 0 });
    p = reducirRecta(p, { tipo: 'tiempo' });
    expect(p.fase).toBe('revelada');
    expect(p.historial[0].ganadores).toEqual([1]);
    expect(p.equipos).toMatchObject([{ puntos: 0 }, { puntos: 1 }]);
    // Revelada, el tiempo y los marcadores ya no cuentan
    expect(reducirRecta(p, { tipo: 'tiempo' })).toBe(p);
    expect(reducirRecta(p, { tipo: 'mover', equipo: 0, valor: 3 })).toBe(p);
  });

  it('con imán (1.º y 2.º), al soltar o al fijar el marcador se queda en el entero más cercano', () => {
    let p = nuevaPartidaRecta('p12', 'diez', 5, 3);
    p = reducirRecta(p, { tipo: 'mover', equipo: 0, valor: 6.62 });
    p = reducirRecta(p, { tipo: 'soltar', equipo: 0 });
    expect(p.equipos[0].pos).toBe(7);
    p = reducirRecta(p, { tipo: 'mover', equipo: 1, valor: p.objetivo.valor + 0.3 });
    p = reducirRecta(p, { tipo: 'fijar', equipo: 1 });
    expect(p.equipos[1].pos).toBe(p.objetivo.valor);
  });

  it('los dos equipos, a la misma distancia: punto para los dos', () => {
    let p = nueva();
    p = jugarRonda(p, 'empate');
    expect(p.equipos.map(e => e.puntos)).toEqual([1, 1]);
  });

  it('a 5 rondas gana quien más tiene; cada ronda, otro número', () => {
    let p = nueva(5);
    const claves = new Set<string>();
    for (const g of [0, 1, 0, 0, 1] as const) { claves.add(p.objetivo.clave); p = jugarRonda(p, g); }
    expect(claves.size).toBe(5);
    expect(p.fase).toBe('fin');
    expect(p.ganador).toEqual([0]);
  });

  it('empatados al final, desempate hasta que alguien gana; si no, empate', () => {
    let p = nueva(5);
    for (const g of [0, 1, 0, 1, 'empate'] as const) p = jugarRonda(p, g);
    expect(p.fase).toBe('apuntando');
    expect(p.desempate).toBe(true);
    p = jugarRonda(p, 1);
    expect(p.fase).toBe('fin');
    expect(p.ganador).toEqual([1]);

    let q = nueva(5);
    for (let i = 0; i < 5 + MAX_DESEMPATES; i++) q = jugarRonda(q, 'empate');
    expect(q.fase).toBe('fin');
    expect(q.ganador).toEqual([0, 1]);
  });

  it('es un reductor puro: con la misma semilla, la misma partida', () => {
    const a = jugarRonda(nueva(), 0), b = jugarRonda(nueva(), 0);
    expect(a.objetivo).toEqual(b.objetivo);
  });
});
