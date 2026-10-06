// @vitest-environment jsdom
/**
 * Pruebas físicas: se anota una toma, se ve la mejora, y con un baremo
 * pegado de una hoja de cálculo la última marca pasa a nota en el cuaderno.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfPruebas } from './EfPruebas';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoEF } from '../../lib/demoEF';
import type { EfData } from '../../types/ef';
import type { GradeItem } from '../../types';

const demo = buildDemoEF(new Date(2026, 9, 5));
let ultimo: EfData = demo.ef;
const items: GradeItem[] = [];
const notas: Record<string, number | null> = {};
function Harness() {
  const [ef, setEf] = useState(demo.ef);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfPruebas
          classes={demo.classes} students={demo.students} ef={ef}
          onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })}
          gradeCategories={demo.gradeCategories}
          onAddGradeItem={i => items.push(i)} onSetGrade={(_i, s, v) => { notas[s] = v; }} onNav={() => {}}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  ultimo = demo.ef;
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Pruebas físicas', () => {
  it('anota una toma, con la mejora de cada alumno, y con un baremo pasa la nota al cuaderno', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Course Navette, 1º ESO A: la demo trae dos tomas
    const fila = screen.getByRole('row', { name: /Alumno 1(?!\d)/ });
    expect(within(fila).getByLabelText(/Ha mejorado|Igual/)).toBeTruthy();

    await user.type(screen.getByLabelText('Nueva marca de Alumno 1'), '7,5');
    await user.click(screen.getByRole('button', { name: 'Guardar la toma' }));
    const suyas = ultimo.marcas.filter(m => m.alumnoId === 'ef-s00' && m.pruebaId === 'course-navette');
    expect(suyas.at(-1)).toMatchObject({ fecha: '2026-10-05', valor: 7.5 });

    // Baremo de 1º ESO pegado de una hoja de cálculo
    await user.click(screen.getByRole('button', { name: /Baremos/ }));
    await user.click(screen.getByRole('button', { name: /Nuevo baremo/ }));
    await user.type(screen.getByLabelText('O pégalo de una hoja de cálculo'), '4;5{enter}6;7{enter}8;10');
    await user.click(screen.getByRole('button', { name: 'Leer lo pegado' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    expect(ultimo.baremos).toEqual([expect.objectContaining({ pruebaId: 'course-navette', etapa: 'eso', curso: 1, tramos: [{ marca: 4, nota: 5 }, { marca: 6, nota: 7 }, { marca: 8, nota: 10 }] })]);
    await user.keyboard('{Escape}');

    // 7,5 períodos → 7
    expect(within(screen.getByRole('row', { name: /Alumno 1(?!\d)/ })).getAllByRole('cell')[3].textContent).toBe('7');
    await user.click(screen.getByRole('button', { name: /Pasar las notas al cuaderno/ }));
    await user.click(screen.getByRole('button', { name: 'Pasar al cuaderno' }));
    expect(items).toEqual([expect.objectContaining({ class_id: 'ef-c1', category_id: 'ef-c1-g1', name: 'Course Navette' })]);
    expect(notas['ef-s00']).toBe(7);
  });
});
