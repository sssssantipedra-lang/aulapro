import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { errores } from './importar.mjs';
import { LISTA, ESTILO } from './lista.mjs';

describe('lista de pictogramas hechos con IA', () => {
  it('está completa: id único, tres idiomas, categoría y concepto', () => {
    expect(errores()).toEqual([]);
  });

  it('detecta una fila incompleta o repetida', () => {
    const e = errores([
      ['Mal Id', 'nada', 'a', 'b', '', 'concepto'],
      ['puzle', 'manipulativo', 'Puzle', 'Trencaclosques', 'Puzzle', 'puzzle'],
      ['puzle', 'manipulativo', 'Puzle', 'Trencaclosques', 'Puzzle', 'puzzle'],
    ]);
    expect(e.join('\n')).toMatch(/el id va en minúscula/);
    expect(e.join('\n')).toMatch(/categoría «nada»/);
    expect(e.join('\n')).toMatch(/falta en/);
    expect(e.join('\n')).toMatch(/id repetido/);
  });

  it('el estilo pide lo que hace pictograma: contorno negro, colores planos, sin texto', () => {
    expect(ESTILO).toMatch(/thick black outlines/);
    expect(ESTILO).toMatch(/no text, no letters, no numbers/);
  });

  it('los pictogramas que ya están en la app tienen su WebP y su fila', () => {
    const raiz = join(__dirname, '../../..');
    for (const id of ['plastilina', 'modelar-plastilina', 'hinchar-mejillas', 'inicio-actividad', 'fin-actividad', 'manos-quietas']) {
      expect(LISTA.some(f => f[0] === id), id).toBe(true);
      expect(existsSync(join(raiz, 'public/pictos/aulapro', `ia-${id}.webp`)), id).toBe(true);
    }
  });
});
