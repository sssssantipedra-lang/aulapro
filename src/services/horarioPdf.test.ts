/**
 * Detección de las clases del horario a partir del texto de un PDF (sin IA).
 * El texto de `PDF_REAL` sale de un PDF de horario hecho con Chromium y leído
 * con pdf.js: cada elemento es [texto, x, y, ancho, alto].
 */
import { describe, it, expect } from 'vitest';
import { gridDeTextos, partirCelda, type TextoPdf } from './horarioPdf';
import { gridToBlocks } from './scheduleGrid';

const PDF_REAL: [string, number, number, number, number][] = [
  ['Horario curso 2026-2027 · Profesor', 203.2, -747.0, 205.6, 12.4],
  ['Lunes', 138.3, -717.8, 35.3, 12.0],
  ['Martes', 258.5, -717.8, 38.7, 12.0],
  ['Miércoles', 352.5, -717.8, 55.4, 12.0],
  ['Jueves', 439.8, -717.8, 40.7, 12.0],
  ['Viernes', 517.4, -717.8, 43.1, 12.0],
  ['8:30', 53.2, -687.8, 24.0, 12.0],
  ['9:25', 53.2, -674.3, 24.0, 12.0],
  ['Matemáticas', 121.9, -694.5, 68.0, 12.0],
  ['3º ESO A', 130.7, -681.0, 50.4, 12.0],
  ['Aula 12', 135.6, -667.5, 40.7, 12.0],
  ['Matemáticas', 346.1, -694.5, 68.0, 12.0],
  ['3º ESO A', 354.9, -681.0, 50.4, 12.0],
  ['Aula 12', 359.8, -667.5, 40.7, 12.0],
  ['Lengua', 440.1, -694.5, 40.0, 12.0],
  ['5º Primaria', 430.6, -681.0, 59.1, 12.0],
  ['B', 456.1, -667.5, 8.0, 12.0],
  ['Matemáticas', 505.0, -687.8, 68.0, 12.0],
  ['1º ESO C', 513.1, -674.3, 51.7, 12.0],
  ['9:25', 53.2, -644.3, 24.0, 12.0],
  ['10:20', 49.9, -630.8, 30.7, 12.0],
  ['Ciencias', 132.9, -644.3, 46.0, 12.0],
  ['4º Primaria A', 121.1, -630.8, 69.7, 12.0],
  ['Matemáticas 2ºESO', 224.0, -644.3, 107.8, 12.0],
  ['B', 273.8, -630.8, 8.0, 12.0],
  ['Matemáticas', 426.1, -644.3, 68.0, 12.0],
  ['3º ESO A', 434.9, -630.8, 50.4, 12.0],
  ['Guardia', 517.6, -637.5, 42.7, 12.0],
  ['10:20', 49.9, -600.8, 30.7, 12.0],
  ['11:15', 50.2, -587.3, 30.0, 12.0],
  ['Lengua 6º Primaria', 104.7, -600.8, 102.4, 12.0],
  ['A', 151.9, -587.3, 8.0, 12.0],
  ['Ciencias 4º Primaria', 223.6, -607.5, 108.4, 12.0],
  ['A', 273.8, -594.0, 8.0, 12.0],
  ['Lab 1', 262.8, -580.5, 30.0, 12.0],
  ['Inglés', 364.1, -600.8, 32.0, 12.0],
  ['2º ESO B', 354.6, -587.3, 51.1, 12.0],
  ['Matemáticas', 505.0, -600.8, 68.0, 12.0],
  ['3º ESO A', 513.8, -587.3, 50.4, 12.0],
  ['11:15', 50.2, -557.3, 30.0, 12.0],
  ['11:45', 50.2, -543.8, 30.0, 12.0],
  ['RECREO', 311.4, -550.5, 51.3, 12.0],
  ['11:45', 50.2, -513.8, 30.0, 12.0],
  ['12:40', 49.9, -500.3, 30.7, 12.0],
  ['Matemáticas', 121.9, -513.8, 68.0, 12.0],
  ['1º ESO C', 130.1, -500.3, 51.7, 12.0],
  ['Tutoría', 259.1, -513.8, 37.6, 12.0],
  ['3º ESO A', 252.6, -500.3, 50.4, 12.0],
  ['Lengua', 360.1, -520.5, 40.0, 12.0],
  ['5º Primaria', 350.6, -507.0, 59.1, 12.0],
  ['B', 376.1, -493.5, 8.0, 12.0],
  ['Reunión', 437.8, -507.0, 44.7, 12.0],
  ['Documento sin valor oficial', 33.7, -472.5, 80.7, 6.7],
];
const textos = (): TextoPdf[] => PDF_REAL.map(([str, x, y, w, h]) => ({ str, x, y, w, h }));
const GRUPOS = ['3º ESO A', '5º Primaria B'];

