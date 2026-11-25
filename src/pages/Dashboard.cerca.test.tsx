// @vitest-environment jsdom
/**
 * Los eventos a 5 días o menos en el Inicio (25-11-2026): en «Tu semana» y en «Próximos eventos» llevan la
 * píldora con lo que falta («Hoy», «Mañana», «Faltan 3 días»), con el color del tema y el parpadeo al entrar.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { I18nProvider } from '../i18n';
import { isoDate, shiftDate } from '../lib/utils';
import type { CalEvent, Class } from '../types';

afterEach(cleanup);

const HOY = isoDate();
const evento = (id: string, dias: number): CalEvent =>
  ({ id, name: `Evento ${id}`, date: shiftDate(HOY, dias), time: '10:00', type: 'deadline', urgency: 'media', color: '#000', desc: '' });
const clase = { id: 'c1', name: '1º A', subject: 'Matemáticas', subjects: ['Matemáticas'], isTutoria: false, room: '', color: '#000' } as Class;

function inicio(calEvents: CalEvent[]) {
  render(
    <I18nProvider>
      <Dashboard
        user={null} tasks={[]} scheduleBlocks={[]} calEvents={calEvents} students={[]} classes={[clase]} evaluations={[]}
        attendance={{}} gradeCategories={[]} gradeItems={[]} grades={{}} onNav={() => {}} onAddTask={() => {}}
        onToggleTask={() => {}} onLoadDemo={() => {}}
        semana={{ desde: HOY, hasta: shiftDate(HOY, 6), proxima: false, sesiones: [], pendientes: [], eventos: calEvents.filter(e => e.date >= HOY) }}
      />
    </I18nProvider>,
  );
}

describe('Inicio · eventos cercanos', () => {
  it('«Próximos eventos»: el recuadro del día lleva el anillo y la píldora dice cuánto falta', () => {
    inicio([evento('hoy', 0), evento('tres', 3), evento('lejos', 9)]);
    const tarjeta = screen.getByText('Próximos eventos').closest('.home-card') as HTMLElement;
    const filas = within(tarjeta).getAllByRole('listitem');
    expect(within(filas[0]).getByText('Hoy')).toBeTruthy();
    expect(filas[0].querySelector('.home-date')!.classList.contains('cerca-latido')).toBe(true);
    expect(within(filas[1]).getByText('Faltan 3 días')).toBeTruthy();
    expect(filas[2].querySelector('.cerca-pill')).toBeNull();
    expect(filas[2].querySelector('.home-date')!.classList.contains('cerca-latido')).toBe(false);
  });

  it('«Tu semana»: la píldora late', () => {
    inicio([evento('mañana', 1)]);
    const semana = document.querySelector('.home-semana') as HTMLElement;
    const pildora = within(semana).getByText('Mañana');
    expect(pildora.classList.contains('cerca-pill')).toBe(true);
    expect(pildora.classList.contains('cerca-latido')).toBe(true);
  });
});
