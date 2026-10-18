// @vitest-environment jsdom
/**
 * La ruleta recuerda quién ha salido en cada clase hasta que se reinicia la lista
 * (decisión del dueño, 18-10-2026).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import SecClassroom from './SecClassroom';
import { I18nProvider } from '../i18n';
import { leerSalidos } from '../lib/ruleta';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const clases = [
  { id: 'c1', name: '1º A', nombres: ['Ana', 'Biel', 'Carla'] },
  { id: 'c2', name: '1º B', nombres: ['Dani', 'Eva'] },
];

const abrir = (claseInicial = 'c1') => render(
  <I18nProvider><SecClassroom clases={clases} claseInicial={claseInicial} /></I18nProvider>,
);

/** Gira la ruleta y espera a que termine y a que se vea el resultado. */
async function girar() {
  fireEvent.click(screen.getByRole('button', { name: 'GIRAR' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(4200); });
  // El resultado espera a que salga el texto anterior (AnimatePresence): tarda un poco más
  for (let i = 0; i < 10 && !screen.queryByText('Volver a meter en el sorteo'); i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  // jsdom no trae ResizeObserver ni lienzo, y la pizarra usa los dos
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(async () => {
  cleanup();
  // framer-motion deja un fotograma pendiente en su reloj: si los temporizadores falsos se quitan sin vaciarlo,
  // las animaciones de la prueba siguiente no avanzan nunca
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Ruleta con memoria', () => {
  it('quien sale queda guardado en su clase y, al reabrir, no vuelve a estar en el sorteo', async () => {
    abrir();
    await girar();
    expect(leerSalidos('c1')).toHaveLength(1);
    expect(screen.getByText('Quedan 2 por salir')).toBeTruthy();
    expect(leerSalidos('c2')).toEqual([]);

    cleanup();
    abrir();
    expect(screen.getByText(/Quedan 2 de 3/)).toBeTruthy();
  });

  it('nadie repite: tras tres giros han salido los tres y aparece el aviso de reiniciar', async () => {
    abrir();
    await girar();
    await girar();
    await girar();
    expect([...leerSalidos('c1')].sort()).toEqual(['Ana', 'Biel', 'Carla']);
    fireEvent.click(screen.getByRole('button', { name: 'GIRAR' }));
    expect(screen.getByText('Ya han salido todos. Reinicia para volver a empezar.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Reiniciar lista/ }));
    expect(leerSalidos('c1')).toEqual([]);
    expect(screen.getByText('3 participantes')).toBeTruthy();
  });

  it('«Volver a meter en el sorteo» devuelve a quien acaba de salir', async () => {
    abrir();
    await girar();
    fireEvent.click(screen.getByText('Volver a meter en el sorteo'));
    expect(leerSalidos('c1')).toEqual([]);
  });

  it('cada clase tiene su propia lista', () => {
    localStorage.setItem('aulapro_ruleta_c1', JSON.stringify(['Ana', 'Biel']));
    abrir('c2');
    expect(screen.getByText('2 participantes')).toBeTruthy();
  });
});
