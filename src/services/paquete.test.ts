import { describe, it, expect } from 'vitest';
import {
  buildBundle, mergeBundle, bundleCounts, emptyBundle, esPaquete, gruposDeEvaluaciones,
  type SharedBundle, type SyncSource, type ShareScope, type LocalState,
} from './paquete';
import type { Class, Student, GradeCategory, GradeItem, Rubric, Evaluation } from '../types';

/* ── Ayudas para montar datos de prueba sin ruido ── */

const cls = (id: string, name = id): Class =>
  ({ id, name, subject: 'Mates', subjects: ['Mates'], room: 'A1', color: '#000' });

const stu = (id: string, class_id: string, name = id): Student =>
  ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' });

const cat = (id: string, class_id: string, weight = 50): GradeCategory =>
  ({ id, class_id, name: id, weight });

const item = (id: string, class_id: string, category_id: string): GradeItem =>
  ({ id, class_id, category_id, name: id, date: '2026-01-01' });

const rub = (id: string, class_id?: string, otras: string[] = []): Rubric => ({
  id, name: id, criteria: [], class_id,
  ...(otras.length ? { otras_clases: otras.map(c => ({ class_id: c })) } : {}),
});

const evl = (id: string, class_id: string): Evaluation => ({
  id, rubric_id: 'r1', rubric_name: 'R', student_id: 's1', student_name: 'S',
  class_id, date: '2026-01-01', scores: {}, notes: '',
});

function bundle(patch: Partial<SharedBundle> = {}): SharedBundle {
  return { ...emptyBundle(), ...patch };
}

/** Lo propio (sin `from`) con la misma forma que un paquete. */
function propio(patch: Partial<LocalState> = {}): LocalState {
  const { from, ...resto } = emptyBundle();
  void from;
  return { ...resto, ...patch };
}

/* ══════════════════════════════════════════════════════════
   Fusión de listas
   ══════════════════════════════════════════════════════════ */

describe('mergeBundle: quién gana ante el mismo id', () => {
  it('en reconcile conserva lo LOCAL: nadie pierde su trabajo al conectarse', () => {
    const local  = propio({ students: [stu('s1', 'c1', 'Ana LOCAL')] });
    const remote = bundle({ students: [stu('s1', 'c1', 'Ana REMOTA')] });

    const out = mergeBundle(local, remote, 'conservar');
    expect(out.students).toHaveLength(1);
    expect(out.students[0].name).toBe('Ana LOCAL');
  });

  it('en live gana lo REMOTO: es una edición deliberada del compañero', () => {
    const local  = propio({ students: [stu('s1', 'c1', 'Ana LOCAL')] });
    const remote = bundle({ students: [stu('s1', 'c1', 'Ana REMOTA')] });

    const out = mergeBundle(local, remote, 'actualizar');
    expect(out.students[0].name).toBe('Ana REMOTA');
  });

  it('lo que solo existe en un lado se añade, en los dos modos', () => {
    const local  = propio({ students: [stu('s1', 'c1')] });
    const remote = bundle({ students: [stu('s2', 'c1')] });

    for (const mode of ['conservar', 'actualizar'] as const) {
      const ids = mergeBundle(local, remote, mode).students.map(s => s.id).sort();
      expect(ids).toEqual(['s1', 's2']);
    }
  });
});

/* ══════════════════════════════════════════════════════════
   Dueños: dos docentes compartiendo el mismo grupo
   ══════════════════════════════════════════════════════════ */

