// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MARGEN_ANTES, PEDIDA_VALE_MS, atenderClasePedida, claseAlAbrir, claseAlAbrirAhora, claseDeAhora, clasePedida,
  hayClaseHoy, pedirClase, recordarClase, ultimaClase,
} from './claseActiva';
import type { ArchivoCalendarios } from './calendarioEscolar';
import type { Class, ScheduleBlock } from '../types';

const clase = (id: string, etapa?: Class['etapa']) => ({ id, name: id, subject: '', room: '', color: '', etapa }) as Class;
const bloque = (class_id: string, day: number, time_start: string, time_end: string): ScheduleBlock =>
  ({ id: `${class_id}${day}${time_start}`, class_id, day, time_start, time_end, subject: '', room: '', color: '' });
const clases = [clase('a'), clase('b'), clase('c')];
// Martes: «b» de 8:30 a 9:25 y «c» de 11:00 a 11:55 (el 13-10-2026 es martes)
const horario = [bloque('b', 2, '08:30', '09:25'), bloque('c', 2, '11:00', '11:55')];
const martes = (h: number, m: number) => new Date(2026, 9, 13, h, m);

describe('la clase de ahora', () => {
  it('la que está en marcha', () => {
    expect(claseDeAhora(clases, horario, martes(9, 0))).toEqual({ id: 'b', enMarcha: true, desde: '08:30', hasta: '09:25' });
  });
  it('la que empieza dentro del margen, aunque aún no haya empezado', () => {
    expect(claseDeAhora(clases, horario, martes(10, 60 - MARGEN_ANTES))).toEqual({ id: 'c', enMarcha: false, desde: '11:00', hasta: '11:55' });
    expect(claseDeAhora(clases, horario, martes(8, 25))?.id).toBe('b');
  });
  it('ninguna si la siguiente queda lejos, si ya no hay más hoy o si no hay horario', () => {
    expect(claseDeAhora(clases, horario, martes(10, 60 - MARGEN_ANTES - 1))).toBeNull();
    expect(claseDeAhora(clases, horario, martes(13, 0))).toBeNull();
    expect(claseDeAhora(clases, [], martes(9, 0))).toBeNull();
  });
  it('en un festivo o en vacaciones el horario no manda', () => {
    expect(claseDeAhora(clases, horario, martes(9, 0), false)).toBeNull();
  });
  it('con una clase en marcha, la que viene después no la quita aunque esté a punto de empezar', () => {
    const seguidas = [bloque('b', 2, '08:30', '09:25'), bloque('c', 2, '09:25', '10:20')];
    expect(claseDeAhora(clases, seguidas, martes(9, 20))?.id).toBe('b');
    expect(claseDeAhora(clases, seguidas, martes(9, 25))?.id).toBe('c');
  });
  it('solo cuentan las clases que la pantalla ofrece', () => {
    expect(claseDeAhora([clase('a'), clase('c')], horario, martes(9, 0))).toBeNull();
  });
});

describe('la regla: qué clase abre una pantalla', () => {
  it('con clase en marcha, esa, aunque la última elegida fuera otra', () => {
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(9, 0), ultima: 'a' })).toEqual({ id: 'b', motivo: 'ahora' });
  });
  it('sin clase en marcha, la última con la que se trabajó', () => {
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(10, 0), ultima: 'a' })).toEqual({ id: 'a', motivo: 'ultima' });
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(18, 0), ultima: 'c' })).toEqual({ id: 'c', motivo: 'ultima' });
  });
  it('sin última, la siguiente de hoy; y sin horario o sin más clases hoy, la primera', () => {
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(10, 0) })).toEqual({ id: 'c', motivo: 'siguiente' });
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(13, 0) })).toEqual({ id: 'a', motivo: 'primera' });
    expect(claseAlAbrir({ classes: clases, blocks: [], now: martes(9, 0) })).toEqual({ id: 'a', motivo: 'primera' });
  });
  it('la clase pedida manda sobre el horario', () => {
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(9, 0), ultima: 'a', pedida: 'c' })).toEqual({ id: 'c', motivo: 'pedida' });
  });
  it('una clase pedida o recordada que ya no existe (o que la pantalla no ofrece) no cuenta', () => {
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(9, 0), pedida: 'borrada' }).id).toBe('b');
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(13, 0), ultima: 'borrada' })).toEqual({ id: 'a', motivo: 'primera' });
  });
  it('en un festivo no manda el horario: la última o la primera', () => {
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(9, 0), lectivo: false, ultima: 'c' })).toEqual({ id: 'c', motivo: 'ultima' });
    expect(claseAlAbrir({ classes: clases, blocks: horario, now: martes(9, 0), lectivo: false })).toEqual({ id: 'a', motivo: 'primera' });
  });
  it('sin clases no hay nada que abrir', () => {
    expect(claseAlAbrir({ classes: [], blocks: horario, now: martes(9, 0), ultima: 'a' })).toEqual({ id: '', motivo: '' });
  });
});

