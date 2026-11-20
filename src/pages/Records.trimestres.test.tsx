// @vitest-environment jsdom
/**
 * El acta usa la misma evaluación que el cuaderno y, en «Final de curso», la regla de la nota final de la
 * clase y la asignatura (20-11-2026).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Records } from './Records';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { DEFAULT_BLOCK } from '../services/classMarks';
import { guardarPeriodoElegido } from '../lib/periodos';
import type { Class, ClassMark, GradeCategory, GradeItem, GradeMap, MarksBlockConfig, Student } from '../types';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2027, 1, 10, 10)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const clase = { id: 'c1', name: '1º ESO A', subject: 'Matemáticas', subjects: ['Matemáticas'], color: '#000' } as unknown as Class;
const alumno = { id: 's1', class_id: 'c1', name: 'Alumno 1' } as unknown as Student;
const categorias: GradeCategory[] = [{ id: 'k1', class_id: 'c1', name: 'Pruebas', weight: 100 }];
const actividades: GradeItem[] = [
  { id: 'i1', class_id: 'c1', category_id: 'k1', name: 'Otoño', date: '2026-10-20' },
  { id: 'i2', class_id: 'c1', category_id: 'k1', name: 'Invierno', date: '2027-02-03' },
  { id: 'i3', class_id: 'c1', category_id: 'k1', name: 'Invierno 2', date: '2027-02-05' },
];
const notas: GradeMap = { i1: { s1: 4 }, i2: { s1: 8 }, i3: { s1: 9 } };

function pinta(marksConfigs: Record<string, MarksBlockConfig>, classMarks: ClassMark[] = []) {
  render(
    <I18nProvider><ToastProvider>
      <Records classes={[clase]} students={[alumno]} gradeCategories={categorias} gradeItems={actividades} grades={notas}
        classMarks={classMarks} marksConfigs={marksConfigs} evaluations={[]} teacherName="Profesor" course="2026-2027" onNav={() => {}} />
    </ToastProvider></I18nProvider>,
  );
}
const filaDelAlumno = () => within(document.getElementById('acta') as HTMLElement).getByText('Alumno 1').closest('tr') as HTMLElement;
const celdas = () => within(filaDelAlumno()).getAllByRole('cell').map(c => c.textContent);
const apagado = { 'c1|Matemáticas': { ...DEFAULT_BLOCK, enabled: false } };

describe('Acta por evaluaciones', () => {
  it('se abre en la evaluación de hoy y cuenta solo sus notas', () => {
    pinta(apagado);
    expect(screen.getByRole('button', { name: '2ª evaluación (la de hoy)' }).getAttribute('aria-pressed')).toBe('true');
    expect(celdas().slice(2, 4)).toEqual(['8,5', '8,5']);
  });

  it('se abre en la evaluación que se dejó elegida en el cuaderno', () => {
    guardarPeriodoElegido('1ª evaluación', '2027-02-10');
    pinta(apagado);
    expect(screen.getByRole('button', { name: '1ª evaluación' }).getAttribute('aria-pressed')).toBe('true');
    expect(celdas().slice(2, 4)).toEqual(['4,0', '4,0']);
  });

  it('«Final de curso» sin regla elegida es evaluación continua: todas las notas juntas', () => {
    pinta(apagado);
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    expect(celdas().slice(2, 4)).toEqual(['7,0', '7,0']);
    expect(within(document.getElementById('acta') as HTMLElement).getByText('Nota final: evaluación continua, con todas las notas del curso.')).toBeTruthy();
  });

  it('con la media de las evaluaciones, enseña la nota de cada una y su media con los pesos', () => {
    pinta({ 'c1|Matemáticas': { ...DEFAULT_BLOCK, enabled: false, final: { modo: 'media', pesos: [25, 75, 0] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    // 4 al 25 % y 8,5 al 75 %
    expect(celdas().slice(2, 6)).toEqual(['4,0', '8,5', '—', '7,4']);
    const acta = document.getElementById('acta') as HTMLElement;
    expect(within(acta).getByText('Nota final: media de las evaluaciones (1ª evaluación 25% · 2ª evaluación 75% · 3ª evaluación 0%).')).toBeTruthy();
  });

  it('el bloque de trabajo diario y actitud se calcula con las anotaciones de la evaluación', () => {
    const marcas: ClassMark[] = [
      { id: 'm1', class_id: 'c1', student_id: 's1', type: 'homework', date: '2026-10-05' },
      { id: 'm2', class_id: 'c1', student_id: 's1', type: 'homework', date: '2026-10-06' },
    ];
    pinta({}, marcas);
    // En la 2.ª no hay anotaciones: el bloque parte de sus notas (10, 10 y 5 → 8,3)
    expect(celdas()[3]).toBe('8,3');
    fireEvent.click(screen.getByRole('button', { name: '1ª evaluación' }));
    // En la 1.ª, dos «sin tarea»: tareas baja a 9 → 8,0
    expect(celdas()[3]).toBe('8,0');
  });
});
