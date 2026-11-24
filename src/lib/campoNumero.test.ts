import { describe, it, expect } from 'vitest';
import { numeroAlSalir, numeroEscrito } from './campoNumero';

describe('numeroEscrito: lo que llega a la pantalla mientras se escribe', () => {
  it('vacío, a medias o con letras no cambia nada', () => {
    expect(numeroEscrito('', { min: 1, max: 12 })).toBeNull();
    expect(numeroEscrito('  ', { min: 1 })).toBeNull();
    expect(numeroEscrito('4', { min: 20, max: 120 })).toBeNull();
    expect(numeroEscrito('4a', {})).toBeNull();
    expect(numeroEscrito('-', {})).toBeNull();
  });
  it('un número dentro del margen llega tal cual', () => {
    expect(numeroEscrito('45', { min: 20, max: 120 })).toBe(45);
    expect(numeroEscrito('0', { min: 0 })).toBe(0);
    expect(numeroEscrito('7', { min: 1, max: 8 })).toBe(7);
  });
  it('fuera del margen no llega (se corrige al salir)', () => {
    expect(numeroEscrito('50', { min: 1, max: 12 })).toBeNull();
    expect(numeroEscrito('0', { min: 1 })).toBeNull();
  });
  it('sin decimales, un número con coma no vale; con decimales, sí, con coma o punto', () => {
    expect(numeroEscrito('7,5', {})).toBeNull();
    expect(numeroEscrito('7,5', { decimales: true })).toBe(7.5);
    expect(numeroEscrito('7.5', { decimales: true })).toBe(7.5);
    expect(numeroEscrito('7,', { decimales: true })).toBeNull();
  });
});

describe('numeroAlSalir: lo que queda al salir del campo', () => {
  it('vacío o no es un número: vuelve el último valor bueno', () => {
    expect(numeroAlSalir('', 4, { min: 1, max: 8 })).toBe(4);
    expect(numeroAlSalir('abc', 30, { min: 20 })).toBe(30);
  });
  it('fuera del margen se lleva al límite más cercano', () => {
    expect(numeroAlSalir('50', 4, { min: 1, max: 12 })).toBe(12);
    expect(numeroAlSalir('0', 4, { min: 1, max: 12 })).toBe(1);
    expect(numeroAlSalir('4', 55, { min: 20, max: 120 })).toBe(20);
  });
  it('sin decimales se redondea; con decimales se conserva', () => {
    expect(numeroAlSalir('7,6', 1, {})).toBe(8);
    expect(numeroAlSalir('7,5', 1, { decimales: true })).toBe(7.5);
  });
});
