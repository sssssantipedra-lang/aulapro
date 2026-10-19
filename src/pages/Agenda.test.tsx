// @vitest-environment jsdom
/**
 * Borrar el horario entero desde la Agenda: pide confirmación y deja los
 * eventos del calendario como estaban.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Agenda } from './Agenda';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { ScheduleBlock } from '../types';
import { takeGrupos } from '../lib/apoyoNav';

afterEach(cleanup);

const block = (id: string): ScheduleBlock =>
  ({ id, day: 1, time_start: '08:30', time_end: '09:25', subject: 'Mates', room: '', class_id: '', color: '#000' });

function setup(blocks: ScheduleBlock[], apoyoBlocks: ScheduleBlock[] = [], onNav: (s: string) => void = () => {}) {
  const onReplaceBlocks = vi.fn();
  const onUpdateBlock = vi.fn();
  const onDeleteCalEvent = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <Agenda
          classes={[]} scheduleBlocks={blocks} apoyoBlocks={apoyoBlocks} calEvents={[]}
          onAddBlock={() => {}} onUpdateBlock={onUpdateBlock} onDeleteBlock={() => {}}
          onReplaceBlocks={onReplaceBlocks}
          onAddCalEvent={() => {}} onUpdateCalEvent={() => {}} onDeleteCalEvent={onDeleteCalEvent}
          onNav={onNav}
        />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onReplaceBlocks, onDeleteCalEvent, onUpdateBlock };
}

describe('Agenda · borrar horario', () => {
  it('sin horario no se ofrece', async () => {
    const user = userEvent.setup();
    setup([]);
    await user.click(screen.getByRole('button', { name: 'Horario' }));
    expect(screen.getByRole('menuitem', { name: /Escanear horario/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Borrar horario/ })).toBeNull();
  });

  it('pide confirmación y vacía el horario', async () => {
    const user = userEvent.setup();
    const { onReplaceBlocks, onDeleteCalEvent } = setup([block('a'), block('b')]);
    // Está en el menú «Horario», no a la vista (11-10-2026)
    await user.click(screen.getByRole('button', { name: 'Horario' }));
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
  it('se abre en una portada con dos tarjetas que llevan al horario semanal y a la agenda mensual', async () => {
    const user = userEvent.setup();
    setup([{ ...block('tarde'), time_start: '16:00', time_end: '16:55', subject: 'Música' }]);
    expect(screen.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('1 clase a la semana')).toBeTruthy();
    expect(screen.getByText('Sin eventos próximos')).toBeTruthy();
    expect(screen.queryByText('16:00')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Agenda mensual/ }));
    expect(screen.getByRole('tab', { name: 'Mensual' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('tab', { name: 'Resumen' }));
    await user.click(screen.getByRole('button', { name: /Horario semanal/ }));
    expect(screen.getByRole('tab', { name: 'Semanal' }).getAttribute('aria-selected')).toBe('true');
  });

  it('enseña las clases de la tarde', async () => {
    const user = userEvent.setup();
    setup([{ ...block('tarde'), time_start: '16:00', time_end: '16:55', subject: 'Música' }]);
    await user.click(screen.getByRole('button', { name: /Horario semanal/ }));
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

  it('cada bloque sale una sola vez y a su hora: su posición es proporcional a la hora de inicio', async () => {
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
    // Un bloque empieza a las 07:45, así que la cuadrícula empieza a las 07:00; cada minuto son 1,3 px y 09:45 son 165 minutos después
    const m = screen.getByRole('button', { name: /Matemáticas, 09:45–10:30/ });
    expect(parseFloat(m.style.top)).toBeCloseTo((105 + 60) * 1.3 + 1, 1);
    expect(parseFloat(m.style.height)).toBeCloseTo(45 * 1.3 - 2, 1);
    // Lo que empieza antes de las 8 hace que la cuadrícula empiece antes
    expect(screen.getByText('07:00')).toBeTruthy();
  });

  it('el patio de las 11:15 sale encima de la clase de las 11:45, aunque se creara después', async () => {
    const user = userEvent.setup();
    setup([
      { ...block('clase'), day: 2, time_start: '11:45', time_end: '12:30', subject: '4º A Educación Física' },
      { ...block('patio'), day: 2, time_start: '11:15', time_end: '11:45', subject: 'Patio de juegos' },
    ]);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    const patio = screen.getByRole('button', { name: /Patio de juegos/ });
    const clase = screen.getByRole('button', { name: /4º A Educación Física/ });
    expect(parseFloat(patio.style.top)).toBeLessThan(parseFloat(clase.style.top));
    // Uno justo detrás del otro, sin pisarse: a todo el ancho
    expect(patio.style.width).toBe('calc(100% - 4px)');
    expect(clase.style.width).toBe('calc(100% - 4px)');
  });

  it('los bloques que coinciden en el tiempo van lado a lado', async () => {
    const user = userEvent.setup();
    setup([
      { ...block('a'), time_start: '09:00', time_end: '10:00', subject: 'Grupo A' },
      { ...block('b'), time_start: '09:30', time_end: '10:30', subject: 'Grupo B' },
    ]);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    expect(screen.getByRole('button', { name: /Grupo A/ }).style.width).toBe('calc(50% - 4px)');
    expect(screen.getByRole('button', { name: /Grupo B/ }).style.left).toBe('calc(50% + 2px)');
  });
});

describe('Agenda · mover los bloques', () => {
  it('con Alt y las flechas se mueve de 5 en 5 minutos y de día en día, sin cambiar lo que dura', async () => {
    const user = userEvent.setup();
    const { onUpdateBlock } = setup([{ ...block('p'), day: 3, time_start: '11:15', time_end: '11:45', subject: 'Patio' }]);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    const patio = screen.getByRole('button', { name: /Patio/ });
    patio.focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onUpdateBlock).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p', day: 3, time_start: '11:20', time_end: '11:50' }));
    await user.keyboard('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}');
    expect(onUpdateBlock).toHaveBeenLastCalledWith(expect.objectContaining({ day: 3, time_start: '11:00', time_end: '11:30' }));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(onUpdateBlock).toHaveBeenLastCalledWith(expect.objectContaining({ day: 4, time_start: '11:15', time_end: '11:45' }));
    // Intro abre el bloque para editarlo, como siempre
    await user.keyboard('{Enter}');
    expect(screen.getByText('Editar bloque')).toBeTruthy();
  });

  it('arrastrar un bloque a otra hora y otro día lo cambia, y el clic de soltar no lo abre', () => {
    const { onUpdateBlock } = setup([{ ...block('p'), day: 3, time_start: '11:15', time_end: '11:45', subject: 'Patio' }]);
    fireEvent.click(screen.getByRole('tab', { name: 'Semanal' }));
    // jsdom no mide la pantalla: cinco columnas de 200 px a partir de x = 100
    const cols = document.querySelectorAll('.wk-col');
    cols.forEach((c, i) => { (c as HTMLElement).getBoundingClientRect = () => ({ left: 100 + i * 200, right: 300 + i * 200, top: 0, bottom: 800, width: 200, height: 800, x: 100 + i * 200, y: 0, toJSON: () => ({}) }); });
    const patio = screen.getByRole('button', { name: /Patio/ });
    patio.setPointerCapture = () => {};
    const evento = (tipo: string, x: number, y: number) => {
      const e = new MouseEvent(tipo, { bubbles: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(e, 'pointerType', { value: 'mouse' });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      patio.dispatchEvent(e);
    };
    act(() => evento('pointerdown', 520, 300));
    act(() => evento('pointermove', 720, 300 + 39)); // un día a la derecha y 30 minutos más abajo (39 px)
    act(() => evento('pointerup', 720, 339));
    patio.click();
    expect(onUpdateBlock).toHaveBeenCalledOnce();
    expect(onUpdateBlock).toHaveBeenCalledWith(expect.objectContaining({ day: 4, time_start: '11:45', time_end: '12:15' }));
    expect(screen.queryByText('Editar bloque')).toBeNull();
  });

  it('los bloques de apoyo no se mueven desde aquí', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    const { onUpdateBlock } = setup([], [{ ...block('apoyo-gru1-0'), day: 2, subject: 'Habilidades sociales' }], onNav);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    const b = screen.getByRole('button', { name: /Habilidades sociales/ });
    b.focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onUpdateBlock).not.toHaveBeenCalled();
    expect(b.querySelector('.wk-asa')).toBeNull();
  });
});
