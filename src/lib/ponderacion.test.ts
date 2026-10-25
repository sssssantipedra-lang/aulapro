import { describe, it, expect } from 'vitest';
import { mediaDeCategoria, porcentajesEnCategoria, pesoEnLaNotaFinal } from './ponderacion';
import type { GradeItem, GradeMap } from '../types';

const it_ = (id: string, weight?: number): GradeItem => ({ id, class_id: 'c', category_id: 'k', name: id, date: '2026-10-01', ...(weight !== undefined ? { weight } : {}) });
const notas = (a: number | null, b: number | null, c: number | null): GradeMap => ({ a: { s: a }, b: { s: b }, c: { s: c } });

describe('ponderación dentro de la categoría', () => {
  it('sin pesos elegidos, media simple como siempre', () => {
    expect(mediaDeCategoria([it_('a'), it_('b'), it_('c')], notas(4, 6, 8), 's')).toBe(6);
  });
  it('con pesos, media ponderada', () => {
    expect(mediaDeCategoria([it_('a', 50), it_('b', 30), it_('c', 20)], notas(10, 5, 0), 's')).toBeCloseTo(6.5, 5);
  });
  it('una nota sin poner no resta: se promedia solo lo que hay', () => {
    expect(mediaDeCategoria([it_('a', 50), it_('b', 30), it_('c', 20)], notas(10, 5, null), 's')).toBeCloseTo(8.1250, 3);
    expect(mediaDeCategoria([it_('a')], notas(null, null, null), 's')).toBeNull();
  });
  it('las notas sin peso cuentan como su parte igual junto a las que sí lo tienen', () => {
    const p = porcentajesEnCategoria([it_('a', 50), it_('b'), it_('c')]);
    expect(p.get('a')! + p.get('b')! + p.get('c')!).toBeCloseTo(100, 5);
    expect(p.get('a')).toBeGreaterThan(p.get('b')!);
  });
  it('lo que pesa en la nota final es su parte por el peso de la categoría', () => {
    const lista = [it_('a', 25), it_('b', 75)];
    expect(pesoEnLaNotaFinal(lista[0], lista, 40)).toBeCloseTo(10, 5);
  });
  it('un peso 0 deja la nota fuera de la media', () => {
    expect(mediaDeCategoria([it_('a', 0), it_('b', 100)], { a: { s: 10 }, b: { s: 4 } }, 's')).toBe(4);
  });
});
