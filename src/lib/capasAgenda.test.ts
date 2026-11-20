// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CAPAS, apuntesDeAgenda, apuntesVisibles, capasApagadas, capasDe, eventosVisibles, guardarCapasApagadas, pantallaDe, porFecha,
  type CapaAgenda,
} from './capasAgenda';
import { translate, EN_DICT } from '../i18n';
import { CA } from '../i18n/ca';
import { leerCopiaDeDatos } from './copiaDeDatos';
import type { GradeItem, WorkSession } from '../types';
import type { MarcaPrueba, SesionEF } from '../types/ef';

const ses = (id: string, extra: Partial<SesionEF> = {}): SesionEF =>
  ({ id, titulo: `Sesión ${id}`, objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '', ...extra });
const item = (id: string, class_id: string, date: string, category_id = 'cat1'): GradeItem => ({ id, class_id, category_id, name: `Actividad ${id}`, date });
const reunion = (id: string, kind: WorkSession['kind'], date: string, extra: Partial<WorkSession> = {}): WorkSession =>
  ({ id, kind, at: '', date, title: `Acto ${id}`, notes: '', ...extra });
const marca = (id: string, pruebaId: string, alumnoId: string, fecha: string): MarcaPrueba => ({ id, pruebaId, alumnoId, fecha, valor: 1 });

const classes = [{ id: 'c1' }, { id: 'c2' }];

describe('capas de la Agenda · lo que tiene fecha', () => {
  it('las sesiones con fecha, sin las archivadas ni las que no tienen día', () => {
    const a = apuntesDeAgenda({ classes, sesiones: [
      ses('a', { fecha: '2026-11-23', claseId: 'c1' }), ses('b'), ses('c', { fecha: '2026-11-24', archivada: true }),
      ses('d', { fecha: '2026-11-20', claseId: 'c2', completada: true }), ses('e', { fecha: 'mañana' }),
    ] });
    expect(a.map(x => [x.id, x.fecha, x.claseId, x.hecho])).toEqual([
      ['sesiones:d', '2026-11-20', 'c2', true], ['sesiones:a', '2026-11-23', 'c1', undefined],
    ]);
  });
  it('las actividades del cuaderno, con su categoría', () => {
    const a = apuntesDeAgenda({ classes, gradeItems: [item('ex', 'c1', '2026-11-25'), item('sinfecha', 'c1', '')], gradeCategories: [{ id: 'cat1', name: 'Pruebas' }] });
    expect(a).toEqual([{ id: 'cuaderno:ex', capa: 'cuaderno', tipo: 'actividad', fecha: '2026-11-25', titulo: 'Actividad ex', claseId: 'c1', extra: 'Pruebas' }]);
  });
  it('las reuniones y las formaciones, con su hora, y sin clase', () => {
    const a = apuntesDeAgenda({ classes, workSessions: [reunion('f', 'training', '2026-11-26', { organizer: ' CEFIRE ' }), reunion('r', 'meeting', '2026-11-26', { timeStart: '17:00' })] });
    expect(a.map(x => [x.tipo, x.hora, x.extra, x.claseId])).toEqual([['formacion', undefined, 'CEFIRE', undefined], ['reunion', '17:00', undefined, undefined]]);
  });
  it('las marcas de una prueba física se juntan por prueba, clase y día', () => {
    const a = apuntesDeAgenda({
      classes, pruebas: [{ id: 'p1', nombre: 'Course Navette' }],
      students: [{ id: 's1', class_id: 'c1' }, { id: 's2', class_id: 'c1' }, { id: 's3', class_id: 'c2' }],
      marcas: [marca('m1', 'p1', 's1', '2026-11-18'), marca('m2', 'p1', 's2', '2026-11-18'), marca('m3', 'p1', 's3', '2026-11-18'),
        marca('m4', 'p1', 's1', '2026-11-19'), marca('m5', 'borrada', 's1', '2026-11-19')],
    });
    expect(a.map(x => [x.fecha, x.claseId, x.cuantas, x.titulo])).toEqual([
      ['2026-11-18', 'c1', 2, 'Course Navette'], ['2026-11-18', 'c2', 1, 'Course Navette'], ['2026-11-19', 'c1', 1, 'Course Navette'],
    ]);
  });
  it('una clase que ya no existe no rompe nada: el apunte se queda sin clase', () => {
    expect(apuntesDeAgenda({ classes, sesiones: [ses('a', { fecha: '2026-11-23', claseId: 'borrada' })] })[0].claseId).toBeUndefined();
  });
  it('salen por día y, dentro del día, sesiones, cuaderno, pruebas y reuniones', () => {
    const a = apuntesDeAgenda({
      classes, sesiones: [ses('s', { fecha: '2026-11-23' })], gradeItems: [item('g', 'c1', '2026-11-23'), item('antes', 'c1', '2026-11-02')],
      workSessions: [reunion('r', 'meeting', '2026-11-23')],
    });
    expect(a.map(x => x.id)).toEqual(['cuaderno:antes', 'sesiones:s', 'cuaderno:g', 'reuniones:r']);
    expect(new Set(a.map(x => x.id)).size).toBe(a.length);
  });
});

