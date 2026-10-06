// @vitest-environment jsdom
/**
 * El selector de comunidad y el aviso a los perfiles antiguos. Los currículos
 * autonómicos que hay copiados cambian con el tiempo, así que aquí se fija
 * cuáles hay para probar los tres casos: ninguno, solo una etapa y las dos.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CommunitySelect } from './CommunitySelect';
import { CommunityPrompt } from './CommunityPrompt';
import { I18nProvider } from '../i18n';
import type { ComunidadId } from '../lib/curriculum/comunidades';

vi.mock('../lib/curriculum/propios', async importOriginal => {
  const original = await importOriginal<typeof import('../lib/curriculum/propios')>();
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

  it('en dos grupos: con decreto autonómico actualizado (con la etapa si es solo una) y con el estatal', () => {
    render(<I18nProvider><Selector /></I18nProvider>);
    const grupos = screen.getAllByRole('group');
    expect(grupos.map(g => g.getAttribute('label'))).toEqual([
      'Decreto autonómico actualizado', 'Decreto estatal (RD 157/2022 y RD 217/2022)',
    ]);
    expect(within(grupos[0]).getAllByRole('option').map(o => o.textContent)).toEqual(['Cataluña', 'Comunidad de Madrid (Primaria)']);
    const estatales = within(grupos[1]).getAllByRole('option').map(o => o.textContent);
    expect(estatales).toHaveLength(18);
    expect(estatales[0]).toBe('Andalucía');
    expect(estatales.at(-1)).toBe('Fuera de España / no aplica');
    expect(screen.queryByText(/próximamente/)).toBeNull();
  });

  it('sin elegir no dice nada; al elegir cuenta de qué decreto sale cada etapa', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><Selector /></I18nProvider>);
    const select = screen.getByRole('combobox');
    expect(screen.queryByText(/currículo|Decreto/i)).toBeNull();

    await user.selectOptions(select, 'madrid');
    expect(screen.getByText('Comunidad de Madrid: decreto autonómico actualizado en Primaria.')).toBeTruthy();
    expect(screen.getByText('Primaria: Decreto 61/2022, de 13 de julio, modificado por Decreto 59/2024, de 12 de junio.')).toBeTruthy();
    expect(screen.getByText('ESO: currículo estatal, Real Decreto 217/2022, de 29 de marzo.')).toBeTruthy();

    // Sin «todavía» ni «más adelante»: sigue el estatal, con sus reales decretos
    await user.selectOptions(select, 'andalucia');
    expect(screen.getByText('Andalucía sigue el currículo estatal.')).toBeTruthy();
    expect(screen.getByText('Primaria: Real Decreto 157/2022, de 1 de marzo.')).toBeTruthy();
    expect(screen.getByText('ESO: Real Decreto 217/2022, de 29 de marzo.')).toBeTruthy();
    expect(screen.queryByText(/todavía|más adelante|por ahora/)).toBeNull();

    await user.selectOptions(select, 'fuera');
    expect(screen.getByText('Currículo estatal.')).toBeTruthy();
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
