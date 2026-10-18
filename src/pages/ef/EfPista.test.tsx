// @vitest-environment jsdom
/**
 * En la pista: se elige un aspecto y se toca a cada alumno; otro toque lo
 * quita. Quien está exento lleva su etiqueta.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfPista } from './EfPista';
import { I18nProvider } from '../../i18n';
import { buildDemoEF } from '../../lib/demoEF';
import type { ClassMark } from '../../types';

const demo = buildDemoEF(new Date(2026, 9, 5));
let marcas: ClassMark[] = [];
function Harness() {
  const [ms, setMs] = useState<ClassMark[]>([]);
  const cambiar = (f: (p: ClassMark[]) => ClassMark[]) => setMs(p => { marcas = f(p); return marcas; });
  return (
    <I18nProvider>
      <EfPista
        classes={demo.classes} students={demo.students} scheduleBlocks={demo.blocks} classMarks={ms} ef={demo.ef}
        onAddMark={m => cambiar(p => [...p, m])} onDeleteMark={id => cambiar(p => p.filter(x => x.id !== id))} onNav={() => {}}
      />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  marcas = [];
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 8, 40)); // lunes, en clase con 1º ESO A
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('En la pista', () => {
  it('abre la clase de ahora, anota con un toque y lo quita con otro', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('tab', { name: '1º ESO A' }).getAttribute('aria-selected')).toBe('true');
    // Alumno 4 está lesionado: no puede correr ni saltar
    expect(screen.getByRole('button', { name: /Alumno 4(?!\d)/ }).textContent).toContain('No puede correr');

    await user.click(screen.getByRole('radio', { name: /Sin equipación/ }));
    await user.click(screen.getByRole('button', { name: /Alumno 1(?!\d)/ }));
    expect(marcas).toEqual([expect.objectContaining({ class_id: 'ef-c1', student_id: 'ef-s00', type: 'ef-ropa', date: '2026-10-05' })]);
    expect(screen.getByRole('button', { name: /Alumno 1(?!\d)/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Hoy, 1 anotación en 1º ESO A.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Alumno 1(?!\d)/ }));
    expect(marcas).toEqual([]);
  });

  it('el alumnado sale en orden de lista, con los números como números: 1, 2, 3… 10, 14 y no 1, 10, 14, 2', () => {
    // Se da el alumnado revuelto: la pantalla lo pone en orden
    const clase = demo.classes[0].id;
    const revuelto = [14, 1, 5, 10, 2, 13, 3, 12, 4, 11, 6, 9, 7, 8]
      .map(n => ({ id: `t${n}`, class_id: clase, name: `Alumno ${n}`, email: '', photo: null, alerts: [], notes: '' }));
    render(
      <I18nProvider>
        <EfPista
          classes={demo.classes} students={revuelto} scheduleBlocks={demo.blocks} classMarks={[]} ef={demo.ef}
          onAddMark={() => {}} onDeleteMark={() => {}} onNav={() => {}}
        />
      </I18nProvider>,
    );
    const nombres = screen.getAllByRole('button', { name: /^Alumno \d+/ }).map(b => /^Alumno (\d+)/.exec(b.textContent ?? '')![1]).map(Number);
    expect(nombres).toHaveLength(14);
    expect(nombres).toEqual([...nombres].sort((a, b) => a - b));
  });
});
