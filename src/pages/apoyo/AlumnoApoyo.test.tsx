// @vitest-environment jsdom
/**
 * La página de un alumno de PT y AL: se abre en la pestaña pedida, el resumen
 * tiene sus grupos y su última coordinación, «Registrar sesión» abre el
 * registro en el grupo que toca, y las pestañas llevan cada cosa. Sin alumno,
 * vuelve a la lista.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlumnoApoyo } from './AlumnoApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoApoyo } from '../../lib/demoApoyo';
import {
  requestAlumno, takeAgendaPara, takeAlumno, takeFichaPara, takeRegistro, takeGrupos,
} from '../../lib/apoyoNav';
import type { ApoyoData } from '../../types/apoyo';
import type { Section } from '../../types';

let ultimo: ApoyoData;
function Harness({ onNav }: { onNav: (s: Section) => void }) {
  const [data, setData] = useState(() => buildDemoApoyo(new Date(2026, 9, 5)));
  return (
    <I18nProvider>
      <ToastProvider>
        <AlumnoApoyo
          data={data} onChange={f => setData(d => { ultimo = f(d); return ultimo; })}
          especialidades={['PT', 'AL']} comunidad={undefined}
          docente={{ nombre: 'Profesor', centro: '', curso: '' }} onNav={onNav}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  // Nada pendiente de otra prueba
  takeAlumno(); takeRegistro(); takeFichaPara(); takeAgendaPara(); takeGrupos();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 10)); // lunes 5 de octubre
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Página de un alumno de apoyo', () => {
  it('abre con su resumen y «Registrar sesión» va a su sesión de hoy', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    requestAlumno('demo-a4');
    render(<Harness onNav={onNav} />);
    expect(screen.getByRole('heading', { name: 'Alumno 4' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')).toBe('true');

    const grupos = screen.getByText('Sus grupos de apoyo').closest('.card') as HTMLElement;
    for (const g of ['Matemáticas en su aula', 'Lenguaje oral', 'Habilidades sociales']) expect(within(grupos).getByText(g)).toBeTruthy();
    const coord = screen.getByText('Última coordinación').closest('.card') as HTMLElement;
    expect(within(coord).getByText(/Familia/)).toBeTruthy();

    // Los lunes solo tiene «Lenguaje oral», a las 11:30
    await user.click(screen.getByRole('button', { name: /Registrar sesión/ }));
    expect(onNav).toHaveBeenLastCalledWith('apoyo-registro');
    expect(takeRegistro()).toEqual({ grupoId: 'demo-g3', fecha: '2026-10-05' });
  });

  it('la ficha adaptada y la agenda visual se piden para él', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    requestAlumno('demo-a1');
    render(<Harness onNav={onNav} />);
    await user.click(screen.getByRole('button', { name: /Ficha adaptada/ }));
    expect(onNav).toHaveBeenLastCalledWith('resources');
    expect(takeFichaPara()).toBe('demo-a1');
    await user.click(screen.getByRole('button', { name: /Agenda visual/ }));
    expect(onNav).toHaveBeenLastCalledWith('apoyo-agenda-visual');
    expect(takeAgendaPara()).toBe('demo-a1');
  });

  it('sesiones, datos con sus grupos y el programa, cada uno en su pestaña', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    requestAlumno('demo-a1', 'sesiones');
    render(<Harness onNav={onNav} />);
    expect(screen.getByRole('tab', { name: 'Sesiones' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('button', { name: /Abrir en el registro/ }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Datos' }));
    const chip = screen.getByRole('button', { name: 'Habilidades sociales' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await user.click(chip);
    expect(ultimo.grupos.find(g => g.id === 'demo-g4')?.alumnos).toContain('demo-a1');

    await user.click(screen.getByRole('tab', { name: 'Programa' }));
    expect(await screen.findByRole('button', { name: /Nuevo programa/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Alumno 2' })).toBeNull();
  });

  it('sin alumno elegido, vuelve a «Mi alumnado»', () => {
    const onNav = vi.fn();
    render(<Harness onNav={onNav} />);
    expect(onNav).toHaveBeenCalledWith('apoyo-alumnado');
  });
});
