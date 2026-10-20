// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { perfilPrueba, recordarPerfilPrueba, limpiarPrueba } from './modoPrueba';

describe('modo de prueba', () => {
  beforeEach(() => { localStorage.clear(); });

  it('recuerda el perfil de ejemplo y lo olvida', () => {
    expect(perfilPrueba()).toBeNull();
    recordarPerfilPrueba('p1');
    expect(perfilPrueba()).toBe('p1');
    recordarPerfilPrueba(null);
    expect(perfilPrueba()).toBeNull();
  });

  it('limpiar borra el perfil de la prueba y quita el activo si era ese', async () => {
    recordarPerfilPrueba('p1');
    const borrar = vi.fn().mockResolvedValue(undefined);
    const quitar = vi.fn();
    await limpiarPrueba(borrar, () => 'p1', quitar);
    expect(borrar).toHaveBeenCalledWith('p1');
    expect(quitar).toHaveBeenCalled();
    expect(perfilPrueba()).toBeNull();
  });

  it('limpiar no toca el perfil activo si es otro', async () => {
    recordarPerfilPrueba('p1');
    const quitar = vi.fn();
    await limpiarPrueba(async () => {}, () => 'p2', quitar);
    expect(quitar).not.toHaveBeenCalled();
  });

  it('sin prueba en curso no borra nada', async () => {
    const borrar = vi.fn();
    await limpiarPrueba(borrar, () => null, () => {});
    expect(borrar).not.toHaveBeenCalled();
  });

  it('si el borrado falla, igualmente olvida la prueba', async () => {
    recordarPerfilPrueba('p1');
    await limpiarPrueba(async () => { throw new Error('no existe'); }, () => null, () => {});
    expect(perfilPrueba()).toBeNull();
  });
});
