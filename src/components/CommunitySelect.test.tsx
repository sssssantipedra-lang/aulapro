// @vitest-environment jsdom
/**
 * El selector de comunidad y el aviso a los perfiles antiguos. Los currículos
 * autonómicos que hay copiados cambian con el tiempo, así que aquí se fija
 * cuáles hay para probar los tres casos: ninguno, solo una etapa y las dos.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CommunitySelect } from './CommunitySelect';
import { CommunityPrompt } from './CommunityPrompt';
import { I18nProvider } from '../i18n';
import type { ComunidadId } from '../lib/curriculum/comunidades';

vi.mock('../lib/curriculum/cargar', async importOriginal => {
  const original = await importOriginal<typeof import('../lib/curriculum/cargar')>();
  return {
    ...original,
    etapasConCurriculoPropio: (id: string) =>
      id === 'cataluna' ? ['primaria', 'eso'] : id === 'madrid' ? ['primaria'] : [],
  };
});

afterEach(() => { cleanup(); localStorage.clear(); });

function Selector() {
  const [v, setV] = useState<ComunidadId | ''>('');
  return <CommunitySelect id="c" value={v} onChange={setV} />;
}

describe('selector de comunidad', () => {
  it('ofrece las 19 comunidades y «Fuera de España», con «Fuera de España» la última', () => {
    render(<I18nProvider><Selector /></I18nProvider>);
    const opciones = screen.getAllByRole('option');
    // La primera es el «Elige tu comunidad…»
    expect(opciones).toHaveLength(1 + 20);
    expect(opciones[opciones.length - 1].textContent).toBe('Fuera de España / no aplica');
  });

  it('marca «próximamente» las que aún no tienen su decreto, y no las que sí', () => {
    render(<I18nProvider><Selector /></I18nProvider>);
    expect(screen.getByRole('option', { name: 'Andalucía · próximamente' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Cataluña' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Fuera de España / no aplica' })).toBeTruthy();
  });

  it('sin elegir no dice nada; al elegir cuenta qué currículo se va a usar', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><Selector /></I18nProvider>);
    const select = screen.getByRole('combobox');
    expect(screen.queryByText(/currículo/i)).toBeNull();

    await user.selectOptions(select, 'cataluna');
    expect(screen.getByText('Cataluña: currículo oficial disponible en Primaria y ESO.')).toBeTruthy();

    await user.selectOptions(select, 'madrid');
    expect(screen.getByText('Comunidad de Madrid: currículo oficial disponible en Primaria; en ESO se usa el estatal por ahora.')).toBeTruthy();

    await user.selectOptions(select, 'andalucia');
    expect(screen.getByText(/Andalucía: todavía no tenemos su decreto\. Mientras tanto se usa el currículo estatal/)).toBeTruthy();

    await user.selectOptions(select, 'fuera');
    expect(screen.getByText('Se usa el currículo estatal (LOMLOE).')).toBeTruthy();
  });
});

describe('aviso a los perfiles sin comunidad', () => {
  it('no deja guardar hasta elegir una', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<I18nProvider><CommunityPrompt onChoose={onChoose} onLater={() => {}} /></I18nProvider>);

    const guardar = screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;
    expect(guardar.disabled).toBe(true);

    await user.selectOptions(screen.getByLabelText('Comunidad autónoma'), 'madrid');
    expect(guardar.disabled).toBe(false);
    await user.click(guardar);
    expect(onChoose).toHaveBeenCalledWith('madrid');
  });

  it('«Ahora no» y cerrar con Escape lo dejan para después', async () => {
    const user = userEvent.setup();
    const onLater = vi.fn();
    render(<I18nProvider><CommunityPrompt onChoose={() => {}} onLater={onLater} /></I18nProvider>);

    await user.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(onLater).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onLater).toHaveBeenCalledTimes(2);
  });

  it('avisa de que mientras no elija se usa el estatal', () => {
    render(<I18nProvider><CommunityPrompt onChoose={() => {}} onLater={() => {}} /></I18nProvider>);
    expect(screen.getByText(/Hasta que la elijas se usa el currículo estatal/)).toBeTruthy();
  });
});
