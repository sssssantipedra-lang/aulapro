// @vitest-environment jsdom
/**
 * El cupo de hoy de cada modelo (16-11-2026): la app solo sabe lo que Google le ha dicho (agotado hasta las 9:00),
 * no cuánto queda; lo dice así y enlaza con AI Studio para la cifra exacta.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { CupoModelos } from './CupoModelos';
import { AI_STUDIO_USO_URL, cupoAgotadoHasta, nextDailyReset } from '../services/gemini';

afterEach(() => { cleanup(); localStorage.clear(); });

const agotar = (modelo: string, hasta: number) => {
  const c = JSON.parse(localStorage.getItem('aulapro_model_cooldown') ?? '{}');
  c[modelo] = hasta;
  localStorage.setItem('aulapro_model_cooldown', JSON.stringify(c));
};

describe('Cupo de hoy de cada modelo', () => {
  it('los tres modelos de la SdA, disponibles o agotados hasta que se renueva, y el enlace a AI Studio', () => {
    agotar('gemini-4-hydrogen', nextDailyReset());
    agotar('gemini-3.8-flash', Date.now() + 30_000);   // una pausa por minuto no es «agotado»
    render(<I18nProvider><CupoModelos /></I18nProvider>);
    const filas = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(filas[0]).toMatch(/^Gemini 4 HydrogenAgotado hasta las \d{1,2}:\d{2}/);
    expect(filas.slice(1)).toEqual(['Gemini 3.8 FlashDisponible', 'Gemini 3.5 Flash-LiteDisponible']);
    expect(screen.getByText(/Google no dice cuántas peticiones quedan/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver mi uso exacto en Google AI Studio/ }).getAttribute('href')).toBe(AI_STUDIO_USO_URL);
  });

  it('pasada la hora, deja de estar agotado', () => {
    agotar('gemini-4-hydrogen', Date.now() - 1000);
    expect(cupoAgotadoHasta('gemini-4-hydrogen')).toBeNull();
  });
});
