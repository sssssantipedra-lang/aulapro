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

  describe('comunidad autónoma', () => {
    /** Un perfil como los que ya existen, creado antes de que hubiera comunidad. */
    function perfilAntiguo() {
      const id = 'pvieja';
      localStorage.setItem('aulapro_web_profiles', JSON.stringify([{
        id, name: 'Marta López', school: 'CEIP Ejemplo', subject: 'Tutoría', course: '2025-2026',
        createdAt: '2025-09-01T08:00:00.000Z', lastOpenedAt: '2025-09-01T08:00:00.000Z',
      }]));
      localStorage.setItem('aulapro_active_profile', id);
    }

    it('crear un perfil exige elegir la comunidad, y queda en la barra lateral', async () => {
      const user = userEvent.setup();
      render(<I18nProvider><App /></I18nProvider>);

      await user.type(await screen.findByLabelText(/Tu nombre/), 'Ana García');
      await user.click(screen.getByRole('button', { name: 'Empezar a usar Aula Pro' }));
      expect(await screen.findByText('Elige tu comunidad autónoma.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Mis Clases/ })).toBeNull();

      await user.selectOptions(screen.getByLabelText(/Comunidad autónoma/), 'madrid');
      await user.click(screen.getByRole('button', { name: 'Empezar a usar Aula Pro' }));

      expect(await screen.findByRole('button', { name: 'Comunidad autónoma: Comunidad de Madrid' })).toBeTruthy();
      // Ya la ha elegido: nadie le vuelve a preguntar
      expect(screen.queryByRole('dialog', { name: 'Elige tu comunidad autónoma' })).toBeNull();
    });

    it('el perfil de ejemplo ya trae comunidad y no se le pregunta', async () => {
      const user = userEvent.setup();
      render(<I18nProvider><App /></I18nProvider>);
      await user.click(await screen.findByText('Explorar con datos de ejemplo'));

      expect(await screen.findByRole('button', { name: 'Comunidad autónoma: Comunitat Valenciana' })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Elige tu comunidad autónoma' })).toBeNull();
    });

    it('un perfil anterior sin comunidad ve el aviso una vez, y elegir la deja guardada', async () => {
      perfilAntiguo();
      const user = userEvent.setup();
      const first = render(<I18nProvider><App /></I18nProvider>);

      const aviso = await screen.findByRole('dialog', { name: 'Elige tu comunidad autónoma' });
      await user.selectOptions(screen.getByLabelText('Comunidad autónoma'), 'cataluna');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByRole('button', { name: 'Comunidad autónoma: Cataluña' })).toBeTruthy();
      expect(aviso.isConnected).toBe(false);

      // Al volver a abrir la app sigue elegida y no se pregunta de nuevo
      first.unmount();
      render(<I18nProvider><App /></I18nProvider>);
      expect(await screen.findByRole('button', { name: 'Comunidad autónoma: Cataluña' })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Elige tu comunidad autónoma' })).toBeNull();
    });

    it('«Ahora no» no se vuelve a preguntar, pero la barra lateral sigue invitando a elegirla', async () => {
      perfilAntiguo();
      const user = userEvent.setup();
      const first = render(<I18nProvider><App /></I18nProvider>);

      await screen.findByRole('dialog', { name: 'Elige tu comunidad autónoma' });
      await user.click(screen.getByRole('button', { name: 'Ahora no' }));
      expect(screen.queryByRole('dialog', { name: 'Elige tu comunidad autónoma' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Elige tu comunidad autónoma' })).toBeTruthy();

      first.unmount();
      render(<I18nProvider><App /></I18nProvider>);
      expect(await screen.findByRole('button', { name: 'Elige tu comunidad autónoma' })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Elige tu comunidad autónoma' })).toBeNull();
    });

    it('un valor raro en el perfil se trata como si no hubiera comunidad, sin romper', async () => {
      perfilAntiguo();
      const perfiles = JSON.parse(localStorage.getItem('aulapro_web_profiles')!);
      perfiles[0].community = 'atlantida';
      localStorage.setItem('aulapro_web_profiles', JSON.stringify(perfiles));
      render(<I18nProvider><App /></I18nProvider>);
      expect(await screen.findByRole('dialog', { name: 'Elige tu comunidad autónoma' })).toBeTruthy();
    });
  });

  it('todas las secciones se abren sin romperse', async () => {
    const user = userEvent.setup();
    const errores: unknown[] = [];
    const onError = (e: ErrorEvent) => errores.push(e.error ?? e.message);
    window.addEventListener('error', onError);

    render(<I18nProvider><App /></I18nProvider>);
    await user.click(await screen.findByText('Explorar con datos de ejemplo'));
    await screen.findByRole('button', { name: /Mis Clases/ });

    // El menú va por tareas: unas pantallas son entradas directas y otras
    // pestañas dentro de un apartado (Evaluar, Documentos, En clase).
    const h1 = async (nombre: string) =>
      expect((await screen.findAllByRole('heading', { level: 1 })).length, nombre).toBeGreaterThan(0);
    const menu = (nombre: string) => user.click(screen.getByRole('button', { name: new RegExp(`^${nombre}$`) }));

    for (const nombre of ['Mis Clases', 'Agenda', 'Cuaderno de Notas', 'Asistencia']) {
      await menu(nombre);
      await h1(nombre);
    }

    const apartados: [string, string[]][] = [
      ['Evaluar', ['Rúbricas', 'Diana competencial', 'Autoevaluaciones', 'Historial']],
      ['Documentos', ['Informes', 'Actas']],
      ['En clase', ['Distribución de aula', 'Sala de alumnos']],
    ];
    for (const [apartado, pestañas] of apartados) {
      await menu(apartado);
      for (const p of pestañas) {
        await user.click(await screen.findByRole('tab', { name: p }));
        await h1(`${apartado} → ${p}`);
      }
    }

    // «Más» empieza plegado
    await user.click(screen.getByRole('button', { name: /^Más/ }));
    for (const nombre of ['Reuniones', 'Formaciones', 'Trabajo compartido', 'Registro de cambios', 'Configuración']) {
      await menu(nombre);
      await h1(nombre);
    }
    window.removeEventListener('error', onError);
    expect(errores).toEqual([]);
  }, 30_000);
});
