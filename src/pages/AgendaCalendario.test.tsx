// @vitest-environment jsdom
/**
 * La Agenda con el calendario escolar de la comunidad del perfil: los días no
 * lectivos sombreados, las vacaciones en franja y, al pulsar un día, su
 * nombre. Para una comunidad sin calendario no cambia nada.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Agenda } from './Agenda';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { ComunidadId } from '../lib/curriculum/comunidades';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 11, 10)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function pinta(comunidad?: ComunidadId) {
  const r = render(
    <I18nProvider><ToastProvider>
      <Agenda
        classes={[]} scheduleBlocks={[]} calEvents={[]} comunidad={comunidad}
        onAddBlock={() => {}} onUpdateBlock={() => {}} onDeleteBlock={() => {}} onReplaceBlocks={() => {}}
        onAddCalEvent={() => {}} onUpdateCalEvent={() => {}} onDeleteCalEvent={() => {}} onNav={() => {}}
      />
    </ToastProvider></I18nProvider>,
  );
  // La Agenda se abre en la semana: el calendario escolar está en el mes
  fireEvent.click(r.getByRole('tab', { name: 'Mensual' }));
}

const dia = (n: number) => [...document.querySelectorAll('.cal-day:not(.other-month)')].find(d => d.textContent?.startsWith(String(n)) && d.querySelector('span')?.textContent === String(n))!;

describe('Agenda · calendario escolar', () => {
  it('Madrid, diciembre de 2026: el 7 y el 8 no lectivos, y las vacaciones desde el 23', () => {
    pinta('madrid');
    expect(dia(8).className).toContain('no-lectivo');
    expect(dia(8).getAttribute('title')).toBe('Inmaculada Concepción');
    expect(dia(7).className).toContain('no-lectivo');
    expect(dia(22).className).not.toMatch(/vacaciones|no-lectivo/);
    expect(dia(23).className).toContain('vacaciones vac-ini');
    expect(dia(31).className).toContain('vacaciones');
    expect(screen.getByText(/Orden 2034\/2026/)).toBeTruthy();
    fireEvent.click(dia(24));
    expect(screen.getByText('Vacaciones de Navidad')).toBeTruthy();
  });

  it('el curso que aún no está publicado lo dice', () => {
    pinta('madrid');
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('El calendario de este curso aún no está disponible.')).toBeTruthy();
  });

  it('una comunidad sin calendario, como hasta ahora', () => {
    pinta('andalucia');
    expect(document.querySelector('.no-lectivo, .vacaciones')).toBeNull();
    expect(document.querySelector('.cal-escolar-fuente')).toBeNull();
  });
});
