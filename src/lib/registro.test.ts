import { describe, it, expect } from 'vitest';
import { BIEN, MEJORABLE, cuentaRegistro, esRegistro, notaRegistro } from './registro';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('escala de registro', () => {
  it('la nota es la proporción de pulgares arriba entre los valorados', () => {
    expect(notaRegistro(items, { a: BIEN, b: BIEN, c: BIEN, d: BIEN })).toBe(10);
    expect(notaRegistro(items, { a: BIEN, b: MEJORABLE })).toBe(5);
    expect(notaRegistro(items, { a: BIEN, b: BIEN, c: MEJORABLE })).toBe(6.7);
    expect(notaRegistro(items, { a: MEJORABLE, b: MEJORABLE })).toBe(0);
  });

  it('lo que no se ha valorado no cuenta, y sin ninguno valorado no hay nota', () => {
    expect(notaRegistro(items, { a: BIEN })).toBe(10);
    expect(notaRegistro(items, {})).toBeNull();
    expect(notaRegistro(items, { a: 7, b: 0 })).toBeNull();
  });

  it('un concepto con más peso pesa más', () => {
    expect(notaRegistro([{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }], { a: BIEN, b: MEJORABLE })).toBe(7.5);
  });

  it('cuenta los bien hechos y los mejorables, y reconoce una escala de registro', () => {
    expect(cuentaRegistro({ a: BIEN, b: MEJORABLE, c: BIEN }, ['a', 'b', 'c', 'd'])).toEqual({ bien: 2, mejorable: 1 });
    expect(esRegistro({ tipo: 'registro' })).toBe(true);
    expect(esRegistro({})).toBe(false);
  });
});
