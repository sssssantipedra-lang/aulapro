// @vitest-environment jsdom
/**
 * Auditoría del 5-11-2026: un perfil guardado por una versión más nueva de AulaPro (en otro dispositivo) puede traer
 * partes que esta versión no conoce. Al guardar se conservan tal cual: antes se perdían, y de ahí a la nube y al otro
 * dispositivo, donde la versión nueva las echaba en falta.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { clavesDesconocidas, useAppState } from './useAppState';

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('crypto', {}); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('partes del perfil que esta versión no conoce', () => {
  it('clavesDesconocidas: lo que no es del perfil de esta versión, sin los huecos', () => {
    expect(clavesDesconocidas({ classes: [], novedad: { x: 1 }, otra: undefined })).toEqual({ novedad: { x: 1 } });
  });

  it('sobreviven a abrir el perfil y guardarlo', async () => {
    const perfil = { id: 'p1', name: 'Profesor', school: '', subject: '', course: '', createdAt: '2026-11-05T00:00:00Z', lastOpenedAt: '2026-11-05T00:00:00Z' };
    localStorage.setItem('aulapro_web_profiles', JSON.stringify([perfil]));
    localStorage.setItem('aulapro_active_profile', 'p1');
    localStorage.setItem('aulapro_web_data_p1', JSON.stringify({ classes: [{ id: 'c1', name: '1A', subject: 'Mates' }], novedad: { x: 1 } }));
    const { result } = renderHook(() => useAppState());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(result.current.ready).toBe(true);
    await act(async () => { result.current.addTask('Corregir', 'medium'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    const guardado = JSON.parse(localStorage.getItem('aulapro_web_data_p1')!);
    expect(guardado.tasks).toHaveLength(1);
    expect(guardado.novedad).toEqual({ x: 1 });
    expect(guardado.classes[0].id).toBe('c1');
  });
});
