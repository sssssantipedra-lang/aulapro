// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n';
import { ToastProvider } from './ui/Toast';
import { ApiKeySettings } from './ApiKeySettings';
import { usoIaAceptado, fechaUsoIa } from '../lib/usoIA';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const pintar = () => render(<I18nProvider><ToastProvider><ApiKeySettings /></ToastProvider></I18nProvider>);
const dialogo = () => screen.getAllByRole('dialog', { hidden: true }).find(d => d.closest('.modal-overlay.open'))!;

describe('aceptar el uso de la IA la primera vez que se va a conseguir la clave (4-11-2026)', () => {
  it('«Abrir AI Studio» no abre Google hasta marcar la casilla, y la casilla enlaza con el panel informativo', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    pintar();
    await userEvent.click(screen.getByRole('link', { name: /Abrir AI Studio/ }));
    expect(abrir).not.toHaveBeenCalled();
    expect(usoIaAceptado()).toBe(false);

    const d = dialogo();
    expect(within(d).getByRole('link', { name: 'Política de privacidad' }).getAttribute('href')).toBe('../privacidad.html');
    const continuar = within(d).getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;
    expect(continuar.disabled).toBe(true);
    expect(d.textContent).toMatch(/Acepto el uso de la IA en AulaPro y las responsabilidades/);

    await userEvent.click(within(d).getByRole('button', { name: 'Leer la información' }));
    const panel = dialogo();
    expect(panel.textContent).toMatch(/AulaPro no guarda ni pide diagnósticos/);
    expect(panel.textContent).toMatch(/Espacio Económico Europeo/);
    expect(panel.textContent).toMatch(/responde de los datos del alumnado/);
    expect(panel.textContent).toMatch(/no se usa para evaluar ni para poner notas: se usa para dar recomendaciones/);
    expect(panel.textContent).toMatch(/decisión final sobre cómo hacerlo es siempre del docente/);
    expect(panel.querySelectorAll('strong').length).toBeGreaterThan(5);
    expect(within(panel).getByRole('link', { name: 'Leer la política de privacidad' }).getAttribute('href')).toBe('../privacidad.html');
    await userEvent.click(within(panel).getAllByRole('button', { name: 'Cerrar' }).at(-1)!);

    await userEvent.click(within(dialogo()).getByRole('checkbox'));
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Continuar' }));
    expect(usoIaAceptado()).toBe(true);
    expect(fechaUsoIa()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(abrir).toHaveBeenCalledWith('https://aistudio.google.com/apikey', '_blank', 'noopener,noreferrer');
  });

  it('sin aceptar, «Pegar mi clave» también pide la casilla', async () => {
    pintar();
    await userEvent.click(screen.getByRole('button', { name: /Pegar mi clave/ }));
    expect(dialogo().textContent).toMatch(/Antes de usar la IA/);
    expect(usoIaAceptado()).toBe(false);
  });

  it('quien ya aceptó abre Google directamente y puede volver a leer la información', async () => {
    localStorage.setItem('aulapro_uso_ia', JSON.stringify({ v: '2026-11-04', fecha: '2026-11-04T10:00:00.000Z' }));
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    pintar();
    const enlace = screen.getByRole('link', { name: /Abrir AI Studio/ });
    expect(enlace.getAttribute('href')).toBe('https://aistudio.google.com/apikey');
    await userEvent.click(screen.getByRole('button', { name: 'Cómo trata AulaPro lo que envías a la IA' }));
    expect(dialogo().textContent).toMatch(/Espacio Económico Europeo/);
    expect(abrir).not.toHaveBeenCalled();
  });
});
