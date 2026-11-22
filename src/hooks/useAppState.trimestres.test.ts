// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState } from './useAppState';
import type { Evaluation, Rubric } from '../types';
import { DEFAULT_BLOCK } from '../services/classMarks';

/**
 * La columna del cuaderno de una rúbrica, una diana o una escala es por evaluación (20-11-2026): usar el
 * instrumento en el segundo trimestre no cambia la nota del primero. Antes había una sola columna, con la
 * fecha del primer uso y la nota del último.
 */
describe('la nota de un instrumento va a la columna de su evaluación', () => {
  beforeEach(() => localStorage.clear());

  function preparar() {
    const { result } = renderHook(() => useAppState());
    act(() => result.current.loadDemoData('es'));
    const clase = result.current.classes[0];
    const [alumno, otro] = result.current.students.filter(s => s.class_id === clase.id);
    const categoria = result.current.gradeCategories.find(c => c.class_id === clase.id)!;
    const rubrica: Rubric = {
      id: 'rub-tri', name: 'Exposición oral', class_id: clase.id, subject: clase.subject, category_id: categoria.id,
      criteria: [{ id: 'a', name: 'Uno', descriptors: {} }],
    } as Rubric;
    act(() => result.current.addRubric(rubrica));
    const ev = (id: string, date: string, grade: number, de = alumno): Evaluation => ({
      id, rubric_id: rubrica.id, rubric_name: rubrica.name, student_id: de.id, student_name: de.name,
      class_id: clase.id, date, scores: { a: 2 }, notes: '', instrument: 'rubric', grade, max_level: 4,
    });
    const columnas = () => result.current.gradeItems.filter(i => i.id.startsWith('gi-rub-tri')).map(i => ({ id: i.id, date: i.date }));
    const nota = (columna: string, de = alumno) => result.current.grades[columna]?.[de.id];
    return { result, ev, columnas, nota, alumno, otro };
  }

  it('en el segundo trimestre abre otra columna y la del primero se queda como estaba', () => {
    const { result, ev, columnas, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    act(() => result.current.addEvaluation(ev('e2', '2027-02-03', 9)));
    expect(columnas()).toEqual([{ id: 'gi-rub-tri', date: '2026-11-10' }, { id: 'gi-rub-tri@2026-2', date: '2027-02-03' }]);
    expect(nota('gi-rub-tri')).toBe(5);
    expect(nota('gi-rub-tri@2026-2')).toBe(9);
    // Otra vez en el segundo: la misma columna del segundo
    act(() => result.current.addEvaluation(ev('e3', '2027-03-01', 7)));
    expect(columnas()).toHaveLength(2);
    expect(nota('gi-rub-tri@2026-2')).toBe(7);
    expect(nota('gi-rub-tri')).toBe(5);
  });

  it('evaluar a varios de golpe en una evaluación nueva no duplica la columna', () => {
    const { result, ev, columnas, nota, otro } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    act(() => {
      result.current.addEvaluation(ev('e2', '2027-02-03', 9));
      result.current.addEvaluation(ev('e3', '2027-02-03', 6, otro));
    });
    expect(columnas().map(c => c.id)).toEqual(['gi-rub-tri', 'gi-rub-tri@2026-2']);
    expect(nota('gi-rub-tri@2026-2')).toBe(9);
    expect(nota('gi-rub-tri@2026-2', otro)).toBe(6);
  });

  it('la columna nueva lleva la fecha de la evaluación, no la de hoy', () => {
    const { result, ev, columnas } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2027-05-06', 8)));
    expect(columnas()).toEqual([{ id: 'gi-rub-tri', date: '2027-05-06' }]);
  });

  it('corregir la del primer trimestre cambia su columna aunque haya otra posterior en el segundo', () => {
    const { result, ev, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    act(() => result.current.addEvaluation(ev('e2', '2027-02-03', 9)));
    act(() => result.current.updateEvaluation(ev('e1', '2026-11-10', 6.5)));
    expect(nota('gi-rub-tri')).toBe(6.5);
    expect(nota('gi-rub-tri@2026-2')).toBe(9);
  });

  it('borrar la del segundo trimestre vacía su casilla y no trae la nota del primero', () => {
    const { result, ev, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    act(() => result.current.addEvaluation(ev('e2', '2027-02-03', 9)));
    act(() => result.current.deleteEvaluation('e2'));
    expect(nota('gi-rub-tri@2026-2')).toBeUndefined();
    expect(nota('gi-rub-tri')).toBe(5);
  });

  it('borrar la última del trimestre deja la anterior de ese mismo trimestre', () => {
    const { result, ev, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2027-01-20', 4)));
    act(() => result.current.addEvaluation(ev('e2', '2027-02-03', 9)));
    expect(nota('gi-rub-tri')).toBe(9);
    act(() => result.current.deleteEvaluation('e2'));
    expect(nota('gi-rub-tri')).toBe(4);
  });

  it('si el docente cambia la fecha de la columna a otra evaluación, la siguiente evaluación abre otra', () => {
    const { result, ev, columnas, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    const columna = result.current.gradeItems.find(i => i.id === 'gi-rub-tri')!;
    act(() => result.current.updateGradeItem({ ...columna, date: '2027-01-15' }));
    act(() => result.current.addEvaluation(ev('e2', '2026-12-01', 3)));
    expect(columnas().map(c => c.id)).toEqual(['gi-rub-tri', 'gi-rub-tri@2026-1']);
    expect(nota('gi-rub-tri')).toBe(5);
    expect(nota('gi-rub-tri@2026-1')).toBe(3);
  });
});

describe('la regla de la nota final de curso', () => {
  beforeEach(() => localStorage.clear());

  it('se guarda con la configuración del bloque y el registro dice que cambió la regla, no el bloque', () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current.loadDemoData('es'));
    const clase = result.current.classes[0];
    act(() => result.current.setMarksConfig(clase.id, clase.subject, { ...DEFAULT_BLOCK, points: 2, final: { modo: 'media', pesos: [20, 30, 50] } }, 'regla'));
    expect(result.current.marksConfigs[`${clase.id}|${clase.subject}`].final).toEqual({ modo: 'media', pesos: [20, 30, 50] });
    const ultima = result.current.auditLog[0];
    expect(ultima.what).toBe(`Nota final de curso de ${clase.name}`);
    expect(ultima.detail).toBe('media de las evaluaciones (20 · 30 · 50)');
    act(() => result.current.setMarksConfig(clase.id, clase.subject, { ...DEFAULT_BLOCK, points: 2 }, 'regla'));
    expect(result.current.auditLog[0].detail).toBe('evaluación continua');
  });
});
