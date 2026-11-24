// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  aplicarFechas, asignaturasDeClase, asignaturasPropuestas, bloquesDe, correrDesde, diaDeLaSemana, finDelCursoDe,
  franjasDelDia, franjasDeLaSemana, huecosDesde, motivoNoLectivo, recordarReparto, repartir, repartoRecordado, resumirSaltos,
  type MotivoSalto,
} from './repartoSesiones';
import { calendarios } from './calendarioEscolar';
import type { ScheduleBlock } from '../types';

const bloque = (day: number, time_start: string, time_end: string, subject = 'Matemáticas', class_id = 'c1'): ScheduleBlock =>
  ({ id: `${class_id}-${day}-${time_start}-${subject}`, day, time_start, time_end, subject, room: '', class_id, color: '#000' });

/** Lunes, miércoles y viernes a las 9:00. El 2-11-2026 es lunes. */
const LXV = [bloque(1, '09:00', '09:55'), bloque(3, '09:00', '09:55'), bloque(5, '09:00', '09:55')];
const ses = (id: string, fecha?: string, completada = false) => ({ id, ...(fecha ? { fecha } : {}), ...(completada ? { completada } : {}) });
const fechas = (r: { propuestas: { id: string; fecha: string }[] }) => r.propuestas.map(p => `${p.id}:${p.fecha}`);

describe('reparto · las clases de la semana', () => {
  it('el día de la semana va de 1 (lunes) a 7 (domingo)', () => {
    expect(diaDeLaSemana('2026-11-02')).toBe(1);
    expect(diaDeLaSemana('2026-11-08')).toBe(7);
  });
  it('dos horas seguidas son una clase; separadas por el recreo, dos', () => {
    expect(franjasDelDia([bloque(2, '09:55', '10:50'), bloque(2, '09:00', '09:55')], 2)).toEqual([{ hora: '09:00', fin: '10:50', asignatura: 'Matemáticas' }]);
    expect(franjasDelDia([bloque(2, '09:00', '09:55'), bloque(2, '11:30', '12:25')], 2).map(f => f.hora)).toEqual(['09:00', '11:30']);
  });
  it('una hora mal escrita no cuenta y «9:00» va antes que «10:00»', () => {
    expect(franjasDelDia([bloque(1, '10:00', '11:00'), bloque(1, '9:00', '9:50'), bloque(1, 'tarde', '12:00')], 1).map(f => f.hora)).toEqual(['9:00', '10:00']);
  });
  it('la semana solo trae los días con clase', () => {
    expect(franjasDeLaSemana(LXV).map(d => d.dia)).toEqual([1, 3, 5]);
  });
});

