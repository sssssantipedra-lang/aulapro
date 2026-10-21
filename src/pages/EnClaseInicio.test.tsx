// @vitest-environment jsdom
/**
 * En clase: la clase de «Ahora» o «Siguiente» sale del horario de hoy, con las
 * horas bien comparadas, y se renueva sola al pasar el tiempo.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { EnClaseInicio } from './EnClaseInicio';
import { I18nProvider } from '../i18n';
import type { Class, ScheduleBlock } from '../types';

const clase = (id: string, name: string) => ({ id, name, subject: '', room: '', color: '#0284c7' }) as Class;
const bloque = (class_id: string, time_start: string, time_end: string, day = 3): ScheduleBlock =>
  ({ id: class_id + time_start, class_id, day, time_start, time_end, subject: '', room: '', color: '' });
const clases = [clase('a', '4º A'), clase('b', '5º B')];

function pinta(blocks: ScheduleBlock[]) {
  return render(
    <I18nProvider>
      <EnClaseInicio classes={clases} scheduleBlocks={blocks} classMarks={[]} seatingPlans={{}} onNav={() => {}} />
    </I18nProvider>,
  );
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('En clase · la clase que toca', () => {
  it('«Ahora» la que está en marcha y «Siguiente» la que viene, con sus horas', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 9, 30));
    pinta([bloque('a', '9:00', '9:55'), bloque('b', '10:00', '10:55')]);
    expect(screen.getByText(/Ahora · 9:00–9:55/)).toBeTruthy();
    expect(screen.getByText('4º A')).toBeTruthy();
  });

  it('entre clases dice «Siguiente», y sin más clases hoy no enseña ninguna', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 9, 58));
    const { unmount } = pinta([bloque('a', '9:00', '9:55'), bloque('b', '10:00', '10:55')]);
    expect(screen.getByText(/Siguiente · 10:00–10:55/)).toBeTruthy();
    expect(screen.getByText('5º B')).toBeTruthy();
    unmount();
    vi.setSystemTime(new Date(2026, 9, 21, 13, 0));
    pinta([bloque('a', '9:00', '9:55')]);
    expect(screen.queryByText(/Ahora|Siguiente/)).toBeNull();
  });

  it('se renueva sola: al empezar la siguiente clase pasa a «Ahora»', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 9, 58));
    pinta([bloque('a', '9:00', '9:55'), bloque('b', '10:00', '10:55')]);
    expect(screen.getByText(/Siguiente · 10:00/)).toBeTruthy();
    act(() => { vi.setSystemTime(new Date(2026, 9, 21, 10, 1)); vi.advanceTimersByTime(30_000); });
    expect(screen.getByText(/Ahora · 10:00–10:55/)).toBeTruthy();
  });
});
