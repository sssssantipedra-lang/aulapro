/**
 * Las listas de la SdA (la explicación curricular, las medidas para cada
 * necesidad) a veces llegan de la IA en un solo párrafo («1. … 2. …», «- … - …»),
 * y así se leen mal.
 */
import { describe, it, expect } from 'vitest';
import { listaEnLineas } from './learningSituations';

describe('listaEnLineas', () => {
  it('pone cada punto de la lista en su línea', () => {
    expect(listaEnLineas('1. Se elige la CE1 por la salud. 2. Se elige la CE2; 3. Los saberes 2, 3 y 4: la organización.'))
      .toBe('1. Se elige la CE1 por la salud.\n2. Se elige la CE2;\n3. Los saberes 2, 3 y 4: la organización.');
  });

  it('también las listas con guiones', () => {
    expect(listaEnLineas('- No puede correr: lanzador en la zona de ataque. - No puede saltar: juega sin saltos.'))
      .toBe('- No puede correr: lanzador en la zona de ataque.\n- No puede saltar: juega sin saltos.');
    expect(listaEnLineas('Medidas generales - con un guion en medio - que no es una lista.')).toBe('Medidas generales - con un guion en medio - que no es una lista.');
  });

  it('no parte los códigos de criterio ni los números dentro de una frase', () => {
    const t = 'Se trabaja el criterio 2.3 y la competencia específica 1. Después, el 3.1.';
    expect(listaEnLineas(t)).toBe(t);
  });

  it('si ya viene con saltos de línea, no lo toca', () => {
    const t = '1. Primero.\n2. Segundo. 3. Tercero.';
    expect(listaEnLineas(t)).toBe(t);
  });
});
