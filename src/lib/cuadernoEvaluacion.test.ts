// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Class, ClassMark, GradeCategory, GradeItem, GradeMap, MarksBlockConfig, Student } from '../types';
import { applyClassMarks, DEFAULT_BLOCK, isMarksCategory, type MarksInput } from '../services/classMarks';
import {
  aUnDecimal, categoriasDe, cuadernoDe, mediaDeEvaluaciones, notasDeCurso, porcentajesDeEvaluaciones, REGLA_CONTINUA, reglaFinal,
} from './cuadernoEvaluacion';
import { conVecinos, guardarRangos } from './periodos';
import { mediaPonderada } from './ponderacion';

const HOY = '2027-02-10';
const cls: Class = { id: 'c1', name: '5.º A', subject: 'Lengua', subjects: ['Lengua', 'Plástica'] } as Class;
const otra: Class = { id: 'c2', name: '6.º B', subject: 'Lengua' } as Class;
const alumno = (id: string, class_id = 'c1'): Student => ({ id, name: `Alumno ${id}`, class_id } as Student);
const cat = (id: string, weight: number, subject?: string, class_id = 'c1'): GradeCategory => ({ id, class_id, name: id, weight, ...(subject ? { subject } : {}) });
const item = (id: string, category_id: string, date: string, weight?: number, class_id = 'c1'): GradeItem =>
  ({ id, class_id, category_id, name: id, date, ...(weight !== undefined ? { weight } : {}) });
const marca = (id: string, student_id: string, type: ClassMark['type'], date: string, subject?: string): ClassMark =>
  ({ id, class_id: 'c1', student_id, type, date, ...(subject ? { subject } : {}) });

/** Lengua: pruebas 60 y tareas 40 (sin asignatura: es de la principal); el bloque, sin tocar (1 punto de 10). */
function cuaderno(extra: Partial<MarksInput> = {}): MarksInput {
  const gradeItems = [
    item('ex1', 'pruebas', '2026-10-20'), item('ta1', 'tareas', '2026-11-05'),
    item('ex2', 'pruebas', '2027-02-03'), item('ta2', 'tareas', '2027-01-20'),
    item('ex3', 'pruebas', '2027-05-10'),
    item('lam', 'plastica', '2026-10-01'),
  ];
  const grades: GradeMap = {
    ex1: { a: 4, b: 8 }, ta1: { a: 6, b: 8 },
    ex2: { a: 8, b: 6 }, ta2: { a: 9, b: null },
    ex3: { a: 10 },
    lam: { a: 7, b: 7 },
  };
  return {
    classes: [cls, otra], students: [alumno('a'), alumno('b'), alumno('z', 'c2')],
    gradeCategories: [cat('pruebas', 60), cat('tareas', 40), cat('plastica', 100, 'Plástica'), cat('otra', 100, undefined, 'c2')],
    gradeItems, grades, classMarks: [], marksConfigs: { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: false }, 'c1|Plástica': { ...DEFAULT_BLOCK, enabled: false }, 'c2|Lengua': { ...DEFAULT_BLOCK, enabled: false } },
    ...extra,
  };
}
const nota = (d: MarksInput, periodo: string, id: string, subject = 'Lengua') => {
  const v = cuadernoDe(d, periodo, HOY);
  return mediaPonderada(categoriasDe(v, cls, subject), v.gradeItems, v.grades, id);
};

