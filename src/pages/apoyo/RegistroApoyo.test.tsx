// @vitest-environment jsdom
/**
 * Registro diario de PT y AL: el grupo que toca hoy, los objetivos del
 * trimestre de cada alumno con tres botones, las caras de cómo ha respondido
 * y que se guarde solo, sin guardar sesiones vacías.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistroApoyo } from './RegistroApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import type { ApoyoData } from '../../types/apoyo';
import { requestRegistro } from '../../lib/apoyoNav';

const inicial: ApoyoData = {
  alumnos: [
    { id: 'a1', nombre: 'Marta Gil', claseOrigen: '4º B', categorias: [], diagnostico: '', necesidades: '', notas: '' },
    { id: 'a2', nombre: 'Pau Ruiz', claseOrigen: '3º A', categorias: [], diagnostico: '', necesidades: '', notas: '' },
  ],
  grupos: [
    { id: 'g1', nombre: 'Lectoescritura', especialidad: 'PT', modalidad: 'fuera', color: '#000', alumnos: ['a1', 'a2'],
      horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }] },
    { id: 'g2', nombre: 'Lenguaje oral', especialidad: 'AL', modalidad: 'fuera', color: '#111', alumnos: ['a1'],
      horario: [{ dia: 2, inicio: '10:00', fin: '10:45' }] },
  ],
  programas: [
    { id: 'p1', alumnoId: 'a1', ambito: 'Lectoescritura', especialidad: 'PT', objetivos: [
      { id: 'o1', texto: 'Leer sílabas directas', trimestres: [1], criterios: [] },
      { id: 'o2', texto: 'Escribir frases', trimestres: [3], criterios: [] },
    ] },
    { id: 'p2', alumnoId: 'a1', ambito: 'Pragmática', especialidad: 'AL', objetivos: [
      { id: 'o3', texto: 'Respetar el turno', trimestres: [1], criterios: [] },
    ] },
  ],
  sesiones: [],
  documentos: [],
  coordinaciones: [],
  agendas: [],
  fotos: [],
};

let ultimo: ApoyoData = inicial;
function Harness() {
  const [data, setData] = useState(inicial);
  return (
    <I18nProvider>
      <ToastProvider>
        <RegistroApoyo data={data} onNav={() => {}} onChange={f => setData(d => { ultimo = f(d); return ultimo; })} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  ultimo = inicial;
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 10)); // lunes 5 de octubre
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Registro diario', () => {
  it('desde el Inicio llega con el grupo y el día ya elegidos', () => {
    requestRegistro({ grupoId: 'g2', fecha: '2026-10-07' });
    render(<Harness />);
    expect(screen.getByRole('tab', { name: /Lenguaje oral/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Miércoles, 7 de octubre/)).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Marta Gil' })).getByText('Respetar el turno')).toBeTruthy();
  });

  it('abre el grupo del día con los objetivos del trimestre de su especialidad', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: /Lectoescritura/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: /Lenguaje oral/ })).toBeNull();
    const marta = screen.getByRole('article', { name: 'Marta Gil' });
    expect(within(marta).getByText('Leer sílabas directas')).toBeTruthy();
    // Ni el del 3º trimestre ni el de AL
    expect(within(marta).queryByText('Escribir frases')).toBeNull();
    expect(within(marta).queryByText('Respetar el turno')).toBeNull();
    // Pau no tiene objetivos este trimestre
    expect(within(screen.getByRole('article', { name: 'Pau Ruiz' })).getByText('No tiene objetivos para este trimestre.')).toBeTruthy();
  });

  it('guarda solo lo marcado y desmarca al volver a pulsar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const marta = screen.getByRole('article', { name: 'Marta Gil' });
    await user.click(within(marta).getByRole('button', { name: 'Conseguido' }));
    expect(ultimo.sesiones).toHaveLength(1);
    expect(ultimo.sesiones[0]).toMatchObject({ grupoId: 'g1', fecha: '2026-10-05' });
    expect(ultimo.sesiones[0].alumnos.find(r => r.alumnoId === 'a1')?.objetivos).toEqual({ o1: 'si' });

    await user.click(within(marta).getByRole('button', { name: 'Atención: Ha ido bien' }));
    expect(ultimo.sesiones[0].alumnos.find(r => r.alumnoId === 'a1')?.respuesta).toEqual({ atencion: 3 });

    // Desmarcarlo todo deja la sesión vacía, y una sesión vacía no se guarda
    await user.click(within(marta).getByRole('button', { name: 'Conseguido' }));
    await user.click(within(marta).getByRole('button', { name: 'Atención: Ha ido bien' }));
    expect(ultimo.sesiones).toEqual([]);
  });

  it('el tema de la clase y la ausencia también cuentan, y otro grupo se elige aparte', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Qué trabaja hoy su clase'), 'Fracciones');
    expect(ultimo.sesiones[0].temaClase).toBe('Fracciones');
    await user.click(within(screen.getByRole('article', { name: 'Pau Ruiz' })).getByLabelText('No ha venido'));
    expect(ultimo.sesiones[0].alumnos.find(r => r.alumnoId === 'a2')?.ausente).toBe(true);

    await user.selectOptions(screen.getByLabelText('Otro grupo'), 'g2');
    const marta = screen.getByRole('article', { name: 'Marta Gil' });
    expect(within(marta).getByText('Respetar el turno')).toBeTruthy();
    expect(within(marta).queryByText('Leer sílabas directas')).toBeNull();
  });
});
