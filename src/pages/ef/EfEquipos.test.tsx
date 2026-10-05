// @vitest-environment jsdom
/**
 * Equipos: se hacen equipos de una clase, quien falta hoy se queda fuera, se
 * retocan cambiando a dos alumnos y se marca el nivel y el sexo.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfEquipos } from './EfEquipos';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoEF } from '../../lib/demoEF';
import type { EfData } from '../../types/ef';
import type { AttendanceMap } from '../../types';

const demo = buildDemoEF(new Date(2026, 9, 5));
let ultimo: EfData = demo.ef;
// Iker falta hoy en 1º ESO A
const attendance: AttendanceMap = { 'ef-c1': { '2026-10-05': { 'ef-s01': 'absent' } } };
function Harness() {
  const [ef, setEf] = useState(demo.ef);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfEquipos classes={demo.classes} students={demo.students} attendance={attendance} ef={ef}
          onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} onNav={() => {}} />
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

describe('Equipos', () => {
  it('hace equipos sin quien falta hoy, con los exentos dentro, y se retocan a mano', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // 1º ESO A trae equipos de la demo; se hacen otros, de tres
    await user.selectOptions(screen.getByLabelText('Número de equipos'), '3');
    expect(screen.getByLabelText(/Sin quien falta hoy \(1\)/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Hacer otros/ }));
    const grupos = ultimo.equipos['ef-c1'].grupos;
    expect(grupos).toHaveLength(3);
    expect(grupos.flat()).toHaveLength(7);
    expect(grupos.flat()).not.toContain('ef-s01');
    // Mateo está lesionado: juega en su equipo, con su limitación y qué hace
    expect(grupos.flat()).toContain('ef-s03');
    expect(screen.getAllByText(/No puede correr/).length).toBeGreaterThan(0);

    // Cambiar a dos alumnos de equipo
    const a = grupos[0][0], b = grupos[1][0];
    const nombre = (id: string) => demo.students.find(s => s.id === id)!.name;
    await user.click(screen.getByRole('button', { name: new RegExp(nombre(a)) }));
    await user.click(screen.getByRole('button', { name: new RegExp(nombre(b)) }));
    expect(ultimo.equipos['ef-c1'].grupos[0]).toContain(b);
    expect(ultimo.equipos['ef-c1'].grupos[1]).toContain(a);
  });

  it('el nivel y el sexo se marcan en la tabla, y las parejas que separar se añaden', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Nivel de Nora Ferrer Gil' })).getByRole('radio', { name: '3' }));
    expect(ultimo.niveles['ef-s00']).toBe(3);
    // Otro toque en el sexo marcado lo quita
    await user.click(within(screen.getByRole('radiogroup', { name: 'Sexo de Nora Ferrer Gil' })).getByRole('radio', { name: 'Chica' }));
    expect(ultimo.sexos['ef-s00']).toBeUndefined();

    await user.selectOptions(screen.getByLabelText('Primer alumno de la pareja'), 'ef-s02');
    await user.selectOptions(screen.getByLabelText('Segundo alumno de la pareja'), 'ef-s04');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(ultimo.separar).toContainEqual({ a: 'ef-s02', b: 'ef-s04' });
  });
});
