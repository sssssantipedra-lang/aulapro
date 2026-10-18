// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aplicarTamanoLetra, getTamanoLetra, restaurarTamanoLetra, FACTOR_TAMANO } from './tamanoLetra';

beforeEach(() => { localStorage.clear(); document.documentElement.style.zoom = ''; });
afterEach(() => { delete window.electronAPI; });

describe('tamaño de las letras', () => {
  it('por defecto es estándar, y solo «grande» se recuerda como grande', () => {
    expect(getTamanoLetra()).toBe('estandar');
    localStorage.setItem('aulapro_tamano_letra', 'enorme');
    expect(getTamanoLetra()).toBe('estandar');
    aplicarTamanoLetra('grande');
    expect(getTamanoLetra()).toBe('grande');
  });

  it('sin puente nativo usa el zoom de CSS y vuelve a quitarlo', () => {
    aplicarTamanoLetra('grande');
    expect(document.documentElement.style.zoom).toBe(String(FACTOR_TAMANO.grande));
    aplicarTamanoLetra('estandar');
    expect(document.documentElement.style.zoom).toBe('');
  });

  it('con puente nativo (Android o Electron) le pasa el factor y no toca el CSS', () => {
    const setTextScale = vi.fn().mockResolvedValue(undefined);
    window.electronAPI = { isDesktop: true, platform: 'win32', version: '', app: { setTextScale } };
    aplicarTamanoLetra('grande');
    expect(setTextScale).toHaveBeenCalledWith(FACTOR_TAMANO.grande);
    aplicarTamanoLetra('estandar');
    expect(setTextScale).toHaveBeenLastCalledWith(1);
    expect(document.documentElement.style.zoom).toBe('');
  });

  it('un fallo del puente no rompe nada', () => {
    window.electronAPI = { isDesktop: false, platform: 'android', version: '', app: { setTextScale: () => Promise.reject(new Error('no')) } };
    expect(() => aplicarTamanoLetra('grande')).not.toThrow();
  });

  it('al abrir la app solo se toca si se había elegido grande', () => {
    const setTextScale = vi.fn();
    window.electronAPI = { isDesktop: true, platform: 'win32', version: '', app: { setTextScale } };
    restaurarTamanoLetra();
    expect(setTextScale).not.toHaveBeenCalled();
    localStorage.setItem('aulapro_tamano_letra', 'grande');
    restaurarTamanoLetra();
    expect(setTextScale).toHaveBeenCalledWith(FACTOR_TAMANO.grande);
  });
});
