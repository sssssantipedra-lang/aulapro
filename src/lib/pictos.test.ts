/**
 * Los pictogramas de la agenda visual: cada uno tiene su dibujo dentro de la
 * aplicación y su nombre en los tres idiomas, y la licencia va al lado.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATRIBUCION_MULBERRY, buscarPictos, CATEGORIAS_PICTO, PICTOS } from './pictos';

const DIR = join(__dirname, '../../public/pictos/mulberry');

describe('pictogramas', () => {
  it('cada uno tiene su archivo, su categoría y su nombre en castellano, català e inglés', () => {
    expect(PICTOS.length).toBeGreaterThan(200);
    expect(new Set(PICTOS.map(p => p.id)).size).toBe(PICTOS.length);
    const cats = new Set(CATEGORIAS_PICTO.map(c => c.id));
    for (const p of PICTOS) {
      expect(existsSync(join(DIR, `${p.id}.svg`)), p.id).toBe(true);
      expect(cats.has(p.categoria)).toBe(true);
      expect(p.es && p.ca && p.en, p.id).toBeTruthy();
    }
    // Hay motoras: silla de ruedas
    expect(PICTOS.some(p => p.id === 'wheelchair')).toBe(true);
  });

  it('la licencia va con ellos y la atribución es la que pide el autor', () => {
    expect(readFileSync(join(DIR, 'LICENSE.txt'), 'utf8')).toContain('creativecommons.org/licenses/by-sa/4.0');
    expect(ATRIBUCION_MULBERRY).toBe('Mulberry Symbols by Steve Lee are licenced under the Creative Commons Attribution-ShareAlike 4.0 License. See https://mulberrysymbols.org for details');
  });

  it('se buscan sin tildes, en el idioma de la app o en castellano', () => {
    expect(buscarPictos('bano', 'es').map(p => p.id)).toContain('toilets');
    expect(buscarPictos('rentar', 'ca').map(p => p.id)).toContain('wash-hands');
    expect(buscarPictos('lavarse', 'ca').map(p => p.id)).toContain('wash-hands');
    expect(buscarPictos('', 'es', 'emociones').every(p => p.categoria === 'emociones')).toBe(true);
  });
});
