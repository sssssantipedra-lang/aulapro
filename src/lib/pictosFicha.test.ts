/**
 * Los pictogramas de las fichas con apoyos visuales: la IA elige de dos
 * listas cerradas y lo que devuelve se comprueba con el catálogo.
 */
import { describe, it, expect } from 'vitest';
import { CONSIGNAS_FICHA, DIBUJOS_FICHA, dibujosEnOrden, listaParaIA, pictoDeVerbo, pictoValido } from './pictosFicha';
import { pictoDe } from './pictos';

describe('pictogramas de ficha', () => {
  it('las consignas y los dibujos están en el catálogo, sin repetirse entre listas ni personas concretas', () => {
    for (const id of CONSIGNAS_FICHA) expect(pictoDe(id), id).toBeTruthy();
    expect(DIBUJOS_FICHA.length).toBeGreaterThan(150);
    expect(DIBUJOS_FICHA.some(id => CONSIGNAS_FICHA.includes(id))).toBe(false);
    expect(DIBUJOS_FICHA.some(id => pictoDe(id)!.categoria === 'personas')).toBe(false);
    expect(DIBUJOS_FICHA).toEqual(expect.arrayContaining(['apple', 'banana', 'orange', 'measuring-jug', 'tree']));
  });

  it('el verbo de un paso lleva a su pictograma en castellano, catalán o inglés', () => {
    expect(pictoDeVerbo('Rodea')).toBe('ap-rodear');
    expect(pictoDeVerbo('Encercla')).toBe('ap-rodear');
    expect(pictoDeVerbo('Circle')).toBe('ap-rodear');
    expect(pictoDeVerbo('Lee')).toBe('read-book');
    expect(pictoDeVerbo('Llegeix')).toBe('read-book');
    expect(pictoDeVerbo('Une')).toBe('ap-unir');
    expect(pictoDeVerbo('Subraya')).toBe('ap-subrayar');
    expect(pictoDeVerbo('Mide')).toBe('ap-regla');
    expect(pictoDeVerbo('Dibuja palotes')).toBe('ap-palotes');
    expect(pictoDeVerbo('Saluda')).toBeUndefined();
  });

  it('un identificador que no está en el catálogo no vale', () => {
    expect(pictoValido('apple')).toBe('apple');
    expect(pictoValido(' apple ')).toBe('apple');
    expect(pictoValido('tigre')).toBeUndefined();
    expect(pictoValido('')).toBeUndefined();
    expect(pictoValido(undefined)).toBeUndefined();
  });

  it('a la IA se le da el identificador con su nombre', () => {
    expect(listaParaIA(['apple', 'ap-rodear'])).toBe('apple (Manzana), ap-rodear (Rodear)');
  });

  it('los dibujos para contar se intercalan, como en una ficha de recuento', () => {
    expect(dibujosEnOrden([{ picto: 'apple', cantidad: 3 }, { picto: 'banana', cantidad: 1 }, { picto: 'orange', cantidad: 2 }]))
      .toEqual(['apple', 'banana', 'orange', 'apple', 'orange', 'apple']);
    expect(dibujosEnOrden([{ picto: 'apple' }])).toEqual(['apple']);
    expect(dibujosEnOrden(undefined)).toEqual([]);
  });
});
