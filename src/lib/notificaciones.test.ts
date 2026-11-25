// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  agrupar, avisosDe, CADUCA_ALUMNO, DIAS_CERCA, diasHasta, diasSiCerca, leerOcultos, ocultarAviso, separar, sigueOculto,
  textoDeFalta, volverAEnsenar, type DatosDeAvisos,
} from './notificaciones';
import { shiftDate } from './utils';
import type { CalEvent, Class, GradeItem, Student, Task } from '../types';
import type { Radar } from './radarClase';

const HOY = '2026-11-25';
const t = (k: string, v?: Record<string, string | number>) => k.replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? ''));
const evento = (id: string, dias: number, extra: Partial<CalEvent> = {}): CalEvent => ({
  id, name: `Evento ${id}`, date: shiftDate(HOY, dias), time: '10:00', type: 'deadline', urgency: 'media', color: '#000', desc: '', ...extra,
});
const clase = (id: string): Class => ({ id, name: `Clase ${id}`, subject: 'Matemáticas', subjects: ['Matemáticas'], isTutoria: false, room: '', color: '#000' } as Class);
const alumno = (id: string, class_id = 'c1'): Student => ({ id, class_id, name: `Alumno ${id}`, email: '', photo: null, alerts: [], notes: '' });
const item = (id: string, date: string, class_id = 'c1'): GradeItem => ({ id, class_id, category_id: 'cat-' + class_id, name: `Actividad ${id}`, date });
const tarea = (id: string, priority: Task['priority'], done = false): Task => ({ id, text: `Tarea ${id}`, priority, done });

const base = (extra: Partial<DatosDeAvisos> = {}): DatosDeAvisos => ({
  hoy: HOY, calEvents: [], classes: [clase('c1')], students: [alumno('a'), alumno('b'), alumno('c')],
  gradeItems: [], gradeCategories: [{ id: 'cat-c1', class_id: 'c1', name: 'Pruebas', weight: 100 }], grades: {}, tasks: [], ...extra,
});

describe('cuántos días faltan', () => {
  it('cuenta días de calendario, con las fechas como se escriben (locales)', () => {
    expect(diasHasta('2026-11-25', HOY)).toBe(0);
    expect(diasHasta('2026-11-26', HOY)).toBe(1);
    expect(diasHasta('2026-11-24', HOY)).toBe(-1);
    expect(diasHasta('2026-12-01', HOY)).toBe(6);
    // Cambio de mes y de año
    expect(diasHasta('2027-01-02', '2026-12-30')).toBe(3);
    // El cambio de hora de octubre (25-10-2026) no come ni añade un día
    expect(diasHasta('2026-10-26', '2026-10-24')).toBe(2);
    expect(diasHasta('2026-03-30', '2026-03-28')).toBe(2);
    // Una fecha con hora detrás cuenta por su día
    expect(diasHasta('2026-11-27T23:30', HOY)).toBe(2);
  });

  it('lo que no es una fecha no cuenta', () => {
    expect(diasHasta('', HOY)).toBeNull();
    expect(diasHasta('mañana', HOY)).toBeNull();
    expect(diasHasta('2026-13-01', HOY)).toBeNull();
  });

  it('una fecha imposible no cuenta (no pasa al mes siguiente, donde la Agenda no la pinta)', () => {
    expect(diasHasta('2026-02-30', '2026-02-27')).toBeNull();
    expect(diasSiCerca('2026-04-31', '2026-04-30')).toBeNull();
    expect(diasHasta('2026-11-00', HOY)).toBeNull();
    expect(diasHasta('2028-02-29', '2028-02-27')).toBe(2);
    expect(avisosDe(base({ calEvents: [{ ...evento('x', 0), date: '2026-11-31' }] }))).toEqual([]);
  });

  it('cerca es de hoy (0) a dentro de 5 días, ambos incluidos; nunca lo ya pasado', () => {
    expect(DIAS_CERCA).toBe(5);
    expect(diasSiCerca(HOY, HOY)).toBe(0);
    expect(diasSiCerca(shiftDate(HOY, 5), HOY)).toBe(5);
    expect(diasSiCerca(shiftDate(HOY, 6), HOY)).toBeNull();
    expect(diasSiCerca(shiftDate(HOY, -1), HOY)).toBeNull();
  });

  it('dice cuánto falta', () => {
    expect(textoDeFalta(0, t)).toBe('Hoy');
    expect(textoDeFalta(1, t)).toBe('Mañana');
    expect(textoDeFalta(3, t)).toBe('Faltan 3 días');
  });
});