describe('gridDeTextos · horario real en PDF', () => {
  const bloques = gridToBlocks(gridDeTextos(textos(), GRUPOS));
  const de = (dia: number) => bloques.filter(b => b.day === dia).map(b => `${b.time_start} ${b.subject} ${b.className}`.trim());

  it('coloca cada clase en su día y su hora', () => {
    expect(bloques).toHaveLength(14);
    expect(de(1)).toEqual(['08:30 Matemáticas 3º ESO A', '09:25 Ciencias 4º Primaria A', '10:20 Lengua 6º Primaria A', '11:45 Matemáticas 1º ESO C']);
    expect(de(2)).toEqual(['09:25 Matemáticas 2ºESO B', '10:20 Ciencias 4º Primaria A', '11:45 Tutoría 3º ESO A']);
    expect(de(3)).toEqual(['08:30 Matemáticas 3º ESO A', '10:20 Inglés 2º ESO B', '11:45 Lengua 5º Primaria B']);
    expect(de(4)).toEqual(['08:30 Lengua 5º Primaria B', '09:25 Matemáticas 3º ESO A']);
    expect(de(5)).toEqual(['08:30 Matemáticas 1º ESO C', '10:20 Matemáticas 3º ESO A']);
  });

  it('toma la hora de fin de la columna de horas y deja fuera recreo, guardia y reunión', () => {
    expect(bloques.find(b => b.day === 1 && b.time_start === '08:30')?.time_end).toBe('09:25');
    expect(bloques.some(b => /recreo|guardia|reuni/i.test(b.subject))).toBe(false);
  });

  it('separa el aula', () => {
    expect(bloques.find(b => b.day === 1 && b.time_start === '08:30')?.room).toBe('Aula 12');
    expect(bloques.find(b => b.day === 2 && b.time_start === '10:20')?.room).toBe('Lab 1');
  });

  it('no inventa nada en un texto que no es un horario', () => {
    expect(gridDeTextos([], GRUPOS)).toBeNull();
    const suelto = ['Acta', 'de', 'la', 'reunión', 'del', 'claustro', 'de', 'octubre'].map((str, i) => ({ str, x: 10 + i * 40, y: 30, w: 30, h: 9 }));
    expect(gridDeTextos(suelto, GRUPOS)).toBeNull();
  });
});

describe('partirCelda', () => {
  it('reconoce un grupo que ya existe aunque cambie el espaciado', () => {
    expect(partirCelda('Matemáticas 3ºESO A', ['3º ESO A'])).toEqual({ subject: 'Matemáticas', group: '3º ESO A', room: '' });
  });
  it('reconoce grupos habituales sin lista previa', () => {
    expect(partirCelda('Lengua 5º Primaria B Aula 4').group).toBe('5º Primaria B');
    expect(partirCelda('Lengua 5º Primaria B Aula 4').room).toBe('Aula 4');
    expect(partirCelda('MAT 3ºA').group).toBe('3ºA');
  });
  it('una celda que solo trae el grupo lo usa como nombre', () => {
    expect(partirCelda('3º ESO A')).toEqual({ subject: '3º ESO A', group: '', room: '' });
  });
  it('una celda vacía sigue vacía', () => {
    expect(partirCelda('  ')).toEqual({ subject: '', group: '', room: '' });
  });
});