describe('la última clase, recordada en el dispositivo por perfil', () => {
  beforeEach(() => localStorage.clear());
  it('cada perfil recuerda la suya', () => {
    expect(ultimaClase('p-recuerdo-1')).toBeNull();
    recordarClase('p-recuerdo-1', 'b');
    recordarClase('p-recuerdo-2', 'c');
    expect(ultimaClase('p-recuerdo-1')).toBe('b');
    expect(ultimaClase('p-recuerdo-2')).toBe('c');
    expect(localStorage.getItem('aulapro_clase_activa_p-recuerdo-1')).toBe('b');
  });
  it('se lee del dispositivo al volver a abrir la app', () => {
    localStorage.setItem('aulapro_clase_activa_p-recuerdo-3', 'c');
    expect(ultimaClase('p-recuerdo-3')).toBe('c');
  });
  it('una clase vacía no borra el recuerdo', () => {
    recordarClase('p-recuerdo-4', 'a');
    recordarClase('p-recuerdo-4', '');
    expect(ultimaClase('p-recuerdo-4')).toBe('a');
  });
});

describe('la clase pedida al pasar de pantalla', () => {
  beforeEach(() => atenderClasePedida());
  it('vale para la pantalla que se abre a continuación y luego se olvida', () => {
    pedirClase('c', 1_000);
    expect(clasePedida(1_500)).toBe('c');
    atenderClasePedida();
    expect(clasePedida(1_600)).toBeNull();
  });
  it('si nadie la atiende, caduca sola', () => {
    pedirClase('c', 1_000);
    expect(clasePedida(1_000 + PEDIDA_VALE_MS)).toBe('c');
    expect(clasePedida(1_001 + PEDIDA_VALE_MS)).toBeNull();
  });
});

describe('con el reloj, el calendario y el recuerdo de este dispositivo', () => {
  beforeEach(() => { localStorage.clear(); atenderClasePedida(); });
  const datos = (perfil: string) => ({ perfil, classes: clases, blocks: horario });

  it('sigue la regla con la última clase del perfil', () => {
    recordarClase('p-ahora-1', 'a');
    expect(claseAlAbrirAhora(datos('p-ahora-1'), clases, null, martes(9, 0))).toEqual({ id: 'b', motivo: 'ahora' });
    expect(claseAlAbrirAhora(datos('p-ahora-1'), clases, null, martes(10, 0))).toEqual({ id: 'a', motivo: 'ultima' });
  });
  it('atiende la clase pedida desde otra pantalla y la que pide la propia pantalla', () => {
    const now = martes(9, 0);
    pedirClase('c', now.getTime());
    expect(claseAlAbrirAhora(datos('p-ahora-2'), clases, null, now)).toEqual({ id: 'c', motivo: 'pedida' });
    expect(claseAlAbrirAhora(datos('p-ahora-2'), clases, 'a', now)).toEqual({ id: 'a', motivo: 'pedida' });
  });
  it('una pantalla que solo ofrece algunas clases elige entre las suyas', () => {
    recordarClase('p-ahora-3', 'b');
    expect(claseAlAbrirAhora(datos('p-ahora-3'), [clase('a'), clase('c')], null, martes(10, 0))).toEqual({ id: 'c', motivo: 'siguiente' });
  });
});

describe('si hoy hay clase según el calendario escolar', () => {
  const archivo = {
    actualizado: '2026-09-01',
    calendarios: [{
      comunidad: 'comunitat-valenciana', curso: '2026-2027',
      clases: { primaria: { inicio: '2026-09-08', fin: '2027-06-18' }, eso: { inicio: '2026-09-08', fin: '2027-06-18' } },
      vacaciones: [{ nombre: 'Navidad', desde: '2026-12-23', hasta: '2027-01-06' }],
      noLectivos: [{ fecha: '2026-10-12', nombre: 'Fiesta Nacional' }],
      norma: { es: '', ca: '', en: '' },
    }],
  } as unknown as ArchivoCalendarios;
  const mias = [clase('a', 'primaria')];

  it('un festivo y unas vacaciones no son lectivos; un día corriente, sí', () => {
    expect(hayClaseHoy(archivo, mias, 'comunitat-valenciana', null, new Date(2026, 9, 12, 9, 0))).toBe(false);
    expect(hayClaseHoy(archivo, mias, 'comunitat-valenciana', null, new Date(2026, 11, 28, 9, 0))).toBe(false);
    expect(hayClaseHoy(archivo, mias, 'comunitat-valenciana', null, new Date(2026, 9, 13, 9, 0))).toBe(true);
  });
  it('sin calendario de esa comunidad manda el horario', () => {
    expect(hayClaseHoy(archivo, mias, undefined, null, new Date(2026, 9, 12, 9, 0))).toBe(true);
  });
});