describe('el cuaderno de una evaluación', () => {
  beforeEach(() => localStorage.clear());

  it('enseña y cuenta solo las actividades de sus fechas', () => {
    const v = cuadernoDe(cuaderno(), '1ª evaluación', HOY);
    expect(v.gradeItems.map(i => i.id).sort()).toEqual(['ex1', 'lam', 'ta1']);
    expect(cuadernoDe(cuaderno(), '2ª evaluación', HOY).gradeItems.map(i => i.id).sort()).toEqual(['ex2', 'ta2']);
    expect(cuadernoDe(cuaderno(), 'Final de curso', HOY).gradeItems).toHaveLength(6);
    expect(nota(cuaderno(), '1ª evaluación', 'a')).toBeCloseTo(4 * 0.6 + 6 * 0.4);
    expect(nota(cuaderno(), '2ª evaluación', 'a')).toBeCloseTo(8 * 0.6 + 9 * 0.4);
    // Sin nota en tareas en la 2.ª, la categoría no resta
    expect(nota(cuaderno(), '2ª evaluación', 'b')).toBe(6);
    expect(nota(cuaderno(), '3ª evaluación', 'b')).toBeNull();
  });

  it('cada asignatura de la clase tiene su nota', () => {
    expect(nota(cuaderno(), '1ª evaluación', 'a', 'Plástica')).toBe(7);
    expect(nota(cuaderno(), '2ª evaluación', 'a', 'Plástica')).toBeNull();
  });

  it('una actividad sin fecha sale en todas las evaluaciones, y una de otro curso solo en «Final de curso»', () => {
    const d = cuaderno();
    d.gradeItems = [...d.gradeItems, item('sin', 'tareas', ''), item('vieja', 'tareas', '2026-03-03')];
    for (const p of ['1ª evaluación', '2ª evaluación', '3ª evaluación']) {
      const ids = cuadernoDe(d, p, HOY).gradeItems.map(i => i.id);
      expect(ids).toContain('sin');
      expect(ids).not.toContain('vieja');
    }
    expect(cuadernoDe(d, 'Final de curso', HOY).gradeItems.map(i => i.id)).toEqual(expect.arrayContaining(['sin', 'vieja']));
  });

  it('al cambiar las fechas de una evaluación, la actividad pasa a la que le toca', () => {
    expect(cuadernoDe(cuaderno(), '1ª evaluación', HOY).gradeItems.map(i => i.id)).toContain('ta1');
    guardarRangos(conVecinos('1ª evaluación', { desde: '2026-09-01', hasta: '2026-10-31' }, HOY, {}), HOY);
    expect(cuadernoDe(cuaderno(), '1ª evaluación', HOY).gradeItems.map(i => i.id)).not.toContain('ta1');
    expect(cuadernoDe(cuaderno(), '2ª evaluación', HOY).gradeItems.map(i => i.id)).toContain('ta1');
  });

  it('el peso de cada nota dentro de su categoría cuenta entre las de esa evaluación', () => {
    const d = cuaderno();
    d.gradeItems = [...d.gradeItems.filter(i => i.id !== 'ex1'), item('ex1', 'pruebas', '2026-10-20', 75), item('ex1b', 'pruebas', '2026-11-25', 25)];
    d.grades = { ...d.grades, ex1b: { a: 8 } };
    // Pruebas de la 1.ª: 4 al 75 % y 8 al 25 % = 5; la del 2.º trimestre no entra
    expect(nota(d, '1ª evaluación', 'a')).toBeCloseTo(5 * 0.6 + 6 * 0.4);
  });
});

