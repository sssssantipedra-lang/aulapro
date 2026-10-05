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
    // Mateo está lesionado: no puede correr ni saltar
    expect(screen.getByRole('button', { name: /Mateo Ruiz Ortega/ }).textContent).toContain('No puede correr');

    await user.click(screen.getByRole('radio', { name: /Sin equipación/ }));
    await user.click(screen.getByRole('button', { name: /Nora Ferrer Gil/ }));
    expect(marcas).toEqual([expect.objectContaining({ class_id: 'ef-c1', student_id: 'ef-s00', type: 'ef-ropa', date: '2026-10-05' })]);
    expect(screen.getByRole('button', { name: /Nora Ferrer Gil/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Hoy, 1 anotación en 1º ESO A.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Nora Ferrer Gil/ }));
    expect(marcas).toEqual([]);
  });
});
