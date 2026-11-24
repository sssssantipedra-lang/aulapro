import { describe, it, expect } from 'vitest';
import { coberturaDeEvaluacion, coberturaDeMateria, porcentaje } from './cobertura';
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
const ev = (scores: Record<string, number>, date = '2026-11-10'): Evaluation => ({
  id: 'e', rubric_id: 'r', rubric_name: 'R', student_id: 'a', student_name: 'A', class_id: 'c1', date, scores: {}, notes: '', officialCriteriaScores: scores,
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

describe('cobertura de una evaluación: qué se ha evaluado en ella, qué en otra y qué en ninguna', () => {
  const HOY = '2027-02-15';
  const [PRIMERA, SEGUNDA, TERCERA] = ['1ª evaluación', '2ª evaluación', '3ª evaluación'];
  const delCurso = [
    ev({ 'matematicas|1.1': 7 }, '2026-10-20'),
    ev({ 'matematicas|1.1': 5, 'matematicas|2.1': 9, 'lengua|1.2': 8 }, '2027-02-03'),
  ];
  const codigos = (l: { codigo: string }[]) => l.map(c => c.codigo);

  it('cada criterio cae en un solo grupo, y los tres suman el total', () => {
    const c = coberturaDeEvaluacion(entry, '5-6', delCurso, SEGUNDA, HOY, {});
    expect(codigos(c.enEsta)).toEqual(['1.1', '2.1']);
    expect(c.enOtra).toEqual([]);
    expect(codigos(c.enNinguna)).toEqual(['1.2', '2.2']);
    expect(c.enEsta.length + c.enOtra.length + c.enNinguna.length).toBe(c.total);
  });

  it('lo evaluado solo en otra evaluación dice en cuál', () => {
    const primera = coberturaDeEvaluacion(entry, '5-6', delCurso, PRIMERA, HOY, {});
    expect(codigos(primera.enEsta)).toEqual(['1.1']);
    expect(primera.enOtra).toMatchObject([{ codigo: '2.1', competencia: 2, periodos: [SEGUNDA] }]);
    const tercera = coberturaDeEvaluacion(entry, '5-6', delCurso, TERCERA, HOY, {});
    expect(tercera.enEsta).toEqual([]);
    expect(tercera.enOtra.map(c => [c.codigo, c.periodos])).toEqual([['1.1', [PRIMERA, SEGUNDA]], ['2.1', [SEGUNDA]]]);
  });

  it('«en ninguna» son los pendientes de todo el curso, se mire la evaluación que se mire', () => {
    const pendientes = codigos(coberturaDeMateria(entry, '5-6', delCurso).pendientes);
    for (const p of [PRIMERA, SEGUNDA, TERCERA]) {
      expect(codigos(coberturaDeEvaluacion(entry, '5-6', delCurso, p, HOY, {}).enNinguna)).toEqual(pendientes);
    }
  });

  it('manda la fecha de cada evaluación con las fechas que haya puesto el docente', () => {
    // El centro cierra la 1.ª el 15 de octubre: lo del 20 de octubre ya es de la 2.ª
    const rangos = { [PRIMERA]: { desde: '2026-09-01', hasta: '2026-10-15' }, [SEGUNDA]: { desde: '2026-10-16', hasta: '2027-03-31' } };
    const c = coberturaDeEvaluacion(entry, '5-6', delCurso, PRIMERA, HOY, rangos);
    expect(c.enEsta).toEqual([]);
    expect(c.enOtra.map(x => [x.codigo, x.periodos])).toEqual([['1.1', [SEGUNDA]], ['2.1', [SEGUNDA]]]);
  });

  it('una evaluación sin fecha cuenta en las tres, y una de otro curso, en ninguna de este', () => {
    const sinFecha = coberturaDeEvaluacion(entry, '5-6', [ev({ 'matematicas|2.2': 6 }, '')], TERCERA, HOY, {});
    expect(codigos(sinFecha.enEsta)).toEqual(['2.2']);
    const deOtroCurso = coberturaDeEvaluacion(entry, '5-6', [ev({ 'matematicas|2.2': 6 }, '2025-11-10')], PRIMERA, HOY, {});
    expect(deOtroCurso.enEsta).toEqual([]);
    // Tiene nota en «Curso», así que no está por repartir, pero no es de ninguna evaluación de este curso
    expect(deOtroCurso.enOtra).toMatchObject([{ codigo: '2.2', periodos: [] }]);
    expect(codigos(deOtroCurso.enNinguna)).toEqual(['1.1', '1.2', '2.1']);
  });

  it('sin evaluaciones, todo queda por repartir', () => {
    const c = coberturaDeEvaluacion(entry, '5-6', [], PRIMERA, HOY, {});
    expect(c).toMatchObject({ total: 4, enEsta: [], enOtra: [] });
    expect(c.enNinguna).toHaveLength(4);
  });
});
