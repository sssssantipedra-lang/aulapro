// @vitest-environment jsdom
/**
 * Circuitos: se crea uno con sus estaciones y el cronómetro pasa de
 * «Preparados» al trabajo de la primera estación, se para y sigue.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfCircuitos } from './EfCircuitos';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { EF_VACIO } from '../../lib/ef';
import type { EfData } from '../../types/ef';

let ultimo: EfData = EF_VACIO;
function Harness() {
  const [ef, setEf] = useState(EF_VACIO);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfCircuitos ef={ef} onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => { localStorage.clear(); ultimo = EF_VACIO; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Circuitos', () => {
  it('crea un circuito y el cronómetro avanza de fase, se para y sigue', async () => {
    // Solo el reloj y el intervalo son de mentira; los setTimeout de la librería de pruebas, de verdad
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Nuevo circuito/ }));
    await user.type(screen.getByLabelText('Nombre'), 'Fuerza');
    await user.type(screen.getByLabelText('Estaciones, una por línea'), 'Sentadillas{Enter}Plancha');
    await user.clear(screen.getByLabelText('Trabajo (segundos)'));
    await user.type(screen.getByLabelText('Trabajo (segundos)'), '20');
    // 2 rondas: 4 × 20 de trabajo, 2 × 15 de descanso y 60 entre rondas
    expect(screen.getByText(/En total, 2:50/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.circuitos[0]).toMatchObject({ nombre: 'Fuerza', estaciones: ['Sentadillas', 'Plancha'], trabajo: 20 });

    await user.click(screen.getByRole('button', { name: /Empezar/ }));
    const crono = screen.getByRole('dialog', { name: 'Fuerza' });
    const boton = (n: RegExp | string) => within(crono).getByRole('button', { name: n });
    expect(crono.textContent).toContain('Preparados');
    await user.click(boton('Empezar'));
    await act(async () => { vi.advanceTimersByTime(10_500); });
    expect(crono.textContent).toContain('Trabajo');
    expect(crono.textContent).toContain('Sentadillas');
    expect(crono.textContent).toContain('Después: Plancha');

    await user.click(boton('Pausa'));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(crono.textContent).toContain('Sentadillas');
    await user.click(boton('Seguir'));
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(crono.textContent).toContain('Descanso');
    expect(crono.textContent).toContain('Ahora: Plancha');

    await user.click(boton('Cerrar'));
    expect(screen.queryByRole('dialog', { name: 'Fuerza' })).toBeNull();
  });
});
