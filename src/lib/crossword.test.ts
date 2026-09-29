import { describe, it, expect } from 'vitest';
import { buildCrossword, crosswordCells } from './crossword';

/** Generador pseudoaleatorio con semilla, para que la prueba sea repetible. */
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

const WORDS = [
  { palabra: 'Planeta', pista: 'Gira alrededor de una estrella' },
  { palabra: 'Luna', pista: 'Satélite de la Tierra' },
  { palabra: 'Sol', pista: 'Nuestra estrella' },
  { palabra: 'Órbita', pista: 'Camino que sigue un planeta' },
  { palabra: 'Cometa', pista: 'Tiene cola de hielo y polvo' },
  { palabra: 'Galaxia', pista: 'Conjunto enorme de estrellas' },
];

describe('buildCrossword', () => {
  it('coloca las palabras cruzadas, sin tildes y con cada letra en su sitio', () => {
    for (let s = 1; s <= 20; s++) {
      const cw = buildCrossword(WORDS, seeded(s));
      expect(cw.entradas.length).toBeGreaterThanOrEqual(4);
      expect(cw.entradas.map(e => e.palabra)).toContain('PLANETA');
      expect(cw.entradas.every(e => !/[ÁÉÍÓÚ]/.test(e.palabra))).toBe(true);

      const grid = crosswordCells(cw);
      // Cada palabra se lee entera en la cuadrícula y no se sale de ella
      for (const e of cw.entradas) {
        const letters = [...e.palabra].map((_, i) =>
          e.dir === 'H' ? grid[e.fila][e.columna + i]?.letra : grid[e.fila + i][e.columna]?.letra).join('');
        expect(letters).toBe(e.palabra);
        expect(grid[e.fila][e.columna]?.numero).toBe(e.numero);
      }
    }
  });

  it('no deja palabras falsas: cada tramo de letras seguidas es una palabra del crucigrama', () => {
    for (let s = 1; s <= 20; s++) {
      const cw = buildCrossword(WORDS, seeded(s));
      const grid = crosswordCells(cw);
      const valid = new Set(cw.entradas.map(e => e.palabra));
      const runs: string[] = [];
      for (let r = 0; r < cw.filas; r++) runs.push(...grid[r].map(c => c?.letra ?? ' ').join('').split(' '));
      for (let c = 0; c < cw.columnas; c++) runs.push(...grid.map(row => row[c]?.letra ?? ' ').join('').split(' '));
      for (const run of runs.filter(x => x.length >= 2)) expect(valid.has(run)).toBe(true);
    }
  });

  it('numera en orden de lectura y pone las horizontales primero', () => {
    const cw = buildCrossword(WORDS, seeded(3));
    const firstV = cw.entradas.findIndex(e => e.dir === 'V');
    expect(cw.entradas.slice(0, firstV).every(e => e.dir === 'H')).toBe(true);
    expect(cw.entradas.some(e => e.numero === 1)).toBe(true);
  });

  it('sin palabras válidas devuelve un crucigrama vacío', () => {
    expect(buildCrossword([{ palabra: 'a', pista: '' }]).entradas).toEqual([]);
  });

  it('ignora las palabras repetidas', () => {
    const cw = buildCrossword([...WORDS, { palabra: 'luna', pista: 'otra vez' }], seeded(1));
    expect(cw.entradas.filter(e => e.palabra === 'LUNA')).toHaveLength(1);
  });
});
