import { describe, it, expect } from 'vitest';
import { normalizeClass, type Class } from './index';

/**
 * `normalizeClass` es una migración: la ejecuta cada carga de datos sobre las
 * clases guardadas antes de que una clase pudiera tener varias asignaturas.
 * Si se equivoca, un docente abre la aplicación y no encuentra su asignatura.
 */

/**
 * Una clase tal y como la guardaba la versión anterior: sin `subjects`.
 * Se construye por partes y se convierte al final, porque el tipo actual
 * exige esa clave que aquí precisamente no queremos poner.
 */
function legacy(patch: Partial<Class> = {}): Class {
  const base = {
    id: 'c1', name: '5º A', subject: 'Matemáticas',
    room: 'A1', color: '#000',
  };
  return { ...base, ...patch } as Class;
}

describe('normalizeClass: migración del formato antiguo', () => {
  it('convierte la única asignatura en la lista, sin perderla', () => {
    const c = normalizeClass(legacy());
    expect(c.subjects).toEqual(['Matemáticas']);
    expect(c.subject).toBe('Matemáticas');
  });

  it('respeta una lista que ya venga puesta', () => {
    const c = normalizeClass(legacy({ subjects: ['Lengua', 'Sociales', 'Plástica'] }));
    expect(c.subjects).toEqual(['Lengua', 'Sociales', 'Plástica']);
  });

  it('mantiene `subject` igual a la primera de la lista', () => {
    // Lo que se escribió antes de que existieran varias asignaturas sigue
    // leyendo `subject`: si se desincroniza, esas pantallas mienten.
    const c = normalizeClass(legacy({ subject: 'Viejo', subjects: ['Lengua', 'Sociales'] }));
    expect(c.subject).toBe('Lengua');
  });

  it('nunca deja la lista vacía, aunque no hubiera asignatura', () => {
    const c = normalizeClass(legacy({ subject: '', subjects: [] }));
    expect(c.subjects).toHaveLength(1);
    expect(c.subject).toBe('Sin asignatura');
  });

  it('descarta huecos y cadenas en blanco de la lista', () => {
    const c = normalizeClass(legacy({ subjects: ['Lengua', '', '   ', 'Sociales'] }));
    expect(c.subjects).toEqual(['Lengua', 'Sociales']);
  });

  it('aguanta que `subjects` no sea una lista (copia de seguridad manipulada)', () => {
    // Los valores son distintos a propósito: así se ve que descarta el dato
    // roto y recurre a `subject`, en vez de pasar por casualidad.
    const roto = legacy({ subject: 'Matemáticas', subjects: 'Lengua' as unknown as string[] });
    const c = normalizeClass(roto);
    expect(c.subjects).toEqual(['Matemáticas']);
  });

  it('es idempotente: aplicarla dos veces no cambia nada', () => {
    // Se ejecuta en cada carga y en cada sincronización, así que tiene que serlo.
    const once = normalizeClass(legacy({ subjects: ['Lengua', 'Sociales'] }));
    expect(normalizeClass(once)).toEqual(once);
  });

  it('no toca el resto de los datos de la clase', () => {
    const c = normalizeClass(legacy({ name: '5º A', room: 'A12', color: '#abc', isTutoria: true }));
    expect(c.name).toBe('5º A');
    expect(c.room).toBe('A12');
    expect(c.color).toBe('#abc');
    expect(c.isTutoria).toBe(true);
  });
});
