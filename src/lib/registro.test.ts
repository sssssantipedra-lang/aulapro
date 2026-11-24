import { describe, it, expect } from 'vitest';
import { BIEN, MEJORABLE, cuentaRegistro, esRegistro, notaRegistro, ultimaValoracion, yaGuardado } from './registro';
import type { Evaluation } from '../types';

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

describe('lo ya valorado con una escala y la evaluación del curso', () => {
  const ev = (id: string, student_id: string, date: string, scores: Record<string, number>): Evaluation => ({
    id, rubric_id: 'esc', rubric_name: 'Trae el material', student_id, student_name: '', class_id: 'c', date, scores, notes: '', instrument: 'diana',
  }) as Evaluation;
  const lista = [ev('e2', 's1', '2026-11-10', { a: BIEN }), ev('e1', 's1', '2026-10-01', { a: MEJORABLE }), ev('e3', 's2', '2026-11-12', { a: BIEN })];

  it('la última valoración de cada alumno es la más reciente con esa escala', () => {
    expect(ultimaValoracion(lista, 'esc', 's1')?.id).toBe('e2');
    expect(ultimaValoracion(lista, 'esc', 's3')).toBeUndefined();
    expect(ultimaValoracion(lista, 'otra', 's1')).toBeUndefined();
  });

  it('en la misma evaluación del curso, lo que no cambia no se guarda otra vez', () => {
    expect(yaGuardado(lista[0], { a: BIEN }, '2026-12-01')).toBe(true);
    expect(yaGuardado(lista[0], { a: MEJORABLE }, '2026-12-01')).toBe(false);
    expect(yaGuardado(lista[0], { a: BIEN, b: BIEN }, '2026-12-01')).toBe(false);
    expect(yaGuardado(undefined, { a: BIEN }, '2026-12-01')).toBe(false);
  });

  it('en otra evaluación sí se guarda aunque esté igual: su columna del cuaderno es otra', () => {
    expect(yaGuardado(lista[0], { a: BIEN }, '2027-02-03')).toBe(false);
    // Y de un curso a otro
    expect(yaGuardado(lista[0], { a: BIEN }, '2027-11-10')).toBe(false);
  });
});
