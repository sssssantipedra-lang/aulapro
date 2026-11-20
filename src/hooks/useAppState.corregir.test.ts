// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState } from './useAppState';
import type { Evaluation, Rubric } from '../types';

/**
 * Corregir una evaluación (20-11-2026): se actualiza en su sitio y la nota va al cuaderno solo si la
 * corregida es la vigente, la misma regla que al borrar.
 */
describe('updateEvaluation', () => {
  function preparar() {
    const { result } = renderHook(() => useAppState());
    act(() => result.current.loadDemoData('es'));
    const clase = result.current.classes[0];
    const alumno = result.current.students.find(s => s.class_id === clase.id)!;
    const categoria = result.current.gradeCategories.find(c => c.class_id === clase.id)!;
    const rubrica: Rubric = {
      id: 'rub-prueba', name: 'Rúbrica de prueba', class_id: clase.id, subject: clase.subject, category_id: categoria.id,
      criteria: [{ id: 'a', name: 'Uno', descriptors: {} }, { id: 'b', name: 'Dos', descriptors: {} }],
    } as Rubric;
    act(() => result.current.addRubric(rubrica));
    const ev = (id: string, date: string, grade: number): Evaluation => ({
      id, rubric_id: rubrica.id, rubric_name: rubrica.name, student_id: alumno.id, student_name: alumno.name,
      class_id: clase.id, date, scores: { a: 2, b: 2 }, notes: '', instrument: 'rubric', grade, max_level: 4,
    });
    const nota = () => result.current.grades['gi-' + rubrica.id]?.[alumno.id];
    return { result, ev, nota };
  }

  it('corregir la vigente la actualiza en su sitio y lleva la nota al cuaderno', () => {
    const { result, ev, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    expect(nota()).toBe(5);
    const antes = result.current.evaluations.length;
    act(() => result.current.updateEvaluation({ ...ev('e1', '2026-11-10', 7.5), scores: { a: 3, b: 3 }, notes: 'Corregida' }));
    expect(result.current.evaluations.length).toBe(antes);
    expect(result.current.evaluations.find(e => e.id === 'e1')).toMatchObject({ grade: 7.5, scores: { a: 3, b: 3 }, notes: 'Corregida' });
    expect(nota()).toBe(7.5);
  });

  it('corregir una más antigua no toca el cuaderno, que lleva la nota de la posterior', () => {
    const { result, ev, nota } = preparar();
    act(() => result.current.addEvaluation(ev('e1', '2026-11-10', 5)));
    act(() => result.current.addEvaluation(ev('e2', '2026-11-18', 9)));
    expect(nota()).toBe(9);
    act(() => result.current.updateEvaluation(ev('e1', '2026-11-10', 2.5)));
    expect(result.current.evaluations.find(e => e.id === 'e1')?.grade).toBe(2.5);
    expect(nota()).toBe(9);
  });

  it('no hace nada con una evaluación que no existe', () => {
    const { result, ev } = preparar();
    const antes = result.current.evaluations;
    act(() => result.current.updateEvaluation(ev('no-existe', '2026-11-10', 5)));
    expect(result.current.evaluations).toBe(antes);
  });

  it('varias correcciones seguidas, de alumnos distintos, se guardan todas', () => {
    const { result, ev } = preparar();
    const otro = result.current.students.filter(s => s.class_id === result.current.classes[0].id)[1];
    act(() => {
      result.current.addEvaluation(ev('e1', '2026-11-20', 5));
      result.current.addEvaluation({ ...ev('e2', '2026-11-20', 5), student_id: otro.id, student_name: otro.name });
    });
    act(() => {
      result.current.updateEvaluation(ev('e1', '2026-11-20', 10));
      result.current.updateEvaluation({ ...ev('e2', '2026-11-20', 7.5), student_id: otro.id, student_name: otro.name });
    });
    expect(result.current.evaluations.find(e => e.id === 'e1')?.grade).toBe(10);
    expect(result.current.evaluations.find(e => e.id === 'e2')?.grade).toBe(7.5);
    expect(result.current.grades['gi-rub-prueba']).toMatchObject({ [otro.id]: 7.5 });
  });
});