describe('los avisos', () => {
  it('eventos: solo los de 0 a 5 días, con su clase, el más cercano primero', () => {
    const r = avisosDe(base({
      calEvents: [evento('lejos', 6), evento('pasado', -1), evento('cinco', 5), evento('hoy', 0, { classId: 'c1' }), evento('dos', 2)],
    }));
    expect(r.map(a => a.tipo === 'evento' && a.evento.id)).toEqual(['hoy', 'dos', 'cinco']);
    const hoy = r[0];
    expect(hoy.tipo === 'evento' && [hoy.dias, hoy.clase?.id]).toEqual([0, 'c1']);
  });

  it('una clase que ya no existe no rompe el evento', () => {
    const [a] = avisosDe(base({ calEvents: [evento('x', 1, { classId: 'borrada' })] }));
    expect(a.tipo === 'evento' && a.clase).toBeNull();
  });

  it('a igual distancia, el urgente y, si no, el de antes por hora', () => {
    const r = avisosDe(base({ calEvents: [evento('tarde', 2, { time: '17:00' }), evento('urgente', 2, { urgency: 'alta', time: '18:00' }), evento('pronto', 2, { time: '9:00' })] }));
    expect(r.map(a => a.tipo === 'evento' && a.evento.id)).toEqual(['urgente', 'pronto', 'tarde']);
  });

  it('alumnado: el del radar, con su motivo; sin Mis clases en el perfil, no', () => {
    const radar: Radar = {
      atencion: [{ student: alumno('a'), cls: clase('c1'), dato: { tipo: 'asistencia', clave: '{n} faltas sin justificar', vars: { n: 3 }, peso: 90 }, cuantos: 1 }],
      destacan: [{ student: alumno('b'), cls: clase('c1'), dato: { tipo: 'notas', clave: 'Media de {nota}', peso: 80 }, cuantos: 1 }],
    };
    const r = avisosDe(base({ radar }));
    expect(r.map(a => a.tipo)).toEqual(['alumno']);
    expect(r[0].clave).toBe('alumno:a:{n} faltas sin justificar');
    expect(avisosDe(base({ radar, conAlumnado: false }))).toEqual([]);
  });

  it('alumnado: la clave lleva de qué asignatura habla, no sus números', () => {
    const conDato = (vars: Record<string, string | number>): Radar => ({
      atencion: [{ student: alumno('a'), cls: clase('c1'), dato: { tipo: 'notas', clave: 'Media de {nota} en {asignatura}, por debajo del 5', vars, peso: 95 }, cuantos: 1 }],
      destacan: [],
    });
    const mates = avisosDe(base({ radar: conDato({ nota: 4.2, asignatura: 'Matemáticas' }) }))[0].clave;
    // La nota cambia, pero es lo mismo: sigue oculto
    expect(avisosDe(base({ radar: conDato({ nota: 4, asignatura: 'Matemáticas' }) }))[0].clave).toBe(mates);
    // Otra asignatura con la misma regla: es otro motivo y vuelve
    expect(avisosDe(base({ radar: conDato({ nota: 4.5, asignatura: 'Lengua' }) }))[0].clave).not.toBe(mates);
  });

  it('notas a medio poner: la regla del cuaderno, solo de la evaluación de hoy y de lo ya fechado', () => {
    const grades = { i1: { a: 5, b: 6 }, i2: { a: 5 }, i3: { a: 5, b: 6 }, i4: { a: 7, b: 8 }, i5: { a: 1, b: 2, c: 3 } };
    const r = avisosDe(base({
      gradeItems: [item('i1', '2026-11-20'), item('i2', '2026-11-20'), item('i3', '2026-09-20'), item('i4', '2026-11-30'), item('i5', '2026-11-20')],
      grades,
      // La evaluación de hoy, aquí, desde el 1 de noviembre
      enEvaluacion: f => !f || f >= '2026-11-01',
    }));
    // i1: falta «c» (2 de 3 hechas). i2: solo 1 de 3, aún en ello. i3: de otra evaluación. i4: aún no ha llegado. i5: completa
    expect(r.map(a => a.tipo === 'notas' && a.item.id)).toEqual(['i1']);
    const a = r[0];
    expect(a.tipo === 'notas' && [a.faltan.map(s => s.id), a.total, a.cls.id, a.asignatura]).toEqual([['c'], 3, 'c1', 'Matemáticas']);
    expect(avisosDe(base({ gradeItems: [item('i1', '2026-11-20')], grades, conCuaderno: false }))).toEqual([]);
  });

  it('notas a medio poner: dice la asignatura de la categoría, para abrir el cuaderno en ella', () => {
    const r = avisosDe(base({
      classes: [{ ...clase('c1'), subjects: ['Lengua', 'Ciencias'] }],
      gradeCategories: [{ id: 'cat-c1', class_id: 'c1', name: 'Pruebas', weight: 100, subject: 'Ciencias' }],
      gradeItems: [item('i1', '2026-11-20')], grades: { i1: { a: 5, b: 6 } },
    }));
    expect(r[0].tipo === 'notas' && r[0].asignatura).toBe('Ciencias');
  });

  it('notas a medio poner: el alumnado exento ese día (EF) no cuenta, o el aviso no se iría nunca', () => {
    const datos = base({ gradeItems: [item('i1', '2026-11-20'), item('i2', '2026-11-10')], grades: { i1: { a: 5, b: 6 }, i2: { a: 5, b: 6 } } });
    // «c» estaba exento del 15 al 30: en i1 no falta nadie; en i2 (antes de su exención), sí
    const exentoEn = (id: string, f: string) => id === 'c' && f >= '2026-11-15' && f <= '2026-11-30';
    const r = avisosDe({ ...datos, exentoEn });
    expect(r.map(a => a.tipo === 'notas' && [a.item.id, a.total])).toEqual([['i2', 3]]);
    expect(avisosDe(datos).map(a => a.tipo === 'notas' && a.item.id)).toEqual(['i1', 'i2']);
  });

  it('el bloque de «Trabajo diario y actitud» no cuenta como actividad', () => {
    const r = avisosDe(base({
      gradeCategories: [{ id: 'marksblock:c1', class_id: 'c1', name: 'Bloque', weight: 0 }],
      gradeItems: [{ ...item('b1', '2026-11-20'), category_id: 'marksblock:c1' }], grades: { b1: { a: 5, b: 5 } },
    }));
    expect(r.filter(a => a.tipo === 'notas')).toEqual([]);
  });

  it('tareas: las que no están hechas', () => {
    const r = avisosDe(base({ tasks: [tarea('1', 'low'), tarea('2', 'high'), tarea('3', 'high', true)] }));
    expect(r.map(a => a.tipo === 'tarea' && a.tarea.id)).toEqual(['2', '1']);
  });

  it('primero lo más urgente, y agrupados por tipo con el grupo más urgente delante', () => {
    const radar: Radar = {
      atencion: [{ student: alumno('a'), cls: clase('c1'), dato: { tipo: 'notas', clave: 'x', peso: 82 }, cuantos: 1 }],
      destacan: [],
    };
    const r = avisosDe(base({
      radar, calEvents: [evento('cinco', 5), evento('hoy', 0)], tasks: [tarea('t', 'high')],
      gradeItems: [item('i1', '2026-11-20')], grades: { i1: { a: 5, b: 6 } },
    }));
    // hoy (100), tarea alta (65), alumno (60), cinco días (50), notas (40)
    expect(r.map(a => a.clave.split(':').slice(0, 2).join(':'))).toEqual(['evento:hoy', 'tarea:t', 'alumno:a', 'evento:cinco', 'notas:i1']);
    expect(agrupar(r).map(g => [g.tipo, g.avisos.length])).toEqual([['evento', 2], ['tarea', 1], ['alumno', 1], ['notas', 1]]);
  });
});

