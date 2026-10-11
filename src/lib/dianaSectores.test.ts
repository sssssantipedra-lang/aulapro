/**
 * Lo que llega a cada sector de la Diana: las competencias clave de las
 * rúbricas y dianas (1-4) y las competencias específicas por las competencias
 * clave con las que las conecta el decreto (de 10 a 4).
 */
import { describe, it, expect } from 'vitest';
import { evidenciasPorSector, nivelDelSector } from './dianaSectores';
import type { NotaMateria } from './curriculum/evaluacionPorCriterios';
import type { Evaluation } from '../types';

const formato = { numero: (n: number) => String(n).replace('.', ','), ce: (n: number) => `CE${n}` };

const evaluacion = (competencyScores: Record<string, number>): Evaluation => ({
  id: 'e', rubric_id: 'r', rubric_name: 'Mercado', student_id: 's', student_name: '', class_id: 'c',
  date: '2026-10-03', scores: {}, notes: '', competencyScores,
});

const mates = (competencias: { n: number; nota: number | null; clave: string[] }[]): { asignatura: string; notas: NotaMateria } => ({
  asignatura: 'Matemáticas',
  notas: { id: 'matematicas', nombre: 'Matemáticas', grupo: '3', nota: null, competencias: competencias.map(c => ({ ...c, texto: '', criterios: [] })) },
});

describe('evidencias de la Diana', () => {
  it('las competencias clave de las rúbricas, como siempre', () => {
    const s = evidenciasPorSector([evaluacion({ CCL: 3, CPSAA: 2 })], [], formato);
    expect(s.ds1).toEqual([{ value: 3, etiqueta: 'CCL 3 («Mercado»)' }]);
    // CPSAA alimenta dos sectores: Social y Aprender a aprender
    expect(s.ds4).toHaveLength(1);
    expect(s.ds5).toHaveLength(1);
  });

  it('una competencia específica llega a los sectores de sus competencias clave, una vez por sector', () => {
    const s = evidenciasPorSector([], [mates([{ n: 2, nota: 7.5, clave: ['CCL', 'STEM', 'CCEC'] }])], formato);
    // 7,5 sobre 10 es un 3 de 4
    expect(s.ds2).toEqual([{ value: 3, etiqueta: 'Matemáticas CE2 7,5/10' }]);
    // CCL y CCEC van los dos a Comunicación: cuenta una vez
    expect(s.ds1).toHaveLength(1);
    expect(s.ds3).toEqual([]);
  });

  it('sin nota o sin conexión en el decreto, no aporta nada', () => {
    const s = evidenciasPorSector([], [mates([{ n: 1, nota: null, clave: ['STEM'] }, { n: 6, nota: 9, clave: [] }])], formato);
    expect(Object.values(s).flat()).toEqual([]);
  });

  it('el nivel del sector es la media de todo, redondeada de 1 a 4', () => {
    const s = evidenciasPorSector([evaluacion({ STEM: 4 })], [mates([{ n: 1, nota: 5, clave: ['STEM'] }])], formato);
    expect(s.ds2.map(e => e.value)).toEqual([4, 2]);
    expect(nivelDelSector(s.ds2)).toBe(3);
    expect(nivelDelSector([])).toBeNull();
    expect(nivelDelSector([{ value: 0.4, etiqueta: '' }])).toBe(1);
  });
});
