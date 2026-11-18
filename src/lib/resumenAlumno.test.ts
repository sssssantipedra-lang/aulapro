/**
 * Lo más relevante de un alumno en su ficha de «Mis clases» (18-11-2026): reglas fijas, sin IA, sobre las notas, la
 * asistencia, las anotaciones y las competencias del periodo elegido.
 */
import { describe, it, expect } from 'vitest';
import { rangoDe, resumenAlumno, MAX_POR_LADO, type DatosParaResumen } from './resumenAlumno';
import type { AttendanceMap, Class, ClassMark, Evaluation, GradeItem, Student } from '../types';

const HOY = '2026-11-18';
const cls = { id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas'], isTutoria: false, room: '', color: '#000' } as Class;
const alumno = (id: string): Student => ({ id, class_id: 'c1', name: `Alumno ${id}`, email: '', photo: null, alerts: [], notes: '' });
const item = (id: string, date: string, category_id = 'cat1'): GradeItem => ({ id, class_id: 'c1', category_id, name: `Actividad ${id}`, date });

const base = (extra: Partial<DatosParaResumen> = {}): DatosParaResumen => ({
  student: alumno('a'), cls, companeros: ['a', 'b', 'c', 'd'],
  gradeCategories: [{ id: 'cat1', class_id: 'c1', name: 'Pruebas', weight: 100 }],
  gradeItems: [], grades: {}, attendance: {}, classMarks: [], evaluations: [],
  hoy: HOY, periodo: 'semanas', ...extra,
});
const claves = (xs: { clave: string }[]) => xs.map(x => x.clave);

describe('las fechas de cada periodo', () => {
  it('las últimas 4 semanas, con las 4 anteriores para comparar', () => {
    expect(rangoDe('semanas', HOY)).toEqual({
      actual: { desde: '2026-10-22', hasta: '2026-11-18' },
      anterior: { desde: '2026-09-24', hasta: '2026-10-21' },
    });
  });

  it('el trimestre, sin calendario: sep-dic, ene-mar y abr en adelante', () => {
    expect(rangoDe('trimestre', HOY)).toEqual({ actual: { desde: '2026-09-01', hasta: '2026-12-31' }, anterior: null });
    expect(rangoDe('trimestre', '2027-02-10')).toEqual({
      actual: { desde: '2027-01-01', hasta: '2027-03-31' }, anterior: { desde: '2026-09-01', hasta: '2026-12-31' },
    });
    expect(rangoDe('trimestre', '2027-05-03').actual).toEqual({ desde: '2027-04-01', hasta: '2027-08-31' });
  });

  it('el curso empieza el 1 de septiembre, también visto desde enero', () => {
    expect(rangoDe('curso', HOY).actual).toEqual({ desde: '2026-09-01', hasta: '2027-08-31' });
    expect(rangoDe('curso', '2027-01-15').actual).toEqual({ desde: '2026-09-01', hasta: '2027-08-31' });
  });
});

describe('las notas del cuaderno', () => {
  const gradeItems = [item('i1', '2026-11-03'), item('i2', '2026-11-10'), item('viejo', '2026-10-05')];

  it('una media alta y que sube sale en positivo, con su mejor nota', () => {
    const r = resumenAlumno(base({
      gradeItems,
      grades: {
        i1: { a: 9, b: 6, c: 6, d: 6 }, i2: { a: 8, b: 6, c: 6, d: 6 }, viejo: { a: 6 },
      },
    }));
    expect(r.hayDatos).toBe(true);
    expect(claves(r.positivos)).toEqual(expect.arrayContaining([
      'Media de {nota} en {asignatura}',
      'Ha subido {d} puntos en {asignatura} respecto al periodo anterior',
      'Mejor nota: {nota} en «{actividad}»',
    ]));
    expect(r.positivos.find(x => x.clave === 'Media de {nota} en {asignatura}')!.vars).toEqual({ nota: 8.5, asignatura: 'Matemáticas' });
    expect(r.positivos.find(x => x.clave.startsWith('Ha subido'))!.vars).toMatchObject({ d: 2.5 });
    expect(r.positivos.find(x => x.clave.startsWith('Mejor nota'))!.vars).toEqual({ nota: 9, actividad: 'Actividad i1' });
    // Con la media ya dicha, no se repite que va por encima de la clase
    expect(claves(r.positivos)).not.toContain('{d} puntos por encima de la media de la clase en {asignatura}');
    expect(r.atencion).toEqual([]);
  });

  it('frente a la clase: se dice cuando la media, sola, no lo cuenta (un 6 con la clase en 4,5, o un 6 con la clase en 8)', () => {
    const arriba = resumenAlumno(base({ gradeItems, grades: { i1: { a: 6, b: 4, c: 4, d: 4 } } }));
    expect(arriba.positivos.find(x => x.clave.startsWith('{d} puntos por encima'))!.vars).toEqual({ d: 1.5, asignatura: 'Matemáticas' });
    const abajo = resumenAlumno(base({ gradeItems, grades: { i1: { a: 6, b: 9, c: 9, d: 8 } } }));
    expect(abajo.atencion.find(x => x.clave.startsWith('{d} puntos por debajo'))!.vars).toEqual({ d: 2, asignatura: 'Matemáticas' });
  });

  it('una sola nota baja se dice cuál es', () => {
    const r = resumenAlumno(base({ gradeItems, grades: { i1: { a: 3 }, i2: { a: 9 } } }));
    expect(r.atencion.find(x => x.clave.startsWith('Nota más baja'))!.vars).toEqual({ nota: 3, actividad: 'Actividad i1' });
  });

  it('una media por debajo del 5 y que baja sale en «necesita atención», con las notas bajas y lo que no tiene calificado', () => {
    const r = resumenAlumno(base({
      gradeItems: [...gradeItems, item('i3', '2026-11-12')],
      grades: {
        i1: { a: 3, b: 7, c: 7, d: 7 }, i2: { a: 4, b: 7, c: 7, d: 7 }, i3: { b: 8, c: 8, d: 8 }, viejo: { a: 7 },
      },
    }));
    expect(claves(r.atencion)).toEqual(expect.arrayContaining([
      'Media de {nota} en {asignatura}, por debajo del 5',
      'Ha bajado {d} puntos en {asignatura} respecto al periodo anterior',
      '{n} de {total} notas por debajo de 5',
      'Sin nota en «{actividad}», que la clase ya tiene calificada',
    ]));
    // Lo más grave, primero
    expect(r.atencion[0].clave).toBe('Media de {nota} en {asignatura}, por debajo del 5');
    expect(r.atencion.find(x => x.clave.startsWith('{n} de'))!.vars).toEqual({ n: 2, total: 2 });
    expect(r.positivos).toEqual([]);
  });

  it('cada categoría cuenta con su peso, y el bloque de anotaciones del cuaderno no entra en la media', () => {
    const r = resumenAlumno(base({
      gradeCategories: [
        { id: 'cat1', class_id: 'c1', name: 'Pruebas', weight: 80 }, { id: 'cat2', class_id: 'c1', name: 'Tareas', weight: 20 },
        { id: 'marksblock:c1|Matemáticas', class_id: 'c1', name: 'Trabajo diario y actitud', weight: 20 },
      ],
      gradeItems: [item('i1', '2026-11-03', 'cat1'), item('i2', '2026-11-04', 'cat2'), item('marks:c1|Matemáticas', '2026-11-05', 'marksblock:c1|Matemáticas')],
      grades: { i1: { a: 10 }, i2: { a: 5 }, 'marks:c1|Matemáticas': { a: 0 } },
    }));
    expect(r.positivos.find(x => x.clave === 'Media de {nota} en {asignatura}')!.vars).toMatchObject({ nota: 9 });
    expect(claves(r.atencion)).not.toContain('Nota más baja: {nota} en «{actividad}»');
  });

  it('fuera del periodo no cuenta, y al mirar todo el curso sí', () => {
    const datos = { gradeItems: [item('viejo', '2026-09-20')], grades: { viejo: { a: 2 } } };
    expect(resumenAlumno(base(datos)).hayDatos).toBe(false);
    expect(claves(resumenAlumno(base({ ...datos, periodo: 'curso' })).atencion)).toContain('Media de {nota} en {asignatura}, por debajo del 5');
  });
});

describe('la asistencia', () => {
  const dias = (estados: Record<string, string>): AttendanceMap => ({ c1: Object.fromEntries(Object.entries(estados).map(([f, e]) => [f, { a: e }])) }) as AttendanceMap;

  it('las faltas sin justificar y los retrasos repetidos piden atención', () => {
    const r = resumenAlumno(base({ attendance: dias({ '2026-11-02': 'absent', '2026-11-03': 'absent', '2026-11-04': 'late', '2026-11-05': 'late', '2026-11-06': 'present', '2026-09-10': 'absent' }) }));
    expect(r.atencion.find(x => x.clave === '{n} faltas sin justificar')!.vars).toEqual({ n: 2 });
    expect(r.atencion.find(x => x.clave === '{n} retrasos')!.vars).toEqual({ n: 2 });
    expect(claves(r.positivos)).not.toContain('Asistencia completa: {n} días sin faltas ni retrasos');
  });

  it('una sola falta va en singular, y un solo retraso no se destaca', () => {
    const r = resumenAlumno(base({ attendance: dias({ '2026-11-02': 'absent', '2026-11-04': 'late' }) }));
    expect(claves(r.atencion)).toEqual(['1 falta sin justificar']);
  });

  it('con cinco días o más sin faltas ni retrasos, asistencia completa', () => {
    const r = resumenAlumno(base({ attendance: dias({ '2026-11-02': 'present', '2026-11-03': 'present', '2026-11-04': 'present', '2026-11-05': 'present', '2026-11-06': 'present' }) }));
    expect(r.positivos.find(x => x.clave.startsWith('Asistencia completa'))!.vars).toEqual({ n: 5 });
  });
});

describe('las anotaciones de actitud y trabajo diario', () => {
  const marca = (id: string, type: ClassMark['type'], date: string, extra: Partial<ClassMark> = {}): ClassMark => ({ id, class_id: 'c1', student_id: 'a', type, date, ...extra });

  it('las que suman y las que restan, con su desglose', () => {
    const r = resumenAlumno(base({ classMarks: [
      marca('1', 'participation', '2026-11-03'), marca('2', 'participation', '2026-11-04'), marca('3', 'behavior-good', '2026-11-04'),
      marca('4', 'homework', '2026-11-05'), marca('5', 'homework', '2026-11-06'), marca('6', 'material', '2026-11-06'),
    ] }));
    expect(r.positivos.find(x => x.clave === '{n} anotaciones positivas')).toMatchObject({ vars: { n: 3 }, detalle: [{ etiqueta: 'Participa', n: 2 }, { etiqueta: 'Buen comportamiento', n: 1 }] });
    expect(r.atencion.find(x => x.clave === '{n} anotaciones negativas')).toMatchObject({ vars: { n: 3 }, detalle: [{ etiqueta: 'Sin tarea', n: 2 }, { etiqueta: 'Sin material', n: 1 }] });
  });

  it('las de «En la pista» de EF salen con sus nombres de EF', () => {
    const ef = { ...cls, subject: 'Educación Física', subjects: ['Educación Física'] } as Class;
    const r = resumenAlumno(base({ cls: ef, classMarks: [marca('1', 'behavior-good', '2026-11-03'), marca('2', 'ef-ropa', '2026-11-03'), marca('3', 'behavior-bad', '2026-11-04')] }));
    expect(r.positivos[0]).toMatchObject({ clave: '1 anotación positiva', detalle: [{ etiqueta: 'Juego limpio', n: 1 }] });
    expect(r.atencion[0].detalle).toEqual(expect.arrayContaining([{ etiqueta: 'Sin equipación', n: 1 }, { etiqueta: 'Mala actitud', n: 1 }]));
  });

  it('tres días de clase seguidos con buena actitud son una racha', () => {
    const r = resumenAlumno(base({ classMarks: [marca('1', 'participation', '2026-11-16'), marca('2', 'participation', '2026-11-17'), marca('3', 'behavior-good', '2026-11-18')] }));
    expect(r.positivos.find(x => x.clave.startsWith('Racha'))!.vars).toEqual({ n: 3 });
  });
});

describe('las competencias clave de las evaluaciones', () => {
  const ev = (id: string, date: string, competencyScores: Record<string, number>, max_level?: number): Evaluation => ({
    id, rubric_id: 'r', rubric_name: 'Rúbrica', student_id: 'a', student_name: 'Alumno a', class_id: 'c1', date, scores: {}, notes: '', competencyScores, max_level,
  });

  it('destaca desde 3,5 sobre 4 y tiene que mejorar por debajo de 2,5, con el nombre de la competencia para traducir', () => {
    const r = resumenAlumno(base({ evaluations: [ev('1', '2026-11-03', { CCL: 4, STEM: 2, CD: 3 }), ev('2', '2026-11-10', { CCL: 4, STEM: 2 })] }));
    expect(r.positivos).toEqual([expect.objectContaining({ tipo: 'competencias', vars: { competencia: 'Comunicación lingüística', nivel: 4 }, traducir: ['competencia'] })]);
    expect(r.atencion).toEqual([expect.objectContaining({ vars: { competencia: 'Matemática, ciencia, tecnología e ingeniería', nivel: 2 } })]);
  });

  it('una rúbrica de tres niveles se pasa a la escala de 4', () => {
    const r = resumenAlumno(base({ evaluations: [ev('1', '2026-11-03', { CCL: 3 }, 3)] }));
    expect(r.positivos[0].vars).toMatchObject({ nivel: 4 });
  });
});

describe('el resumen entero', () => {
  it('sin nada anotado en el periodo, lo dice', () => {
    expect(resumenAlumno(base())).toEqual({ positivos: [], atencion: [], hayDatos: false });
  });

  it('como mucho cinco a cada lado, ordenados por importancia', () => {
    const marcas: ClassMark[] = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, class_id: 'c1', student_id: 'a', type: 'homework' as const, date: '2026-11-0' + (i + 2) }));
    const r = resumenAlumno(base({
      gradeItems: [item('i1', '2026-11-03'), item('i2', '2026-11-10'), item('i3', '2026-11-11'), item('viejo', '2026-10-05')],
      grades: { i1: { a: 2, b: 8, c: 8, d: 8 }, i2: { a: 3, b: 8, c: 8, d: 8 }, i3: { b: 8, c: 8, d: 8 }, viejo: { a: 8 } },
      attendance: { c1: { '2026-11-02': { a: 'absent' }, '2026-11-03': { a: 'absent' }, '2026-11-04': { a: 'late' }, '2026-11-05': { a: 'late' } } },
      classMarks: marcas,
    }));
    expect(r.atencion).toHaveLength(MAX_POR_LADO);
    expect(r.atencion.map(x => x.peso)).toEqual([...r.atencion.map(x => x.peso)].sort((a, b) => b - a));
  });
});
