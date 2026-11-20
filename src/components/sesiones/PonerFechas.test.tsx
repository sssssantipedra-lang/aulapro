// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PonerFechas, type PeticionDeFechas } from './PonerFechas';
import { I18nProvider } from '../../i18n';
import type { Class, ScheduleBlock } from '../../types';
import type { SesionEF } from '../../types/ef';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const ses = (id: string, extra: Partial<SesionEF> = {}): SesionEF =>
  ({ id, titulo: `Sesión ${id}`, claseId: 'c1', objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '', ...extra });
const bloque = (day: number, subject: string): ScheduleBlock =>
  ({ id: `${day}-${subject}`, day, time_start: '09:00', time_end: '09:55', subject, room: '', class_id: 'c1', color: '#000' });
const clases = [{ id: 'c1', name: '3.º A', etapa: 'primaria' } as Class];

function montar(peticion: Partial<PeticionDeFechas>, bloques: ScheduleBlock[]) {
  const onAplicar = vi.fn();
  const p: PeticionDeFechas = { modo: 'poner', grupo: 'Las fracciones', clave: 'c1|s1', claseId: 'c1', sesiones: [], pistas: [], ...peticion };
  render(<I18nProvider><PonerFechas peticion={p} classes={clases} bloques={bloques} onAplicar={onAplicar} onClose={() => {}} /></I18nProvider>);
  return onAplicar;
}

describe('Poner fechas', () => {
  it('enseña el día de cada sesión antes de aplicar y solo aplica al pulsar', () => {
    const onAplicar = montar({ sesiones: [ses('a'), ses('b'), ses('hecha', { completada: true, fecha: '2026-09-10' })] }, [bloque(1, 'Lengua'), bloque(3, 'Lengua')]);
    expect(screen.getByRole('dialog', { name: 'Poner fechas a «Las fracciones»' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Primer día'), { target: { value: '2026-11-02' } });
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Sesión a');
    expect(filas[0].textContent).toContain('09:00');
    expect(screen.getByText('1 sesión ya completada conserva su día.')).toBeTruthy();
    expect(onAplicar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Poner estas fechas' }));
    expect(onAplicar.mock.calls[0][0].map((x: { id: string; fecha: string }) => `${x.id}:${x.fecha}`)).toEqual(['a:2026-11-02', 'b:2026-11-04']);
  });

  it('con varias asignaturas no propone nada hasta que se elige en cuáles, y lo recuerda', () => {
    const onAplicar = montar({ sesiones: [ses('a')] }, [bloque(1, 'Lengua'), bloque(2, 'Plástica')]);
    expect(screen.getByText(/Esta clase tiene varias asignaturas/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Poner estas fechas' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Plástica' }));
    fireEvent.change(screen.getByLabelText('Primer día'), { target: { value: '2026-11-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Poner estas fechas' }));
    expect(onAplicar.mock.calls[0][0][0]).toMatchObject({ id: 'a', fecha: '2026-11-03' });
    cleanup();
    montar({ sesiones: [ses('a')] }, [bloque(1, 'Lengua'), bloque(2, 'Plástica')]);
    expect(screen.getByRole('button', { name: 'Plástica' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('la asignatura sale marcada si se parece al área de la situación de aprendizaje', () => {
    montar({ sesiones: [ses('a')], pistas: ['Lengua Castellana y Literatura'] }, [bloque(1, 'Lengua'), bloque(2, 'Plástica')]);
    expect(screen.getByRole('button', { name: 'Lengua' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Plástica' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('un día se quita con la X, dice por qué se salta y se puede volver a poner', () => {
    const onAplicar = montar({ sesiones: [ses('a'), ses('b')] }, [bloque(1, 'Lengua'), bloque(3, 'Lengua')]);
    fireEvent.change(screen.getByLabelText('Primer día'), { target: { value: '2026-11-02' } });
    fireEvent.click(screen.getAllByTitle('Ese día no hay clase: saltarlo')[0]);
    expect(screen.getByText(/Se salta el .*: lo has quitado tú/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Poner estas fechas' }));
    expect(onAplicar.mock.calls[0][0].map((x: { fecha: string }) => x.fecha)).toEqual(['2026-11-04', '2026-11-09']);
    fireEvent.click(screen.getByRole('button', { name: /Volver a poner el/ }));
    expect(screen.queryByText(/lo has quitado tú/)).toBeNull();
  });

  it('sin horario, cuenta en días lectivos', () => {
    const onAplicar = montar({ sesiones: [ses('a'), ses('b')] }, []);
    expect(screen.getByText(/no tiene horas en tu horario semanal/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Primer día'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('Una sesión cada cuántos días lectivos'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Poner estas fechas' }));
    expect(onAplicar.mock.calls[0][0].map((x: { fecha: string }) => x.fecha)).toEqual(['2026-11-02', '2026-11-05']);
  });

  it('«No se dio» corre esa sesión y las que se pisan, y deja las demás', () => {
    const sesiones = [ses('a', { fecha: '2026-11-02' }), ses('b', { fecha: '2026-11-04' }), ses('c', { fecha: '2026-11-16' })];
    const onAplicar = montar({ modo: 'correr', desdeId: 'a', sesiones }, [bloque(1, 'Lengua'), bloque(3, 'Lengua')]);
    expect(screen.getByRole('dialog', { name: 'No se dio «Sesión a»' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correr las fechas' }));
    expect(onAplicar.mock.calls[0][0].map((x: { id: string; fecha: string }) => `${x.id}:${x.fecha}`)).toEqual(['a:2026-11-04', 'b:2026-11-09']);
  });
});
