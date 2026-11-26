// @vitest-environment jsdom
/**
 * La galería de los juegos (26-11-2026): el filtro por área, los juegos que se abren y los «Próximamente» de las áreas
 * que aún no tienen sus dos juegos; y el catálogo, del que sale todo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { GaleriaJuegos, VentanaJuegos } from './GaleriaJuegos';
import { I18nProvider } from '../../i18n';
import { AREAS, JUEGOS, POR_AREA, tarjetasDeGaleria } from '../../lib/juegos/catalogo';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('el catálogo', () => {
  it('cada juego tiene un id único, un área que existe, tramos y su componente', () => {
    expect(new Set(JUEGOS.map(j => j.id)).size).toBe(JUEGOS.length);
    for (const j of JUEGOS) {
      expect(AREAS.some(a => a.id === j.area)).toBe(true);
      expect(j.tramos.length).toBeGreaterThan(0);
      expect(typeof j.cargar).toBe('function');
    }
  });
  it('con todas las áreas, primero los juegos y después un «Próximamente» por cada juego que falta', () => {
    const t = tarjetasDeGaleria('todas');
    expect(t.filter(x => x.tipo === 'juego')).toHaveLength(JUEGOS.length);
    // Una tarjeta «Próximamente» por área a la que le faltan juegos, con cuántos
    const pronto = t.filter(x => x.tipo === 'pronto');
    expect(pronto.map(x => x.tipo === 'pronto' && [x.area, x.faltan])).toEqual([['castellano', POR_AREA], ['valenciano', POR_AREA], ['ingles', POR_AREA], ['ciencias', POR_AREA]]);
    expect(t.findIndex(x => x.tipo === 'pronto')).toBe(JUEGOS.length);
    expect(tarjetasDeGaleria('matematicas').every(x => x.tipo === 'juego')).toBe(true);
    expect(tarjetasDeGaleria('ingles').every(x => x.tipo === 'pronto')).toBe(true);
  });
});

describe('la galería', () => {
  it('filtra por área, abre un juego y los «Próximamente» no se pueden abrir', () => {
    const onJugar = vi.fn();
    render(<I18nProvider><GaleriaJuegos onJugar={onJugar} /></I18nProvider>);
    const filtro = within(screen.getByRole('radiogroup', { name: 'Área' }));
    expect(filtro.getAllByRole('radio').map(r => r.textContent)).toEqual(['Todas', 'Matemáticas', 'Lengua castellana', 'Valenciano', 'Inglés', 'Ciencias']);
    fireEvent.click(screen.getByRole('button', { name: /La recta numérica/ }));
    expect(onJugar).toHaveBeenCalledWith(expect.objectContaining({ id: 'recta' }));
    expect(screen.getAllByText('Próximamente')).toHaveLength(4);
    fireEvent.click(filtro.getByRole('radio', { name: 'Inglés' }));
    expect(screen.queryByRole('button', { name: /Tirar de la cuerda/ })).toBeNull();
    expect(screen.getAllByText('Próximamente')).toHaveLength(1);
    expect(screen.getByText('2 juegos nuevos de esta área, para todos los cursos.')).toBeTruthy();
    // El filtro se recuerda en el dispositivo
    expect(localStorage.getItem('aulapro_juegos_area')).toBe('ingles');
  });

  it('en una ventana (la pizarra) se cierra con la X y con Escape', () => {
    const onCerrar = vi.fn();
    render(<I18nProvider><VentanaJuegos onJugar={vi.fn()} onCerrar={onCerrar} /></I18nProvider>);
    expect(screen.getByRole('dialog', { name: 'Juegos para la clase' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});
