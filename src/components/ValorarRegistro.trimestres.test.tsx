// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ValorarRegistro } from './ValorarRegistro';
import { I18nProvider } from '../i18n';
import { ToastProvider } from './ui/Toast';
import { BIEN, MEJORABLE } from '../lib/registro';
import type { Class, EvalDiana, Evaluation, Student } from '../types';

/**
 * Una escala de registro se abre con lo ya valorado, y quien no cambia no se guarda otra vez. Con la columna
 * del cuaderno por evaluación (20-11-2026), eso solo vale dentro de una misma evaluación del curso: lo que
 * viene del primer trimestre y se guarda en el segundo se guarda a toda la clase, y se dice antes.
 */
const clase = { id: 'a', name: '1º A', subject: 'Matemáticas', subjects: ['Matemáticas'], room: '', color: '#0284c7' } as unknown as Class;
const alumnos = ['Alumno 1', 'Alumno 2'].map((name, k) => ({ id: `s${k + 1}`, class_id: 'a', name, email: '', photo: null, alerts: [], notes: '' }) as Student);
const escala = { id: 'esc', name: 'Trae el material', tipo: 'registro', class_id: 'a', subject: 'Matemáticas', category_id: 'cat', items: [{ id: 'i1', name: 'Material', weight: 1 }] } as unknown as EvalDiana;
const previa = (student: Student, date: string, v: number): Evaluation => ({
  id: 'ev-' + student.id, rubric_id: 'esc', rubric_name: escala.name, student_id: student.id, student_name: student.name,
  class_id: 'a', date, scores: { i1: v }, notes: '', instrument: 'diana', grade: v === BIEN ? 10 : 0, max_level: BIEN,
});

function abrir(evaluations: Evaluation[]) {
  const onAdd = vi.fn();
  render(<I18nProvider><ToastProvider>
    <ValorarRegistro escala={escala} classes={[clase]} students={alumnos} evaluations={evaluations} onAddEvaluation={onAdd} onClose={vi.fn()} />
  </ToastProvider></I18nProvider>);
  return onAdd;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 1, 3, 10, 0));   // 3 de febrero de 2027: 2.ª evaluación
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('valorar con una escala en otra evaluación del curso', () => {
  it('lo valorado en la 1.ª se guarda en la 2.ª a toda la clase, también a quien no cambia, y se avisa antes', () => {
    const onAdd = abrir([previa(alumnos[0], '2026-11-10', BIEN), previa(alumnos[1], '2026-11-10', MEJORABLE)]);
    expect(screen.getByText(/Lo marcado viene de la 1\.ª evaluación/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Alumno 2, Material: bien hecho'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valoración' }));
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onAdd.mock.calls.map(c => [c[0].student_id, c[0].date, c[0].scores.i1])).toEqual([['s1', '2027-02-03', BIEN], ['s2', '2027-02-03', BIEN]]);
  });

  it('«Empezar en blanco» quita lo marcado y solo se guarda a quien se valore', () => {
    const onAdd = abrir([previa(alumnos[0], '2026-11-10', BIEN), previa(alumnos[1], '2026-11-10', MEJORABLE)]);
    fireEvent.click(screen.getByRole('button', { name: 'Empezar en blanco' }));
    expect(screen.queryByText(/Lo marcado viene de/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Alumno 1, Material: mejorable'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valoración' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ student_id: 's1', scores: { i1: MEJORABLE } });
  });

  it('dentro de la misma evaluación sigue como antes: sin aviso, y quien no cambia no se guarda otra vez', () => {
    const onAdd = abrir([previa(alumnos[0], '2027-01-20', BIEN), previa(alumnos[1], '2027-01-20', MEJORABLE)]);
    expect(screen.queryByText(/Lo marcado viene de/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Alumno 2, Material: bien hecho'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valoración' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].student_id).toBe('s2');
  });
});
