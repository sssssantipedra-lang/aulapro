// @vitest-environment jsdom
/**
 * Guardado automático: escribe tras una pausa, no repite lo ya guardado y, para
 * no perder lo hecho en esa pausa, escribe al instante al cerrar la ventana,
 * al ocultarse la página y al cambiar de perfil.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { REINTENTO_GUARDADO_MS, useGuardadoAutomatico } from './useGuardadoAutomatico';
import { bloquearGuardado } from '../lib/guardadoBloqueado';

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

/**
 * Auditoría del 5-11-2026: lo que se escribe al salir de un perfil (al cambiar a otro o al cerrarlo) puede fallar, y
 * entonces no quedaba nada que lo reintentara: el temporizador se había cancelado y el siguiente perfil ocupaba su
 * sitio. Dentro del mismo perfil no hacía falta: el temporizador pendiente ya volvía a intentarlo.
 */
describe('cuando falla la escritura al salir de un perfil', () => {
  it('al cerrar el perfil con un fallo al escribir, se vuelve a intentar solo', async () => {
    let falla = false;
    const guardarQueFalla = vi.fn(async () => { if (falla) throw new Error('fallo'); });
    const { result, rerender } = renderHook((p: { ready: boolean; profileId: string | null; snapshot: object }) => useGuardadoAutomatico({ ...p, guardar: guardarQueFalla, retardo: 700 }), { initialProps: { ready: true, profileId: 'p1' as string | null, snapshot: { n: 1 } } });
    await pasar(800);
    await vi.waitFor(() => expect(guardarQueFalla).toHaveBeenCalledTimes(1));
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    falla = true;
    rerender({ ready: true, profileId: null, snapshot: { n: 2 } });
    expect(guardarQueFalla).toHaveBeenCalledTimes(2);
    expect(guardarQueFalla).toHaveBeenLastCalledWith('p1', { n: 2 });
    await vi.waitFor(() => expect(result.current.errorGuardado).toBe('otro'));
    falla = false;
    await pasar(REINTENTO_GUARDADO_MS + 10);
    await vi.waitFor(() => expect(guardarQueFalla).toHaveBeenCalledTimes(3));
    expect(guardarQueFalla).toHaveBeenLastCalledWith('p1', { n: 2 });
  });

  it('si al cambiar de perfil falla la escritura del anterior, se escribe al abrir el nuevo, y a su perfil', async () => {
    let falla = false;
    const guardarQueFalla = vi.fn<(id: string, datos: object) => Promise<void>>(async () => { if (falla) throw new Error('fallo'); });
    const { rerender } = renderHook((p: { ready: boolean; profileId: string; snapshot: object }) => useGuardadoAutomatico({ ...p, guardar: guardarQueFalla, retardo: 700 }), { initialProps: { ready: true, profileId: 'p1', snapshot: { n: 1 } as object } });
    await pasar(800);
    await vi.waitFor(() => expect(guardarQueFalla).toHaveBeenCalledTimes(1));
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    falla = true;
    rerender({ ready: false, profileId: 'p2', snapshot: { n: 2 } });
    expect(guardarQueFalla).toHaveBeenCalledTimes(2);
    expect(guardarQueFalla).toHaveBeenLastCalledWith('p1', { n: 2 });
    await act(async () => {}); // el fallo llega (es asíncrono)
    falla = false;
    // Se abre el perfil nuevo: lo que quedó del anterior se escribe antes, y a su perfil
    rerender({ ready: true, profileId: 'p2', snapshot: { m: 1 } });
    expect(guardarQueFalla).toHaveBeenCalledTimes(3);
    expect(guardarQueFalla).toHaveBeenLastCalledWith('p1', { n: 2 });
    await pasar(800);
    await vi.waitFor(() => expect(guardarQueFalla).toHaveBeenLastCalledWith('p2', { m: 1 }));
    expect(guardarQueFalla.mock.calls.filter(c => c[0] === 'p2' && JSON.stringify(c[1]) === '{"n":2}')).toHaveLength(0);
  });
});

/**
 * Auditoría del 1-11-2026: si el navegador no deja guardar (sin espacio, o falla), se avisa en pantalla y se vuelve a
 * intentar solo; antes el error se perdía y el docente seguía trabajando sin que se guardara nada.
 */
describe('cuando no se puede guardar', () => {
  it('avisa del motivo, vuelve a intentarlo solo y quita el aviso al conseguirlo', async () => {
    let falla = true;
    const guardarQueFalla = vi.fn(async () => { if (falla) throw new DOMException('lleno', 'QuotaExceededError'); });
    const { result } = renderHook(() => useGuardadoAutomatico({ ready: true, profileId: 'p1', snapshot: { n: 1 }, guardar: guardarQueFalla, retardo: 700 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(result.current.errorGuardado).toBe('espacio');
    expect(result.current.saving).toBe(false);
    falla = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(REINTENTO_GUARDADO_MS + 800); });
    expect(guardarQueFalla).toHaveBeenCalledTimes(2);
    expect(result.current.errorGuardado).toBeNull();
  });

  it('con el guardado bloqueado (otra pestaña tiene la app) no escribe nada, ni al cerrar', async () => {
    const { rerender } = montar({ ready: true, profileId: 'p1', snapshot: { n: 1 } });
    await primeraEscritura();
    bloquearGuardado();
    rerender({ ready: true, profileId: 'p1', snapshot: { n: 2 } });
    await pasar(800);
    window.dispatchEvent(new Event('pagehide'));
    expect(guardar).not.toHaveBeenCalled();
  });
});
