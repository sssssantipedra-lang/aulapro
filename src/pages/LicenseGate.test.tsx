// @vitest-environment jsdom
/**
 * Pantalla de licencia de la versión web con la venta cerrada (decisión del dueño, 31-10-2026: se abre el
 * 15-11-2026): no enseña ningún botón ni enlace de compra, dice cuándo sale a la venta y deja la clave a mano
 * a la vista. Con la venta abierta, vuelve el botón con el correo de la cuenta puesto.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LicenseGate } from './LicenseGate';
import { I18nProvider } from '../i18n';
import type { LicenseState } from '../types/electron';

vi.mock('../lib/platform', () => ({ isWebApp: () => true, isAndroidApp: () => false }));
vi.mock('../platform/cuentaWeb', async importOriginal => {
  const real = await importOriginal<typeof import('../platform/cuentaWeb')>();
  return {
    ...real,
    leerCuenta: async () => ({ email: 'docente@ejemplo.org', nombre: 'Profesor', proveedor: 'google', desde: '2026-10-31' }),
    hayToken: () => true,
    botonGoogle: async () => {},
    licenciaDeLaCuenta: async () => ({ error: 'sin-conexion' }),
  };
});

const sin: LicenseState = { required: true, status: 'sin-licencia', enforced: true, keyHint: '', since: '', buyUrl: '' };
const pintar = () => render(<I18nProvider><LicenseGate state={sin} onChange={() => {}} /></I18nProvider>);

afterEach(cleanup);

describe('pantalla de licencia con la venta cerrada', () => {
  it('no enseña ningún enlace de compra y dice cuándo se abre', async () => {
    const { VENTA_ABIERTA } = await import('../platform/cuentaWeb');
    expect(VENTA_ABIERTA).toBe(false);
    pintar();
    expect(await screen.findByText(/sale a la venta el 15 de noviembre de 2026/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Comprar AulaPro/ })).toBeNull();
    expect(document.querySelector('a[href*="lemonsqueezy"]')).toBeNull();
  });

  it('deja la clave a mano a la vista, para quien ya la tiene', async () => {
    pintar();
    expect(await screen.findByLabelText('Clave de licencia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeTruthy();
  });
});
