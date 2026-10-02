import { describe, expect, it } from 'vitest';
import { looksLikeKey } from './apiKey';

describe('looksLikeKey', () => {
  it('acepta cualquier formato de clave de Google', () => {
    expect(looksLikeKey('AIza' + 'a'.repeat(35))).toBe(true);
    expect(looksLikeKey('  AQ.Ab8RN6' + 'k'.repeat(40) + '  ')).toBe(true);
    expect(looksLikeKey('otro_formato-futuro.' + 'x'.repeat(30))).toBe(true);
  });

  it('rechaza lo que claramente no es una clave', () => {
    expect(looksLikeKey('hola, esto es un texto copiado')).toBe(false);
    expect(looksLikeKey('corta')).toBe(false);
    expect(looksLikeKey('')).toBe(false);
  });
});