describe('capas de la Agenda · lo que se ve', () => {
  const apuntes = apuntesDeAgenda({
    classes, sesiones: [ses('s1', { fecha: '2026-11-23', claseId: 'c1' }), ses('s2', { fecha: '2026-11-23', claseId: 'c2' })],
    gradeItems: [item('g', 'c1', '2026-11-24')], workSessions: [reunion('r', 'meeting', '2026-11-24')],
  });
  it('sin las capas apagadas', () => {
    expect(apuntesVisibles(apuntes, new Set<CapaAgenda>(['sesiones', 'reuniones'])).map(a => a.id)).toEqual(['cuaderno:g']);
    expect(apuntesVisibles(apuntes, new Set()).length).toBe(4);
  });
  it('con una clase elegida, solo lo suyo: lo que no es de ninguna clase tampoco sale', () => {
    expect(apuntesVisibles(apuntes, new Set(), 'c1').map(a => a.id)).toEqual(['sesiones:s1', 'cuaderno:g']);
  });
  it('los eventos, igual: todos, o solo los de la clase', () => {
    const ev = [{ id: 'a', classId: 'c1' }, { id: 'b' }, { id: 'c', classId: 'c2' }];
    expect(eventosVisibles(ev).map(e => e.id)).toEqual(['a', 'b', 'c']);
    expect(eventosVisibles(ev, 'c1').map(e => e.id)).toEqual(['a']);
  });
  it('agrupa por día', () => {
    expect(Object.fromEntries(Object.entries(porFecha(apuntes)).map(([k, v]) => [k, v.length]))).toEqual({ '2026-11-23': 2, '2026-11-24': 2 });
  });
});

describe('capas de la Agenda · a qué pantalla lleva cada una y qué perfil las tiene', () => {
  it('cada apunte abre su pantalla', () => {
    expect(pantallaDe({ capa: 'sesiones', tipo: 'sesion' }, false)).toBe('sesiones');
    expect(pantallaDe({ capa: 'sesiones', tipo: 'sesion' }, true)).toBe('ef-sesiones');
    expect(pantallaDe({ capa: 'cuaderno', tipo: 'actividad' }, false)).toBe('notebook');
    expect(pantallaDe({ capa: 'pruebas', tipo: 'prueba' }, true)).toBe('ef-pruebas');
    expect(pantallaDe({ capa: 'reuniones', tipo: 'reunion' }, false)).toBe('meetings');
    expect(pantallaDe({ capa: 'reuniones', tipo: 'formacion' }, false)).toBe('trainings');
  });
  it('las pruebas físicas, solo en Educación Física; PT y AL, solo reuniones y formaciones', () => {
    expect(capasDe(false, () => true)).toEqual(['sesiones', 'cuaderno', 'reuniones']);
    expect(capasDe(true, () => true)).toEqual(['sesiones', 'cuaderno', 'reuniones', 'pruebas']);
    expect(capasDe(false, s => s === 'meetings' || s === 'trainings')).toEqual(['reuniones']);
  });
  it('los nombres de las capas están en inglés y en catalán', () => {
    for (const c of CAPAS) {
      expect(translate('es', c.label)).toBe(c.label);
      expect(c.label in EN_DICT && c.label in CA).toBe(true);
    }
  });
});

describe('capas de la Agenda · las apagadas se recuerdan en el dispositivo', () => {
  beforeEach(() => localStorage.clear());
  it('de entrada, todas encendidas', () => { expect([...capasApagadas()]).toEqual([]); });
  it('se guardan y se leen', () => {
    guardarCapasApagadas(new Set<CapaAgenda>(['cuaderno', 'reuniones']));
    expect([...capasApagadas()].sort()).toEqual(['cuaderno', 'reuniones']);
  });
  it('lo guardado roto o con capas que no existen no rompe nada', () => {
    localStorage.setItem('aulapro_agenda_capas_apagadas', '["cuaderno","inventada",7]');
    expect([...capasApagadas()]).toEqual(['cuaderno']);
    localStorage.setItem('aulapro_agenda_capas_apagadas', '{mal');
    expect([...capasApagadas()]).toEqual([]);
  });
});

describe('la clase de un evento sobrevive a las copias', () => {
  it('una copia de los datos conserva el campo «Clase» del evento', () => {
    const evento = { id: 'e1', name: 'Examen', date: '2026-11-25', time: '09:00', type: 'deadline', urgency: 'alta', color: '#000', desc: '', classId: 'c1' };
    const copia = leerCopiaDeDatos(JSON.stringify({ _app: 'AulaPro', version: 2, data: { classes: [{ id: 'c1', name: '3.º A' }], events: [evento] } }));
    expect(copia.ok).toBe(true);
    expect(copia.ok && (copia.datos.events as unknown[])[0]).toEqual(evento);
  });
});
