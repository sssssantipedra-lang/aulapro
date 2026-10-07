// @vitest-environment jsdom
/**
 * «Mi alumnado» de PT y AL: pulsar un alumno abre su página; desde la Agenda
 * se llega a la pestaña Grupos con el grupo ya abierto; y se añade un alumno.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlumnadoApoyo } from './AlumnadoApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoApoyo } from '../../lib/demoApoyo';
import { requestGrupos, takeAlumno, takeGrupos } from '../../lib/apoyoNav';
import type { ApoyoData } from '../../types/apoyo';
import type { Section } from '../../types';

let ultimo: ApoyoData;
function Harness({ onNav }: { onNav: (s: Section) => void }) {
  const [data, setData] = useState(() => buildDemoApoyo(new Date(2026, 9, 5)));
  return (
    <I18nProvider>
      <ToastProvider>
        <AlumnadoApoyo data={data} onChange={f => setData(d => { ultimo = f(d); return ultimo; })} especialidades={['PT', 'AL']} onNav={onNav} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  takeAlumno(); takeGrupos();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 10));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Mi alumnado', () => {
  it('pulsar un alumno abre su página', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    render(<Harness onNav={onNav} />);
    expect(screen.getByRole('tab', { name: /Alumnado/ }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('button', { name: /^Alumno 2, 3º A, 1 aviso$/ }));
    expect(onNav).toHaveBeenCalledWith('apoyo-alumno');
    expect(takeAlumno()).toEqual({ alumnoId: 'demo-a2', pestana: 'resumen' });
  });

  it('desde un bloque de la Agenda se abre la pestaña Grupos con ese grupo', () => {
    requestGrupos('demo-g2');
    render(<Harness onNav={() => {}} />);
    expect(screen.getByRole('tab', { name: /Grupos/ }).getAttribute('aria-selected')).toBe('true');
    const d = screen.getByRole('dialog');
    expect((within(d).getByLabelText('Nombre') as HTMLInputElement).value).toBe('Matemáticas en su aula');
  });

  it('añade un alumno nuevo', async () => {
    const user = userEvent.setup();
    render(<Harness onNav={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Nuevo alumno/ }));
    const d = screen.getByRole('dialog');
    await user.type(within(d).getByLabelText('Nombre y apellidos'), 'Alumno 9');
    await user.click(within(d).getByRole('button', { name: 'Guardar' }));
    expect(ultimo.alumnos.some(a => a.nombre === 'Alumno 9')).toBe(true);
    expect(screen.getByText('Alumno 9')).toBeTruthy();
  });
});
