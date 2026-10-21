import { describe, it, expect } from 'vitest';
import { aMinutos, bloqueQueToca, claseQueToca, enMarcha } from './claseQueToca';
import type { Class, ScheduleBlock } from '../types';

const clase = (id: string) => ({ id, name: id, subject: '', room: '', color: '' }) as Class;
const bloque = (class_id: string, day: number, time_start: string, time_end: string): ScheduleBlock =>
  ({ id: `${class_id}${day}${time_start}`, class_id, day, time_start, time_end, subject: '', room: '', color: '' });
const clases = [clase('a'), clase('b'), clase('c')];
const horario = [bloque('b', 2, '08:30', '09:25'), bloque('c', 2, '11:00', '11:55')];

describe('la clase que toca pasar lista', () => {
  it('la que está en marcha', () => {
    expect(claseQueToca(clases, horario, new Date(2026, 9, 13, 9, 0))).toBe('b');
  });
  it('si no hay ninguna en marcha, la siguiente de hoy', () => {
    expect(claseQueToca(clases, horario, new Date(2026, 9, 13, 9, 45))).toBe('c');
  });
  it('sin más clases hoy, o sin horario, la primera', () => {
    expect(claseQueToca(clases, horario, new Date(2026, 9, 13, 13, 0))).toBe('a');
    expect(claseQueToca(clases, [], new Date(2026, 9, 13, 9, 0))).toBe('a');
  });
});

describe('el bloque que toca (portada de En clase)', () => {
  it('da el bloque con su hora, o nada si hoy ya no queda ninguno', () => {
    expect(bloqueQueToca(clases, horario, new Date(2026, 9, 13, 9, 45))?.time_start).toBe('11:00');
    expect(bloqueQueToca(clases, horario, new Date(2026, 9, 13, 13, 0))).toBeUndefined();
  });
});

describe('las horas se comparan como horas, y el calendario manda', () => {
  const lunes = (h: number, m: number) => new Date(2026, 9, 19, h, m);

  it('«9:00» sin cero no se cuela detrás de «10:00»', () => {
    const h = [bloque('a', 1, '9:00', '9:55'), bloque('b', 1, '10:00', '10:55')];
    expect(bloqueQueToca(clases, h, lunes(9, 30))?.class_id).toBe('a');
    expect(bloqueQueToca(clases, h, lunes(10, 20))?.class_id).toBe('b');
    expect(bloqueQueToca(clases, h, lunes(11, 30))).toBeUndefined();
  });
  it('un festivo o unas vacaciones no tienen clase, aunque el horario la tenga', () => {
    const h = [bloque('a', 1, '09:00', '09:55')];
    expect(bloqueQueToca(clases, h, lunes(9, 30), false)).toBeUndefined();
    expect(bloqueQueToca(clases, h, lunes(9, 30), true)?.class_id).toBe('a');
  });
  it('un bloque con la hora rota o con el fin antes del inicio no cuenta', () => {
    const h = [bloque('a', 1, '??', '09:55'), bloque('b', 1, '11:00', '10:00'), bloque('c', 1, '12:00', '12:55')];
    expect(bloqueQueToca(clases, h, lunes(9, 0))?.class_id).toBe('c');
  });
  it('sabe si el bloque está en marcha o es solo el siguiente', () => {
    const b = bloque('a', 1, '09:00', '09:55');
    expect(enMarcha(b, lunes(9, 30))).toBe(true);
    expect(enMarcha(b, lunes(8, 30))).toBe(false);
    expect(enMarcha(b, lunes(9, 55))).toBe(false);
  });
  it('aMinutos entiende las formas de escribir una hora', () => {
    expect([aMinutos('8:30'), aMinutos('08:30'), aMinutos('8.30'), aMinutos('25:00'), aMinutos('')]).toEqual([510, 510, 510, null, null]);
  });
});
