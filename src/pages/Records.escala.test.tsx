// @vitest-environment jsdom
/**
 * La escala de las competencias clave del acta es siempre 1-4 (o sobre 10), aunque una rúbrica se haya
 * evaluado con otro número de niveles: antes salía «1-3» si todas las evaluaciones de la clase eran de tres niveles.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Records } from './Records';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, Evaluation, Student } from '../types';

afterEach(cleanup);
const clase = { id: 'c1', name: '1º ESO A', subject: 'Matemáticas', subjects: ['Matemáticas'], color: '#000' } as unknown as Class;
const alumno = { id: 's1', class_id: 'c1', name: 'Alumno 1' } as unknown as Student;
const evaluacion = { id: 'e1', rubric_id: 'r1', rubric_name: 'R', student_id: 's1', student_name: 'Alumno 1', class_id: 'c1', date: '2026-10-01', scores: {}, notes: '', instrument: 'rubric', max_level: 3, competencyScores: { CCL: 3 } } as unknown as Evaluation;

describe('Acta: escala de las competencias clave', () => {
  it('con evaluaciones de tres niveles sigue ofreciendo 1-4 y 1-10', () => {
    render(
      <I18nProvider><ToastProvider>
        <Records classes={[clase]} students={[alumno]} gradeCategories={[]} gradeItems={[]} grades={{}} evaluations={[evaluacion]}
          teacherName="Profesor" course="2025-2026" onNav={() => {}} />
      </ToastProvider></I18nProvider>,
    );
    expect(screen.getByRole('option', { name: '1-4' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '1-3' })).toBeNull();
    expect(screen.getByRole('option', { name: '1-10' })).toBeTruthy();
  });
});
