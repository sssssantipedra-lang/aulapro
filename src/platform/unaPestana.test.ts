// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { olvidarPestana, PESTANA_PERDIDA, pestanaPerdida, reservarPestana, tomarPestana } from './unaPestana';

/** Un gestor de cerrojos como el del navegador (Web Locks): uno a la vez, con espera, abandono por señal y «steal». */
function gestorFalso() {
  let dueno: ((e: unknown) => void) | null = null;
  const request = (nombre: string, opciones: LockOptions, cb: (l: Lock | null) => unknown) => new Promise((resolve, reject) => {
    const conceder = () => {
      dueno = reject;
      Promise.resolve(cb({ name: nombre, mode: 'exclusive' } as Lock)).then(resolve, reject);
    };
    if (opciones.steal) {
      const anterior = dueno;
      dueno = null;
      anterior?.(new DOMException('Se lo ha quedado otra pestaña', 'AbortError'));
      conceder();
      return;
    }
    if (!dueno) { conceder(); return; }
    opciones.signal?.addEventListener('abort', () => reject(new DOMException('Sin esperar más', 'AbortError')));
  });
  return { request } as unknown as Pick<LockManager, 'request'>;
}

beforeEach(() => olvidarPestana());

describe('una sola pestaña con AulaPro (auditoría del 1-11-2026)', () => {
  it('la primera pestaña se queda la app; la segunda, tras esperar un poco, no', async () => {
    const gestor = gestorFalso();
    expect(await reservarPestana(50, gestor)).toBe(true);
    expect(await reservarPestana(50, gestor)).toBe(false);
  });

  it('«Usar aquí» se queda la app y la otra pestaña recibe el aviso para dejar de guardar', async () => {
    const gestor = gestorFalso();
    const aviso = vi.fn();
    window.addEventListener(PESTANA_PERDIDA, aviso);
    expect(await reservarPestana(50, gestor)).toBe(true);
    expect(await tomarPestana(gestor)).toBe(true);
    await vi.waitFor(() => expect(aviso).toHaveBeenCalledTimes(1));
    expect(pestanaPerdida()).toBe(true);
    window.removeEventListener(PESTANA_PERDIDA, aviso);
  });

  it('sin Web Locks (navegadores antiguos) todo sigue como antes: la app se abre', async () => {
    expect(await reservarPestana(50, undefined)).toBe(true);
    expect(await tomarPestana(undefined)).toBe(true);
  });
});
