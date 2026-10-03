import { describe, it, expect } from 'vitest';
import { claveCriterioOficial, notasDeMateria, officialCriteriaScoresFor } from './evaluacionPorCriterios';
import type { CurriculumEntry } from './index';
import type { Evaluation } from '../../types';

const MATES: CurriculumEntry = {
  id: 'matematicas',
  nombre: 'Matemáticas',
  competencias: [{ n: 1, texto: 'Resolver problemas.' }, { n: 2, texto: 'Comprobar soluciones.' }],
  criterios: {
    '3': [
      { codigo: '1.1', competencia: 1, texto: 'Comprender el enunciado.', codigoLiteral: true },
      { codigo: '1.2', competencia: 1, texto: 'Aplicar estrategias.', codigoLiteral: true },
      { codigo: '2.1', competencia: 2, texto: 'Comprobar la solución.', codigoLiteral: true },
    ],
  },
  saberes: { '3': [] },
};

const evaluacion = (notas: Record<string, number>): Evaluation => ({
  id: 'e', rubric_id: 'r', rubric_name: 'R', student_id: 's', student_name: 'S', class_id: 'c',
  date: '2026-10-03', scores: {}, notes: '', officialCriteriaScores: notas,
});

describe('officialCriteriaScoresFor', () => {
  it('apunta la nota de cada criterio de la rúbrica en todos sus criterios oficiales, de varias materias', () => {
    const criterios = [
      { id: 'a', officialCriteria: [{ materia: 'matematicas', codigo: '1.1' }, { materia: 'ciencias-de-la-naturaleza', codigo: '2.3' }] },
      { id: 'b', officialCriteria: [{ materia: 'matematicas', codigo: '2.1' }] },
      { id: 'c' }, // sin criterios oficiales: solo cuenta para la nota de siempre
    ];
    expect(officialCriteriaScoresFor(criterios, { a: 3, b: 4, c: 1 }, 4)).toEqual({
      'matematicas|1.1': 7.5, 'ciencias-de-la-naturaleza|2.3': 7.5, 'matematicas|2.1': 10,
    });
  });

  it('el 10 es el nivel más alto de la escala del instrumento', () => {
    expect(officialCriteriaScoresFor([{ id: 'a', officialCriteria: [{ materia: 'm', codigo: '1.1' }] }], { a: 3 }, 6))
      .toEqual({ 'm|1.1': 5 });
  });

  it('dos criterios de la rúbrica sobre el mismo criterio oficial: la media', () => {
    const ref = { materia: 'm', codigo: '1.1' };
    expect(officialCriteriaScoresFor([{ id: 'a', officialCriteria: [ref] }, { id: 'b', officialCriteria: [ref] }], { a: 2, b: 4 }, 4))
      .toEqual({ 'm|1.1': 7.5 });
  });

  it('sin criterios oficiales, o sin nada marcado, no añade nada a la evaluación', () => {
    expect(officialCriteriaScoresFor([{ id: 'a' }], { a: 4 }, 4)).toBeUndefined();
    expect(officialCriteriaScoresFor([{ id: 'a', officialCriteria: [{ materia: 'm', codigo: '1.1' }] }], {}, 4)).toBeUndefined();
  });
});

describe('notasDeMateria', () => {
  it('criterio: media de sus evaluaciones; competencia: de sus criterios evaluados; materia: de sus competencias', () => {
    const notas = notasDeMateria(MATES, '3', [
      evaluacion({ 'matematicas|1.1': 5, 'matematicas|2.1': 10 }),
      evaluacion({ 'matematicas|1.1': 7, 'otra|1.1': 0 }),
    ]);
    expect(notas.competencias.map(c => [c.n, c.nota, c.criterios.map(cr => [cr.codigo, cr.nota, cr.veces])])).toEqual([
      [1, 6, [['1.1', 6, 2], ['1.2', null, 0]]],
      [2, 10, [['2.1', 10, 1]]],
    ]);
    expect(notas.nota).toBe(8);
  });

  it('sin evaluaciones, todo sin nota pero con todas sus competencias y criterios', () => {
    const notas = notasDeMateria(MATES, '3', []);
    expect(notas.nota).toBeNull();
    expect(notas.competencias.flatMap(c => c.criterios)).toHaveLength(3);
  });

  it('la clave junta materia y código', () => {
    expect(claveCriterioOficial({ materia: 'matematicas', codigo: '2.1' })).toBe('matematicas|2.1');
  });
});
