import { describe, it, expect } from 'vitest';
import { demoSnapshot } from './useAppState';

describe('demoSnapshot', () => {
  it('trae clases, alumnos y notas con la forma de un perfil guardado', () => {
    const d = demoSnapshot();
    expect(d.classes.length).toBeGreaterThan(0);
    expect(d.students.length).toBeGreaterThan(0);
    // Cada alumno pertenece a una clase que existe
    const ids = new Set(d.classes.map(c => c.id));
    expect(d.students.every(s => ids.has(s.class_id))).toBe(true);
    // Las claves son las del archivo guardado (blocks/events), no las de la interfaz
    expect(Array.isArray(d.blocks)).toBe(true);
    expect(Array.isArray(d.events)).toBe(true);
    expect(d.tombstones).toBeDefined();
  });
});
