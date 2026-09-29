// @vitest-environment jsdom
/**
 * Configuración: una cuadrícula de tarjetas que se abren al pulsarlas y se
 * cierran con «← Configuración»; los avisos de la IA abren directamente la
 * tarjeta de la clave.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profile } from './Profile';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { requestSettingsPanel } from '../lib/settingsNav';

afterEach(cleanup);
beforeAll(() => { window.scrollTo = () => {}; });

function setup() {
  render(
    <I18nProvider>
      <ToastProvider>
        <Profile
          user={{ id: 'u', full_name: 'Ana García', school: 'IES Ejemplo', subject: 'Matemáticas' } as never}
          profile={null} profileId="p1" course="2026-2027"
          onUpdateUser={() => {}} onUpdateSecurity={() => {}} onExportData={() => ({})} onImportData={() => null} onClearSchoolYear={async () => {}}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('Configuración', () => {
  it('muestra las tarjetas y cada una abre su apartado', async () => {
    setup();
    for (const name of ['Perfil', 'Clave de la IA', 'Idioma', 'Apariencia', 'Seguridad', 'Datos y copias']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeTruthy();
    }
    await userEvent.click(screen.getByRole('button', { name: /Perfil/ }));
    expect(screen.getByLabelText('Nombre')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Configuración/ }));
    await userEvent.click(screen.getByRole('button', { name: /Seguridad/ }));
    expect(screen.getByRole('button', { name: /Fijar contraseña/ })).toBeTruthy();
  });

  it('un aviso de la IA abre directamente la clave', () => {
    requestSettingsPanel('ia');
    setup();
    expect(screen.getByRole('button', { name: /Pegar mi clave/ })).toBeTruthy();
  });
});
