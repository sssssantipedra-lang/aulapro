import { describe, it, expect } from 'vitest';
import { coberturaDeMateria, porcentaje } from './cobertura';
import type { CurriculumEntry } from './index';
import type { Evaluation } from '../../types';

const entry = {
  id: 'matematicas', nombre: 'Matemáticas',
  competencias: [{ n: 1, texto: 'Interpretar', descriptores: [] }, { n: 2, texto: 'Resolver', descriptores: [] }],
  criterios: { '5-6': [
    { codigo: '1.1', texto: 'Comprender problemas', competencia: 1 }, { codigo: '1.2', texto: 'Representar', competencia: 1 },
    { codigo: '2.1', texto: 'Elegir estrategias', competencia: 2 }, { codigo: '2.2', texto: 'Comprobar', competencia: 2 },
  ] },
  saberes: { '5-6': [] },
} as unknown as CurriculumEntry;
const ev = (scores: Record<string, number>): Evaluation => ({
  id: 'e', rubric_id: 'r', rubric_name: 'R', student_id: 'a', student_name: 'A', class_id: 'c1', date: '2026-11-10', scores: {}, notes: '', officialCriteriaScores: scores,
});

describe('cobertura del currículo de una materia', () => {
  it('cuenta los criterios evaluados alguna vez en la clase y lista los que faltan, con su competencia', () => {
    const c = coberturaDeMateria(entry, '5-6', [ev({ 'matematicas|1.1': 7 }), ev({ 'matematicas|1.1': 5, 'matematicas|2.2': 9, 'lengua|1.2': 8 })]);
    expect(c).toMatchObject({ total: 4, evaluados: 2, competenciasPendientes: [1, 2] });
    expect(c.pendientes.map(p => p.codigo)).toEqual(['1.2', '2.1']);
    expect(porcentaje(c)).toBe(50);
  });

  it('sin evaluaciones, falta todo; con todo evaluado, nada', () => {
    expect(coberturaDeMateria(entry, '5-6', [])).toMatchObject({ evaluados: 0, competenciasPendientes: [1, 2] });
    const todo = coberturaDeMateria(entry, '5-6', [ev({ 'matematicas|1.1': 7, 'matematicas|1.2': 7, 'matematicas|2.1': 7, 'matematicas|2.2': 7 })]);
    expect(todo).toMatchObject({ evaluados: 4, pendientes: [], competenciasPendientes: [] });
    expect(porcentaje(todo)).toBe(100);
  });

  it('un grupo de cursos sin criterios no rompe nada', () => {
    expect(coberturaDeMateria(entry, '1-2', [])).toMatchObject({ total: 0, evaluados: 0 });
    expect(porcentaje({ total: 0, evaluados: 0 })).toBe(0);
  });
});
