import { describe, it, expect } from 'vitest';
import { CARPETAS, nombreDeCarpeta, rutaLegible } from './carpetas';

describe('carpetas de AulaPro en Android', () => {
  it('limpia lo que una ruta de Android no admite', () => {
    expect(nombreDeCarpeta('Fichas')).toBe('Fichas');
    expect(nombreDeCarpeta('  Actas / 4º A: curso  ')).toBe('Actas 4º A curso');
    expect(nombreDeCarpeta('../..')).toBe('Otros');
    expect(nombreDeCarpeta('')).toBe('Otros');
    expect(nombreDeCarpeta(undefined)).toBe('Otros');
    expect(nombreDeCarpeta('a'.repeat(100))).toHaveLength(60);
  });

  it('las carpetas de partida son nombres válidos y distintos', () => {
    const nombres = Object.values(CARPETAS);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const n of nombres) expect(nombreDeCarpeta(n)).toBe(n);
  });

  it('enseña la ruta como Documentos › AulaPro › carpeta', () => {
    expect(rutaLegible('Fichas')).toBe('Documentos › AulaPro › Fichas');
    expect(rutaLegible('')).toBe('Documentos › AulaPro › Otros');
  });
});
