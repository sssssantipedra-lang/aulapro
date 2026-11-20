import { describe, it, expect } from 'vitest';
import type { Class, Evaluation, ScheduleBlock } from '../types';
import {
  claseDePartida, comoCorreccion, esRondaNueva, estadoDe, evaluacionQueCorrige, evaluacionVigente, hechoEnRonda, idDeEvaluacion,
  marcados, marcasATodos, marcasValidas, mismasMarcas, porGuardar, siguientePendiente, sinCeros, ultimasPorAlumno,
} from './evaluarClase';

const ev = (p: Partial<Evaluation>): Evaluation => ({
  id: 'e1', rubric_id: 'r1', rubric_name: 'Exposición oral', student_id: 's1', student_name: 'Alumno 1',
  class_id: 'c1', date: '2026-11-20', scores: { a: 3 }, notes: '', instrument: 'rubric', grade: 7.5, ...p,
});
const clase = (id: string): Class => ({ id, name: id, subject: 'Lengua' } as Class);
const bloque = (class_id: string, day: number, time_start: string, time_end: string): ScheduleBlock =>
  ({ id: `b-${class_id}-${day}`, day, time_start, time_end, subject: '', room: '', class_id, color: '' });

describe('ultimasPorAlumno', () => {
  it('se queda con la más reciente de cada alumno con ese instrumento en esa clase', () => {
    const lista = [
      ev({ id: 'nueva', date: '2026-11-20' }),
      ev({ id: 'vieja', date: '2026-11-10' }),
      ev({ id: 'otro', student_id: 's2', date: '2026-11-12' }),
      ev({ id: 'otraClase', student_id: 's3', class_id: 'c2' }),
      ev({ id: 'otroInstrumento', student_id: 's4', rubric_id: 'r2' }),
    ];
    const u = ultimasPorAlumno(lista, 'r1', 'rubric', 'c1');
    expect(Object.keys(u).sort()).toEqual(['s1', 's2']);
    expect(u.s1.id).toBe('nueva');
    expect(u.s2.id).toBe('otro');
  });

  it('a igual fecha manda la que va antes en la lista, que es la última guardada', () => {
    const u = ultimasPorAlumno([ev({ id: 'segunda' }), ev({ id: 'primera' })], 'r1', 'rubric', 'c1');
    expect(u.s1.id).toBe('segunda');
  });

  it('no mezcla una rúbrica con una diana ni cuenta las evaluaciones sin alumno', () => {
    const lista = [ev({ id: 'd', instrument: 'diana' }), ev({ id: 'sin', student_id: '' }), ev({ id: 'antigua', instrument: undefined })];
    expect(ultimasPorAlumno(lista, 'r1', 'diana', 'c1').s1.id).toBe('d');
    // Las evaluaciones de antes no llevan `instrument`: son de rúbrica
    expect(ultimasPorAlumno(lista, 'r1', 'rubric', 'c1').s1.id).toBe('antigua');
  });
});

describe('estadoDe', () => {
  it('distingue hoy, otro día y sin evaluar', () => {
    expect(estadoDe(undefined, '2026-11-20')).toBe('pendiente');
    expect(estadoDe(ev({}), '2026-11-20')).toBe('hoy');
    expect(estadoDe(ev({ date: '2026-11-12' }), '2026-11-20')).toBe('antes');
  });
});

describe('evaluacionVigente', () => {
  it('es la más reciente con nota de ese alumno con ese instrumento en esa clase', () => {
    const a = ev({ id: 'a', date: '2026-11-10' }), b = ev({ id: 'b', date: '2026-11-20' });
    const sinNota = ev({ id: 'c', date: '2026-11-21', grade: undefined });
    expect(evaluacionVigente([sinNota, b, a], a)?.id).toBe('b');
  });

  it('a igual fecha manda la que va antes en la lista, como al borrar', () => {
    const a = ev({ id: 'a' }), b = ev({ id: 'b' });
    expect(evaluacionVigente([b, a], a)?.id).toBe('b');
  });

  it('no mira las de otro alumno, otra clase u otro instrumento', () => {
    const a = ev({ id: 'a', date: '2026-11-10' });
    const otras = [ev({ id: 'x', student_id: 's2' }), ev({ id: 'y', class_id: 'c2' }), ev({ id: 'z', rubric_id: 'r2' })];
    expect(evaluacionVigente([...otras, a], a)?.id).toBe('a');
    expect(evaluacionVigente(otras, a)).toBeUndefined();
  });
});

