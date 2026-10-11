import { describe, it, expect } from 'vitest';
import { claseQueToca } from './claseQueToca';
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
