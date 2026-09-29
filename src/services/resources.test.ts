import { describe, it, expect } from 'vitest';
import { prepareExercise, shuffleApart, cleanCode } from './resources';
import { cleanEmoji } from '../lib/fichaThemes';

describe('prepareExercise', () => {
  it('«ordenar» guarda el orden correcto y muestra los elementos desordenados', () => {
    const ex = prepareExercise({ tipo: 'ordenar', enunciado: '', elementos: ['a', 'b', 'c', 'd'], solucion: '' });
    expect(ex.ordenCorrecto).toEqual(['a', 'b', 'c', 'd']);
    expect(ex.elementos).not.toEqual(['a', 'b', 'c', 'd']);
    expect([...ex.elementos!].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('no vuelve a barajar un «ordenar» ya preparado', () => {
    const ex = { tipo: 'ordenar' as const, enunciado: '', elementos: ['b', 'a'], ordenCorrecto: ['a', 'b'], solucion: '' };
    expect(prepareExercise(ex)).toBe(ex);
  });

  it('«crucigrama» monta la cuadrícula a partir de las pistas', () => {
    const ex = prepareExercise({ tipo: 'crucigrama', enunciado: '', pistas: [{ palabra: 'Luna', pista: 'Satélite' }, { palabra: 'Sol', pista: 'Estrella' }], solucion: '' });
    expect(ex.crucigrama?.entradas.map(e => e.palabra).sort()).toEqual(['LUNA', 'SOL']);
  });
});

describe('shuffleApart', () => {
  it('nunca deja el orden original', () => {
    for (let i = 0; i < 50; i++) expect(shuffleApart([1, 2])).toEqual([2, 1]);
  });
});

describe('cleanEmoji', () => {
  it('se queda con el primer emoji y, si no hay, usa el de reserva', () => {
    expect(cleanEmoji('🚀 cohete', '⭐')).toBe('🚀');
    expect(cleanEmoji('👩‍🚀', '⭐')).toBe('👩‍🚀');
    expect(cleanEmoji('cohete', '⭐')).toBe('⭐');
    expect(cleanEmoji(undefined, '⭐')).toBe('⭐');
  });
});

describe('cleanCode', () => {
  it('deja solo cifras y letras en mayúsculas, sin tildes', () => {
    expect(cleanCode(' 4-7 2 ')).toBe('472');
    expect(cleanCode('sól')).toBe('SOL');
  });
});