describe('claseDePartida', () => {
  const classes = [clase('c1'), clase('c2'), clase('c3')];
  // Viernes 20-11-2026 a las 10:15
  const ahora = new Date(2026, 10, 20, 10, 15);

  it('la que se pide (la de la sesión) gana si el instrumento es de esa clase', () => {
    expect(claseDePartida({ instrumento: { id: 'r1' }, classes, pedida: 'c3', ahora })).toBe('c3');
    expect(claseDePartida({ instrumento: { id: 'r1', class_id: 'c1' }, classes, pedida: 'c3', ahora })).toBe('c1');
  });

  it('con una sola clase posible no hay nada que elegir', () => {
    expect(claseDePartida({ instrumento: { id: 'r1', class_id: 'c2' }, classes, scheduleBlocks: [bloque('c1', 5, '10:00', '11:00')], ahora })).toBe('c2');
  });

  it('propone la que toca ahora por el horario, entre las del instrumento', () => {
    const scheduleBlocks = [bloque('c1', 5, '8:00', '9:00'), bloque('c2', 5, '10:00', '11:00'), bloque('c3', 5, '12:00', '13:00')];
    expect(claseDePartida({ instrumento: { id: 'r1' }, classes, scheduleBlocks, ahora })).toBe('c2');
    // La rúbrica es de c1 y c3: c2 no vale aunque esté en marcha; la siguiente de hoy es c3
    const inst = { id: 'r1', class_id: 'c1', otras_clases: [{ class_id: 'c3' }] };
    expect(claseDePartida({ instrumento: inst, classes, scheduleBlocks, ahora })).toBe('c3');
  });

  it('sin horario que valga, la última clase en la que se evaluó con ese instrumento', () => {
    const evaluations = [ev({ class_id: 'c1', date: '2026-11-10' }), ev({ class_id: 'c3', date: '2026-11-18' }), ev({ class_id: 'c2', date: '2026-11-19', rubric_id: 'otra' })];
    expect(claseDePartida({ instrumento: { id: 'r1' }, classes, evaluations, ahora })).toBe('c3');
  });

  it('y si no, la principal del instrumento o la primera', () => {
    const inst = { id: 'r1', class_id: 'c2', otras_clases: [{ class_id: 'c3' }] };
    expect(claseDePartida({ instrumento: inst, classes, ahora })).toBe('c2');
    expect(claseDePartida({ instrumento: { id: 'r1' }, classes, ahora })).toBe('c1');
    expect(claseDePartida({ instrumento: { id: 'r1' }, classes: [], ahora })).toBe('');
  });
});

describe('siguientePendiente', () => {
  const orden = ['a', 'b', 'c', 'd'];

  it('pasa al siguiente de la lista que falta, saltando los hechos', () => {
    expect(siguientePendiente(orden, 'a', id => id === 'b')).toBe('c');
  });

  it('da la vuelta al llegar al final', () => {
    expect(siguientePendiente(orden, 'd', id => id === 'a')).toBe('b');
  });

  it('no devuelve al que se acaba de guardar ni a nadie si no queda ninguno', () => {
    expect(siguientePendiente(orden, 'b', id => id !== 'b')).toBeUndefined();
    expect(siguientePendiente(['a'], 'a', () => false)).toBeUndefined();
    expect(siguientePendiente([], '', () => false)).toBeUndefined();
  });

  it('sin nadie elegido, el primero que falte', () => {
    expect(siguientePendiente(orden, '', id => id === 'a')).toBe('b');
  });
});

describe('lo marcado', () => {
  it('quita los ceros de la diana y cuenta lo marcado', () => {
    expect(sinCeros({ a: 3, b: 0, c: 1 })).toEqual({ a: 3, c: 1 });
    expect(marcados({ a: 3, b: 0, huerfano: 2 }, ['a', 'b', 'c'])).toBe(1);
  });

  it('pone el mismo nivel a todos los criterios', () => {
    expect(marcasATodos(['a', 'b'], 3)).toEqual({ a: 3, b: 3 });
  });

  it('dos marcados son iguales si coinciden niveles y observaciones, sin contar ceros ni espacios', () => {
    expect(mismasMarcas({ scores: { a: 3, b: 0 }, notes: 'Bien ' }, { scores: { a: 3 }, notes: 'Bien' })).toBe(true);
    expect(mismasMarcas({ scores: { a: 3 }, notes: '' }, { scores: { a: 2 }, notes: '' })).toBe(false);
    expect(mismasMarcas({ scores: { a: 3 }, notes: '' }, { scores: { a: 3, b: 1 }, notes: '' })).toBe(false);
    expect(mismasMarcas({ scores: { a: 3 }, notes: 'x' }, { scores: { a: 3 }, notes: '' })).toBe(false);
  });
});

