// @vitest-environment jsdom
/** La campana de los avisos va en el menú junto a «Buscar», también con el menú plegado (25-11-2026). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { I18nProvider } from '../../i18n';
import type { User } from '../../types';

afterEach(cleanup);

const docente = { id: 'p', full_name: 'Profesor', school: '', subject: 'Matemáticas', community: 'madrid' } as unknown as User;

function menu(mini: boolean, avisos: number) {
  const onAvisos = vi.fn();
  render(
    <I18nProvider>
      <Sidebar mini={mini} onToggle={() => {}} current="dashboard" onNav={() => {}} user={docente} onLogout={() => {}}
        onBuscar={() => {}} avisos={avisos} onAvisos={onAvisos} />
    </I18nProvider>,
  );
  return onAvisos;
}

describe('Menú · campana de avisos', () => {
  it('está junto a «Buscar», con el número, y abre el panel', () => {
    const onAvisos = menu(false, 3);
    const campana = screen.getByRole('button', { name: 'Avisos: 3 pendientes' });
    expect(campana.closest('.sb-acciones')?.querySelector('.sb-buscar')).toBeTruthy();
    expect(campana.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(campana);
    expect(onAvisos).toHaveBeenCalled();
  });

  it('con el menú plegado sigue ahí; sin avisos, sin número', () => {
    menu(true, 0);
    expect(screen.getByRole('button', { name: 'Avisos: no hay nada pendiente' }).textContent).toBe('');
  });
});
