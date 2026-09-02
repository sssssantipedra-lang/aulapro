import { describe, it, expect } from 'vitest';
import { buildWordSearchGrid } from './wordSearch';

/** Sigue la posición+dirección de una colocación y devuelve la palabra que forma en la rejilla. */
function readWord(rejilla: string[][], fila: number, columna: number, dir: [number, number], len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += rejilla[fila + dir[0] * i][columna + dir[1] * i];
  return s;
}

describe('buildWordSearchGrid', () => {
  it('coloca cada palabra en la rejilla exactamente donde dice su posición', () => {
    const words = ['fracción', 'numerador', 'denominador', 'equivalente', 'simplificar'];
    const { rejilla, posiciones } = buildWordSearchGrid(words);

    expect(posiciones).toHaveLength(words.length);
    for (const p of posiciones) {
      // La palabra guardada en `posiciones` lleva tilde (para mostrarla); en la rejilla va sin tilde.
      const sinTilde = p.palabra.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-ZÑ]/g, '');
      const letras = readWord(rejilla, p.fila, p.columna, p.dir, sinTilde.length);
      expect(letras).toBe(sinTilde);
    }
  });

  it('la rejilla es cuadrada y solo tiene letras A-Z o Ñ', () => {
    const { rejilla, size } = buildWordSearchGrid(['gato', 'perro', 'niño']);
    expect(rejilla).toHaveLength(size);
    for (const fila of rejilla) {
      expect(fila).toHaveLength(size);
      for (const letra of fila) expect(letra).toMatch(/^[A-ZÑ]$/);
    }
  });

  it('conserva la Ñ en vez de convertirla en N', () => {
    const { posiciones } = buildWordSearchGrid(['niño', 'araña']);
    const palabras = posiciones.map(p => p.palabra);
    expect(palabras).toContain('NIÑO');
    expect(palabras).toContain('ARAÑA');
  });

  it('descarta palabras de una sola letra', () => {
    const { posiciones } = buildWordSearchGrid(['a', 'sol', 'luna']);
    expect(posiciones.map(p => p.palabra)).toEqual(['LUNA', 'SOL']);
  });

  it('no revienta con una lista larga de palabras largas (crece la rejilla en vez de fallar)', () => {
    const words = ['mitocondria', 'fotosíntesis', 'ecosistema', 'biodiversidad', 'cromosoma', 'nutrientes', 'respiración', 'membrana'];
    const { posiciones } = buildWordSearchGrid(words);
    expect(posiciones.length).toBeGreaterThanOrEqual(words.length - 1); // como mucho se cae una
  });
});