describe('mergeBundle: el dueño manda sobre lo suyo', () => {
  const TUTOR = 'perfil-tutor';
  const ESPECIALISTA = 'perfil-especialista';

  const alumnoDe = (owner: string, name: string): Student =>
    ({ ...stu('s1', 'c1', name), owner });

  it('la lista del tutor gana aunque el especialista sincronice después', () => {
    // Caso real: el tutor corrige el nombre de un alumno; el especialista
    // todavía tiene el viejo y su paquete llega en modo live, donde el
    // remoto ganaría siempre.
    const local  = propio({ students: [alumnoDe(TUTOR, 'Ana Ruiz Gómez')] });
    const remote = bundle({ students: [alumnoDe(TUTOR, 'Ana Ruiz')], from: ESPECIALISTA });

    const out = mergeBundle(local, remote, 'actualizar', TUTOR);
    expect(out.students[0].name).toBe('Ana Ruiz Gómez');
  });

  it('lo del compañero llega aunque yo tenga otra versión (conservar)', () => {
    // El reverso: si la ficha es suya, su cambio entra aunque en reconcile
    // normalmente ganara lo local.
    const local  = propio({ students: [alumnoDe(ESPECIALISTA, 'copia vieja')] });
    const remote = bundle({ students: [alumnoDe(ESPECIALISTA, 'al día')], from: ESPECIALISTA });

    const out = mergeBundle(local, remote, 'conservar', TUTOR);
    expect(out.students[0].name).toBe('al día');
  });

  it('sin dueño se comporta como antes: manda el modo', () => {
    const local  = propio({ students: [stu('s1', 'c1', 'LOCAL')] });
    const remote = bundle({ students: [stu('s1', 'c1', 'REMOTO')], from: ESPECIALISTA });

    expect(mergeBundle(local, remote, 'conservar', TUTOR).students[0].name).toBe('LOCAL');
    expect(mergeBundle(local, remote, 'actualizar', TUTOR).students[0].name).toBe('REMOTO');
  });

  it('sin saber quién soy, tampoco cambia el comportamiento anterior', () => {
    // `me` puede faltar (perfil aún sin cargar): no debe romper nada.
    const local  = propio({ students: [alumnoDe(TUTOR, 'LOCAL')] });
    const remote = bundle({ students: [alumnoDe(TUTOR, 'REMOTO')], from: ESPECIALISTA });

    expect(mergeBundle(local, remote, 'conservar').students[0].name).toBe('LOCAL');
  });

  it('las clases se rigen por la misma regla', () => {
    const mia   = { ...cls('c1', 'MI VERSION'), owner: TUTOR };
    const suya  = { ...cls('c1', 'SU VERSION'), owner: TUTOR };
    const out = mergeBundle(
      bundle({ classes: [mia] }),
      bundle({ classes: [suya], from: ESPECIALISTA }),
      'actualizar', TUTOR,
    );
    expect(out.classes[0].name).toBe('MI VERSION');
  });

  it('lo que solo tiene uno se añade, tenga dueño o no', () => {
    const local  = propio({ students: [alumnoDe(TUTOR, 'Ana')] });
    const remote = bundle({ students: [{ ...stu('s2', 'c1', 'Luis'), owner: ESPECIALISTA }], from: ESPECIALISTA });

    const out = mergeBundle(local, remote, 'actualizar', TUTOR);
    expect(out.students.map(s => s.name).sort()).toEqual(['Ana', 'Luis']);
  });
});

/* ══════════════════════════════════════════════════════════
   Notas: la fusión es por celda, no por prueba entera
   ══════════════════════════════════════════════════════════ */

describe('fusión de notas', () => {
  it('mezcla por alumno dentro de la misma prueba, sin pisar al otro', () => {
    const local  = propio({ grades: { i1: { s1: 7 } } });
    const remote = bundle({ grades: { i1: { s2: 9 } } });

    const out = mergeBundle(local, remote, 'conservar');
    expect(out.grades.i1).toEqual({ s1: 7, s2: 9 });
  });

  it('una nota borrada a propósito (null) no la resucita el remoto al conservar', () => {
    // null no es «sin calificar»: es «yo quité esta nota». Debe aguantar.
    const local  = propio({ grades: { i1: { s1: null } } });
    const remote = bundle({ grades: { i1: { s1: 9 } } });

    const out = mergeBundle(local, remote, 'conservar');
    expect(out.grades.i1.s1).toBeNull();
  });

  it('al actualizar la nota del compañero sí sustituye a la mía', () => {
    const local  = propio({ grades: { i1: { s1: 7 } } });
    const remote = bundle({ grades: { i1: { s1: 9 } } });

    const out = mergeBundle(local, remote, 'actualizar');
    expect(out.grades.i1.s1).toBe(9);
  });
});

/* ══════════════════════════════════════════════════════════
   Qué sale de casa: el alcance de lo compartido
   ══════════════════════════════════════════════════════════ */

