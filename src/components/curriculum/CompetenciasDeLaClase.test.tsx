// @vitest-environment jsdom
/**
 * El cuaderno, pestaña «Por competencias», con el currículo real de Madrid:
 * la clase entera, un alumno por fila y una columna por competencia
 * específica, con las notas de las evaluaciones con criterios oficiales.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { CompetenciasDeLaClase } from './CompetenciasDeLaClase';
import { I18nProvider } from '../../i18n';
import { downloadFile } from '../../lib/download';
import type { Class, Evaluation, Student } from '../../types';

vi.mock('../../lib/download', () => ({ downloadFile: vi.fn() }));

afterEach(() => { cleanup(); localStorage.clear(); vi.mocked(downloadFile).mockClear(); });

const QUINTO: Class = {
  id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas', 'Lengua Castellana y Literatura', 'Religión'],
  room: '', color: '#000', etapa: 'primaria', curso: 5,
};

const alumno = (id: string, name: string): Student => ({ id, class_id: 'c1', name, email: '', photo: null, alerts: [], notes: '' });
const ALUMNOS = [alumno('s2', 'Alumno 2'), alumno('s1', 'Alumno 1')];

const evaluacion = (student_id: string, notas: Record<string, number>): Evaluation => ({
  id: 'e' + Math.random(), rubric_id: 'r', rubric_name: 'Mercado', student_id, student_name: '',
  class_id: 'c1', date: '2026-10-03', scores: {}, notes: '', officialCriteriaScores: notas,
});

function pinta(cls: Class, evaluaciones: Evaluation[], onNav = vi.fn()) {
  render(
    <I18nProvider>
      <CompetenciasDeLaClase classes={[cls]} students={ALUMNOS} evaluations={evaluaciones} comunidad="madrid" onNav={onNav} />
    </I18nProvider>,
  );
  return onNav;
}

describe('cuaderno por competencias', () => {
  it('un alumno por fila, una columna por competencia específica y la del área', async () => {
    pinta(QUINTO, [
      evaluacion('s1', { 'matematicas|1.1': 5, 'matematicas|2.1': 9 }),
      evaluacion('s1', { 'matematicas|1.1': 7 }),
      evaluacion('s2', { 'matematicas|2.1': 4 }),
    ]);
    const tabla = await screen.findByRole('table');
    const cabecera = within(tabla).getAllByRole('columnheader').map(c => c.textContent);
    expect(cabecera[0]).toBe('Alumno');
    expect(cabecera[1]).toBe('CE1');
    expect(cabecera.at(-1)).toBe('Área');
    // El texto entero de la competencia, al pasar el ratón por su columna
    expect(within(tabla).getByRole('columnheader', { name: 'CE1' }).getAttribute('title')!.length).toBeGreaterThan(40);
    // Por orden de nombre
    const filas = within(tabla).getAllByRole('rowheader').map(c => c.textContent);
    expect(filas).toEqual(['Alumno 1', 'Alumno 2']);
    const uno = within(tabla).getByRole('rowheader', { name: 'Alumno 1' }).closest('tr')!;
    const celdas = within(uno).getAllByRole('cell').map(c => c.textContent);
    // CE1: media de 5 y 7; CE2: 9; Área: media de 6 y 9
    expect(celdas[0]).toBe('6,0');
    expect(celdas[1]).toBe('9,0');
    expect(celdas.at(-1)).toBe('7,5');
    expect(celdas[2]).toBe('—');
    // La leyenda con cada competencia y de dónde sale
    expect(screen.getByText(/^Matemáticas, según Decreto 61\/2022/)).toBeTruthy();
    // Una asignatura por chip, sin las que no tienen materia oficial
    expect(screen.getByRole('button', { name: 'Lengua Castellana y Literatura', pressed: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Religión' })).toBeNull();
  });

  it('se exporta a Excel con una columna por competencia', async () => {
    pinta(QUINTO, [evaluacion('s1', { 'matematicas|2.1': 8 })]);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /Exportar a Excel/ }));
    const [blob, nombre] = vi.mocked(downloadFile).mock.calls[0];
    expect(nombre).toBe('Competencias 5º A Matemáticas.csv');
    const csv = await (blob as Blob).text();
    const [cab, fila1, fila2] = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(cab).toMatch(/^"Alumno";"CE1";"CE2";.*"Área por competencias"$/);
    expect(fila1).toMatch(/^"Alumno 1";"";"8";/);
    expect(fila2).toMatch(/^"Alumno 2";"";"";/);
    expect(csv).toContain('"Matemáticas · Decreto 61/2022');
  });

  it('sin notas todavía, explica cómo conseguirlas y lleva a Rúbricas', async () => {
    const onNav = pinta(QUINTO, []);
    expect(await screen.findByText(/Aún no hay notas/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Rúbricas' }));
    expect(onNav).toHaveBeenCalledWith('rubrics');
  });

  it('una clase sin etapa ni curso pide que se indiquen', () => {
    const onNav = pinta({ ...QUINTO, etapa: undefined, curso: undefined }, []);
    expect(screen.getByText(/Indica la etapa y el curso de la clase/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Mis Clases' }));
    expect(onNav).toHaveBeenCalledWith('classes');
  });
});
