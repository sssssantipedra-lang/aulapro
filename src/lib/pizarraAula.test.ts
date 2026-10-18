import { describe, it, expect } from 'vitest';
import {
  FONDOS, fondoPorId, leerVentanas, leerEscenas, ajustarRect, tirarDados, repartirGrupos,
  formatoCrono, direccionParaQr, SIMBOLOS_TRABAJO, MAX_ESCENAS, MAX_DADOS,
} from './pizarraAula';

/** Generador repetible para que las pruebas no dependan del azar. */
function semilla(s: number) {
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('fondos', () => {
  it('los identificadores no se repiten y cada fondo tiene tono', () => {
    expect(new Set(FONDOS.map(f => f.id)).size).toBe(FONDOS.length);
    for (const f of FONDOS) expect(['claro', 'oscuro']).toContain(f.tono);
  });
  it('un fondo desconocido vuelve al blanco', () => {
    expect(fondoPorId('nada').id).toBe('blanco');
    expect(fondoPorId(undefined).id).toBe('blanco');
    expect(fondoPorId('pizarra').id).toBe('pizarra');
  });
});

describe('ventanas y escenas guardadas', () => {
  const ids = ['timer', 'wheel'];
  const rect = { x: 10, y: 20, width: 300, height: 400 };

  it('descarta ventanas que ya no existen, repetidas o con medidas rotas', () => {
    const v = leerVentanas([
      { id: 'timer', rect }, { id: 'timer', rect }, { id: 'borrada', rect },
      { id: 'wheel', rect: { x: 0, y: 0, width: 0, height: 10 } },
      { id: 'wheel', rect: { x: 'a', y: 0, width: 5, height: 5 } },
      null, 3,
    ], ids);
    expect(v).toEqual([{ id: 'timer', rect }]);
  });
  it('lo que no es una lista da una lista vacía', () => {
    expect(leerVentanas('x', ids)).toEqual([]);
    expect(leerEscenas('no es json', ids)).toEqual([]);
    expect(leerEscenas('{"a":1}', ids)).toEqual([]);
    expect(leerEscenas(null, ids)).toEqual([]);
  });
  it('lee una escena válida, recorta el nombre y corrige el fondo', () => {
    const raw = JSON.stringify([
      { id: 'e1', nombre: '  Inicio de clase  ', fondo: 'raro', ventanas: [{ id: 'timer', rect }] },
      { id: 'e2', nombre: '   ', fondo: 'blanco', ventanas: [] },
      { id: 'e3', fondo: 'blanco', ventanas: [] },
    ]);
    expect(leerEscenas(raw, ids)).toEqual([
      { id: 'e1', nombre: 'Inicio de clase', fondo: 'blanco', ventanas: [{ id: 'timer', rect }] },
    ]);
  });
  it('no pasa del máximo de escenas', () => {
    const muchas = Array.from({ length: MAX_ESCENAS + 5 }, (_, i) => ({ id: 'e' + i, nombre: 'E' + i, fondo: 'blanco', ventanas: [] }));
    expect(leerEscenas(JSON.stringify(muchas), ids)).toHaveLength(MAX_ESCENAS);
  });
});

describe('ajustarRect', () => {
  const area = { width: 1000, height: 600 };
  const min = { width: 200, height: 200 };
  it('deja como está lo que cabe', () => {
    const r = { x: 50, y: 60, width: 300, height: 300 };
    expect(ajustarRect(r, area, min)).toEqual(r);
  });
  it('trae dentro lo que se salía por la derecha y por abajo', () => {
    expect(ajustarRect({ x: 900, y: 500, width: 300, height: 300 }, area, min)).toEqual({ x: 700, y: 300, width: 300, height: 300 });
  });
  it('encoge lo que no cabe, sin bajar del mínimo', () => {
    expect(ajustarRect({ x: 0, y: 0, width: 5000, height: 5000 }, area, min)).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
    expect(ajustarRect({ x: 0, y: 0, width: 50, height: 50 }, { width: 100, height: 100 }, min)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });
  it('no deja coordenadas negativas', () => {
    const r = ajustarRect({ x: -40, y: -9, width: 300, height: 300 }, area, min);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

describe('símbolos de trabajo', () => {
  it('no se repiten y llevan color hexadecimal', () => {
    expect(new Set(SIMBOLOS_TRABAJO.map(s => s.id)).size).toBe(SIMBOLOS_TRABAJO.length);
    for (const s of SIMBOLOS_TRABAJO) expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('dados', () => {
  it('tira entre 1 y MAX_DADOS dados, con caras de 1 a 6', () => {
    expect(tirarDados(0)).toHaveLength(1);
    expect(tirarDados(99)).toHaveLength(MAX_DADOS);
    const r = semilla(7);
    for (let i = 0; i < 200; i++) for (const d of tirarDados(3, 6, r)) { expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(6); }
  });
  it('un generador que da casi 1 no se sale de las caras', () => {
    expect(tirarDados(1, 6, () => 0.9999999)).toEqual([6]);
    expect(tirarDados(1, 6, () => 0)).toEqual([1]);
  });
  it('sale cada cara con el tiempo', () => {
    const r = semilla(3);
    const vistas = new Set<number>();
    for (let i = 0; i < 100; i++) tirarDados(1, 6, r).forEach(d => vistas.add(d));
    expect(vistas.size).toBe(6);
  });
});

describe('repartirGrupos', () => {
  const alumnos = Array.from({ length: 23 }, (_, i) => 'Alumno ' + (i + 1));

  it('reparte a todos una sola vez', () => {
    const g = repartirGrupos(alumnos, { por: 'numero', n: 5 }, semilla(1));
    expect(g).toHaveLength(5);
    expect(g.flat().sort()).toEqual([...alumnos].sort());
  });
  it('los grupos se diferencian en uno como mucho', () => {
    const tam = repartirGrupos(alumnos, { por: 'numero', n: 5 }, semilla(2)).map(x => x.length);
    expect(Math.max(...tam) - Math.min(...tam)).toBeLessThanOrEqual(1);
  });
  it('por tamaño: grupos de 4 con 23 alumnos son 6 grupos y ninguno queda con una sola persona', () => {
    const g = repartirGrupos(alumnos, { por: 'tamano', n: 4 }, semilla(3));
    expect(g).toHaveLength(6);
    expect(Math.min(...g.map(x => x.length))).toBeGreaterThanOrEqual(3);
    expect(Math.max(...g.map(x => x.length))).toBeLessThanOrEqual(4);
  });
  it('no hay más grupos que personas', () => {
    expect(repartirGrupos(['A', 'B'], { por: 'numero', n: 9 }, semilla(1))).toHaveLength(2);
  });
  it('ignora nombres vacíos y aguanta una lista vacía', () => {
    expect(repartirGrupos([], { por: 'numero', n: 3 })).toEqual([]);
    expect(repartirGrupos(['  ', ''], { por: 'tamano', n: 3 })).toEqual([]);
    expect(repartirGrupos(['A'], { por: 'tamano', n: 0 }).flat()).toEqual(['A']);
  });
  it('no cambia la lista que recibe', () => {
    const copia = [...alumnos];
    repartirGrupos(alumnos, { por: 'numero', n: 4 });
    expect(alumnos).toEqual(copia);
  });
});

describe('formatoCrono', () => {
  it('escribe minutos, segundos y centésimas', () => {
    expect(formatoCrono(0)).toBe('00:00.00');
    expect(formatoCrono(61_230)).toBe('01:01.23');
    expect(formatoCrono(599_990)).toBe('09:59.99');
  });
  it('a partir de una hora quita las centésimas', () => {
    expect(formatoCrono(3_600_000)).toBe('1:00:00');
    expect(formatoCrono(3_725_000)).toBe('1:02:05');
  });
  it('un valor negativo o roto se queda en cero', () => {
    expect(formatoCrono(-5)).toBe('00:00.00');
    expect(formatoCrono(NaN)).toBe('00:00.00');
  });
});

describe('direccionParaQr', () => {
  it('añade https a un dominio suelto', () => {
    expect(direccionParaQr('aulapro.app')).toBe('https://aulapro.app');
    expect(direccionParaQr(' aulapro.app/descargas ')).toBe('https://aulapro.app/descargas');
  });
  it('respeta los esquemas ya escritos', () => {
    expect(direccionParaQr('http://a.es')).toBe('http://a.es');
    expect(direccionParaQr('mailto:contacto@aulapro.app')).toBe('mailto:contacto@aulapro.app');
  });
  it('un texto libre se queda como está', () => {
    expect(direccionParaQr('Aula 2.º B')).toBe('Aula 2.º B');
    expect(direccionParaQr('')).toBe('');
  });
});
