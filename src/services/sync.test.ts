import { describe, it, expect } from 'vitest';
import {
  buildBundle, mergeBundle, hashBundle, emptyBundle, emptyTombstones,
  type SharedBundle, type SyncSource, type ShareScope,
} from './sync';
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

const rub = (id: string): Rubric => ({ id, name: id, criteria: [] });

const evl = (id: string, class_id: string): Evaluation => ({
  id, rubric_id: 'r1', rubric_name: 'R', student_id: 's1', student_name: 'S',
  class_id, date: '2026-01-01', scores: {}, notes: '',
});

function bundle(patch: Partial<SharedBundle> = {}): SharedBundle {
  return { ...emptyBundle(), ...patch };
}

/* ══════════════════════════════════════════════════════════
   Fusión de listas
   ══════════════════════════════════════════════════════════ */

describe('mergeBundle: quién gana ante el mismo id', () => {
  it('en reconcile conserva lo LOCAL: nadie pierde su trabajo al conectarse', () => {
    const local  = bundle({ students: [stu('s1', 'c1', 'Ana LOCAL')] });
    const remote = bundle({ students: [stu('s1', 'c1', 'Ana REMOTA')] });

    const out = mergeBundle(local, remote, 'reconcile');
    expect(out.students).toHaveLength(1);
    expect(out.students[0].name).toBe('Ana LOCAL');
  });

  it('en live gana lo REMOTO: es una edición deliberada del compañero', () => {
    const local  = bundle({ students: [stu('s1', 'c1', 'Ana LOCAL')] });
    const remote = bundle({ students: [stu('s1', 'c1', 'Ana REMOTA')] });

    const out = mergeBundle(local, remote, 'live');
    expect(out.students[0].name).toBe('Ana REMOTA');
  });

  it('lo que solo existe en un lado se añade, en los dos modos', () => {
    const local  = bundle({ students: [stu('s1', 'c1')] });
    const remote = bundle({ students: [stu('s2', 'c1')] });

    for (const mode of ['reconcile', 'live'] as const) {
      const ids = mergeBundle(local, remote, mode).students.map(s => s.id).sort();
      expect(ids).toEqual(['s1', 's2']);
    }
  });
});

/* ══════════════════════════════════════════════════════════
   Lápidas: un borrado no puede resucitar
   ══════════════════════════════════════════════════════════ */

describe('lápidas', () => {
  it('un borrado REMOTO elimina el dato local, aunque local mande (reconcile)', () => {
    const local  = bundle({ students: [stu('s1', 'c1')] });
    const remote = bundle({ tombstones: { ...emptyTombstones(), students: ['s1'] } });

    const out = mergeBundle(local, remote, 'reconcile');
    expect(out.students).toHaveLength(0);
  });

  it('un borrado LOCAL impide que el remoto lo resucite (live)', () => {
    // El caso peligroso: yo borro a un alumno, mi compañero todavía lo tiene,
    // y en modo live el remoto normalmente ganaría.
    const local  = bundle({ tombstones: { ...emptyTombstones(), students: ['s1'] } });
    const remote = bundle({ students: [stu('s1', 'c1')] });

    const out = mergeBundle(local, remote, 'live');
    expect(out.students).toHaveLength(0);
  });

  it('las lápidas se acumulan de los dos lados y sin duplicados', () => {
    const local  = bundle({ tombstones: { ...emptyTombstones(), students: ['s1', 's2'] } });
    const remote = bundle({ tombstones: { ...emptyTombstones(), students: ['s2', 's3'] } });

    const out = mergeBundle(local, remote, 'live');
    expect(out.tombstones.students.sort()).toEqual(['s1', 's2', 's3']);
  });

  it('borrar una prueba se lleva sus notas en la fusión', () => {
    const local  = bundle({
      gradeItems: [item('i1', 'c1', 'cat1')],
      grades: { i1: { s1: 8 } },
    });
    const remote = bundle({ tombstones: { ...emptyTombstones(), gradeItems: ['i1'] } });

    const out = mergeBundle(local, remote, 'reconcile');
    expect(out.gradeItems).toHaveLength(0);
    expect(out.grades.i1).toBeUndefined();
  });
});

/* ══════════════════════════════════════════════════════════
   Notas: la fusión es por celda, no por prueba entera
   ══════════════════════════════════════════════════════════ */

describe('fusión de notas', () => {
  it('mezcla por alumno dentro de la misma prueba, sin pisar al otro', () => {
    const local  = bundle({ grades: { i1: { s1: 7 } } });
    const remote = bundle({ grades: { i1: { s2: 9 } } });

    const out = mergeBundle(local, remote, 'reconcile');
    expect(out.grades.i1).toEqual({ s1: 7, s2: 9 });
  });

  it('una nota borrada a propósito (null) no la resucita el remoto en reconcile', () => {
    // null no es «sin calificar»: es «yo quité esta nota». Debe aguantar.
    const local  = bundle({ grades: { i1: { s1: null } } });
    const remote = bundle({ grades: { i1: { s1: 9 } } });

    const out = mergeBundle(local, remote, 'reconcile');
    expect(out.grades.i1.s1).toBeNull();
  });

  it('en live la nota del compañero sí sustituye a la mía', () => {
    const local  = bundle({ grades: { i1: { s1: 7 } } });
    const remote = bundle({ grades: { i1: { s1: 9 } } });

    const out = mergeBundle(local, remote, 'live');
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
    rubrics: [rub('r1')],
    dianas: [],
    evaluations: [evl('e1', 'c1'), evl('e2', 'c2')],
    tombstones: { ...emptyTombstones(), students: ['borrado1'] },
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

  it('las lápidas viajan SIEMPRE enteras, aunque su clase no se comparta', () => {
    // Son solo ids, no datos personales, y hacen falta completas para que un
    // borrado llegue aunque la clase afectada ya no esté marcada.
    const b = buildBundle(source, scope({ classIds: [] }));
    expect(b.tombstones.students).toEqual(['borrado1']);
  });
});

/* ══════════════════════════════════════════════════════════
   Huella: detectar cambios sin comparar objeto a objeto
   ══════════════════════════════════════════════════════════ */

describe('hashBundle', () => {
  it('mismo contenido, misma huella', () => {
    expect(hashBundle(bundle({ students: [stu('s1', 'c1')] })))
      .toBe(hashBundle(bundle({ students: [stu('s1', 'c1')] })));
  });

  it('un cambio mínimo cambia la huella', () => {
    expect(hashBundle(bundle({ students: [stu('s1', 'c1', 'Ana')] })))
      .not.toBe(hashBundle(bundle({ students: [stu('s1', 'c1', 'Anna')] })));
  });
});

/* ══════════════════════════════════════════════════════════
   Convergencia: fusionar dos veces no debe cambiar nada más
   ══════════════════════════════════════════════════════════ */

describe('convergencia', () => {
  it('aplicar la misma fusión otra vez da el mismo resultado (idempotente)', () => {
    // Si no lo fuera, la sincronización en vivo entraría en bucle infinito.
    const local  = bundle({ students: [stu('s1', 'c1', 'Ana')], classes: [cls('c1')] });
    const remote = bundle({ students: [stu('s2', 'c1', 'Luis')], classes: [cls('c1')] });

    const once  = mergeBundle(local, remote, 'live');
    const twice = mergeBundle(once, remote, 'live');
    expect(hashBundle(twice)).toBe(hashBundle(once));
  });
});
