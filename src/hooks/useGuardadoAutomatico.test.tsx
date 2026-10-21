// @vitest-environment jsdom
/**
 * Guardado automático: escribe tras una pausa, no repite lo ya guardado y, para
 * no perder lo hecho en esa pausa, escribe al instante al cerrar la ventana,
 * al ocultarse la página y al cambiar de perfil.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGuardadoAutomatico } from './useGuardadoAutomatico';

const guardar = vi.fn(async () => {});

// Sin crypto.subtle la huella es el propio texto y se calcula al instante: así los temporizadores falsos lo controlan todo
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('crypto', {}); guardar.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const montar = (inicial: { ready: boolean; profileId: string | null; snapshot: object }) =>
  renderHook((p: typeof inicial) => useGuardadoAutomatico({ ...p, guardar, retardo: 700 }), { initialProps: inicial });

/** Espera a que la primera escritura termine (la huella se calcula con crypto, fuera de los temporizadores falsos) y la olvida. */
const primeraEscritura = async () => {
  await pasar(800);
  await vi.waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
  guardar.mockClear();
};

/** Deja correr el temporizador y la huella asíncrona. */
const pasar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('guardado automático', () => {
  it('escribe tras la pausa, una sola vez por tanda de cambios, y no repite lo ya guardado', async () => {
    const { rerender } = montar({ ready: true, profileId: 'p1', snapshot: { n: 1 } });
    await pasar(699);
    expect(guardar).not.toHaveBeenCalled();
    await pasar(5);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenLastCalledWith('p1', { n: 1 });

    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 3 } });
    await pasar(800);
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenLastCalledWith('p1', { n: 3 });

    // Un objeto nuevo con lo mismo no se vuelve a escribir
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 3 } });
    await pasar(800);
    expect(guardar).toHaveBeenCalledTimes(2);
  });

  it('sin perfil cargado no escribe nada', async () => {
    montar({ ready: false, profileId: 'p1', snapshot: { n: 1 } });
    await pasar(2000);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('un cambio hecho dentro de la pausa se escribe al cerrar la ventana', async () => {
    const { rerender } = montar({ ready: true, profileId: 'p1', snapshot: { n: 1 } });
    await primeraEscritura();
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    await pasar(100);
    expect(guardar).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(guardar).toHaveBeenCalledOnce();
    expect(guardar).toHaveBeenCalledWith('p1', { n: 2 });
    // Y no se escribe otra vez cuando vence el temporizador
    await pasar(1000);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('al pasar la página a segundo plano también se escribe, pero no al volver a verla', async () => {
    const { rerender } = montar({ ready: true, profileId: 'p1', snapshot: { n: 1 } });
    await primeraEscritura();
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    const estado = vi.spyOn(document, 'visibilityState', 'get');
    estado.mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(guardar).not.toHaveBeenCalled();
    estado.mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(guardar).toHaveBeenCalledWith('p1', { n: 2 });
    estado.mockRestore();
  });

  it('al cambiar de perfil, lo que quedaba por escribir va al perfil de donde salió', async () => {
    const { rerender } = montar({ ready: true, profileId: 'p1', snapshot: { n: 1 } });
    await primeraEscritura();
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    await pasar(50);
    rerender({ ready: false, profileId: 'p2', snapshot: { n: 2 } });
    expect(guardar).toHaveBeenCalledWith('p1', { n: 2 });
    expect(guardar).not.toHaveBeenCalledWith('p2', expect.anything());
  });

  it('al desmontar escribe lo pendiente', async () => {
    const { rerender, unmount } = montar({ ready: true, profileId: 'p1', snapshot: { n: 1 } });
    await primeraEscritura();
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 9 } });
    unmount();
    expect(guardar).toHaveBeenCalledWith('p1', { n: 9 });
  });
});
