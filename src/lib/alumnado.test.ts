import { describe, it, expect } from 'vitest';
import { compararAlumnos, compararNombres, idsEnOrdenDeLista, ordenarAlumnado } from './alumnado';

const a = (id: string, name: string) => ({ id, name });

describe('orden de lista', () => {
  it('los números cuentan como números: 1, 2, 5, 14 y no 1, 14, 2, 5', () => {
    const lista = ['Alumno 14', 'Alumno 1', 'Alumno 5', 'Alumno 10', 'Alumno 2'].map((n, i) => a(String(i), n));
    expect(ordenarAlumnado(lista).map(x => x.name)).toEqual(['Alumno 1', 'Alumno 2', 'Alumno 5', 'Alumno 10', 'Alumno 14']);
  });

  it('no distingue mayúsculas ni tildes y pone la eñe donde toca', () => {
    expect(['Óscar', 'oliva', 'Ñoño', 'Nuria', 'Álvaro', 'Zoe'].sort(compararNombres)).toEqual(['Álvaro', 'Nuria', 'Ñoño', 'oliva', 'Óscar', 'Zoe']);
  });

  it('los apellidos primero, si así se escribieron', () => {
    const lista = [a('1', 'Pérez, Ana'), a('2', 'García, Luis'), a('3', 'García, Ana')];
    expect(ordenarAlumnado(lista).map(x => x.name)).toEqual(['García, Ana', 'García, Luis', 'Pérez, Ana']);
  });

  it('dos con el mismo nombre se ordenan siempre igual, por su identificador', () => {
    const x = a('b', 'Alumno 3');
    const y = a('a', 'Alumno 3');
    expect(compararAlumnos(x, y)).toBe(1);
    expect(ordenarAlumnado([x, y]).map(s => s.id)).toEqual(['a', 'b']);
    expect(ordenarAlumnado([y, x]).map(s => s.id)).toEqual(['a', 'b']);
  });

  it('no toca la lista original', () => {
    const lista = [a('1', 'B'), a('2', 'A')];
    ordenarAlumnado(lista);
    expect(lista.map(s => s.name)).toEqual(['B', 'A']);
  });

  it('pone en orden unos identificadores y deja al final los que no conoce', () => {
    const alumnado = [a('1', 'Alumno 10'), a('2', 'Alumno 2'), a('3', 'Alumno 1')];
    expect(idsEnOrdenDeLista(['1', 'x', '2', '3', 'y'], alumnado)).toEqual(['3', '2', '1', 'x', 'y']);
  });
});