describe('el bloque «Trabajo diario y actitud» en cada evaluación', () => {
  beforeEach(() => localStorage.clear());
  const conBloque = (classMarks: ClassMark[]) => cuaderno({ classMarks, marksConfigs: {} });

  it('se calcula con las anotaciones de las fechas de la evaluación', () => {
    const d = conBloque([
      marca('m1', 'a', 'homework', '2026-10-01'), marca('m2', 'a', 'homework', '2026-10-08'),
      marca('m3', 'a', 'participation', '2027-01-15'),
    ]);
    const bloque = (periodo: string) => cuadernoDe(d, periodo, HOY).grades['marks:c1|Lengua']?.a;
    // Tareas parte de 10 y pierde 0,5 por cada «sin tarea»; participación parte de 5 y gana 0,5
    expect(bloque('1ª evaluación')).toBeCloseTo((9 * 33.33 + 10 * 33.33 + 5 * 33.34) / 100, 2);
    expect(bloque('2ª evaluación')).toBeCloseTo((10 * 33.33 + 10 * 33.33 + 5.5 * 33.34) / 100, 2);
    expect(bloque('Final de curso')).toBeCloseTo((9 * 33.33 + 10 * 33.33 + 5.5 * 33.34) / 100, 2);
  });

  it('es la misma cuenta que hacía el acta: el bloque de todo el curso es el de siempre', () => {
    const d = conBloque([marca('m1', 'a', 'behavior-bad', '2026-10-01'), marca('m2', 'b', 'participation', '2027-02-01')]);
    const antes = applyClassMarks(d);
    const ahora = cuadernoDe(d, 'Final de curso', HOY);
    expect(ahora.gradeCategories).toEqual(antes.gradeCategories);
    expect(ahora.gradeItems).toEqual(antes.gradeItems);
    expect(ahora.grades).toEqual(antes.grades);
  });

  it('admite el cuaderno con el bloque ya puesto, sin contarlo dos veces', () => {
    const d = conBloque([marca('m1', 'a', 'homework', '2026-10-01'), marca('m2', 'a', 'homework', '2027-01-20')]);
    const yaPuesto = { ...d, ...applyClassMarks(d) };
    const v = cuadernoDe(yaPuesto, '1ª evaluación', HOY);
    expect(v.gradeCategories.filter(c => isMarksCategory(c.id) && c.class_id === 'c1' && c.subject === 'Lengua')).toHaveLength(1);
    expect(v.grades['marks:c1|Lengua'].a).toBeCloseTo(cuadernoDe(d, '1ª evaluación', HOY).grades['marks:c1|Lengua'].a as number);
  });

  it('en una evaluación sin actividades ni anotaciones no cuenta: nadie tiene nota solo por la de partida', () => {
    const d = conBloque([marca('m1', 'a', 'homework', '2026-10-01')]);
    d.gradeItems = d.gradeItems.filter(i => i.id !== 'ex3');
    expect(nota(d, '3ª evaluación', 'a')).toBeNull();
    expect(cuadernoDe(d, '3ª evaluación', HOY).gradeCategories.some(c => c.id === 'marksblock:c1|Lengua')).toBe(false);
    // Con una actividad o una anotación en sus fechas, sí
    expect(cuadernoDe(d, '2ª evaluación', HOY).gradeCategories.some(c => c.id === 'marksblock:c1|Lengua')).toBe(true);
    const conUna = conBloque([marca('m9', 'b', 'participation', '2027-05-05')]);
    conUna.gradeItems = conUna.gradeItems.filter(i => i.id !== 'ex3');
    expect(nota(conUna, '3ª evaluación', 'a')).not.toBeNull();
  });
});

