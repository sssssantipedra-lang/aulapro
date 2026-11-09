// @vitest-environment jsdom
/**
 * Pantalla de licencia de la versión web con la venta cerrada (decisión del dueño, 31-10-2026): no enseña ningún botón ni
 * enlace de compra y deja la clave a mano a la vista. Con la venta abierta, vuelve el botón con el correo de la cuenta puesto,
 * y quien entró en el acceso anticipado gratuito (beta, 5-11-2026) lee que ha terminado y puede suscribirse. Las pruebas se
 * acomodan solas a cómo estén los interruptores (`scripts/abrir-venta.mjs` los cambia el día de la apertura).
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

const { VENTA_ABIERTA } = await import('../platform/cuentaWeb');

describe.runIf(!VENTA_ABIERTA)('pantalla de licencia con la venta cerrada', () => {
  it('no enseña ningún enlace de compra y dice que la venta aún no está abierta', async () => {
    pintar();
    expect(await screen.findByText(/la venta de AulaPro aún no está abierta/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Suscribirme/ })).toBeNull();
    expect(document.querySelector('a[href*="lemonsqueezy"]')).toBeNull();
  });
});

describe.runIf(VENTA_ABIERTA)('pantalla de licencia con la venta abierta', () => {
  it('enseña el botón de suscribirse con el correo de la cuenta puesto en el pago', async () => {
    pintar();
    const enlace = await screen.findByRole('link', { name: /Suscribirme/ });
    expect(enlace.getAttribute('href')).toContain('lemonsqueezy');
    expect(enlace.getAttribute('href')).toContain(encodeURIComponent('docente@ejemplo.org'));
  });
});

describe('quien entró en el acceso anticipado gratuito y se encuentra la venta abierta', () => {
  it('lee que el acceso anticipado terminó, no que «su suscripción terminó»', async () => {
    localStorage.setItem('aulapro_beta_terminada', '1');
    pintar();
    expect(await screen.findByText(/El acceso anticipado gratuito de AulaPro ha terminado/)).toBeTruthy();
    expect(screen.queryByText(/Tu suscripción a AulaPro ha terminado/)).toBeNull();
    expect(screen.getByText(/no se ha borrado nada/)).toBeTruthy();
    localStorage.removeItem('aulapro_beta_terminada');
  });

  it('deja la clave a mano a la vista, para quien ya la tiene', async () => {
    pintar();
    if (VENTA_ABIERTA) (await screen.findByText(/¿Compraste con otro correo/)).click();
    expect(await screen.findByLabelText('Clave de licencia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeTruthy();
  });
});
