/**
 * `gridToBlocks` es la pieza que coloca cada sesión en su día y su hora a
 * partir de la tabla que transcribe la IA. Se prueba con los casos que antes
 * descolocaban el horario: celdas vacías, recreos, cabeceras en otro orden u
 * otro idioma y filas sin hora de fin.
 */
import { describe, it, expect } from 'vitest';
import {
  gridToBlocks, parseDayHeader, mapColumnsToDays, normalizeTime, fillMergedCells,
  type GridCell,
} from './scheduleGrid';

const c = (subject = '', group = '', room = ''): GridCell => ({ subject, group, room });
const LV = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

describe('normalizeTime', () => {
  it('acepta las formas habituales', () => {
    expect(normalizeTime('9')).toBe('09:00');
    expect(normalizeTime('9:5')).toBe('09:05');
    expect(normalizeTime('09.30')).toBe('09:30');
    expect(normalizeTime('8h')).toBe('08:00');
    expect(normalizeTime('8h30')).toBe('08:30');
  });
  it('rechaza lo que no es una hora', () => {
    expect(normalizeTime('')).toBeNull();
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime('1ª hora')).toBeNull();
  });
});

describe('parseDayHeader', () => {
  it('entiende castellano, abreviaturas y letras', () => {
    expect(parseDayHeader('Lunes')).toBe(1);
    expect(parseDayHeader('MIÉRCOLES')).toBe(3);
    expect(parseDayHeader('Jue.')).toBe(4);
    expect(parseDayHeader('X')).toBe(3);
    expect(parseDayHeader('V')).toBe(5);
  });
  it('entiende catalán, gallego, euskera e inglés', () => {
    expect(parseDayHeader('Dimarts')).toBe(2);
    expect(parseDayHeader('Xoves')).toBe(4);
    expect(parseDayHeader('Ostirala')).toBe(5);
    expect(parseDayHeader('Wednesday')).toBe(3);
  });
  it('no confunde lo que no es un día', () => {
    expect(parseDayHeader('Hora')).toBeNull();
    expect(parseDayHeader('Sábado')).toBeNull();
    expect(parseDayHeader('')).toBeNull();
  });
});