describe('buildBundle: solo viaja lo marcado', () => {
  const source: SyncSource = {
    classes: [cls('c1'), cls('c2')],
    students: [stu('s1', 'c1'), stu('s2', 'c2')],
    gradeCategories: [cat('cat1', 'c1'), cat('cat2', 'c2')],
    gradeItems: [item('i1', 'c1', 'cat1'), item('i2', 'c2', 'cat2')],
    grades: { i1: { s1: 8 }, i2: { s2: 6 } },
    rubrics: [rub('r1', 'c1'), rub('r2', 'c2'), rub('r3', 'c2', ['c1']), rub('r4')],
    dianas: [],
    evaluations: [evl('e1', 'c1'), evl('e2', 'c2')],
  };

  const scope = (p: Partial<ShareScope> = {}): ShareScope =>
    ({ classIds: ['c1'], grades: true, rubrics: true, evaluations: true, ...p });

  it('la clase no marcada se queda en casa, con sus alumnos y sus notas', () => {
    const b = buildBundle(source, scope());
    expect(b.classes.map(c => c.id)).toEqual(['c1']);
    expect(b.students.map(s => s.id)).toEqual(['s1']);
    expect(b.gradeItems.map(i => i.id)).toEqual(['i1']);
    expect(b.grades.i2).toBeUndefined();
    expect(b.evaluations.map(e => e.id)).toEqual(['e1']);
  });

  it('si no comparto notas, no va ninguna categoría, prueba ni celda', () => {
    const b = buildBundle(source, scope({ grades: false }));
    expect(b.gradeCategories).toHaveLength(0);
    expect(b.gradeItems).toHaveLength(0);
    expect(b.grades).toEqual({});
  });

  it('si no comparto rúbricas ni evaluaciones, no viajan', () => {
    const b = buildBundle(source, scope({ rubrics: false, evaluations: false }));
    expect(b.rubrics).toHaveLength(0);
    expect(b.dianas).toHaveLength(0);
    expect(b.evaluations).toHaveLength(0);
  });
});

