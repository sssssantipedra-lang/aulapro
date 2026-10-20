// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const saveData = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/storage', async () => {
  const real = await vi.importActual<typeof import('../services/storage')>('../services/storage');
  return {
    ...real,
    getActiveProfileId: () => 'p1',
    setActiveProfileId: () => {},
    listProfiles: async () => [{ id: 'p1', name: 'Profesor', school: '', subject: '', course: '', createdAt: '2026-01-01', lastOpenedAt: '2026-01-01' }],
    loadData: async () => ({ tasks: [{ id: 't1', text: 'Corregir', priority: 'high', done: false }] }),
    saveData: (...a: unknown[]) => saveData(...a),
    touchProfile: async () => {},
    backup: async () => {},
  };
});
const { useAppState } = await import('./useAppState');

beforeEach(() => { saveData.mockClear(); });

describe('app en solo lectura (licencia anual caducada)', () => {
  it('no guarda nada y deshace cualquier cambio avisando', async () => {
    const onBloqueado = vi.fn();
    const { result } = renderHook(() => useAppState({ soloLectura: true, onBloqueado }));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    await new Promise(r => setTimeout(r, 400)); // la referencia se toma tras lo cargado
    act(() => { result.current.addTask('Algo nuevo', 'low'); });
    await waitFor(() => expect(onBloqueado).toHaveBeenCalled());
    expect(result.current.tasks.map(t => t.text)).toEqual(['Corregir']);
    await new Promise(r => setTimeout(r, 1000));
    expect(saveData).not.toHaveBeenCalled();
  });

  it('con licencia, los cambios se guardan como siempre', async () => {
    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    act(() => { result.current.addTask('Algo nuevo', 'low'); });
    await waitFor(() => expect(saveData).toHaveBeenCalled(), { timeout: 3000 });
    expect(result.current.tasks).toHaveLength(2);
  });
});
