/**
 * Proyectar una ficha un ejercicio por pantalla (25-11-2026): el orden, la cabecera de cada bloque,
 * cuándo deslizar el dedo pasa de ejercicio y el tamaño de letra que hace caber el ejercicio.
 */
import { describe, it, expect } from 'vitest';
import {
  cabeceraDeBloque, direccionDeDeslizar, ejerciciosEnOrden, limitesDeLetra, marcaEnHoja, solucionDe, tamanoQueCabe,
} from './proyeccion';
import type { FichaActivity } from '../services/resources';

const ej = (enunciado: string, solucion = '') => ({ tipo: 'abierta' as const, enunciado, solucion });

describe('ejerciciosEnOrden', () => {
  it('pone los ejercicios uno detrás de otro, con su bloque, su número en el bloque y en toda la ficha', () => {
    const acts: FichaActivity[] = [
      { titulo: 'A', ejercicios: [ej('a1'), ej('a2')] },
      { titulo: 'B', ejercicios: [] },
      { titulo: 'C', ejercicios: [ej('c1')] },
    ];
    expect(ejerciciosEnOrden(acts).map(x => [x.ex.enunciado, x.bloque, x.enBloque, x.n])).toEqual([
      ['a1', 0, 1, 1], ['a2', 0, 2, 2], ['c1', 2, 1, 3],
    ]);
  });
});

describe('marcaEnHoja', () => {
  const calc = { tipo: 'calculos' as const, enunciado: 'Calcula.', lineas: ['2 + 2'], solucion: '' };
  const acts: FichaActivity[] = [
    { titulo: 'A', ejercicios: [ej('a1'), ej('a2')] },
    { titulo: 'B', ejercicios: [ej('b1')] },
    { titulo: 'C', ejercicios: [calc, ej('c2')] },
  ];
  it('en «Cuaderno», como la hoja: 1, 2; sin número si el bloque tiene uno solo; letras si hay cálculos', () => {
    expect([marcaEnHoja(acts, 0, 1, true), marcaEnHoja(acts, 0, 2, true)]).toEqual(['1', '2']);
    expect(marcaEnHoja(acts, 1, 1, true)).toBeNull();
    expect([marcaEnHoja(acts, 2, 1, true), marcaEnHoja(acts, 2, 2, true)]).toEqual(['A', 'B']);
  });
  it('en los demás estilos, siempre el número', () => {
    expect([marcaEnHoja(acts, 1, 1, false), marcaEnHoja(acts, 2, 2, false)]).toEqual(['1', '2']);
  });
});

describe('cabeceraDeBloque', () => {
  it('antepone la etiqueta y el número al título', () => {
    expect(cabeceraDeBloque(['Actividad'], 1, 'Las palabras del ciclo')).toBe('Actividad 1 · Las palabras del ciclo');
  });
  it('no repite «Sala 1» si el título ya empieza así, con dos puntos, punto o en minúscula', () => {
    expect(cabeceraDeBloque(['Sala'], 1, 'Sala 1: la compuerta')).toBe('Sala 1: la compuerta');
    expect(cabeceraDeBloque(['Sala'], 2, 'sala 2. El laboratorio')).toBe('sala 2. El laboratorio');
    expect(cabeceraDeBloque(['Room', 'Sala'], 3, 'Sala 3 · Los motores')).toBe('Sala 3 · Los motores');
    expect(cabeceraDeBloque(['Misión'], 1, 'Mision 1: despegue')).toBe('Mision 1: despegue');
  });
  it('un número distinto o más largo no cuenta como el suyo', () => {
    expect(cabeceraDeBloque(['Sala'], 1, 'Sala 12: el final')).toBe('Sala 1 · Sala 12: el final');
    expect(cabeceraDeBloque(['Sala'], 2, 'Sala 1: la compuerta')).toBe('Sala 2 · Sala 1: la compuerta');
  });
  it('sin título, solo la etiqueta', () => {
    expect(cabeceraDeBloque(['Actividad'], 2, '  ')).toBe('Actividad 2');
  });
});

describe('direccionDeDeslizar', () => {
  it('a la izquierda es el siguiente y a la derecha, el anterior', () => {
    expect(direccionDeDeslizar(-120, 10, 200)).toBe(1);
    expect(direccionDeDeslizar(140, -20, 250)).toBe(-1);
  });
  it('un toque, un movimiento vertical o uno muy lento no pasan de ejercicio', () => {
    expect(direccionDeDeslizar(-8, 3, 90)).toBe(0);
    expect(direccionDeDeslizar(-80, 120, 200)).toBe(0);
    expect(direccionDeDeslizar(-200, 0, 2000)).toBe(0);
  });
});

describe('tamaño de la letra', () => {
  it('busca la letra más grande con la que cabe', () => {
    const r = tamanoQueCabe(px => px <= 41.3, 20, 90);
    expect(r.desborda).toBe(false);
    expect(r.px).toBeGreaterThanOrEqual(40.5);
    expect(r.px).toBeLessThanOrEqual(41.3);
  });
  it('si cabe con la más grande, se queda con ella', () => {
    expect(tamanoQueCabe(() => true, 20, 90)).toEqual({ px: 90, desborda: false });
  });
  it('si ni con la mínima cabe, se queda en la mínima y se desplaza', () => {
    expect(tamanoQueCabe(() => false, 20, 90)).toEqual({ px: 20, desborda: true });
  });
  it('el mínimo crece con la pantalla y nunca baja de 16 px; el máximo nunca es menor que el mínimo', () => {
    const movil = limitesDeLetra(230), proyector = limitesDeLetra(800);
    expect(movil.min).toBe(16);
    expect(proyector.min).toBeGreaterThan(movil.min);
    expect(proyector.max).toBeGreaterThan(proyector.min);
    expect(limitesDeLetra(40).max).toBeGreaterThanOrEqual(limitesDeLetra(40).min);
  });
});

describe('solucionDe', () => {
  it('la solución sin espacios, o nada', () => {
    expect(solucionDe(ej('x', '  4  '))).toBe('4');
    expect(solucionDe(ej('x'))).toBe('');
  });
});
