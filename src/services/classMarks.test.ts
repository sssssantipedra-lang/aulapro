import { describe, it, expect } from 'vitest';
import {
  applyClassMarks, orphanTargets, targetsOfCategory, linkTargets, defaultMarksBase, marksScore,
  MARKS_ITEM_PREFIX, isMarksItem,
} from './classMarks';
import type { Class, ClassMark, GradeCategory, Student } from '../types';

const cls = (id: string, subjects = ['Matemáticas']): Class =>
  ({ id, name: id, subject: subjects[0], subjects, color: '#000' } as unknown as Class);
const st = (id: string, class_id = 'c1'): Student =>
  ({ id, class_id, name: id, email: '', photo: null, alerts: [], notes: '' });
const cat = (id: string, name: string, extra: Partial<GradeCategory> = {}): GradeCategory =>
  ({ id, class_id: 'c1', name, weight: 10, ...extra });
let n = 0;
const mark = (student_id: string, type: ClassMark['type'], extra: Partial<ClassMark> = {}): ClassMark =>
  ({ id: 'm' + n++, class_id: 'c1', student_id, type, date: '2026-09-29', ...extra });

describe('targetsOfCategory', () => {
  it('reconoce los nombres habituales, con o sin tildes', () => {
    expect(targetsOfCategory('Tareas')).toEqual(['homework']);
    expect(targetsOfCategory('Comportamiento')).toEqual(['behavior']);
    expect(targetsOfCategory('Participacion')).toEqual(['participation']);
    expect(targetsOfCategory('Actitud y participación')).toEqual(['behavior', 'participation']);
    expect(targetsOfCategory('Exámenes')).toEqual([]);
  });
  it('un tipo va a la primera categoría que encaja, nunca a dos', () => {
    const links = linkTargets([cat('a', 'Tareas'), cat('b', 'Tareas de casa')]);
    expect(links.get('homework')?.id).toBe('a');
  });
});

describe('marksScore y nota de partida', () => {
  it('parte de 10 si hay negativas y de 5 si solo positivas', () => {
    expect(defaultMarksBase({ name: 'Comportamiento' })).toBe(10);
    expect(defaultMarksBase({ name: 'Participación' })).toBe(5);
  });
  it('suma y resta y se queda entre 0 y 10', () => {
    expect(marksScore(0, 2, 10, 0.5)).toBe(9);
    expect(marksScore(3, 0, 10, 0.5)).toBe(10);
    expect(marksScore(0, 40, 10, 0.5)).toBe(0);
    expect(marksScore(4, 1, 5, 0.5)).toBe(6.5);
  });
});

describe('applyClassMarks', () => {
  const base = {
    classes: [cls('c1')],
    students: [st('ana'), st('beto')],
    gradeItems: [],
    grades: {},
  };

  it('añade una columna por categoría con la nota de todo el grupo', () => {
    const r = applyClassMarks({
      ...base,
      gradeCategories: [cat('comp', 'Comportamiento'), cat('part', 'Participación')],
      classMarks: [mark('ana', 'behavior-bad'), mark('ana', 'material'), mark('beto', 'participation')],
    });
    expect(r.gradeItems.map(i => i.id)).toEqual([MARKS_ITEM_PREFIX + 'comp', MARKS_ITEM_PREFIX + 'part']);
    expect(r.grades[MARKS_ITEM_PREFIX + 'comp']).toEqual({ ana: 9, beto: 10 });
    expect(r.grades[MARKS_ITEM_PREFIX + 'part']).toEqual({ ana: 5, beto: 5.5 });
    expect(isMarksItem(r.gradeItems[0].id)).toBe(true);
  });

  it('respeta la nota de partida y el valor que elige el docente', () => {
    const r = applyClassMarks({
      ...base,
      gradeCategories: [cat('comp', 'Comportamiento', { marksBase: 8, marksStep: 1 })],
      classMarks: [mark('ana', 'behavior-good'), mark('beto', 'behavior-bad')],
    });
    expect(r.grades[MARKS_ITEM_PREFIX + 'comp']).toEqual({ ana: 9, beto: 7 });
  });

  it('sin categoría que las recoja, no cuentan y se avisan', () => {
    const r = applyClassMarks({
      ...base,
      gradeCategories: [cat('ex', 'Exámenes')],
      classMarks: [mark('ana', 'homework')],
    });
    expect(r.gradeItems).toEqual([]);
    expect(orphanTargets(cls('c1'), 'Matemáticas', [cat('ex', 'Exámenes')], [mark('ana', 'homework')]))
      .toEqual(['homework']);
  });

  it('cada asignatura recoge solo sus anotaciones', () => {
    const r = applyClassMarks({
      ...base,
      classes: [cls('c1', ['Matemáticas', 'Física'])],
      gradeCategories: [
        cat('mat', 'Tareas', { subject: 'Matemáticas' }),
        cat('fis', 'Tareas', { subject: 'Física' }),
      ],
      classMarks: [mark('ana', 'homework', { subject: 'Física' }), mark('beto', 'homework')],
    });
    expect(r.grades[MARKS_ITEM_PREFIX + 'fis']).toEqual({ ana: 9.5, beto: 10 });
    expect(r.grades[MARKS_ITEM_PREFIX + 'mat']).toEqual({ ana: 10, beto: 9.5 });
  });

  it('no toca lo guardado', () => {
    const grades = { gi1: { ana: 7 } };
    const r = applyClassMarks({
      ...base, grades,
      gradeItems: [{ id: 'gi1', class_id: 'c1', category_id: 'comp', name: 'x', date: '' }],
      gradeCategories: [cat('comp', 'Comportamiento')],
      classMarks: [mark('ana', 'behavior-bad')],
    });
    expect(grades).toEqual({ gi1: { ana: 7 } });
    expect(r.grades.gi1).toEqual({ ana: 7 });
    expect(r.gradeItems).toHaveLength(2);
  });
});
