import { describe, it, expect } from 'vitest';
import { racha } from './racha';
import type { ClassMark, ClassMarkType } from '../types';

const suma = (t: ClassMarkType) => t === 'participation' || t === 'behavior-good';
const marca = (student_id: string, date: string, type: ClassMarkType = 'participation'): ClassMark =>
  ({ id: `${student_id}${date}${type}`, class_id: 'c1', student_id, type, date });

describe('racha en Anotar actitud', () => {
  it('cuenta los días de clase seguidos con anotaciones que suman', () => {
    const m = [marca('a', '2026-10-13'), marca('a', '2026-10-14'), marca('a', '2026-10-15')];
    expect(racha(m, 'a', '2026-10-15', suma)).toBe(3);
  });

  it('un día con una anotación que resta rompe la racha', () => {
    const m = [marca('a', '2026-10-13'), marca('a', '2026-10-14'), marca('a', '2026-10-14', 'homework'), marca('a', '2026-10-15')];
    expect(racha(m, 'a', '2026-10-15', suma)).toBe(1);
  });

  it('un día sin clase no la rompe, pero un día de clase sin anotarle, sí', () => {
    // El 14 no hay anotaciones de nadie: es un día sin clase
    const sinClase = [marca('a', '2026-10-13'), marca('a', '2026-10-15')];
    expect(racha(sinClase, 'a', '2026-10-15', suma)).toBe(2);
    // El 14 se anotó a otro alumno y a «a» no
    const conClase = [marca('a', '2026-10-13'), marca('b', '2026-10-14'), marca('a', '2026-10-15')];
    expect(racha(conClase, 'a', '2026-10-15', suma)).toBe(1);
  });

  it('mientras no se le anota nada hoy, el día de hoy no la rompe', () => {
    const m = [marca('a', '2026-10-13'), marca('a', '2026-10-14'), marca('b', '2026-10-15')];
    expect(racha(m, 'a', '2026-10-15', suma)).toBe(2);
  });

  it('no mira días posteriores al que se está viendo', () => {
    const m = [marca('a', '2026-10-13'), marca('a', '2026-10-20')];
    expect(racha(m, 'a', '2026-10-14', suma)).toBe(1);
  });

  it('sin anotaciones es 0', () => {
    expect(racha([], 'a', '2026-10-15', suma)).toBe(0);
  });
});
