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
import type { ScheduleBlock } from '../types';

afterEach(cleanup);

const block = (id: string): ScheduleBlock =>
  ({ id, day: 1, time_start: '08:30', time_end: '09:25', subject: 'Mates', room: '', class_id: '', color: '#000' });

function setup(blocks: ScheduleBlock[], apoyoBlocks: ScheduleBlock[] = [], onNav: (s: string) => void = () => {}) {
  const onReplaceBlocks = vi.fn();
  const onDeleteCalEvent = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <Agenda
          classes={[]} scheduleBlocks={blocks} apoyoBlocks={apoyoBlocks} calEvents={[]}
          onAddBlock={() => {}} onUpdateBlock={() => {}} onDeleteBlock={() => {}}
          onReplaceBlocks={onReplaceBlocks}
          onAddCalEvent={() => {}} onUpdateCalEvent={() => {}} onDeleteCalEvent={onDeleteCalEvent}
          onNav={onNav}
        />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onReplaceBlocks, onDeleteCalEvent };
}

describe('Agenda · borrar horario', () => {
  it('sin horario no se ofrece', () => {
    setup([]);
    expect(screen.queryByRole('button', { name: /Borrar horario/ })).toBeNull();
  });

  it('pide confirmación y vacía el horario', async () => {
    const user = userEvent.setup();
    const { onReplaceBlocks, onDeleteCalEvent } = setup([block('a'), block('b')]);
    await user.click(screen.getByRole('button', { name: /Borrar horario/ }));
    expect(onReplaceBlocks).not.toHaveBeenCalled();
    expect(screen.getByText(/Se quitarán las 2 sesiones/)).toBeTruthy();

    const botones = screen.getAllByRole('button', { name: /Borrar horario/ });
    await user.click(botones[botones.length - 1]);
    expect(onReplaceBlocks).toHaveBeenCalledWith([]);
    expect(onDeleteCalEvent).not.toHaveBeenCalled();
  });
});

describe('Agenda · semana', () => {
  it('pinta los bloques que no cruzan una hora en punto y el horario de los grupos de apoyo', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    const apoyo: ScheduleBlock = { ...block('ap'), day: 3, time_start: '12:15', time_end: '13:00', subject: 'Habilidades sociales', room: 'PT' };
    setup([{ ...block('c'), time_start: '10:15', time_end: '10:45', subject: 'Tutoría' }], [apoyo], onNav);
    await user.click(screen.getByRole('tab', { name: 'Semanal' }));
    expect(screen.getAllByText('Tutoría')).toHaveLength(1);
    await user.click(screen.getByText('Habilidades sociales'));
    // El horario de apoyo se cambia en su pantalla, no aquí
    expect(onNav).toHaveBeenCalledWith('apoyo-alumnado');
  });
});
