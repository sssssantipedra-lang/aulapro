// @vitest-environment jsdom
/**
 * La campana de los avisos en la app entera (25-11-2026): con los datos de ejemplo cuenta lo pendiente, el panel
 * lo enseña, «Ya lo he visto» baja el número y se puede deshacer, un evento abre la Agenda en su día y Escape
 * cierra el panel.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { I18nProvider } from './i18n';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const campana = () => screen.getByRole('button', { name: /^Avisos: / });
const numero = () => Number(/(\d+)/.exec(campana().getAttribute('aria-label') ?? '')?.[1] ?? 0);

describe('AulaPro · avisos', () => {
  it('cuenta lo pendiente, se oculta y se vuelve a enseñar, y un evento abre la Agenda en su día', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><App /></I18nProvider>);
    await user.click(await screen.findByText('Explorar con datos de ejemplo'));
    await screen.findByRole('button', { name: /Mis Clases/ });

    const antes = numero();
    // Los datos de ejemplo traen dos eventos a 3 y 5 días, tareas sin hacer y alumnado con avisos
    expect(antes).toBeGreaterThanOrEqual(4);
    await user.click(campana());
    const panel = screen.getByRole('dialog', { name: 'Avisos' });
    expect(within(panel).getByText('Eventos próximos')).toBeTruthy();
    expect(within(panel).getByText('Faltan 3 días')).toBeTruthy();
    expect(within(panel).getByText('Tareas pendientes')).toBeTruthy();
    expect(within(panel).getByText('Alumnado que necesita atención')).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Ya lo he visto: Entrega notas 1ª Eval.' }));
    expect(numero()).toBe(antes - 1);
    expect(within(panel).getByText(/Has ocultado 1 aviso\./)).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: 'Volver a enseñarlos' }));
    expect(numero()).toBe(antes);

    // El evento abre la Agenda en el mes, con su día elegido y el evento a la vista
    await user.click(within(panel).getByRole('button', { name: /^Entrega notas 1ª Eval\./ }));
    expect(screen.queryByRole('dialog', { name: 'Avisos' })).toBeNull();
    expect(await screen.findByText('Plazo máximo de entrega a jefatura')).toBeTruthy();

    // Escape lo cierra
    await user.click(campana());
    expect(screen.getByRole('dialog', { name: 'Avisos' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Avisos' })).toBeNull();
  });

  it('marcar una tarea como hecha desde el panel la quita de la cuenta', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><App /></I18nProvider>);
    await user.click(await screen.findByText('Explorar con datos de ejemplo'));
    await screen.findByRole('button', { name: /Mis Clases/ });
    const antes = numero();
    await user.click(campana());
    const [primera] = within(screen.getByRole('dialog', { name: 'Avisos' })).getAllByRole('checkbox', { name: /^Marcar como hecha: / });
    await user.click(primera);
    expect(numero()).toBe(antes - 1);
  });
});
