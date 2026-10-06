// @vitest-environment jsdom
/**
 * Inicio de PT y AL: las sesiones de hoy llevan al registro de ese grupo, los
 * avisos salen y la evolución tiene a cada alumno. Sin alumnado, los
 * primeros pasos y los datos de ejemplo.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InicioApoyo } from './InicioApoyo';
import { I18nProvider } from '../../i18n';
import { buildDemoApoyo } from '../../lib/demoApoyo';
import { takeRegistro } from '../../lib/apoyoNav';
import { APOYO_VACIO } from '../../lib/apoyo';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 10)); // lunes 5 de octubre
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Inicio de PT y AL', () => {
  it('las sesiones de hoy, por hora, llevan al registro de ese grupo', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    const data = buildDemoApoyo(new Date(2026, 9, 5));
    render(<I18nProvider><InicioApoyo nombre="Laura Martí" data={data} onNav={onNav} onLoadDemo={() => {}} /></I18nProvider>);
    expect(screen.getByRole('heading', { name: 'Buenos días, Laura' })).toBeTruthy();

    const hoy = screen.getByText('Sesiones de hoy').closest('.card') as HTMLElement;
    const grupos = within(hoy).getAllByRole('listitem').map(li => li.querySelector('strong')?.textContent);
    expect(grupos).toEqual(['Lectoescritura, 2º ciclo', 'Lenguaje oral']);

    await user.click(within(hoy).getAllByRole('button', { name: 'Registrar' })[1]);
    expect(onNav).toHaveBeenCalledWith('apoyo-registro');
    expect(takeRegistro()).toEqual({ grupoId: 'demo-g3', fecha: '2026-10-05' });

    // Cada alumno en la evolución, con su barra
    const evol = screen.getByText('Evolución del alumnado').closest('.card') as HTMLElement;
    for (const a of data.alumnos) expect(within(evol).getByText(a.nombre)).toBeTruthy();
    expect(within(evol).getAllByRole('img').length).toBe(data.alumnos.length);
    await user.click(within(evol).getByRole('button', { name: /Alumno 1(?!\d)/ }));
    expect(within(evol).getByText('Leer sílabas directas con fluidez')).toBeTruthy();
  });

  it('sin alumnado, los primeros pasos y los datos de ejemplo', async () => {
    const user = userEvent.setup();
    const onLoadDemo = vi.fn();
    const onNav = vi.fn();
    render(<I18nProvider><InicioApoyo nombre="Laura" data={APOYO_VACIO} onNav={onNav} onLoadDemo={onLoadDemo} /></I18nProvider>);
    expect(screen.getByText('Empieza en tres pasos')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Ir a Alumnado y grupos/ }));
    expect(onNav).toHaveBeenCalledWith('apoyo-alumnado');
    await user.click(screen.getByRole('button', { name: /Probar con datos de ejemplo/ }));
    expect(onLoadDemo).toHaveBeenCalled();
  });
});
