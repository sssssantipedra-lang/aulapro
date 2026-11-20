// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { clasesDe, columnaDeEvaluacion, columnasDeDestino, conObjetivos, idColumna, objetivoPara, objetivosDe } from './objetivos';
import { gradeItemIdFor, type GradeItem } from '../types';

const rub = { id: 'r1', class_id: 'c1', subject: 'Matemáticas', category_id: 'k1', otras_clases: [{ class_id: 'c2', subject: 'Matemáticas', category_id: 'k2' }, { class_id: 'c3' }] };

describe('clases de una rúbrica o diana', () => {
  it('la principal va primero y le siguen las otras, sin repetir', () => {
    expect(clasesDe(rub)).toEqual(['c1', 'c2', 'c3']);
    expect(clasesDe({ ...rub, otras_clases: [{ class_id: 'c1' }, { class_id: 'c2' }, { class_id: 'c2' }] })).toEqual(['c1', 'c2']);
  });

  it('sin clase principal no hay clases: solo historial, como siempre', () => {
    expect(objetivosDe({})).toEqual([]);
    expect(objetivosDe({ otras_clases: [{ class_id: 'c2' }] })).toEqual([]);
  });

  it('cada clase tiene su categoría, y la columna de la principal conserva el id de siempre', () => {
    expect(objetivoPara(rub, 'c2')?.category_id).toBe('k2');
    expect(objetivoPara(rub, 'c9')).toBeUndefined();
    expect(idColumna(rub, 'c1')).toBe(gradeItemIdFor('r1'));
    expect(idColumna(rub, 'c1')).toBe('gi-r1');
    expect(idColumna(rub, 'c2')).toBe('gi-r1-c2');
  });

  it('al guardar se quita lo vacío y lo repetido', () => {
    expect(conObjetivos({ class_id: 'c1', otras_clases: [] })).toEqual({ class_id: 'c1' });
    expect(conObjetivos({ otras_clases: [{ class_id: 'c2' }] })).toEqual({});
    expect(conObjetivos({ class_id: 'c1', otras_clases: [{ class_id: 'c1' }, { class_id: 'c2' }] })).toEqual({ class_id: 'c1', otras_clases: [{ class_id: 'c2' }] });
  });
});

describe('la columna del cuaderno es por evaluación', () => {
  const col = (id: string, date: string): GradeItem => ({ id, class_id: 'c1', category_id: 'k1', name: 'Exposición oral', date });

  it('la primera vez, el id de siempre', () => {
    expect(columnaDeEvaluacion('gi-r1', '2026-11-20', [])).toEqual({ id: 'gi-r1', existe: false });
  });

  it('en la misma evaluación se sigue usando la columna que ya hay', () => {
    expect(columnaDeEvaluacion('gi-r1', '2026-12-15', [col('gi-r1', '2026-10-02')])).toEqual({ id: 'gi-r1', existe: true });
  });

  it('en otra evaluación, una columna nueva: la del primer trimestre no se toca', () => {
    const cuaderno = [col('gi-r1', '2026-10-02')];
    const segunda = columnaDeEvaluacion('gi-r1', '2027-02-03', cuaderno);
    expect(segunda).toEqual({ id: 'gi-r1@2026-2', existe: false });
    cuaderno.push(col(segunda.id, '2027-02-03'));
    expect(columnaDeEvaluacion('gi-r1', '2027-03-01', cuaderno)).toEqual({ id: 'gi-r1@2026-2', existe: true });
    expect(columnaDeEvaluacion('gi-r1', '2026-11-30', cuaderno)).toEqual({ id: 'gi-r1', existe: true });
    expect(columnaDeEvaluacion('gi-r1', '2027-05-05', cuaderno)).toEqual({ id: 'gi-r1@2026-3', existe: false });
  });

  it('una columna de antes de este cambio vale para la evaluación de su fecha', () => {
    const vieja = [col('gi-r1', '2027-01-20')];
    expect(columnaDeEvaluacion('gi-r1', '2027-02-03', vieja).id).toBe('gi-r1');
    expect(columnaDeEvaluacion('gi-r1', '2026-11-03', vieja)).toEqual({ id: 'gi-r1@2026-1', existe: false });
  });

  it('manda la fecha de la columna: si el docente la cambia de evaluación, cuenta donde cae', () => {
    // La columna abierta en la 2.ª se pasó a diciembre: una evaluación de febrero necesita otra, con un id libre
    const cuaderno = [col('gi-r1', '2026-10-02'), col('gi-r1@2026-2', '2026-12-18')];
    expect(columnaDeEvaluacion('gi-r1', '2027-02-03', cuaderno)).toEqual({ id: 'gi-r1@2026-2-2', existe: false });
    // Con dos columnas en la misma evaluación manda la de siempre
    expect(columnaDeEvaluacion('gi-r1', '2026-11-11', cuaderno).id).toBe('gi-r1');
  });

  it('una columna sin fecha vale para cualquier evaluación', () => {
    expect(columnaDeEvaluacion('gi-r1', '2027-02-03', [col('gi-r1', '')])).toEqual({ id: 'gi-r1', existe: true });
  });

  it('no confunde las columnas de otra clase o de otra área del mismo instrumento', () => {
    const cuaderno = [col('gi-r1-c2', '2026-10-02'), col('gi-r1-c1~plastica', '2026-10-02'), col('gi-r10', '2026-10-02')];
    expect(columnasDeDestino('gi-r1', cuaderno)).toEqual([]);
    expect(columnaDeEvaluacion('gi-r1', '2026-10-05', cuaderno)).toEqual({ id: 'gi-r1', existe: false });
    expect(columnaDeEvaluacion('gi-r1-c2', '2027-02-05', cuaderno).id).toBe('gi-r1-c2@2026-2');
  });

  it('otro curso es otra evaluación', () => {
    expect(columnaDeEvaluacion('gi-r1', '2027-10-05', [col('gi-r1', '2026-10-02')]).id).toBe('gi-r1@2027-1');
  });
});
