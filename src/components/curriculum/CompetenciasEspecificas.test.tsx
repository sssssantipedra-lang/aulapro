// @vitest-environment jsdom
/**
 * La sección de competencias específicas de la Diana competencial, con el
 * currículo real de Madrid: las notas de las evaluaciones con criterios
 * oficiales llegan a su criterio, su competencia y su área.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { CompetenciasEspecificas } from './CompetenciasEspecificas';
import { I18nProvider } from '../../i18n';
import type { Class, Evaluation } from '../../types';

afterEach(() => { cleanup(); localStorage.clear(); });

const QUINTO: Class = {
  id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas', 'Religión'], room: '', color: '#000',
  etapa: 'primaria', curso: 5,
};

const evaluacion = (notas: Record<string, number>): Evaluation => ({
  id: 'e' + Math.random(), rubric_id: 'r', rubric_name: 'Mercado', student_id: 's', student_name: 'Ana',
  class_id: 'c1', date: '2026-10-03', scores: {}, notes: '', officialCriteriaScores: notas,
});

function pinta(cls: Class, evaluaciones: Evaluation[]) {
  render(<I18nProvider><CompetenciasEspecificas cls={cls} comunidad="madrid" evaluaciones={evaluaciones} /></I18nProvider>);
}

describe('competencias específicas del alumno', () => {
  it('cada asignatura con materia oficial, con la nota de sus criterios, competencias y área', async () => {
    pinta(QUINTO, [
      evaluacion({ 'matematicas|1.1': 5, 'matematicas|2.1': 9 }),
      evaluacion({ 'matematicas|1.1': 7 }),
    ]);
    const mates = (await screen.findByText('Matemáticas')).closest('details')!;
    // Religión no tiene currículo: no sale
    expect(screen.queryByText('Religión')).toBeNull();
    // Área: media de las competencias 1 (6) y 2 (9)
    expect(within(mates.querySelector('summary')!).getByText('7,5')).toBeTruthy();
    const criterio11 = within(mates).getByText('1.1').closest('li')!;
    expect(within(criterio11).getByText('6,0')).toBeTruthy();
    expect(within(criterio11).getByText('Evaluado 2 veces')).toBeTruthy();
    // Los criterios sin evaluar también están, para ver lo que falta
    expect(within(within(mates).getByText('1.2').closest('li')!).getByText('Sin evaluar')).toBeTruthy();
  });

  it('sin notas todavía, explica cómo conseguirlas', async () => {
    pinta(QUINTO, []);
    expect(await screen.findByText(/Aún no hay notas/)).toBeTruthy();
  });

  it('una clase sin etapa ni curso pide que se indiquen', () => {
    pinta({ ...QUINTO, etapa: undefined, curso: undefined }, []);
    expect(screen.getByText(/Indica la etapa y el curso de la clase/)).toBeTruthy();
  });
});
