import { describe, it, expect, vi, afterEach } from 'vitest';
import { abrirClaveIA, cerrarClaveIA, claveCambiada, suscribirClaveIA, ventanaClaveAbierta, versionDeClave } from './claveIA';

afterEach(() => cerrarClaveIA());

describe('la ventana de la clave de la IA y los avisos de cambio', () => {
  it('abrir y cerrar avisan una vez, y repetir lo mismo no avisa', () => {
    const oyente = vi.fn();
    const soltar = suscribirClaveIA(oyente);
    expect(ventanaClaveAbierta()).toBe(false);
    abrirClaveIA();
    abrirClaveIA();
    expect(ventanaClaveAbierta()).toBe(true);
    expect(oyente).toHaveBeenCalledTimes(1);
    cerrarClaveIA();
    cerrarClaveIA();
    expect(ventanaClaveAbierta()).toBe(false);
    expect(oyente).toHaveBeenCalledTimes(2);
    soltar();
  });

  it('un cambio de clave avisa a quien escucha y cambia la versión, para que las pantallas se vuelvan a pintar', () => {
    const oyente = vi.fn();
    const soltar = suscribirClaveIA(oyente);
    const antes = versionDeClave();
    claveCambiada();
    expect(versionDeClave()).toBe(antes + 1);
    expect(oyente).toHaveBeenCalledTimes(1);
    soltar();
    claveCambiada();
    expect(oyente).toHaveBeenCalledTimes(1);
  });

  it('un oyente que se da de baja mientras se avisa no rompe el aviso a los demás', () => {
    const b = vi.fn();
    const soltarA = suscribirClaveIA(() => soltarA());
    const soltarB = suscribirClaveIA(b);
    claveCambiada();
    expect(b).toHaveBeenCalledTimes(1);
    soltarB();
  });
});
