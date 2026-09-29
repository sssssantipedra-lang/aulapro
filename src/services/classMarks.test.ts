import { describe, it, expect } from 'vitest';
import {
  applyClassMarks, studentBlock, blockConfig, blockActive, blockCategoryWeight,
  DEFAULT_BLOCK, BLOCK_CATEGORY_PREFIX, BLOCK_ITEM_PREFIX, isMarksCategory,
} from './classMarks';
import { weightedAverage } from './aiContext';
import type { Class, ClassMark, GradeCategory, Student, MarksBlockConfig } from '../types';

const cls = (id: string, subjects = ['Matemáticas']): Class =>
  ({ id, name: id, subject: subjects[0], subjects, color: '#000' } as unknown as Class);
const st = (id: string, class_id = 'c1'): Student =>
  ({ id, class_id, name: id, email: '', photo: null, alerts: [], notes: '' });
const cat = (id: string, name: string, weight: number, extra: Partial<GradeCategory> = {}): GradeCategory =>
  ({ id, class_id: 'c1', name, weight, ...extra });
let n = 0;
const mark = (student_id: string, type: ClassMark['type'], extra: Partial<ClassMark> = {}): ClassMark =>
  ({ id: 'm' + n++, class_id: 'c1', student_id, type, date: '2026-09-29', ...extra });

describe('studentBlock', () => {
  it('sin anotaciones, cada parte es su nota de partida (10, 10 y 5)', () => {
    const b = studentBlock([], DEFAULT_BLOCK);
    expect(b.parts.homework.score).toBe(10);
    expect(b.parts.behavior.score).toBe(10);
    expect(b.parts.participation.score).toBe(5);
    expect(b.total).toBeCloseTo(8.33, 2);
  });

  it('cada anotación suma o resta en su parte, entre 0 y 10', () => {
    const b = studentBlock([
      mark('a', 'homework'), mark('a', 'homework'),
      mark('a', 'material'), mark('a', 'behavior-good'), mark('a', 'behavior-good'),
      mark('a', 'participation'),
    ], DEFAULT_BLOCK);
    expect(b.parts.homework).toMatchObject({ score: 9, neg: 2, pos: 0 });
    expect(b.parts.behavior).toMatchObject({ score: 10, neg: 1, pos: 2 });
    expect(b.parts.participation).toMatchObject({ score: 5.5, pos: 1 });
  });

  it('respeta los pesos del docente', () => {
    const cfg: MarksBlockConfig = { ...DEFAULT_BLOCK, weights: { homework: 50, behavior: 50, participation: 0 } };
    const b = studentBlock([mark('a', 'homework'), mark('a', 'homework')], cfg);
    expect(b.total).toBe(9.5); // (9 + 10) / 2, la participación no cuenta
  });
});

describe('blockCategoryWeight', () => {
  it('da el peso justo para valer esos puntos', () => {
    expect(blockCategoryWeight(100, 1)).toBeCloseTo(11.1111, 3);
    expect(blockCategoryWeight(90, 1)).toBe(10);
    expect(blockCategoryWeight(0, 1)).toBe(100);
    expect(blockCategoryWeight(100, 0)).toBe(0);
  });
});

describe('blockActive', () => {
  it('cuenta solo si hay anotaciones, salvo que el docente decida', () => {
    expect(blockActive(DEFAULT_BLOCK, 0)).toBe(false);
    expect(blockActive(DEFAULT_BLOCK, 3)).toBe(true);
    expect(blockActive({ ...DEFAULT_BLOCK, enabled: false }, 3)).toBe(false);
    expect(blockActive({ ...DEFAULT_BLOCK, enabled: true }, 0)).toBe(true);
  });
  it('completa una configuración a medias con los valores por defecto', () => {
    const cfg = blockConfig({ 'c1|Matemáticas': { points: 2 } as MarksBlockConfig }, 'c1', 'Matemáticas');
    expect(cfg.points).toBe(2);
    expect(cfg.weights).toEqual(DEFAULT_BLOCK.weights);
  });
});

describe('applyClassMarks', () => {
  const base = {
    classes: [cls('c1')],
    students: [st('ana'), st('beto')],
    marksConfigs: {},
  };

  it('el bloque vale 1 punto de la nota final', () => {
    const cats = [cat('ex', 'Exámenes', 100)];
    const r = applyClassMarks({
      ...base,
      gradeCategories: cats,
      gradeItems: [{ id: 'e1', class_id: 'c1', category_id: 'ex', name: 'Examen', date: '' }],
      grades: { e1: { ana: 6, beto: 6 } },
      classMarks: [mark('ana', 'homework'), mark('ana', 'homework')],
    });
    const blockId = BLOCK_CATEGORY_PREFIX + 'c1|Matemáticas';
    expect(r.gradeCategories.some(c => c.id === blockId && isMarksCategory(c.id))).toBe(true);
    const bloqueAna = r.grades[BLOCK_ITEM_PREFIX + 'c1|Matemáticas'].ana as number;
    const final = weightedAverage('ana', r.gradeCategories, r.gradeItems, r.grades) as number;
    expect(final).toBeCloseTo(0.9 * 6 + 0.1 * bloqueAna, 6);
  });

  it('sin anotaciones no cambia ninguna media', () => {
    const r = applyClassMarks({
      ...base, gradeCategories: [cat('ex', 'Exámenes', 100)], gradeItems: [], grades: {}, classMarks: [],
    });
    expect(r.gradeCategories).toHaveLength(1);
    expect(r.gradeItems).toHaveLength(0);
  });

  it('desactivado por el docente, no cuenta aunque haya anotaciones', () => {
    const r = applyClassMarks({
      ...base,
      marksConfigs: { 'c1|Matemáticas': { ...DEFAULT_BLOCK, enabled: false } },
      gradeCategories: [cat('ex', 'Exámenes', 100)], gradeItems: [], grades: {},
      classMarks: [mark('ana', 'homework')],
    });
    expect(r.gradeCategories).toHaveLength(1);
  });

  it('cada asignatura tiene su bloque con sus anotaciones', () => {
    const r = applyClassMarks({
      ...base,
      classes: [cls('c1', ['Matemáticas', 'Física'])],
      gradeCategories: [], gradeItems: [], grades: {},
      classMarks: [mark('ana', 'homework', { subject: 'Física' }), mark('beto', 'homework')],
    });
    expect(r.grades[BLOCK_ITEM_PREFIX + 'c1|Física'].ana).toBeLessThan(r.grades[BLOCK_ITEM_PREFIX + 'c1|Física'].beto as number);
    expect(r.grades[BLOCK_ITEM_PREFIX + 'c1|Matemáticas'].beto).toBeLessThan(r.grades[BLOCK_ITEM_PREFIX + 'c1|Matemáticas'].ana as number);
  });

  it('no toca lo guardado', () => {
    const grades = { e1: { ana: 7 } };
    const cats = [cat('ex', 'Exámenes', 100)];
    applyClassMarks({
      ...base, grades, gradeCategories: cats,
      gradeItems: [{ id: 'e1', class_id: 'c1', category_id: 'ex', name: 'x', date: '' }],
      classMarks: [mark('ana', 'behavior-bad')],
    });
    expect(grades).toEqual({ e1: { ana: 7 } });
    expect(cats).toHaveLength(1);
  });
});