describe('mapColumnsToDays', () => {
  it('respeta el orden de las cabeceras', () => {
    expect(mapColumnsToDays(['Martes', 'Lunes'], 2)).toEqual([2, 1]);
  });
  it('supone lunes → viernes si las cabeceras no se entienden', () => {
    expect(mapColumnsToDays(['A', 'B', 'C'], 3)).toEqual([1, 2, 3]);
    expect(mapColumnsToDays([], 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('tampoco se fía de cabeceras repetidas', () => {
    expect(mapColumnsToDays(['Lunes', 'Lunes'], 2)).toEqual([1, 2]);
  });
});

describe('gridToBlocks', () => {
  it('coloca cada celda por su columna y su fila, aunque haya huecos', () => {
    const blocks = gridToBlocks({
      dayHeaders: LV,
      rows: [
        { start: '8:30', end: '9:25', cells: [c('Matemáticas', '3º ESO A', 'Aula 12'), c(), c(), c('Física'), c()] },
        { start: '9:25', end: '10:20', cells: [c(), c('Matemáticas', '3º ESO A'), c(), c(), c('Tutoría')] },
      ],
    });
    expect(blocks).toEqual([
      { day: 1, time_start: '08:30', time_end: '09:25', subject: 'Matemáticas', className: '3º ESO A', room: 'Aula 12' },
      { day: 2, time_start: '09:25', time_end: '10:20', subject: 'Matemáticas', className: '3º ESO A', room: '' },
      { day: 4, time_start: '08:30', time_end: '09:25', subject: 'Física', className: '', room: '' },
      { day: 5, time_start: '09:25', time_end: '10:20', subject: 'Tutoría', className: '', room: '' },
    ]);
  });

  it('se salta el recreo sin correr las filas siguientes', () => {
    const blocks = gridToBlocks({
      dayHeaders: LV,
      rows: [
        { start: '10:20', end: '11:15', cells: [c('Lengua'), c(), c(), c(), c()] },
        { start: '11:15', end: '11:45', isBreak: true, cells: [c('Recreo'), c('Recreo'), c('Recreo'), c('Recreo'), c('Recreo')] },
        { start: '11:45', end: '12:40', cells: [c('Historia'), c(), c(), c(), c()] },
      ],
    });
    expect(blocks.map(b => [b.subject, b.time_start])).toEqual([['Lengua', '10:20'], ['Historia', '11:45']]);
  });

  it('descarta guardias, horas libres y celdas vacías', () => {
    const blocks = gridToBlocks({
      dayHeaders: LV,
      rows: [{ start: '8:30', end: '9:25', cells: [c('Guardia'), c('Libre'), c('—'), c('Reunión'), c('Inglés')] }],
    });
    expect(blocks.map(b => b.subject)).toEqual(['Inglés']);
  });

  it('usa el orden real de las columnas', () => {
    const blocks = gridToBlocks({
      dayHeaders: ['Viernes', 'Jueves'],
      rows: [{ start: '9:00', end: '10:00', cells: [c('A'), c('B')] }],
    });
    expect(blocks.map(b => [b.subject, b.day])).toEqual([['B', 4], ['A', 5]]);
  });

  it('cierra la franja con la siguiente fila si falta la hora de fin', () => {
    const blocks = gridToBlocks({
      dayHeaders: LV,
      rows: [
        { start: '8:00', end: '', cells: [c('A')] },
        { start: '8:50', end: '', cells: [c('B')] },
      ],
    });
    expect(blocks.map(b => b.time_end)).toEqual(['08:50', '09:45']);
  });

  it('entiende «8:30 - 9:25» metido entero en la hora de inicio', () => {
    const [b] = gridToBlocks({ dayHeaders: LV, rows: [{ start: '8:30 - 9:25', cells: [c('A')] }] });
    expect([b.time_start, b.time_end]).toEqual(['08:30', '09:25']);
  });

  it('ignora filas sin hora y columnas de más', () => {
    const blocks = gridToBlocks({
      dayHeaders: LV,
      rows: [
        { start: '1ª hora', cells: [c('A')] },
        { start: '9:00', end: '10:00', cells: [c(), c(), c(), c(), c(), c('Sábado')] },
      ],
    });
    expect(blocks).toEqual([]);
  });

  it('no repite una sesión transcrita dos veces en la misma franja', () => {
    const blocks = gridToBlocks({
      dayHeaders: ['Lunes', 'Martes'],
      rows: [
        { start: '9:00', end: '10:00', cells: [c('Mates', '1ºA'), c()] },
        { start: '9:00', end: '10:00', cells: [c('Mates', '1ºA'), c()] },
      ],
    });
    expect(blocks).toHaveLength(1);
  });

  it('tolera una respuesta vacía o rota', () => {
    expect(gridToBlocks(null)).toEqual([]);
    expect(gridToBlocks({})).toEqual([]);
    expect(gridToBlocks({ rows: [{ start: '9:00' }] })).toEqual([]);
  });
});

describe('fillMergedCells', () => {
  it('copia el valor de la esquina a toda la celda combinada', () => {
    const encode = ({ r, c }: { r: number; c: number }) => `${String.fromCharCode(65 + c)}${r + 1}`;
    const sheet: Record<string, unknown> & { '!merges'?: { s: { r: number; c: number }; e: { r: number; c: number } }[] } = {
      A1: { t: 's', v: 'Recreo' },
      '!merges': [{ s: { r: 0, c: 0 }, e: { r: 1, c: 2 } }],
    };
    fillMergedCells(sheet, encode);
    expect(sheet.C1).toEqual({ t: 's', v: 'Recreo' });
    expect(sheet.B2).toEqual({ t: 's', v: 'Recreo' });
  });
});