describe('reparto · poner fechas', () => {
  it('reparte en orden en los huecos del horario desde el primer día', () => {
    const r = repartir([ses('a'), ses('b'), ses('c'), ses('d')], { bloques: LXV }, '2026-11-02');
    expect(fechas(r)).toEqual(['a:2026-11-02', 'b:2026-11-04', 'c:2026-11-06', 'd:2026-11-09']);
    expect(r.propuestas[0].hora).toBe('09:00');
    expect(r.sinHueco).toEqual([]);
  });
  it('si el primer día no hay clase, empieza en la siguiente', () => {
    expect(fechas(repartir([ses('a'), ses('b')], { bloques: LXV }, '2026-11-03'))).toEqual(['a:2026-11-04', 'b:2026-11-06']);
  });
  it('salta los días no lectivos y dice por qué, delante de la sesión que se retrasa', () => {
    const noLectivo = (iso: string): MotivoSalto | null => (iso === '2026-11-04' ? { tipo: 'no-lectivo', nombre: 'Fiesta' } : null);
    const r = repartir([ses('a'), ses('b'), ses('c')], { bloques: LXV, noLectivo }, '2026-11-02');
    expect(fechas(r)).toEqual(['a:2026-11-02', 'b:2026-11-06', 'c:2026-11-09']);
    expect(r.propuestas[1].saltos).toEqual([{ fecha: '2026-11-04', motivo: { tipo: 'no-lectivo', nombre: 'Fiesta' } }]);
    expect(r.propuestas[0].saltos).toEqual([]);
    expect(r.propuestas[2].saltos).toEqual([]);
  });
  it('un día sin clase en el horario no es un salto: solo cuentan los que tenían clase', () => {
    // El martes es festivo, pero esta clase no tiene hora los martes
    const noLectivo = (iso: string): MotivoSalto | null => (iso === '2026-11-03' ? { tipo: 'no-lectivo', nombre: 'Fiesta' } : null);
    const r = repartir([ses('a'), ses('b')], { bloques: LXV, noLectivo }, '2026-11-02');
    expect(r.propuestas.flatMap(p => p.saltos)).toEqual([]);
  });
  it('salta los días que quita el docente', () => {
    const r = repartir([ses('a'), ses('b')], { bloques: LXV, quitados: new Set(['2026-11-02']) }, '2026-11-02');
    expect(fechas(r)).toEqual(['a:2026-11-04', 'b:2026-11-06']);
    expect(r.propuestas[0].saltos).toEqual([{ fecha: '2026-11-02', motivo: { tipo: 'quitado' } }]);
  });
  it('las ya completadas conservan su día y no gastan hueco; guarda la fecha que tenía cada una', () => {
    const r = repartir([ses('a', '2026-10-01', true), ses('b', '2026-10-05'), ses('c')], { bloques: LXV }, '2026-11-02');
    expect(fechas(r)).toEqual(['b:2026-11-02', 'c:2026-11-04']);
    expect(r.propuestas[0].antes).toBe('2026-10-05');
    expect(r.propuestas[1].antes).toBeUndefined();
  });
  it('con dos clases separadas el mismo día, dos sesiones ese día', () => {
    const dos = [bloque(1, '09:00', '09:55'), bloque(1, '12:00', '12:55')];
    const r = repartir([ses('a'), ses('b'), ses('c')], { bloques: dos }, '2026-11-02');
    expect(fechas(r)).toEqual(['a:2026-11-02', 'b:2026-11-02', 'c:2026-11-09']);
    expect(r.propuestas.map(p => p.hora)).toEqual(['09:00', '12:00', '09:00']);
  });
  it('sin horario, una sesión cada tantos días lectivos, de lunes a viernes', () => {
    expect(fechas(repartir([ses('a'), ses('b'), ses('c')], { bloques: [], cadaDias: 2 }, '2026-11-05')))
      .toEqual(['a:2026-11-05', 'b:2026-11-09', 'c:2026-11-11']);
    expect(fechas(repartir([ses('a'), ses('b'), ses('c')], { bloques: [], cadaDias: 1 }, '2026-11-06')))
      .toEqual(['a:2026-11-06', 'b:2026-11-09', 'c:2026-11-10']);
    // Empezando en sábado, el lunes
    expect(fechas(repartir([ses('a')], { bloques: [] }, '2026-11-07'))).toEqual(['a:2026-11-09']);
  });
  it('sin horario, los festivos no cuentan como día lectivo', () => {
    const noLectivo = (iso: string): MotivoSalto | null => (iso === '2026-11-10' ? { tipo: 'no-lectivo', nombre: 'Fiesta' } : null);
    const r = repartir([ses('a'), ses('b'), ses('c')], { bloques: [], cadaDias: 1, noLectivo }, '2026-11-09');
    expect(fechas(r)).toEqual(['a:2026-11-09', 'b:2026-11-11', 'c:2026-11-12']);
    expect(r.propuestas[1].saltos.map(s => s.fecha)).toEqual(['2026-11-10']);
  });
  it('lo que no cabe antes del final se queda sin fecha y se dice cuál', () => {
    const r = repartir([ses('a'), ses('b'), ses('c')], { bloques: LXV, hasta: '2026-11-05' }, '2026-11-02');
    expect(fechas(r)).toEqual(['a:2026-11-02', 'b:2026-11-04']);
    expect(r.sinHueco).toEqual(['c']);
  });
  it('si no hay ningún día que valga, no se queda dando vueltas', () => {
    const r = repartir([ses('a')], { bloques: LXV, noLectivo: () => ({ tipo: 'fuera-de-curso' }) }, '2026-11-02');
    expect(r).toEqual({ propuestas: [], sinHueco: ['a'] });
    expect(huecosDesde({ bloques: LXV }, 'ayer', 3)).toEqual([]);
    expect(huecosDesde({ bloques: LXV }, '2026-11-02', 0)).toEqual([]);
  });
});

