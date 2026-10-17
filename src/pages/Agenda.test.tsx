// @vitest-environment jsdom
/**
 * Borrar el horario entero desde la Agenda: pide confirmación y deja los
 * eventos del calendario como estaban.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Agenda } from './Agenda';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { ScheduleBlock, HorarioDocumento } from '../types';
import { takeGrupos } from '../lib/apoyoNav';

afterEach(cleanup);

const block = (id: string): ScheduleBlock =>
  ({ id, day: 1, time_start: '08:30', time_end: '09:25', subject: 'Mates', room: '', class_id: '', color: '#000' });

const FOTO: HorarioDocumento = { name: 'horario.png', mimeType: 'image/png', base64: 'iVBORw0KGgo=', addedAt: '2026-10-17' };

function setup(
  blocks: ScheduleBlock[], apoyoBlocks: ScheduleBlock[] = [], onNav: (s: string) => void = () => {},
  horarioDoc: HorarioDocumento | null = null,
) {
  const onReplaceBlocks = vi.fn();
  const onChangeHorarioDoc = vi.fn();
  const onDeleteCalEvent = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <Agenda
          classes={[]} scheduleBlocks={blocks} apoyoBlocks={apoyoBlocks} calEvents={[]}
          onAddBlock={() => {}} onUpdateBlock={() => {}} onDeleteBlock={() => {}}
          onReplaceBlocks={onReplaceBlocks} horarioDoc={horarioDoc} onChangeHorarioDoc={onChangeHorarioDoc}
          onAddCalEvent={() => {}} onUpdateCalEvent={() => {}} onDeleteCalEvent={onDeleteCalEvent}
          onNav={onNav}
        />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onReplaceBlocks, onDeleteCalEvent, onChangeHorarioDoc };
}

describe('Agenda · borrar horario', () => {
  it('sin horario no se ofrece', async () => {
    const user = userEvent.setup();
    setup([]);
    await user.click(screen.getByRole('button', { name: /Horario/ }));
    expect(screen.getByRole('menuitem', { name: /Cargar mi horario/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Borrar horario/ })).toBeNull();
    // Sin documento no hay nada que detectar ni que quitar
    expect(screen.queryByRole('menuitem', { name: /Detectar mis clases/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Quitar el documento/ })).toBeNull();
  });

  it('pide confirmación y vacía el horario', async () => {
    const user = userEvent.setup();
    const { onReplaceBlocks, onDeleteCalEvent } = setup([block('a'), block('b')]);
    // Está en el menú «Horario», no a la vista (11-10-2026)
    await user.click(screen.getByRole('button', { name: /Horario/ }));
    await user.click(screen.getByRole('menuitem', { name: /Borrar horario/ }));
    expect(onReplaceBlocks).not.toHaveBeenCalled();
    expect(screen.getByText(/Se quitarán las 2 sesiones/)).toBeTruthy();

    const botones = screen.getAllByRole('button', { name: /Borrar horario/ });
    await user.click(botones[botones.length - 1]);
    expect(onReplaceBlocks).toHaveBeenCalledWith([]);
    expect(onDeleteCalEvent).not.toHaveBeenCalled();
  });
});

describe('Agenda · semana', () => {
  it('se abre en la semana y enseña las clases de la tarde', () => {
    setup([{ ...block('tarde'), time_start: '16:00', time_end: '16:55', subject: 'Música' }]);
    expect(screen.getByRole('tab', { name: 'Semanal' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('16:00')).toBeTruthy();
    expect(screen.getAllByText('Música')).toHaveLength(1);
  });

  it('pinta los bloques que no cruzan una hora en punto y el horario de los grupos de apoyo', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    const apoyo: ScheduleBlock = { ...block('apoyo-gru1-0'), day: 3, time_start: '12:15', time_end: '13:00', subject: 'Habilidades sociales', room: 'PT' };
    setup([{ ...block('c'), time_start: '10:15', time_end: '10:45', subject: 'Tutoría' }], [apoyo], onNav);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    expect(screen.getAllByText('Tutoría')).toHaveLength(1);
    await user.click(screen.getByText('Habilidades sociales'));
    // El horario de apoyo se cambia en su pantalla, no aquí: se abre su grupo en Mi alumnado
    expect(onNav).toHaveBeenCalledWith('apoyo-alumnado');
    expect(takeGrupos()).toEqual({ grupoId: 'gru1' });
  });

  it('un bloque que cruza una hora en punto sale una sola vez, en la hora en que empieza', async () => {
    const user = userEvent.setup();
    setup([
      { ...block('m'), time_start: '09:45', time_end: '10:30', subject: 'Matemáticas' },
      { ...block('e'), day: 2, time_start: '11:45', time_end: '12:30', subject: 'Educación Física' },
      { ...block('t'), day: 3, time_start: '07:45', time_end: '08:40', subject: 'Guardia' },
    ]);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    expect(screen.getAllByText('Matemáticas')).toHaveLength(1);
    expect(screen.getAllByText('Educación Física')).toHaveLength(1);
    expect(screen.getAllByText('Guardia')).toHaveLength(1);
    // En la fila de las 9, no en la de las 10
    const fila9 = screen.getByText('09:00').nextElementSibling!;
    expect(fila9.textContent).toContain('Matemáticas');
  });
});

describe('Agenda · Mi horario (el documento del docente)', () => {
  it('sin documento, la pestaña invita a cargarlo', async () => {
    const user = userEvent.setup();
    setup([]);
    await user.click(screen.getByRole('tab', { name: 'Mi horario' }));
    expect(screen.getByText('Carga tu horario')).toBeTruthy();
  });

  it('con documento, la pestaña lo muestra y el menú ofrece cambiarlo, detectar las clases y quitarlo', async () => {
    const user = userEvent.setup();
    setup([], [], () => {}, FOTO);
    await user.click(screen.getByRole('tab', { name: 'Mi horario' }));
    expect(screen.getByRole('img', { name: 'Mi horario' }).getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    await user.click(screen.getByRole('button', { name: /^Horario/ }));
    expect(screen.getByRole('menuitem', { name: /Cambiar mi horario/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Detectar mis clases/ })).toBeTruthy();
  });

  it('quitar el documento pide confirmación y no toca las sesiones', async () => {
    const user = userEvent.setup();
    const { onChangeHorarioDoc, onReplaceBlocks } = setup([block('a')], [], () => {}, FOTO);
    await user.click(screen.getByRole('button', { name: /^Horario/ }));
    await user.click(screen.getByRole('menuitem', { name: /Quitar el documento/ }));
    expect(onChangeHorarioDoc).not.toHaveBeenCalled();
    const botones = screen.getAllByRole('button', { name: /Quitar el documento/ });
    await user.click(botones[botones.length - 1]);
    expect(onChangeHorarioDoc).toHaveBeenCalledWith(null);
    expect(onReplaceBlocks).not.toHaveBeenCalled();
  });
});
