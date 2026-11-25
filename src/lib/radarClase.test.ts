import { describe, it, expect } from 'vitest';
import { radar, radarDeClase, UMBRAL_ATENCION } from './radarClase';
import type { Class, GradeItem, Student } from '../types';

const HOY = '2026-11-18';
const clase = (id: string): Class => ({ id, name: id, subject: 'Matemáticas', subjects: ['Matemáticas'], isTutoria: false, room: '', color: '#000' } as Class);
const alumno = (id: string, class_id: string): Student => ({ id, class_id, name: `Alumno ${id}`, email: '', photo: null, alerts: [], notes: '' });
const item = (id: string, class_id: string): GradeItem => ({ id, class_id, category_id: 'cat-' + class_id, name: id, date: '2026-11-10' });

const datos = {
  classes: [clase('c1'), clase('c2')],
  students: [alumno('a', 'c1'), alumno('b', 'c1'), alumno('c', 'c1'), alumno('d', 'c2')],
  gradeCategories: [{ id: 'cat-c1', class_id: 'c1', name: 'Pruebas', weight: 100 }, { id: 'cat-c2', class_id: 'c2', name: 'Pruebas', weight: 100 }],
  gradeItems: [item('i1', 'c1'), item('i2', 'c2')],
  grades: { i1: { a: 3, b: 9, c: 6 }, i2: { d: 9.5 } },
  attendance: { c1: { '2026-11-11': { c: 'absent' as const }, '2026-11-12': { c: 'absent' as const }, '2026-11-13': { c: 'absent' as const } } },
  classMarks: [{ id: 'm1', class_id: 'c1', student_id: 'b', type: 'homework' as const, date: '2026-11-12' }],
  evaluations: [], hoy: HOY,
};

describe('el radar de la clase', () => {
  const r = radar(datos);

  it('quien necesita atención, lo más grave primero y con su motivo', () => {
    expect(r.atencion.map(x => x.student.id)).toEqual(['a', 'c']);
    expect(r.atencion[0].dato.clave).toBe('Media de {nota} en {asignatura}, por debajo del 5');
    expect(r.atencion[1].dato).toMatchObject({ clave: '{n} faltas sin justificar', vars: { n: 3 } });
    expect(r.atencion.every(x => x.dato.peso >= UMBRAL_ATENCION)).toBe(true);
  });

  it('quien va especialmente bien; una anotación suelta no basta para salir en ninguna lista', () => {
    // «b» tiene un 9 y una sola anotación negativa (por debajo del umbral): destaca
    expect(r.destacan.map(x => x.student.id).sort()).toEqual(['b', 'd']);
    expect(r.atencion.map(x => x.student.id)).not.toContain('b');
  });

  it('nadie sale en las dos listas', () => {
    const ids = [...r.atencion, ...r.destacan].map(x => x.student.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('por clase', () => {
    expect(radarDeClase(r, 'c2')).toEqual({ atencion: [], destacan: [expect.objectContaining({ student: expect.objectContaining({ id: 'd' }) })] });
  });

  it('sin datos, vacío', () => {
    expect(radar({ ...datos, gradeItems: [], grades: {}, attendance: {}, classMarks: [] })).toEqual({ atencion: [], destacan: [] });
  });
});

describe('el radar, más rápido sin cambiar lo que dice (25-11-2026)', () => {
  it('con los datos de ejemplo da lo mismo que las reglas de la ficha alumno a alumno', async () => {
    const { buildDemoData } = await import('./demoData');
    const { resumenAlumno } = await import('./resumenAlumno');
    const demo = buildDemoData();
    const hoy = new Date().toISOString().slice(0, 10);
    const d = { ...demo, attendance: {}, hoy };
    const r = radar(d);
    // Lo de siempre: cada alumno con todo el perfil, sin separar nada por clase
    const atencion: string[] = [], destacan: string[] = [];
    for (const cls of d.classes) {
      const suyos = d.students.filter(s => s.class_id === cls.id);
      for (const student of suyos) {
        const x = resumenAlumno({ ...d, student, cls, companeros: suyos.map(s => s.id), periodo: 'semanas' });
        const malos = x.atencion.filter(y => y.peso >= UMBRAL_ATENCION);
        if (malos.length) atencion.push(`${student.id}:${malos[0].clave}:${malos.length}`);
        else if (x.positivos.some(y => y.peso >= 70)) destacan.push(student.id);
      }
    }
    expect(r.atencion.map(x => `${x.student.id}:${x.dato.clave}:${x.cuantos}`).sort()).toEqual(atencion.sort());
    expect(r.destacan.map(x => x.student.id).sort()).toEqual(destacan.sort());
    expect(atencion.length).toBeGreaterThan(0);
  });
});