describe('reparto · «No se dio»: correr esta y las siguientes', () => {
  const seguidas = [ses('a', '2026-11-02'), ses('b', '2026-11-04'), ses('c', '2026-11-06'), ses('d', '2026-11-09')];
  it('con las sesiones seguidas, cada una pasa al hueco de la siguiente', () => {
    const r = correrDesde(seguidas, 'b', { bloques: LXV });
    expect(fechas(r)).toEqual(['b:2026-11-06', 'c:2026-11-09', 'd:2026-11-11']);
    expect(r.propuestas.map(p => p.antes)).toEqual(['2026-11-04', '2026-11-06', '2026-11-09']);
  });
  it('las anteriores no se tocan', () => {
    expect(correrDesde(seguidas, 'c', { bloques: LXV }).propuestas.map(p => p.id)).toEqual(['c', 'd']);
  });
  it('si detrás hay un hueco libre, lo aprovecha y las demás se quedan como estaban', () => {
    const conHueco = [ses('a', '2026-11-02'), ses('b', '2026-11-04'), ses('c', '2026-11-09'), ses('d', '2026-11-11')];
    expect(fechas(correrDesde(conHueco, 'a', { bloques: LXV }))).toEqual(['a:2026-11-04', 'b:2026-11-06']);
  });
  it('salta los días no lectivos al correr, y lo dice', () => {
    const noLectivo = (iso: string): MotivoSalto | null => (iso === '2026-11-06' ? { tipo: 'no-lectivo', nombre: 'Fiesta' } : null);
    const r = correrDesde([ses('a', '2026-11-04'), ses('b', '2026-11-09')], 'a', { bloques: LXV, noLectivo });
    expect(fechas(r)).toEqual(['a:2026-11-09', 'b:2026-11-11']);
    expect(r.propuestas[0].saltos.map(s => s.fecha)).toEqual(['2026-11-06']);
  });
  it('las que no tienen fecha y las ya completadas no se mueven ni frenan a las demás', () => {
    const lista = [ses('a', '2026-11-02'), ses('sin'), ses('hecha', '2026-11-04', true), ses('b', '2026-11-04')];
    expect(fechas(correrDesde(lista, 'a', { bloques: LXV }))).toEqual(['a:2026-11-04', 'b:2026-11-06']);
  });
  it('una sesión puesta a mano en un día sin clase pasa a la clase siguiente', () => {
    expect(fechas(correrDesde([ses('a', '2026-11-03')], 'a', { bloques: LXV }))).toEqual(['a:2026-11-04']);
  });
  it('con dos clases el mismo día, la que se pierde pasa a otro día y la segunda del día siguiente no cambia de día', () => {
    const dos = [bloque(1, '09:00', '09:55'), bloque(1, '12:00', '12:55')];
    const lista = [ses('a', '2026-11-02'), ses('b', '2026-11-09'), ses('c', '2026-11-09'), ses('d', '2026-11-16')];
    // a → lunes 9 (1.ª hora); b, que estaba ese día, pasa a su 2.ª hora (no cambia de día); c ya no cabe el 9 y pasa al 16; d, a la 2.ª del 16
    expect(fechas(correrDesde(lista, 'a', { bloques: dos }))).toEqual(['a:2026-11-09', 'c:2026-11-16']);
  });
  it('sin horario, corre un día lectivo de cada tantos', () => {
    expect(fechas(correrDesde([ses('a', '2026-11-06'), ses('b', '2026-11-09')], 'a', { bloques: [], cadaDias: 1 })))
      .toEqual(['a:2026-11-09', 'b:2026-11-10']);
  });
  it('una sesión sin fecha, o que no está, no corre nada', () => {
    expect(correrDesde([ses('a')], 'a', { bloques: LXV })).toEqual({ propuestas: [], sinHueco: [] });
    expect(correrDesde(seguidas, 'zzz', { bloques: LXV })).toEqual({ propuestas: [], sinHueco: [] });
  });
  it('si no hay más huecos antes del final, lo dice', () => {
    const r = correrDesde([ses('a', '2026-11-04'), ses('b', '2026-11-06')], 'a', { bloques: LXV, hasta: '2026-11-06' });
    expect(fechas(r)).toEqual(['a:2026-11-06']);
    expect(r.sinHueco).toEqual(['b']);
  });
});

describe('reparto · aplicar y resumir', () => {
  it('pone las fechas y deja lo demás como estaba (los mismos objetos)', () => {
    const lista = [{ id: 'a', fecha: '2026-11-02', titulo: 'A' }, { id: 'b', titulo: 'B' }, { id: 'c', fecha: '2026-11-06', titulo: 'C' }];
    const r = aplicarFechas(lista, [{ id: 'a', fecha: '2026-11-04' }, { id: 'b', fecha: '2026-11-06' }, { id: 'c', fecha: '2026-11-06' }]);
    expect(r.map(s => s.fecha)).toEqual(['2026-11-04', '2026-11-06', '2026-11-06']);
    expect(r[0].titulo).toBe('A');
    expect(r[2]).toBe(lista[2]);
  });
  it('varios días seguidos saltados por lo mismo se dicen de una vez', () => {
    const nav: MotivoSalto = { tipo: 'vacaciones', nombre: 'Vacaciones de Navidad' };
    const t = resumirSaltos([
      { fecha: '2026-12-23', motivo: nav }, { fecha: '2026-12-28', motivo: nav }, { fecha: '2027-01-04', motivo: nav },
      { fecha: '2027-01-08', motivo: { tipo: 'quitado' } },
    ]);
    expect(t).toEqual([
      { desde: '2026-12-23', hasta: '2027-01-04', dias: 3, motivo: nav },
      { desde: '2027-01-08', hasta: '2027-01-08', dias: 1, motivo: { tipo: 'quitado' } },
    ]);
  });
});

