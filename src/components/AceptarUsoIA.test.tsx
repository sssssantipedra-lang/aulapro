// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n';
import { ToastProvider } from './ui/Toast';
import { ApiKeySettings } from './ApiKeySettings';
import { usoIaAceptado, fechaUsoIa } from '../lib/usoIA';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const pintar = () => render(<I18nProvider><ToastProvider><ApiKeySettings /></ToastProvider></I18nProvider>);

describe('aceptar cómo se tratan los datos antes de poner la clave de la IA (4-11-2026)', () => {
  it('sin marcar la casilla no se puede pegar la clave, y el texto no habla de diagnósticos que se envíen', async () => {
    pintar();
    expect((screen.getByRole('button', { name: /Pegar mi clave/ }) as HTMLButtonElement).disabled).toBe(true);
    const texto = document.body.textContent ?? '';
    expect(texto).toMatch(/AulaPro no guarda ni pide diagnósticos/);
    expect(texto).toMatch(/Espacio Económico Europeo/);
    expect(texto).toMatch(/me hago responsable/);
    expect(texto).not.toMatch(/categoría/);
    expect(usoIaAceptado()).toBe(false);
  });

  it('al marcarla se guarda la aceptación y ya se puede pegar', async () => {
    pintar();
    await userEvent.click(screen.getByRole('checkbox', { name: /me hago responsable/ }));
    expect(usoIaAceptado()).toBe(true);
    expect(fechaUsoIa()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((screen.getByRole('button', { name: /Pegar mi clave/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('quien ya aceptó ve el texto plegado y puede volver a leerlo', () => {
    localStorage.setItem('aulapro_uso_ia', JSON.stringify({ v: '2026-11-04', fecha: '2026-11-04T10:00:00.000Z' }));
    pintar();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(/Aceptaste el uso de la IA el 2026-11-04/)).toBeTruthy();
  });
});
