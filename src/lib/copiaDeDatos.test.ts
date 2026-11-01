import { describe, it, expect } from 'vitest';
import { leerCopiaDeDatos } from './copiaDeDatos';

const copia = (data: unknown) => JSON.stringify({ _app: 'AulaPro', _version: 2, _date: '2026-11-01', data });

describe('leer una copia de seguridad antes de cargarla (auditoría del 1-11-2026)', () => {
  it('una copia buena devuelve sus datos', () => {
    const r = leerCopiaDeDatos(copia({ classes: [{ id: 'c1' }], students: [], grades: {} }));
    expect(r).toEqual({ ok: true, datos: { classes: [{ id: 'c1' }], students: [], grades: {} } });
  });

  it('lee también el formato de la versión 1, con los nombres de entonces', () => {
    const r = leerCopiaDeDatos(JSON.stringify({ _app: 'AulaPro', classes: [{ id: 'c1' }], grade_items: [{ id: 'g' }], diana_profiles: {} }));
    expect(r.ok && r.datos).toEqual({ classes: [{ id: 'c1' }], gradeItems: [{ id: 'g' }], dianaProfiles: {} });
  });

  it('rechaza lo que no es una copia de AulaPro y las copias cifradas para compartir', () => {
    expect(leerCopiaDeDatos('no es json').ok).toBe(false);
    expect(leerCopiaDeDatos(JSON.stringify({ _app: 'Otra' })).ok).toBe(false);
    expect(leerCopiaDeDatos(JSON.stringify([1, 2])).ok).toBe(false);
    const cifrada = leerCopiaDeDatos(JSON.stringify({ _app: 'AulaPro', _cifrada: true }));
    expect(cifrada.ok === false && cifrada.error).toMatch(/Trabajo compartido/);
  });

  it('rechaza una copia con una parte de forma rara (rompería la app al abrirse)', () => {
    expect(leerCopiaDeDatos(copia({ classes: [{ id: 'c1' }], students: 'Ana' })).ok).toBe(false);
    expect(leerCopiaDeDatos(copia({ classes: [{ id: 'c1' }], grades: [1, 2] })).ok).toBe(false);
    expect(leerCopiaDeDatos(copia({ classes: [{ id: 'c1' }], apoyo: 'x' })).ok).toBe(false);
    expect(leerCopiaDeDatos(copia('texto')).ok).toBe(false);
  });

  it('no carga una copia vacía: dejaría el cuaderno sin nada', () => {
    const r = leerCopiaDeDatos(copia({ classes: [], students: [], grades: {}, auditLog: [{ id: 'a' }] }));
    expect(r.ok === false && r.error).toMatch(/vacía/);
  });
});