describe('reparto · con el calendario escolar de verdad', () => {
  const noLectivo = motivoNoLectivo(calendarios(), 'comunitat-valenciana', null, ['primaria']);
  it('las vacaciones de Navidad se saltan enteras', () => {
    // Lunes, miércoles y viernes desde el viernes 18-12-2026
    const r = repartir([ses('a'), ses('b'), ses('c')], { bloques: LXV, noLectivo }, '2026-12-18');
    expect(r.propuestas[0].fecha).toBe('2026-12-18');
    // El lunes 21 aún hay clase; las vacaciones van del 22 de diciembre al 6 de enero
    expect(fechas(r)).toEqual(['a:2026-12-18', 'b:2026-12-21', 'c:2027-01-08']);
    expect(resumirSaltos(r.propuestas[2].saltos)).toEqual([
      { desde: '2026-12-23', hasta: '2027-01-06', dias: 7, motivo: { tipo: 'vacaciones', nombre: 'Vacaciones de Navidad' } },
    ]);
  });
  it('en verano, fuera del curso, no hay huecos, y no se pasa al curso siguiente', () => {
    expect(noLectivo('2027-07-15')).toEqual({ tipo: 'fuera-de-curso' });
    expect(finDelCursoDe('2026-11-20')).toBe('2027-08-31');
    expect(finDelCursoDe('2027-03-01')).toBe('2027-08-31');
    const r = repartir([ses('a')], { bloques: LXV, noLectivo, hasta: finDelCursoDe('2027-07-01') }, '2027-07-01');
    expect(r.sinHueco).toEqual(['a']);
  });
  it('una comunidad sin calendario no salta nada: no se sabe', () => {
    expect(motivoNoLectivo(calendarios(), 'galicia' as never, null, ['eso'])('2026-12-25')).toBeNull();
  });
});

describe('reparto · en qué horas se dan', () => {
  const horario = [
    bloque(1, '09:00', '10:00', 'Lengua'), bloque(2, '09:00', '10:00', 'Lengua'), bloque(3, '09:00', '10:00', 'Lengua'),
    bloque(1, '10:00', '11:00', 'Matemáticas'), bloque(4, '10:00', '11:00', 'matemáticas'),
    bloque(5, '12:00', '13:00', 'Educación Física'), bloque(1, '09:00', '10:00', 'Lengua', 'c2'),
  ];
  it('las asignaturas de la clase, las de más horas primero y sin repetir por mayúsculas', () => {
    expect(asignaturasDeClase(horario, 'c1')).toEqual(['Lengua', 'Matemáticas', 'Educación Física']);
    expect(asignaturasDeClase(horario, undefined)).toEqual([]);
  });
  it('propone la que se parece al área de la situación de aprendizaje, sin tildes ni mayúsculas', () => {
    const a = asignaturasDeClase(horario, 'c1');
    expect(asignaturasPropuestas(a, ['MATEMATICAS'])).toEqual(['Matemáticas']);
    expect(asignaturasPropuestas(a, ['Lengua Castellana y Literatura'])).toEqual(['Lengua']);
    expect(asignaturasPropuestas(a, ['Educación Física'])).toEqual(['Educación Física']);
  });
  it('sin pista y con varias, ninguna: se elige; con una sola, esa', () => {
    expect(asignaturasPropuestas(asignaturasDeClase(horario, 'c1'), [])).toEqual([]);
    expect(asignaturasPropuestas(['Música'], [])).toEqual(['Música']);
  });
  it('los bloques de la clase en las asignaturas elegidas', () => {
    expect(bloquesDe(horario, 'c1', ['Matemáticas']).map(b => b.day)).toEqual([1, 4]);
    expect(bloquesDe(horario, 'c1', [])).toEqual([]);
    expect(bloquesDe(horario, undefined, ['Lengua'])).toEqual([]);
  });
});

describe('reparto · lo elegido la última vez', () => {
  beforeEach(() => localStorage.clear());
  it('se recuerda por grupo', () => {
    recordarReparto('c1|s1', { asignaturas: ['Lengua'], cadaDias: 3 });
    expect(repartoRecordado('c1|s1')).toEqual({ asignaturas: ['Lengua'], cadaDias: 3 });
    expect(repartoRecordado('otro')).toEqual({});
  });
  it('lo guardado roto no rompe nada', () => {
    localStorage.setItem('aulapro_reparto_sesiones', '{"g":{"asignaturas":"x","cadaDias":99}}');
    expect(repartoRecordado('g')).toEqual({});
    localStorage.setItem('aulapro_reparto_sesiones', 'no es json');
    expect(repartoRecordado('g')).toEqual({});
  });
});