describe('la nota final de curso', () => {
  beforeEach(() => localStorage.clear());

  it('sin elegir nada es evaluación continua: todas las notas del curso juntas, lo de siempre', () => {
    expect(reglaFinal(undefined)).toEqual(REGLA_CONTINUA);
    expect(reglaFinal({})).toEqual(REGLA_CONTINUA);
    const d = cuaderno();
    const { notas } = notasDeCurso(d, cls, 'Lengua', reglaFinal(undefined), HOY);
    const todo = applyClassMarks(d);
    const deSiempre = mediaPonderada(todo.gradeCategories.filter(c => c.class_id === 'c1' && (c.subject ?? 'Lengua') === 'Lengua'), todo.gradeItems, todo.grades, 'a');
    expect(notas.get('a')!.final).toBeCloseTo(deSiempre as number);
    expect(notas.get('a')!.final).toBe(notas.get('a')!.continua);
    // pruebas (4, 8 y 10) al 60 % y tareas (6 y 9) al 40 %
    expect(notas.get('a')!.final).toBeCloseTo((22 / 3) * 0.6 + 7.5 * 0.4);
  });

  it('da la nota de cada evaluación', () => {
    const { notas } = notasDeCurso(cuaderno(), cls, 'Lengua', REGLA_CONTINUA, HOY);
    const a = notas.get('a')!.evaluaciones;
    expect(a[0]).toBeCloseTo(4.8);
    expect(a[1]).toBeCloseTo(8.4);
    expect(a[2]).toBe(10);
    expect(notas.get('b')!.evaluaciones).toEqual([8, 6, null]);
    expect(notas.has('z')).toBe(false);
  });

  it('con la media de las evaluaciones, cada una cuenta por igual de partida', () => {
    const regla = reglaFinal({ final: { modo: 'media', pesos: [1, 1, 1] } });
    const { notas } = notasDeCurso(cuaderno(), cls, 'Lengua', regla, HOY);
    expect(notas.get('a')!.final).toBeCloseTo((4.8 + 8.4 + 10) / 3);
    // Una evaluación sin nota todavía no resta
    expect(notas.get('b')!.final).toBe(7);
  });

  it('con pesos, cada evaluación cuenta lo que diga el docente', () => {
    const regla = reglaFinal({ final: { modo: 'media', pesos: [20, 30, 50] } });
    expect(porcentajesDeEvaluaciones(regla)).toEqual([20, 30, 50]);
    const { notas } = notasDeCurso(cuaderno(), cls, 'Lengua', regla, HOY);
    expect(notas.get('a')!.final).toBeCloseTo(4.8 * 0.2 + 8.4 * 0.3 + 10 * 0.5);
    expect(notas.get('b')!.final).toBeCloseTo((8 * 20 + 6 * 30) / 50);
  });

  it('la media se hace con las notas a un decimal, las que se ven y se firman', () => {
    expect(aUnDecimal(6.46)).toBe(6.5);
    expect(aUnDecimal(null)).toBeNull();
    expect(mediaDeEvaluaciones([6.46, 7.54, null], REGLA_CONTINUA)).toBeCloseTo(7);
    expect(mediaDeEvaluaciones([null, null, null], REGLA_CONTINUA)).toBeNull();
    expect(mediaDeEvaluaciones([5, 9, 7], { modo: 'media', pesos: [0, 1, 1] })).toBe(8);
  });

  it('una regla guardada que no se entiende no rompe nada', () => {
    expect(reglaFinal({ final: { modo: 'media', pesos: [] } })).toEqual({ modo: 'media', pesos: [1, 1, 1] });
    expect(reglaFinal({ final: { modo: 'media', pesos: [0, 0, 0] } })).toEqual({ modo: 'media', pesos: [1, 1, 1] });
    expect(reglaFinal({ final: { modo: 'media', pesos: [2, -1, Number.NaN] } })).toEqual({ modo: 'media', pesos: [2, 1, 1] });
    expect(reglaFinal({ final: { modo: 'otra' } as unknown as MarksBlockConfig['final'] })).toEqual(REGLA_CONTINUA);
  });

  it('en Educación Física vale igual: las columnas de las pruebas físicas ya son por evaluación', () => {
    const ef: Class = { id: 'c1', name: '1.º ESO', subject: 'Educación Física' } as Class;
    const d: MarksInput = {
      classes: [ef], students: [alumno('a')],
      gradeCategories: [cat('motriz', 40), cat('cognitivo', 30), cat('social', 30)],
      gradeItems: [item('gi-ef-p1-c1-2026-1', 'motriz', '2026-10-10'), item('gi-ef-p1-c1-2026-2', 'motriz', '2027-02-01')],
      grades: { 'gi-ef-p1-c1-2026-1': { a: 5 }, 'gi-ef-p1-c1-2026-2': { a: 7 } },
      classMarks: [{ id: 'm', class_id: 'c1', student_id: 'a', type: 'ef-ropa', date: '2026-10-10' }],
      marksConfigs: {},
    };
    const { notas } = notasDeCurso(d, ef, 'Educación Física', REGLA_CONTINUA, HOY);
    const v = notas.get('a')!.evaluaciones;
    expect(v[0]).not.toBeNull();
    expect(v[1]).not.toBeNull();
    expect(v[0]).toBeLessThan(v[1] as number);
    expect(v[2]).toBeNull();
  });
});
