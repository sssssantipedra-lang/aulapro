import { describe, it, expect } from 'vitest';
import { compararAlumnos, compararNombres, idsEnOrdenDeLista, leerListado, ordenarAlumnado } from './alumnado';

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

describe('nombres repetidos', () => {
  it('claveDeNombre no distingue mayúsculas, tildes ni espacios de más', async () => {
    const { claveDeNombre } = await import('./alumnado');
    expect(claveDeNombre('  Lucía   Pérez ')).toBe(claveDeNombre('lucia perez'));
    expect(claveDeNombre('Lucía Pérez')).not.toBe(claveDeNombre('Lucía Pérez G.'));
  });
  it('mismoNombreEnClase busca solo en la misma clase y puede saltarse al propio alumno', async () => {
    const { mismoNombreEnClase } = await import('./alumnado');
    const alumnado = [{ id: 'a', name: 'Ana López', class_id: 'c1' }, { id: 'b', name: 'Ana López', class_id: 'c2' }];
    expect(mismoNombreEnClase('ana lopez', 'c1', alumnado)?.id).toBe('a');
    expect(mismoNombreEnClase('Ana López', 'c1', alumnado, 'a')).toBeUndefined();
    expect(mismoNombreEnClase('Ana López', 'c3', alumnado)).toBeUndefined();
  });
});


describe('leerListado', () => {
  it('lee una columna de nombres y salta la cabecera', () => {
    expect(leerListado('Nombre\nAlumno 1\n\nAlumno 2\n')).toEqual([{ name: 'Alumno 1', email: '' }, { name: 'Alumno 2', email: '' }]);
  });
  it('sigue leyendo «Nombre,Email»', () => {
    expect(leerListado('Nombre,Email\nAlumno 1,alumno1@ejemplo.com\nAlumno 2;alumno2@ejemplo.com'))
      .toEqual([{ name: 'Alumno 1', email: 'alumno1@ejemplo.com' }, { name: 'Alumno 2', email: 'alumno2@ejemplo.com' }]);
  });
  it('«Apellidos, Nombre», como en los listados oficiales, entra como «Nombre Apellidos» y sin correo', () => {
    expect(leerListado('Apellidos, Nombre\nPrimero Segundo, Alumno\n"Tercero Cuarto, Alumna"'))
      .toEqual([{ name: 'Alumno Primero Segundo', email: '' }, { name: 'Alumna Tercero Cuarto', email: '' }]);
  });
  it('columnas pegadas de una hoja de cálculo: número de lista, nombre y correo', () => {
    expect(leerListado('1\tAlumno 1\talumno1@ejemplo.com\n2\tPrimero Segundo, Alumno\t'))
      .toEqual([{ name: 'Alumno 1', email: 'alumno1@ejemplo.com' }, { name: 'Alumno Primero Segundo', email: '' }]);
  });
  it('una cabecera «Apellidos, Nombre» no descoloca las filas que vienen con otras columnas', () => {
    expect(leerListado('Apellidos, Nombre\nPrimero Segundo, Alumno 90\n2\tAlumno 91\talumno91@ejemplo.com\nAlumno 92'))
      .toEqual([{ name: 'Alumno 90 Primero Segundo', email: '' }, { name: 'Alumno 91', email: 'alumno91@ejemplo.com' }, { name: 'Alumno 92', email: '' }]);
  });
  it('con cabecera de nombre y apellidos en columnas, los une en ese orden', () => {
    expect(leerListado('Apellidos\tNombre\nPrimero Segundo\tAlumno')).toEqual([{ name: 'Alumno Primero Segundo', email: '' }]);
    expect(leerListado('Nombre;Apellidos\nAlumno;Primero Segundo')).toEqual([{ name: 'Alumno Primero Segundo', email: '' }]);
  });
});
