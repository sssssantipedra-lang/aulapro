// @vitest-environment jsdom
/**
 * La cobertura del currículo por evaluación, con el currículo real de Madrid: en una evaluación dice qué
 * criterios se han evaluado en ella, cuáles en otra y cuáles en ninguna; en «Curso», como siempre.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { CoberturaCurriculo } from './CoberturaCurriculo';
import { I18nProvider } from '../../i18n';
import type { Class, Evaluation } from '../../types';

// Un día de la 1.ª evaluación
beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 20, 10)); });
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

const QUINTO: Class = { id: 'c1', name: '5º A', subject: 'Matemáticas', room: '', color: '#000', etapa: 'primaria', curso: 5 };

const evaluacion = (notas: Record<string, number>, date: string): Evaluation => ({
  id: 'e' + date, rubric_id: 'r', rubric_name: 'Mercado', student_id: 's1', student_name: '',
  class_id: 'c1', date, scores: {}, notes: '', officialCriteriaScores: notas,
});

const EVALUACIONES = [
  evaluacion({ 'matematicas|1.1': 5 }, '2026-10-03'),
  evaluacion({ 'matematicas|1.1': 7, 'matematicas|2.1': 9 }, '2027-02-10'),
];

function pinta(evaluaciones = EVALUACIONES) {
  render(<I18nProvider><CoberturaCurriculo classes={[QUINTO]} evaluations={evaluaciones} comunidad="madrid" /></I18nProvider>);
}

/** El número de criterios de la materia, leído de la propia fila («1 de 16»). */
const cuenta = (fila: HTMLElement) => fila.querySelector('.cob-cuenta')!.textContent!;

describe('cobertura del currículo por evaluación', () => {
  it('en la evaluación de hoy cuenta lo evaluado en ella y aparta lo de otra y lo que queda por repartir', async () => {
    pinta();
    const fila = (await screen.findByText('5º A')).closest('details')!;
    expect(screen.getByRole('button', { name: /1ª evaluación/, pressed: true })).toBeTruthy();
    // Solo el 1.1 es de octubre; el 2.1 se evaluó en febrero
    expect(cuenta(fila)).toMatch(/^1 de \d+\+1 en otras$/);
    const total = Number(cuenta(fila).match(/de (\d+)/)![1]);
    expect(within(fila).getByRole('img').getAttribute('aria-label'))
      .toBe(`1 de ${total} criterios evaluados en la 1.ª evaluación; 1 más en otra evaluación; ${total - 2} sin evaluar en todo el curso`);
    expect(within(fila).getByText('Evaluados en la 1.ª evaluación (1):').parentElement!.textContent).toContain('1.1');
    const otra = within(fila).getByText('Evaluados solo en otra evaluación (1):').parentElement!;
    expect(otra.textContent).toContain('2.1 2.ª');
    expect(within(fila).getByText(`Quedan ${total - 2} criterios sin evaluar en todo el curso, por repartir:`)).toBeTruthy();
    // Los que quedan por repartir llevan su texto, y no están ni el 1.1 ni el 2.1
    const porRepartir = [...fila.querySelectorAll('li b')].map(b => b.textContent);
    expect(porRepartir).toHaveLength(total - 2);
    expect(porRepartir).not.toContain('1.1');
    expect(porRepartir).not.toContain('2.1');
  });

  it('al cambiar de evaluación cambia la cuenta, y lo que queda por repartir es lo mismo', async () => {
    pinta();
    const fila = (await screen.findByText('5º A')).closest('details')!;
    const porRepartir = () => [...fila.querySelectorAll('li b')].map(b => b.textContent);
    const antes = porRepartir();
    fireEvent.click(screen.getByRole('button', { name: '2ª evaluación' }));
    expect(cuenta(fila)).toMatch(/^2 de \d+$/);
    expect(within(fila).queryByText(/Evaluados solo en otra evaluación/)).toBeNull();
    expect(porRepartir()).toEqual(antes);
    fireEvent.click(screen.getByRole('button', { name: '3ª evaluación' }));
    expect(cuenta(fila)).toMatch(/^0 de \d+\+2 en otras$/);
    expect(within(fila).getByText('Aún no has evaluado ningún criterio en la 3.ª evaluación.')).toBeTruthy();
    expect(within(fila).getByText('Evaluados solo en otra evaluación (2):').parentElement!.textContent).toMatch(/1\.1 1\.ª, 2\.ª.*2\.1 2\.ª/);
    expect(porRepartir()).toEqual(antes);
  });

  it('en «Curso» queda como siempre: evaluados alguna vez y los que faltan', async () => {
    pinta();
    const fila = (await screen.findByText('5º A')).closest('details')!;
    const porRepartir = [...fila.querySelectorAll('li b')].map(b => b.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    expect(cuenta(fila)).toMatch(/^2 de \d+$/);
    expect(within(fila).getByText(/^Faltan \d+ criterios por evaluar:$/)).toBeTruthy();
    expect(within(fila).queryByText(/Evaluados en/)).toBeNull();
    expect([...fila.querySelectorAll('li b')].map(b => b.textContent)).toEqual(porRepartir);
    expect(screen.getByText(/Pulsa una fila para ver los que faltan/)).toBeTruthy();
  });
});
