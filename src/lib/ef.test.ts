import { describe, it, expect } from 'vitest';
import {
  EF_VACIO, efParaOtroCurso, exentosDelDia, normalizarEF, notaConBaremo, pruebasDe, sinAlumnoEF, asignaturaEF, PRUEBAS_DE_PARTIDA,
} from './ef';
import { buildDemoEF } from './demoEF';
import { tipoDePerfil } from './tipoDocente';
import { EF_MARK_TYPES, studentBlock, DEFAULT_BLOCK, targetLabel, esAsignaturaEF } from '../services/classMarks';
import type { ClassMark } from '../types';
import type { EfData } from '../types/ef';

describe('tipo de docente', () => {
  it('PT y AL por sus especialidades, EF por su tipo, y si no, de aula', () => {
    expect(tipoDePerfil({ especialidades: ['AL'] })).toBe('apoyo');
    expect(tipoDePerfil({ tipoDocente: 'ef' })).toBe('ef');
    expect(tipoDePerfil({ tipoDocente: 'raro' })).toBe('aula');
    expect(tipoDePerfil(null)).toBe('aula');
  });
});

describe('datos de EF', () => {
  it('lo guardado vuelve igual, y lo que no se entiende se descarta', () => {
    const demo = buildDemoEF(new Date(2026, 9, 5)).ef;
    expect(normalizarEF(JSON.parse(JSON.stringify(demo)))).toEqual(demo);
    expect(normalizarEF(undefined)).toEqual(EF_VACIO);
    const raro = normalizarEF({
      exentos: [{ id: 'x', alumnoId: 's', desde: 'ayer', limitaciones: [] }, { id: 'y', alumnoId: 's', desde: '2026-10-01', limitaciones: ['correr', 'volar'] }],
      niveles: { a: 2, b: 7 }, sexos: { a: 'F', b: 'X' }, marcas: [{ id: 'm', pruebaId: 'p', alumnoId: 'a', fecha: '2026-10-01', valor: 'mucho' }],
    });
    expect(raro.exentos.map(e => [e.id, e.limitaciones])).toEqual([['y', ['correr']]]);
    expect(raro.niveles).toEqual({ a: 2 });
    expect(raro.sexos).toEqual({ a: 'F' });
    expect(raro.marcas).toEqual([]);
  });

  it('exentos del día: desde su inicio y hasta su fin, o sin fin', () => {
    const d: EfData = { ...EF_VACIO, exentos: [
      { id: 'a', alumnoId: 's1', limitaciones: ['correr'], otra: '', desde: '2026-10-01', hasta: '2026-10-10', tarea: '', justificante: false, motivo: '' },
      { id: 'b', alumnoId: 's2', limitaciones: [], otra: 'Sin sol', desde: '2026-10-06', tarea: '', justificante: false, motivo: '' },
    ] };
    expect(exentosDelDia(d, '2026-10-05').map(e => e.id)).toEqual(['a']);
    expect(exentosDelDia(d, '2026-10-11').map(e => e.id)).toEqual(['b']);
  });

  it('al vaciar el curso quedan el material del docente y se va lo del alumnado', () => {
    const d = buildDemoEF(new Date(2026, 9, 5)).ef;
    const otro = efParaOtroCurso({ ...d, sesiones: [{ id: 's', titulo: 'X', claseId: 'c', fecha: '2026-10-05', objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '' }] });
    expect(otro.exentos).toEqual([]);
    expect(otro.marcas).toEqual([]);
    expect(otro.niveles).toEqual({});
    expect(otro.material).toEqual(d.material);
    expect(otro.circuitos).toEqual(d.circuitos);
    expect(otro.sesiones[0].claseId).toBeUndefined();
  });

  it('borrar un alumno lo quita de todo lo de EF', () => {
    const d = buildDemoEF(new Date(2026, 9, 5)).ef;
    const sin = sinAlumnoEF(d, 'ef-s01');
    expect(sin.niveles['ef-s01']).toBeUndefined();
    expect(sin.separar).toEqual([]);
    expect(sin.marcas.some(m => m.alumnoId === 'ef-s01')).toBe(false);
  });
});

describe('pruebas físicas', () => {
  it('las de partida, con las ocultas marcadas, y las del docente', () => {
    const d: EfData = { ...EF_VACIO, pruebas: [
      { id: 'cooper', nombre: '', categoria: 'resistencia', unidad: '', mejor: 'mas', descripcion: '', oculta: true },
      { id: 'p1', nombre: 'Abdominales en 30 s', categoria: 'fuerza', unidad: 'rep.', mejor: 'mas', descripcion: '', propia: true },
    ] };
    const ps = pruebasDe(d);
    expect(ps).toHaveLength(PRUEBAS_DE_PARTIDA.length + 1);
    expect(ps.find(p => p.id === 'cooper')?.oculta).toBe(true);
    expect(ps.find(p => p.id === 'cooper')?.nombre).toBe('Test de Cooper');
  });

  it('el baremo da la nota del tramo más alto alcanzado, en los dos sentidos', () => {
    const tramos = [{ marca: 140, nota: 5 }, { marca: 160, nota: 7 }, { marca: 180, nota: 10 }];
    expect(notaConBaremo({ tramos }, { mejor: 'mas' }, 165)).toBe(7);
    expect(notaConBaremo({ tramos }, { mejor: 'mas' }, 120)).toBe(5);
    const tiempos = [{ marca: 6, nota: 5 }, { marca: 5.5, nota: 8 }];
    expect(notaConBaremo({ tramos: tiempos }, { mejor: 'menos' }, 5.4)).toBe(8);
    expect(notaConBaremo({ tramos: [] }, { mejor: 'mas' }, 3)).toBeNull();
  });
});

describe('observación en la pista', () => {
  it('cuenta en el bloque con sus partes de EF', () => {
    const m = (type: ClassMark['type']): ClassMark => ({ id: type, class_id: 'c', student_id: 's', type, date: '2026-10-05' });
    const b = studentBlock([m('ef-ropa'), m('ef-esfuerzo'), m('participation'), m('behavior-good')], DEFAULT_BLOCK);
    expect(b.parts.homework.score).toBe(9.5);
    expect(b.parts.participation.score).toBe(6);
    expect(b.parts.behavior.score).toBe(10);
    expect(EF_MARK_TYPES.map(x => x.id)).toContain('ef-no-participa');
    expect(targetLabel('homework', 'Educación Física')).toBe('Vestimenta e higiene');
    expect(targetLabel('homework', 'Matemáticas')).toBe('Tareas');
  });

  it('reconoce la asignatura de EF por sus nombres habituales', () => {
    expect(['EF', 'Educació Física', 'educacion fisica', 'Physical Education'].every(esAsignaturaEF)).toBe(true);
    expect(esAsignaturaEF('Física y Química')).toBe(false);
    expect(asignaturaEF({ subject: 'Tutoría', subjects: ['Tutoría', 'Educación Física'] })).toBe('Educación Física');
  });
});
