// @vitest-environment jsdom
/**
 * Coordinaciones, en la página de un alumno: se anota una con sus acuerdos y
 * solo se ven las suyas.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoordinacionesApoyo } from './CoordinacionesApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { APOYO_VACIO } from '../../lib/apoyo';
import type { ApoyoData } from '../../types/apoyo';

const inicial: ApoyoData = {
  ...APOYO_VACIO,
  alumnos: [
    { id: 'a1', nombre: 'Alumno 1', claseOrigen: '4º B', categorias: [], diagnostico: '', necesidades: '', notas: '' },
    { id: 'a2', nombre: 'Alumno 2', claseOrigen: '3º A', categorias: [], diagnostico: '', necesidades: '', notas: '' },
  ],
  coordinaciones: [{ id: 'c0', alumnoId: 'a2', fecha: '2026-09-30', con: 'tutoria', asistentes: '', temas: 'Lectura en clase', acuerdos: '' }],
};

let ultimo: ApoyoData = inicial;
function Harness() {
  const [data, setData] = useState(inicial);
  return (
    <I18nProvider>
      <ToastProvider>
        <CoordinacionesApoyo alumno={data.alumnos[0]} data={data} onChange={f => setData(d => { ultimo = f(d); return ultimo; })} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  ultimo = inicial;
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 10));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Coordinaciones', () => {
  it('anota una con la familia y sus acuerdos; las de otro alumno no salen', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Todavía no hay coordinaciones de este alumno.')).toBeTruthy();
    expect(screen.queryByText('Lectura en clase')).toBeNull();
    expect(screen.queryByRole('button', { name: /Copiar todas/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Nueva coordinación/ }));
    const d = screen.getByRole('dialog');
    expect(within(d).queryByLabelText('Alumno o alumna')).toBeNull();
    await user.click(within(d).getByRole('button', { name: 'Familia' }));
    await user.type(within(d).getByLabelText('De qué se habló'), 'La lectura en casa');
    await user.type(within(d).getByLabelText('Acuerdos'), 'Leer diez minutos al día');
    await user.click(within(d).getByRole('button', { name: 'Guardar' }));

    expect(ultimo.coordinaciones).toHaveLength(2);
    expect(ultimo.coordinaciones[1]).toMatchObject({ alumnoId: 'a1', fecha: '2026-10-05', con: 'familia', temas: 'La lectura en casa', acuerdos: 'Leer diez minutos al día' });
    expect(screen.getByText('Leer diez minutos al día')).toBeTruthy();
    expect(screen.queryByText('Lectura en clase')).toBeNull();
    expect(screen.getByRole('button', { name: /Copiar todas para el PAP/ })).toBeTruthy();
  });
});
