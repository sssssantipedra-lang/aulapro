// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { columnasACompletar, faltasSeguidas, marcarSugerenciaVista, sugerenciasVistas } from './sugerencias';
import type { AttendanceStatus, GradeItem, Student } from '../types';

const alumno = (id: string): Student => ({ id, class_id: 'c1', name: `Alumno ${id}`, email: '', photo: null, alerts: [], notes: '' });
const A = alumno('a'), B = alumno('b');
const dias = (porDia: Record<string, Record<string, AttendanceStatus>>) => porDia;

describe('faltas seguidas sin justificar', () => {
  it('tres seguidas hasta hoy: se propone, con el día en que empezó', () => {
    const r = faltasSeguidas(dias({
      '2026-11-10': { a: 'present', b: 'present' }, '2026-11-11': { a: 'absent', b: 'present' },
      '2026-11-12': { a: 'absent', b: 'absent' }, '2026-11-13': { a: 'absent', b: 'absent' },
    }), [A, B], '2026-11-13');
    expect(r).toEqual([{ student: A, n: 3, desde: '2026-11-11', hasta: '2026-11-13', clave: 'faltas:a:2026-11-11' }]);
  });

  it('un retraso, una justificada o un día presente cortan la racha; un día sin pasarle lista, no', () => {
    const base = { '2026-11-09': { a: 'absent' as const }, '2026-11-10': { a: 'absent' as const }, '2026-11-12': { a: 'absent' as const } };
    expect(faltasSeguidas(dias({ ...base, '2026-11-11': { b: 'present' } }), [A], '2026-11-12')[0]).toMatchObject({ n: 3, desde: '2026-11-09' });
    for (const corte of ['late', 'justified', 'present'] as const) {
      expect(faltasSeguidas(dias({ ...base, '2026-11-11': { a: corte } }), [A], '2026-11-12')).toEqual([]);
    }
  });

  it('solo cuenta hasta el día que se mira, y sin datos no dice nada', () => {
    const d = dias({ '2026-11-10': { a: 'absent' }, '2026-11-11': { a: 'absent' }, '2026-11-12': { a: 'absent' } });
    expect(faltasSeguidas(d, [A], '2026-11-11')).toEqual([]);
    expect(faltasSeguidas(undefined, [A], '2026-11-12')).toEqual([]);
  });
});

describe('actividades a medio calificar', () => {
  const item = (id: string, date: string): GradeItem => ({ id, class_id: 'c1', category_id: 'cat', name: id, date });
  const clase = ['a', 'b', 'c', 'd'];

  it('si la mayoría tiene nota y a alguien le falta, se dice a quién; la más reciente primero', () => {
    const r = columnasACompletar([item('viejo', '2026-10-01'), item('nuevo', '2026-11-10'), item('completo', '2026-11-11')], {
      viejo: { a: 5, b: 6, c: null }, nuevo: { a: 5, b: 6, c: 7 }, completo: { a: 1, b: 2, c: 3, d: 4 },
    }, clase);
    expect(r.map(x => [x.item.id, x.faltan, x.clave])).toEqual([['nuevo', ['d'], 'sinnota:nuevo'], ['viejo', ['c', 'd'], 'sinnota:viejo']]);
  });

  it('con menos de la mitad calificada no dice nada: aún se está poniendo', () => {
    expect(columnasACompletar([item('i', '2026-11-10')], { i: { a: 5 } }, clase)).toEqual([]);
    expect(columnasACompletar([item('i', '2026-11-10')], {}, clase)).toEqual([]);
  });
});

describe('lo que ya se ha visto', () => {
  beforeEach(() => localStorage.clear());

  it('se recuerda en el dispositivo y no se repite', () => {
    expect(sugerenciasVistas()).toEqual([]);
    marcarSugerenciaVista('faltas:a:2026-11-11');
    expect(marcarSugerenciaVista('faltas:a:2026-11-11')).toEqual(['faltas:a:2026-11-11']);
    expect(sugerenciasVistas()).toEqual(['faltas:a:2026-11-11']);
  });

  it('un almacenamiento estropeado no rompe nada', () => {
    localStorage.setItem('aulapro_sugerencias_vistas', '{no es una lista');
    expect(sugerenciasVistas()).toEqual([]);
  });
});
