// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n';
import { AceptarCondiciones } from './AceptarCondiciones';
import { aceptacionRegistrada, aceptacionSinRegistrar, condicionesAceptadas, VERSION_CONDICIONES } from '../lib/condiciones';

vi.mock('../platform/googleDrive', async orig => ({ ...(await orig<typeof import('../platform/googleDrive')>()), entrarConGoogle: vi.fn(), hayVueltaEntrada: () => false, terminarVueltaEntrada: vi.fn() }));
vi.mock('../platform/microsoft', async orig => ({ ...(await orig<typeof import('../platform/microsoft')>()), entrarConMicrosoft: vi.fn(), hayVueltaEntradaMicrosoft: () => false, terminarVueltaEntradaMicrosoft: vi.fn() }));
vi.mock('../platform/cuentaWeb', async orig => ({ ...(await orig<typeof import('../platform/cuentaWeb')>()), cargarGoogle: () => Promise.resolve() }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe('aceptar las condiciones (3-11-2026)', () => {
  it('en la entrada, sin marcar la casilla no se puede entrar', async () => {
    const { EntrarWeb } = await import('../pages/EntrarWeb');
    render(<I18nProvider><EntrarWeb onEntrar={() => {}} /></I18nProvider>);
    const casilla = screen.getByRole('checkbox', { name: /acepto las condiciones de venta y de uso/i });
    expect((casilla as HTMLInputElement).checked).toBe(false);
    const google = await screen.findByRole('button', { name: /Continuar con Google/ });
    expect((google as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(casilla);
    expect((google as HTMLButtonElement).disabled).toBe(false);
  });

  it('quien ya había entrado la marca una vez, y se guarda para mandarla al servidor', async () => {
    const onAceptar = vi.fn();
    render(<I18nProvider><AceptarCondiciones onAceptar={onAceptar} /></I18nProvider>);
    const seguir = screen.getByRole('button', { name: 'Continuar' });
    expect((seguir as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(seguir);
    expect(onAceptar).toHaveBeenCalled();
    expect(condicionesAceptadas()).toBe(true);
    expect(aceptacionSinRegistrar()).toBe(VERSION_CONDICIONES);
    aceptacionRegistrada(VERSION_CONDICIONES);
    expect(aceptacionSinRegistrar()).toBeUndefined();
  });

  it('una versión anterior no vale', () => {
    localStorage.setItem('aulapro_condiciones', JSON.stringify({ v: '2026-01-01', fecha: 'x', registrada: true }));
    expect(condicionesAceptadas()).toBe(false);
  });
});
