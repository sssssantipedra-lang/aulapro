// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Attendance } from './Attendance';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, Student } from '../types';

afterEach(cleanup);

const clase = { id: 'c1', name: '1º ESO A', subject: 'Matemáticas' } as unknown as Class;
const alumno = { id: 'a1', name: 'Alumno 1', class_id: 'c1' } as unknown as Student;

function pinta(attendance: Record<string, Record<string, Record<string, 'present' | 'absent' | 'late' | 'justified'>>>, onSet = vi.fn()) {
  render(
    <I18nProvider>
      <ToastProvider>
        <Attendance classes={[clase]} students={[alumno]} attendance={attendance} onSet={onSet} onSetDay={() => {}} onNav={() => {}} />
      </ToastProvider>
    </I18nProvider>,
  );
  return onSet;
}

describe('pasar lista', () => {
  it('pulsar un estado sin marcar lo pone', async () => {
    const onSet = pinta({});
    const grupo = screen.getByRole('group', { name: 'Alumno 1' });
    await userEvent.click(grupo.querySelectorAll('button')[0]);
    expect(onSet).toHaveBeenCalledWith('c1', expect.any(String), 'a1', 'present');
  });

  it('volver a pulsar el estado marcado lo quita', async () => {
    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const onSet = pinta({ c1: { [iso]: { a1: 'present' } } });
    const grupo = screen.getByRole('group', { name: 'Alumno 1' });
    const marcado = grupo.querySelector('button[aria-pressed="true"]') as HTMLElement;
    await userEvent.click(marcado);
    expect(onSet).toHaveBeenCalledWith('c1', iso, 'a1', null);
  });
});
