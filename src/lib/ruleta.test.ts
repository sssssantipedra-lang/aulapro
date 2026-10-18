// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { guardarSalidos, leerSalidos, marcarSalido, sinSalir } from './ruleta';

beforeEach(() => localStorage.clear());

describe('memoria de la ruleta', () => {
  it('lo que sale queda guardado por clase y se lee igual', () => {
    guardarSalidos('c1', ['Ana', 'Pau']);
    expect(leerSalidos('c1')).toEqual(['Ana', 'Pau']);
    expect(leerSalidos('c2')).toEqual([]);
  });

  it('reiniciar borra la entrada en vez de dejar una lista vacía', () => {
    guardarSalidos('c1', ['Ana']);
    guardarSalidos('c1', []);
    expect(localStorage.getItem('aulapro_ruleta_c1')).toBeNull();
  });

  it('un valor roto o que no es una lista se ignora', () => {
    localStorage.setItem('aulapro_ruleta_c1', '{no es json');
    expect(leerSalidos('c1')).toEqual([]);
    localStorage.setItem('aulapro_ruleta_c1', '{"a":1}');
    expect(leerSalidos('c1')).toEqual([]);
    localStorage.setItem('aulapro_ruleta_c1', '["Ana", 3, null]');
    expect(leerSalidos('c1')).toEqual(['Ana']);
  });

  it('el sorteo solo cuenta a quien no ha salido, en el orden de la clase', () => {
    expect(sinSalir(['Ana', 'Biel', 'Pau'], ['Biel'])).toEqual(['Ana', 'Pau']);
    expect(sinSalir(['Ana'], ['Ana'])).toEqual([]);
  });

  it('marcar a alguien no lo repite ni guarda nombres que ya no están en la clase', () => {
    const nombres = ['Ana', 'Biel', 'Pau'];
    expect(marcarSalido(nombres, ['Ana', 'Carla'], 'Biel')).toEqual(['Ana', 'Biel']);
    expect(marcarSalido(nombres, ['Ana'], 'Ana')).toEqual(['Ana']);
  });
});
