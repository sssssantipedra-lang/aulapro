// @vitest-environment jsdom
/**
 * Crear el primer perfil: se elige si es docente de aula o de PT y AL. El de
 * PT y AL marca su especialidad (al menos una) y se escribe sola.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Welcome } from './Welcome';
import { I18nProvider } from '../i18n';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });

async function abrir() {
  const onCreateProfile = vi.fn(async () => {});
  const onExploreDemo = vi.fn();
  render(<I18nProvider><Welcome onOpenProfile={() => {}} onCreateProfile={onCreateProfile} onExploreDemo={onExploreDemo} /></I18nProvider>);
  await screen.findByRole('radiogroup');
  return { onCreateProfile, onExploreDemo };
}

describe('crear el perfil', () => {
  it('por defecto es docente de aula, con su especialidad escrita a mano', async () => {
    const user = userEvent.setup();
    const { onCreateProfile } = await abrir();
    expect(screen.getByRole('radio', { name: /Docente de aula/ }).getAttribute('aria-checked')).toBe('true');
    await user.type(screen.getByLabelText('Tu nombre *'), 'Ana García');
    await user.type(screen.getByLabelText('Especialidad'), 'Matemáticas');
    await user.selectOptions(screen.getByLabelText('Comunidad autónoma *'), 'madrid');
    await user.click(screen.getByRole('button', { name: 'Empezar a usar Aula Pro' }));
    expect(onCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana García', subject: 'Matemáticas', community: 'madrid' }), expect.anything());
    expect((onCreateProfile.mock.calls[0] as unknown[])[0]).not.toHaveProperty('especialidades');
  });

  it('PT y AL pide la especialidad y la escribe sola', async () => {
    const user = userEvent.setup();
    const { onCreateProfile } = await abrir();
    await user.click(screen.getByRole('radio', { name: /PT y AL/ }));
    // Su especialidad no se escribe a mano
    expect(screen.queryByLabelText('Especialidad')).toBeNull();
    await user.type(screen.getByLabelText('Tu nombre *'), 'Laura Martí');
    await user.selectOptions(screen.getByLabelText('Comunidad autónoma *'), 'comunitat-valenciana');
    await user.click(screen.getByRole('button', { name: 'Empezar a usar Aula Pro' }));
    expect(screen.getByText('Marca si eres de PT, de AL o de las dos.')).toBeTruthy();
    expect(onCreateProfile).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: 'Audición y Lenguaje (AL)' }));
    await user.click(screen.getByRole('button', { name: 'Empezar a usar Aula Pro' }));
    expect(onCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Laura Martí', subject: 'Audición y Lenguaje', especialidades: ['AL'] }), expect.anything());
  });

  it('el ejemplo sigue al tipo elegido', async () => {
    const user = userEvent.setup();
    const { onExploreDemo } = await abrir();
    await user.click(screen.getByRole('radio', { name: /PT y AL/ }));
    await user.click(screen.getByRole('button', { name: /Explorar con datos de ejemplo/ }));
    expect(onExploreDemo).toHaveBeenCalledWith(expect.objectContaining({ especialidades: ['PT', 'AL'] }));
  });
});
