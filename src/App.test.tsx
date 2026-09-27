// @vitest-environment jsdom
/**
 * La aplicación entera, desde la pantalla de bienvenida. Es la prueba que
 * habría cazado el fallo de «Explorar con datos de ejemplo», que dejaba la
 * app sin clases porque la lectura del disco pisaba los datos recién puestos.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { I18nProvider } from './i18n';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Aula Pro', () => {
  it('«Explorar con datos de ejemplo» abre la app con clases y alumnos', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><App /></I18nProvider>);

    await user.click(await screen.findByText('Explorar con datos de ejemplo'));
    await user.click(await screen.findByRole('button', { name: /Mis Clases/ }));

    expect(await screen.findByText(/3 clases · 13 alumnos/)).toBeTruthy();
  });

  it('los datos de ejemplo siguen ahí al volver a abrir la app', async () => {
    const user = userEvent.setup();
    const first = render(<I18nProvider><App /></I18nProvider>);
    await user.click(await screen.findByText('Explorar con datos de ejemplo'));
    await screen.findByRole('button', { name: /Mis Clases/ });
    // Deja pasar el guardado diferido antes de «cerrar» la app
    await new Promise(r => setTimeout(r, 1500));
    first.unmount();

    render(<I18nProvider><App /></I18nProvider>);
    await user.click(await screen.findByRole('button', { name: /Mis Clases/ }));
    expect(await screen.findByText(/3 clases · 13 alumnos/)).toBeTruthy();
  });

  it('todas las secciones se abren sin romperse', async () => {
    const user = userEvent.setup();
    const errores: unknown[] = [];
    const onError = (e: ErrorEvent) => errores.push(e.error ?? e.message);
    window.addEventListener('error', onError);

    render(<I18nProvider><App /></I18nProvider>);
    await user.click(await screen.findByText('Explorar con datos de ejemplo'));
    await screen.findByRole('button', { name: /Mis Clases/ });

    const secciones = [
      'Mis Clases', 'Agenda', 'Cuaderno de Notas', 'Asistencia', 'Distribución de aula',
      'Rúbricas', 'Diana Competencial', 'Informes', 'Actas', 'Autoevaluaciones', 'Historial',
      'Reuniones', 'Formaciones', 'Sala de alumnos', 'Trabajo compartido', 'Registro de cambios', 'Mi Perfil',
    ];
    for (const nombre of secciones) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${nombre}$`) }));
      // Cada sección se carga aparte (lazy): se espera a que pinte su título
      expect((await screen.findAllByRole('heading', { level: 1 })).length, nombre).toBeGreaterThan(0);
    }
    window.removeEventListener('error', onError);
    expect(errores).toEqual([]);
  }, 30_000);
});
