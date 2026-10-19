import { describe, it, expect } from 'vitest';
import { aMin, cambioDeArrastre, colocarDia, deMin, moverBloque, PX_POR_MIN, rangoHorario } from './horarioSemana';
import type { ScheduleBlock } from '../types';

const b = (id: string, ini: string, fin: string, day = 3): ScheduleBlock =>
  ({ id, day, time_start: ini, time_end: fin, subject: id, room: '', class_id: '', color: '#000' });

describe('horario semanal', () => {
  it('la hora se pasa a minutos y vuelta', () => {
    expect(aMin('11:45')).toBe(705);
    expect(deMin(705)).toBe('11:45');
    expect(deMin(-5)).toBe('00:00');
  });

  it('va de 8:00 a 14:00 como mínimo y crece con la tarde o con lo que empieza antes', () => {
    expect(rangoHorario([])).toEqual({ desde: 480, hasta: 840 });
    expect(rangoHorario([b('t', '16:00', '16:55')])).toEqual({ desde: 480, hasta: 17 * 60 });
    expect(rangoHorario([b('m', '07:30', '08:15')])).toEqual({ desde: 420, hasta: 840 });
  });

  it('cada bloque va a su hora: el patio de las 11:15 queda encima de la clase de las 11:45, aunque se creara después', () => {
    const colocados = colocarDia([b('clase', '11:45', '12:30'), b('patio', '11:15', '11:45')], 480);
    expect(colocados.map(c => c.bloque.id)).toEqual(['patio', 'clase']);
    expect(colocados[0]).toMatchObject({ arriba: 195, alto: 30, carril: 0, carriles: 1 });
    expect(colocados[1]).toMatchObject({ arriba: 225, alto: 45, carril: 0, carriles: 1 });
    // Uno justo detrás del otro no es un solape
    expect(colocados[1].arriba).toBe(colocados[0].arriba + colocados[0].alto);
  });

  it('los que coinciden en el tiempo van lado a lado, y los demás a todo el ancho', () => {
    const c = colocarDia([b('a', '09:00', '10:00'), b('b', '09:30', '10:30'), b('c', '11:00', '11:45')], 480);
    const por = Object.fromEntries(c.map(x => [x.bloque.id, x]));
    expect([por.a.carril, por.a.carriles]).toEqual([0, 2]);
    expect([por.b.carril, por.b.carriles]).toEqual([1, 2]);
    expect([por.c.carril, por.c.carriles]).toEqual([0, 1]);
  });

  it('mover cambia el día y la hora sin cambiar lo que dura, de 5 en 5 minutos', () => {
    const lim = { desde: 480, hasta: 840 };
    const m = moverBloque(b('x', '11:15', '11:45', 3), { dias: 1, minutos: 33 }, lim);
    expect(m).toMatchObject({ day: 4, time_start: '11:50', time_end: '12:20' });
    expect(moverBloque(b('x', '09:00', '09:45', 1), { dias: -3, minutos: -999 }, lim)).toMatchObject({ day: 1, time_start: '08:00', time_end: '08:45' });
    expect(moverBloque(b('x', '13:00', '13:45', 5), { dias: 4, minutos: 999 }, lim)).toMatchObject({ day: 5, time_start: '13:15', time_end: '14:00' });
  });

  it('un arrastre se traduce en minutos por lo que baja y en días por la columna donde está el puntero', () => {
    const cols = [0, 1, 2, 3, 4].map(i => ({ izq: 100 + i * 200, der: 300 + i * 200 }));
    expect(cambioDeArrastre(PX_POR_MIN * 30, 520, cols, 3)).toEqual({ dias: 0, minutos: 30 });
    expect(cambioDeArrastre(0, 720, cols, 3)).toEqual({ dias: 1, minutos: 0 });
    expect(cambioDeArrastre(0, 10, cols, 3).dias).toBe(-2);
    expect(cambioDeArrastre(0, 9999, cols, 3).dias).toBe(2);
  });
});