describe('buildBundle: las rúbricas no se llevan la biblioteca entera', () => {
  const source: SyncSource = {
    classes: [cls('c1'), cls('c2')], students: [], gradeCategories: [], gradeItems: [], grades: {},
    rubrics: [rub('r1', 'c1'), rub('r2', 'c2'), rub('r3', 'c2', ['c1']), rub('sin-clase')],
    dianas: [], evaluations: [],
  };

  it('solo van las que se usan en las clases elegidas, también si c1 es una de las otras clases', () => {
    const b = buildBundle(source, { classIds: ['c1'], grades: true, rubrics: true, evaluations: true });
    expect(b.rubrics.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('una rúbrica sin clase asignada no sale nunca', () => {
    const b = buildBundle(source, { classIds: ['c1', 'c2'], grades: true, rubrics: true, evaluations: true });
    expect(b.rubrics.map(r => r.id)).not.toContain('sin-clase');
  });
});

describe('importar nunca borra', () => {
  it('lo que ya tengo y no viene en el paquete se queda', () => {
    const out = mergeBundle(
      propio({ students: [stu('s1', 'c1'), stu('s2', 'c1')] }),
      bundle({ students: [stu('s3', 'c1')] }),
      'actualizar',
    );
    expect(out.students.map(s => s.id).sort()).toEqual(['s1', 's2', 's3']);
  });

  it('importar dos veces el mismo paquete da el mismo resultado', () => {
    const local  = propio({ students: [stu('s1', 'c1', 'Ana')], classes: [cls('c1')] });
    const remote = bundle({ students: [stu('s2', 'c1', 'Luis')], classes: [cls('c1')] });
    const once  = mergeBundle(local, remote, 'actualizar');
    const twice = mergeBundle(once, remote, 'actualizar');
    expect(twice).toEqual(once);
  });
});

describe('recuentos y forma del paquete', () => {
  it('cuenta clases, alumnos, notas con valor, instrumentos y evaluaciones', () => {
    const c = bundleCounts(bundle({
      classes: [cls('c1')], students: [stu('s1', 'c1'), stu('s2', 'c1')],
      grades: { i1: { s1: 8, s2: null } }, rubrics: [rub('r1', 'c1')], evaluations: [evl('e1', 'c1')],
    }));
    expect(c).toEqual({ classes: 1, students: 2, grades: 1, rubrics: 1, evaluations: 1 });
  });

  it('esPaquete reconoce uno bueno y descarta lo que no lo es', () => {
    expect(esPaquete(emptyBundle())).toBe(true);
    expect(esPaquete(null)).toBe(false);
    expect(esPaquete({ classes: [] })).toBe(false);
    expect(esPaquete({ ...emptyBundle(), grades: [] })).toBe(false);
  });
});

describe('buildBundle: elegir con detalle lo que se envía', () => {
  const source: SyncSource = {
    classes: [cls('c1'), cls('c2')],
    students: [stu('s1', 'c1', 'Alumno 1'), stu('s2', 'c1', 'Alumno 2'), stu('s3', 'c2')],
    gradeCategories: [cat('exam', 'c1'), cat('tareas', 'c1'), cat('vacia', 'c1')],
    gradeItems: [item('i1', 'c1', 'exam'), item('i2', 'c1', 'exam'), item('i3', 'c1', 'tareas'), item('x', 'c2', 'exam')],
    grades: { i1: { s1: 8, s2: 5 }, i2: { s1: 6, s2: 7 }, i3: { s1: 9, s2: 4 }, x: { s3: 1 } },
    rubrics: [rub('r1', 'c1'), rub('r2', 'c1')],
    dianas: [{ id: 'd1', name: 'd1', items: [], class_id: 'c1' }],
    evaluations: [
      { ...evl('e1', 'c1'), rubric_id: 'r1', student_id: 's1' },
      { ...evl('e2', 'c1'), rubric_id: 'r1', student_id: 's2' },
      { ...evl('e3', 'c1'), rubric_id: 'r2', student_id: 's1' },
    ],
  };
  const base: ShareScope = { classIds: ['c1'], grades: true, rubrics: true, evaluations: true };

  it('sin exclusiones va todo lo de las clases elegidas, como siempre', () => {
    const b = buildBundle(source, base);
    expect(b.students).toHaveLength(2);
    expect(b.gradeItems).toHaveLength(3);
    expect(b.rubrics).toHaveLength(2);
    expect(b.dianas).toHaveLength(1);
    expect(b.evaluations).toHaveLength(3);
  });

  it('un alumno que se deja fuera se lleva sus notas y sus evaluaciones', () => {
    const b = buildBundle(source, { ...base, sinAlumnos: ['s2'] });
    expect(b.students.map(s => s.id)).toEqual(['s1']);
    expect(b.grades.i1).toEqual({ s1: 8 });
    expect(b.grades.i3).toEqual({ s1: 9 });
    expect(b.evaluations.map(e => e.id).sort()).toEqual(['e1', 'e3']);
  });

  it('una columna que se deja fuera no lleva ni sus notas, y su categoría sigue si le quedan otras', () => {
    const b = buildBundle(source, { ...base, sinColumnas: ['i1'] });
    expect(b.gradeItems.map(i => i.id).sort()).toEqual(['i2', 'i3']);
    expect(b.grades.i1).toBeUndefined();
    expect(b.gradeCategories.map(c => c.id)).toContain('exam');
  });

  it('una categoría se va con todas sus columnas, pero una categoría que nunca tuvo columnas se queda', () => {
    const b = buildBundle(source, { ...base, sinColumnas: ['i1', 'i2'] });
    const cats = b.gradeCategories.map(c => c.id).sort();
    expect(cats).toEqual(['tareas', 'vacia']);
  });

  it('se puede dejar fuera una rúbrica o una diana concreta', () => {
    const b = buildBundle(source, { ...base, sinInstrumentos: ['r2', 'd1'] });
    expect(b.rubrics.map(r => r.id)).toEqual(['r1']);
    expect(b.dianas).toHaveLength(0);
  });

  it('se pueden dejar fuera las evaluaciones de un instrumento, y el instrumento sigue', () => {
    const b = buildBundle(source, { ...base, sinEvaluacionesDe: ['r1'] });
    expect(b.evaluations.map(e => e.id)).toEqual(['e3']);
    expect(b.rubrics.map(r => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('las exclusiones de otra clase no afectan a las clases elegidas', () => {
    const b = buildBundle(source, { ...base, sinAlumnos: ['s3'], sinColumnas: ['x'] });
    expect(b.students).toHaveLength(2);
    expect(b.gradeItems).toHaveLength(3);
  });

  it('agrupa las evaluaciones por instrumento, solo de las clases elegidas', () => {
    const grupos = gruposDeEvaluaciones(
      [...source.evaluations, { ...evl('e9', 'c2'), rubric_id: 'r1' }, { ...evl('a1', 'c1'), rubric_id: 'autoeval', rubric_name: 'Mates (autoevaluación)' }],
      ['c1'],
    );
    expect(grupos).toEqual([
      { id: 'autoeval', nombre: 'Autoevaluaciones', n: 1 },
      { id: 'r1', nombre: 'R', n: 2 },
      { id: 'r2', nombre: 'R', n: 1 },
    ]);
  });
});
