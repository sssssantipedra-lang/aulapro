import { describe, it, expect } from 'vitest';
import { alumnosConBarreras, barrerasDeClases, sinNombres } from './barreras';
import type { Student } from '../types';

const al = (id: string, class_id: string, name: string, ...textos: string[]): Student => ({
  id, class_id, name, email: '', photo: null, notes: '',
  alerts: textos.map((text, i) => ({ id: `${id}${i}`, text, level: 'warn' as const })),
});

describe('barreras de aprendizaje', () => {
  const alumnado = [
    al('1', 'a', 'María López Ruiz', 'Dislexia', 'Necesita más tiempo'),
    al('2', 'a', 'Pedro Gil', 'Dislexia', 'Necesita más tiempo'),
    al('3', 'b', 'Lucía Ortega', 'Lucía se distrae con facilidad'),
    al('4', 'b', 'Ana Sanz'),
    al('5', 'c', 'Otro Alumno', 'No debería salir'),
  ];

  it('una línea por alumno, juntando las iguales y sin tocar las clases no elegidas', () => {
    expect(barrerasDeClases(alumnado, ['a', 'b'])).toEqual([
      '2 alumnos: Dislexia; Necesita más tiempo',
      'el alumno se distrae con facilidad',
    ]);
  });
  it('quita el nombre de los compañeros aunque lleve tildes o esté en minúsculas', () => {
    expect(sinNombres('con maría y PEDRO en el grupo', ['maria', 'pedro'])).toBe('con el alumno y el alumno en el grupo');
    expect(sinNombres('Mariana no es María', ['maria'])).toBe('Mariana no es el alumno');
  });
  it('cuenta a quien tiene algún aviso', () => {
    expect(alumnosConBarreras(alumnado, ['a', 'b'])).toBe(3);
    expect(alumnosConBarreras(alumnado, [])).toBe(0);
  });
});