describe('«Ya lo he visto»', () => {
  beforeEach(() => localStorage.clear());

  it('oculta un aviso, se guarda por perfil y vuelve a enseñarse', () => {
    const avisos = avisosDe(base({ calEvents: [evento('e', 3)], tasks: [tarea('t', 'low')] }));
    const clave = avisos.find(a => a.tipo === 'evento')!.clave;
    const ocultos = ocultarAviso('p1', clave, HOY);
    expect(leerOcultos('p1')).toEqual({ [clave]: HOY });
    expect(leerOcultos('p2')).toEqual({});
    const s = separar(avisos, ocultos, HOY);
    expect(s.visibles.map(a => a.tipo)).toEqual(['tarea']);
    expect(s.ocultos.map(a => a.clave)).toEqual([clave]);
    expect(volverAEnsenar('p1', [clave])).toEqual({});
  });

  it('un evento oculto vuelve cuando pasa a ser mañana u hoy, o cambia de día', () => {
    const a3 = avisosDe(base({ calEvents: [evento('e', 3)] }))[0];
    const ocultos = ocultarAviso('p1', a3.clave, HOY);
    // Dos días después le falta 1: el motivo ha cambiado
    const manana = avisosDe(base({ hoy: shiftDate(HOY, 2), calEvents: [evento('e', 3)] }));
    expect(separar(manana, ocultos, shiftDate(HOY, 2)).visibles).toHaveLength(1);
    // Al día siguiente aún faltan 2: sigue oculto
    const pasado = avisosDe(base({ hoy: shiftDate(HOY, 1), calEvents: [evento('e', 3)] }));
    expect(separar(pasado, ocultos, shiftDate(HOY, 1)).visibles).toHaveLength(0);
    // Cambia de día: vuelve
    expect(separar(avisosDe(base({ calEvents: [evento('e', 4)] })), ocultos, HOY).visibles).toHaveLength(1);
  });

  it('un alumno oculto vuelve si cambia la regla o a las 4 semanas', () => {
    expect(sigueOculto('alumno:a:x', HOY, shiftDate(HOY, CADUCA_ALUMNO - 1))).toBe(true);
    expect(sigueOculto('alumno:a:x', HOY, shiftDate(HOY, CADUCA_ALUMNO))).toBe(false);
    expect(sigueOculto('notas:i1', HOY, shiftDate(HOY, 200))).toBe(true);
    expect(sigueOculto('notas:i1', undefined, HOY)).toBe(false);
  });

  it('las tareas nunca se ocultan: se marcan como hechas', () => {
    const avisos = avisosDe(base({ tasks: [tarea('t', 'low')] }));
    expect(separar(avisos, { 'tarea:t': HOY }, HOY).visibles).toHaveLength(1);
  });

  it('un almacenamiento estropeado no rompe nada', () => {
    localStorage.setItem('aulapro_avisos_vistos_p1', '[1,2');
    expect(leerOcultos('p1')).toEqual({});
    localStorage.setItem('aulapro_avisos_vistos_p1', JSON.stringify({ a: 3, b: '2026-11-01' }));
    expect(leerOcultos('p1')).toEqual({ b: '2026-11-01' });
  });
});
