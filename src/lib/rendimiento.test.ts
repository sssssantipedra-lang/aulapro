import { describe, it, expect } from 'vitest';
import { rendimientoPorClase } from './rendimiento';
import { buildDemoData } from './demoData';
import type { Class, Evaluation, Rubric } from '../types';

const clase = (id: string): Class => ({ id, name: id, subject: 'Mat', room: '', color: '#000' }) as Class;
const rubrica: Rubric = { id: 'r', name: 'Rúbrica', criteria: [{ id: 'a', name: 'A', descriptors: {} }] };
const ev = (p: Partial<Evaluation>): Evaluation => ({
  id: Math.random().toString(), rubric_id: 'r', rubric_name: 'Rúbrica', student_id: 's1', student_name: '',
  class_id: 'c1', date: '2026-10-01', scores: { a: 4 }, notes: '', ...p,
});

describe('cómo va cada clase', () => {
  it('cuenta la última evaluación de cada alumno y deja fuera las dianas y las clases sin nada', () => {
    const r = rendimientoPorClase([clase('c1'), clase('c2')], [rubrica], [
      ev({ grade: 4, date: '2026-09-01' }),
      ev({ grade: 8, date: '2026-10-01' }),
      ev({ student_id: 's2', grade: 6 }),
      ev({ student_id: 's3', grade: 1, instrument: 'diana' }),
    ]);
    expect(r).toEqual([{ classId: 'c1', nombre: 'c1', color: '#000', rubricas: [{ id: 'r', nombre: 'Rúbrica', media: 7, alumnos: 2 }] }]);
  });

  it('sin nota guardada, la calcula de los niveles', () => {
    const [c] = rendimientoPorClase([clase('c1')], [rubrica], [ev({ scores: { a: 2 } })]);
    expect(c.rubricas[0].media).toBe(5);
  });

  it('los datos de ejemplo enseñan todas las clases, cada una con sus rúbricas', () => {
    const d = buildDemoData();
    const r = rendimientoPorClase(d.classes, d.rubrics, d.evaluations);
    expect(r).toHaveLength(10);
    // ESO: exposición oral y problemas; Primaria: exposición y cuaderno (y problemas en la de Matemáticas)
    expect(r.map(c => c.rubricas.length)).toEqual([2, 2, 2, 2, 2, 3, 2, 2, 2, 2]);
    expect(r.every(c => c.rubricas.every(x => x.alumnos === 6))).toBe(true);
    // Cada clase con notas de los criterios oficiales de su propia materia
    for (const c of d.classes) {
      const materia = Object.values(c.materiasOficiales ?? {})[0];
      expect(d.evaluations.some(e => e.class_id === c.id && Object.keys(e.officialCriteriaScores ?? {}).some(k => k.startsWith(`${materia}|`)))).toBe(true);
    }
    // Con competencias clave y criterios oficiales, como al evaluar de verdad
    expect(d.evaluations.every(e => e.competencyScores)).toBe(true);
  });
});