describe('evaluacionQueCorrige', () => {
  const hoy = '2026-11-20';
  const deHoy = ev({ id: 'hoy' }), vieja = ev({ id: 'vieja', date: '2026-11-10' });

  it('sin decir nada, corrige la de hoy y no toca la de otro día', () => {
    expect(evaluacionQueCorrige(undefined, deHoy, hoy, [deHoy])?.id).toBe('hoy');
    expect(evaluacionQueCorrige(undefined, vieja, hoy, [vieja])).toBeUndefined();
    expect(evaluacionQueCorrige({ scores: {}, notes: '' }, deHoy, hoy, [deHoy])?.id).toBe('hoy');
  });

  it('con un id corrige esa, aunque sea de otro día', () => {
    expect(evaluacionQueCorrige({ scores: {}, notes: '', editId: 'vieja' }, deHoy, hoy, [deHoy, vieja])?.id).toBe('vieja');
  });

  it('con null es otro trabajo: no corrige ninguna', () => {
    expect(evaluacionQueCorrige({ scores: {}, notes: '', editId: null }, deHoy, hoy, [deHoy])).toBeUndefined();
  });
});

describe('porGuardar', () => {
  const ids = ['a', 'b'];

  it('sin nada marcado no hay nada que guardar', () => {
    expect(porGuardar(undefined, undefined, ids)).toBe(false);
    expect(porGuardar({ scores: { a: 0 }, notes: 'algo' }, undefined, ids)).toBe(false);
  });

  it('una evaluación nueva con algo marcado está por guardar', () => {
    expect(porGuardar({ scores: { a: 2 }, notes: '' }, undefined, ids)).toBe(true);
  });

  it('una corrección solo está por guardar si cambia algo', () => {
    const original = ev({ scores: { a: 3, b: 2 }, notes: 'Bien' });
    expect(porGuardar({ scores: { a: 3, b: 2 }, notes: 'Bien' }, original, ids)).toBe(false);
    expect(porGuardar({ scores: { a: 4, b: 2 }, notes: 'Bien' }, original, ids)).toBe(true);
    expect(porGuardar({ scores: { a: 3, b: 2 }, notes: 'Mejor' }, original, ids)).toBe(true);
  });
});

describe('comoCorreccion', () => {
  it('lleva lo nuevo con el id, la fecha, la clase y el alumno de la original', () => {
    const original = ev({ id: 'orig', date: '2026-11-10', scores: { a: 1 }, grade: 2.5 });
    const nueva = ev({ id: 'nueva', date: '2026-11-20', scores: { a: 4 }, grade: 10, notes: 'Corregida' });
    expect(comoCorreccion(nueva, original)).toMatchObject({ id: 'orig', date: '2026-11-10', scores: { a: 4 }, grade: 10, notes: 'Corregida' });
  });
});

describe('idDeEvaluacion', () => {
  it('no se repite al guardar a varios alumnos seguidos', () => {
    const ids = new Set(Array.from({ length: 200 }, idDeEvaluacion));
    expect(ids.size).toBe(200);
  });
});

describe('esRondaNueva y hechoEnRonda', () => {
  const hoy = '2026-11-20';
  const orden = ['s1', 's2'];
  it('es una vuelta nueva si todos tienen evaluación y alguna no es de hoy', () => {
    expect(esRondaNueva(orden, { s1: ev({ date: '2026-10-01' }), s2: ev({ date: '2026-10-02' }) }, hoy)).toBe(true);
    expect(esRondaNueva(orden, { s1: ev({ date: hoy }), s2: ev({ date: '2026-10-02' }) }, hoy)).toBe(true);
  });
  it('no lo es si falta alguien por evaluar, si todos son de hoy o si la clase no tiene alumnado', () => {
    expect(esRondaNueva(orden, { s1: ev({ date: '2026-10-01' }) }, hoy)).toBe(false);
    expect(esRondaNueva(orden, { s1: ev({ date: hoy }), s2: ev({ date: hoy }) }, hoy)).toBe(false);
    expect(esRondaNueva([], {}, hoy)).toBe(false);
  });
  it('en la primera vuelta cuenta cualquier evaluación; en una nueva, solo la de hoy', () => {
    expect(hechoEnRonda('antes', false)).toBe(true);
    expect(hechoEnRonda('hoy', false)).toBe(true);
    expect(hechoEnRonda('pendiente', false)).toBe(false);
    expect(hechoEnRonda('antes', true)).toBe(false);
    expect(hechoEnRonda('hoy', true)).toBe(true);
  });
});

describe('marcasValidas', () => {
  it('deja solo los criterios que el instrumento sigue teniendo y los niveles de su escala', () => {
    expect(marcasValidas({ a: 5, b: 3, z: 2, c: 0 }, ['a', 'b', 'c'], [1, 2, 3, 4])).toEqual({ b: 3 });
  });
  it('sin escala, vale cualquier nivel marcado de sus criterios', () => {
    expect(marcasValidas({ a: 5, z: 2 }, ['a', 'b'])).toEqual({ a: 5 });
  });
});
