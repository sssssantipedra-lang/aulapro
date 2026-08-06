import { describe, it, expect } from 'vitest';
import {
  normalizeClass, levelsOf, gradeFromLevels, levelColor, DEFAULT_LEVELS,
  type Class, type AchievementLevel,
} from './index';

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

/* ══════════════════════════════════════════════════════════
   Niveles de logro configurables
   ══════════════════════════════════════════════════════════ */

const nivel = (n: number): AchievementLevel[] =>
  Array.from({ length: n }, (_, i) => ({ value: i + 1, label: 'N' + (i + 1) }));

describe('levelsOf', () => {
  it('sin niveles propios devuelve los cuatro clásicos', () => {
    expect(levelsOf({}).map(l => l.label)).toEqual(
      ['Insuficiente', 'Suficiente', 'Bien', 'Excelente']);
    expect(levelsOf(undefined)).toBe(DEFAULT_LEVELS);
    expect(levelsOf({ levels: [] })).toBe(DEFAULT_LEVELS);
  });

  it('respeta los que defina el instrumento', () => {
    expect(levelsOf({ levels: nivel(6) })).toHaveLength(6);
  });
});

describe('gradeFromLevels: la nota se calcula sobre el nivel más alto', () => {
  const ids = ['a', 'b'];

  it('el nivel máximo es un 10, sea cual sea el número de niveles', () => {
    expect(gradeFromLevels({ a: 4, b: 4 }, ids, nivel(4))).toBe(10);
    expect(gradeFromLevels({ a: 6, b: 6 }, ids, nivel(6))).toBe(10);
    expect(gradeFromLevels({ a: 2, b: 2 }, ids, nivel(2))).toBe(10);
  });

  it('el mismo nivel vale distinto según la escala', () => {
    // Un 3 sobre 4 es notable; un 3 sobre 6 es justo la mitad.
    expect(gradeFromLevels({ a: 3, b: 3 }, ids, nivel(4))).toBe(7.5);
    expect(gradeFromLevels({ a: 3, b: 3 }, ids, nivel(6))).toBe(5);
  });

  it('promedia los criterios evaluados', () => {
    expect(gradeFromLevels({ a: 4, b: 2 }, ids, nivel(4))).toBe(7.5);
  });

  it('los criterios sin marcar no cuentan, no restan', () => {
    // Si contaran como cero, dejar uno a medias hundiría la nota.
    expect(gradeFromLevels({ a: 4 }, ids, nivel(4))).toBe(10);
  });

  it('sin ningún criterio marcado no hay nota', () => {
    expect(gradeFromLevels({}, ids, nivel(4))).toBeNull();
  });

  it('pondera cuando se le pasan pesos (dianas)', () => {
    // a vale el triple que b: (4/4*3 + 2/4*1) / 4 = 0,875 -> 8,8
    expect(gradeFromLevels({ a: 4, b: 2 }, ids, nivel(4), { a: 3, b: 1 })).toBe(8.8);
  });
});

describe('levelColor', () => {
  it('con cuatro niveles mantiene los colores de siempre', () => {
    expect([1, 2, 3, 4].map(v => levelColor(v, 4)))
      .toEqual(['#dc2626', '#d97706', '#2563eb', '#16a34a']);
  });

  it('con otro número va de rojo a verde sin repetir extremos', () => {
    const seis = [1, 2, 3, 4, 5, 6].map(v => levelColor(v, 6));
    expect(seis[0]).toContain('hsl(0');        // el peor, rojo
    expect(seis[5]).toContain('hsl(140');      // el mejor, verde
    expect(new Set(seis).size).toBe(6);        // ninguno repetido
  });
});

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
