// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { apuntarCambioDeCurso, cursoAlRestaurar } from './cursoAnterior';

describe('el curso escolar de antes de empezar el curso nuevo', () => {
  beforeEach(() => localStorage.clear());
  const cambio = new Date('2026-09-03T10:00:30.500Z');

  it('una copia hecha antes del cambio devuelve el perfil al curso anterior', () => {
    apuntarCambioDeCurso('p1', '2025-2026', cambio);
    expect(cursoAlRestaurar('p1', 'copia-2026-09-03T10-00-30-antes-de-curso-nuevo.json')).toBe('2025-2026');
    expect(cursoAlRestaurar('p1', 'copia-2026-06-20T08-15-00.json')).toBe('2025-2026');
    // También con la ruta entera, como la da la lista de copias de algún dispositivo
    expect(cursoAlRestaurar('p1', 'AulaPro/perfiles/p1/copias/copia-2026-09-01T09-00-00.json')).toBe('2025-2026');
  });

  it('una copia posterior al cambio ya es del curso nuevo: no toca nada', () => {
    apuntarCambioDeCurso('p1', '2025-2026', cambio);
    expect(cursoAlRestaurar('p1', 'copia-2026-09-03T10-00-31.json')).toBeNull();
    expect(cursoAlRestaurar('p1', 'copia-2026-10-01T09-00-00-antes-de-cargar.json')).toBeNull();
  });

  it('sin haber empezado un curso en este dispositivo, o con un nombre que no se entiende, no toca nada', () => {
    expect(cursoAlRestaurar('p1', 'copia-2026-06-20T08-15-00.json')).toBeNull();
    apuntarCambioDeCurso('p1', '2025-2026', cambio);
    expect(cursoAlRestaurar('p1', 'otra-cosa.json')).toBeNull();
    // Cada perfil tiene lo suyo
    expect(cursoAlRestaurar('p2', 'copia-2026-06-20T08-15-00.json')).toBeNull();
  });

  it('un perfil que no decía su curso vuelve a no decirlo', () => {
    apuntarCambioDeCurso('p1', '', cambio);
    expect(cursoAlRestaurar('p1', 'copia-2026-06-20T08-15-00.json')).toBe('');
  });

  it('vale el último cambio', () => {
    apuntarCambioDeCurso('p1', '2025-2026', cambio);
    apuntarCambioDeCurso('p1', '2026-2027', new Date('2027-09-02T09:00:00Z'));
    expect(cursoAlRestaurar('p1', 'copia-2027-06-20T08-15-00.json')).toBe('2026-2027');
    expect(cursoAlRestaurar('p1', 'copia-2027-09-02T09-00-01.json')).toBeNull();
  });

  it('algo mal guardado no rompe la restauración', () => {
    localStorage.setItem('aulapro_curso_anterior_p1', '{"curso":3');
    expect(cursoAlRestaurar('p1', 'copia-2026-06-20T08-15-00.json')).toBeNull();
    localStorage.setItem('aulapro_curso_anterior_p1', JSON.stringify({ curso: '2025-2026', cuando: 'ayer' }));
    expect(cursoAlRestaurar('p1', 'copia-2026-06-20T08-15-00.json')).toBeNull();
  });
});
