/**
 * Los nombres cortos del alumnado (ruleta, avisos, informes): el de pila, salvo
 * con «Alumno 1», «Alumno 2» (los datos de ejemplo, decisión del dueño del
 * 6-10-2026) o con dos alumnos que se llaman igual.
 */
import { describe, it, expect } from 'vitest';
import { nombreDePila, nombresCortos } from './utils';

describe('nombres cortos del alumnado', () => {
  it('el de pila, o el nombre entero si detrás va un número', () => {
    expect(nombreDePila('Lucía Pérez Navarro')).toBe('Lucía');
    expect(nombreDePila('Alumno 12')).toBe('Alumno 12');
    expect(nombreDePila('  Alumno   3 ')).toBe('Alumno 3');
  });

  it('en la ruleta, los que se repiten van enteros', () => {
    expect(nombresCortos(['Alumno 1', 'Alumno 2'])).toEqual(['Alumno 1', 'Alumno 2']);
    expect(nombresCortos(['Lucía Pérez', 'Lucía Gil', 'Pau Ruiz'])).toEqual(['Lucía Pérez', 'Lucía Gil', 'Pau']);
  });
});
