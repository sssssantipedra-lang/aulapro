// @vitest-environment jsdom
/**
 * Autoguardado de Reuniones: una copia por minuto que sustituye a la anterior,
 * recuperable si se cierra sin guardar y que desaparece al guardar de verdad.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkSessions } from './WorkSessions';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { WorkSession } from '../types';

const SLOT = 'aulapro_autoguardado_sin-perfil_meeting';
const slots = () => Object.keys(localStorage).filter(k => k.startsWith('aulapro_autoguardado_'));

function Harness({ initial = [] as WorkSession[], onSaved }: { initial?: WorkSession[]; onSaved?: (s: WorkSession) => void }) {
  const [sessions, setSessions] = useState(initial);
  return (
    <I18nProvider>
      <ToastProvider>
        <WorkSessions
          kind="meeting" sessions={sessions}
          onSave={s => { setSessions(prev => [...prev.filter(x => x.id !== s.id), s]); onSaved?.(s); }}
          onDelete={() => {}} onNav={() => {}}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const minuto = () => act(() => { vi.advanceTimersByTime(60_000); });

describe('Autoguardado de reuniones', () => {
  it('guarda una copia cada minuto y cada una sustituye a la anterior', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getAllByRole('button', { name: /Nueva reunión/ })[0]);
    await user.type(screen.getByLabelText('Asunto de la reunión'), 'Claustro');
    await user.type(screen.getByLabelText('Anotaciones'), 'Primer punto');

    expect(localStorage.getItem(SLOT)).toBeNull();
    await minuto();
    expect(JSON.parse(localStorage.getItem(SLOT)!).draft.notes).toBe('Primer punto');
    expect(screen.getByText(/Autoguardado a las/)).toBeTruthy();

    await user.type(screen.getByLabelText('Anotaciones'), ' y segundo');
    await minuto();
    expect(JSON.parse(localStorage.getItem(SLOT)!).draft.notes).toBe('Primer punto y segundo');
    expect(slots()).toEqual([SLOT]);
  });

  it('si se cierra sin guardar, al volver ofrece recuperarlo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const first = render(<Harness />);
    await user.click(screen.getAllByRole('button', { name: /Nueva reunión/ })[0]);
    await user.type(screen.getByLabelText('Asunto de la reunión'), 'Evaluación 1º ESO');
    await user.type(screen.getByLabelText('Anotaciones'), 'Acuerdos importantes');
    await minuto();
    first.unmount(); // «se cierra la pestaña»

    render(<Harness />);
    expect(screen.getByText(/Tienes anotaciones sin guardar de «Evaluación 1º ESO»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Recuperar' }));
    expect((screen.getByLabelText('Anotaciones') as HTMLTextAreaElement).value).toBe('Acuerdos importantes');
  });

  it('también guarda al cerrar la ventana, sin esperar al minuto', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getAllByRole('button', { name: /Nueva reunión/ })[0]);
    await user.type(screen.getByLabelText('Anotaciones'), 'Justo antes de cerrar');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(JSON.parse(localStorage.getItem(SLOT)!).draft.notes).toBe('Justo antes de cerrar');
  });

  it('al guardar de verdad se borra el autoguardado', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getAllByRole('button', { name: /Nueva reunión/ })[0]);
    await user.type(screen.getByLabelText('Asunto de la reunión'), 'Departamento');
    await user.type(screen.getByLabelText('Anotaciones'), 'Notas');
    await minuto();
    expect(localStorage.getItem(SLOT)).not.toBeNull();
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(localStorage.getItem(SLOT)).toBeNull();
  });

  it('descartar quita el aviso y la copia', async () => {
    const draft: WorkSession = { id: 'w1', kind: 'meeting', at: '', date: '2026-09-27', title: 'Tutoría', notes: 'x' };
    localStorage.setItem(SLOT, JSON.stringify({ draft, editing: false, savedAt: new Date().toISOString() }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByText(/sin guardar/)).toBeNull();
    expect(localStorage.getItem(SLOT)).toBeNull();
  });

  it('no avisa si lo autoguardado ya coincide con lo guardado', () => {
    const s: WorkSession = { id: 'w2', kind: 'meeting', at: '', date: '2026-09-27', title: 'Claustro', notes: 'igual' };
    localStorage.setItem(SLOT, JSON.stringify({ draft: s, editing: true, savedAt: new Date().toISOString() }));
    render(<Harness initial={[s]} />);
    expect(screen.queryByText(/sin guardar/)).toBeNull();
  });
});
