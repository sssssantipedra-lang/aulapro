/**
 * Un emparejamiento equivocado aquí es peor que no emparejar nada: generaría
 * una situación de aprendizaje de «Ciencias» con las competencias de otra
 * materia, presentado como si fuera currículo oficial. Por eso se comprueba
 * tanto que los alias claros emparejan como que los casos ambiguos o
 * inexistentes se quedan sin emparejar, a propósito.
 */
import { describe, it, expect } from 'vitest';
import { emparejarMateria } from './mapeoMaterias';
import { buscarMateria } from './index';

describe('emparejarMateria — Primaria', () => {
  it.each([
    ['Matemáticas', 'Matemáticas'],
    ['Mates', 'Matemáticas'],
    ['Lengua', 'Lengua Castellana y Literatura'],
    ['Castellano', 'Lengua Castellana y Literatura'],
    ['Inglés', 'Lengua Extranjera'],
    ['Naturales', 'Conocimiento del Medio Natural, Social y Cultural'],
    ['Cono', 'Conocimiento del Medio Natural, Social y Cultural'],
    ['Educación Física', 'Educación Física'],
    ['Plástica', 'Educación Artística'],
    ['Música', 'Educación Artística'],
    ['Valores', 'Educación en Valores Cívicos y Éticos'],
  ])('"%s" empareja con "%s"', (asignatura, esperado) => {
    expect(emparejarMateria(asignatura, 'primaria')).toBe(esperado);
  });

  it.each(['Religión', 'Filosofía', 'Ciencias'])('"%s" no empareja con nada', asignatura => {
    expect(emparejarMateria(asignatura, 'primaria')).toBeNull();
  });

  it('cada alias apunta a una materia que existe de verdad en los datos', () => {
    for (const asignatura of ['Matemáticas', 'Lengua', 'Inglés', 'Naturales', 'Plástica']) {
      const nombre = emparejarMateria(asignatura, 'primaria');
      expect(buscarMateria('primaria', nombre!)).toBeDefined();
    }
  });
});

describe('emparejarMateria — ESO', () => {
  it.each([
    ['Biología y Geología', 'Biología y Geología'],
    ['Física y Química', 'Física y Química'],
    ['Sociales', 'Geografía e Historia'],
    ['Lengua', 'Lengua Castellana y Literatura'],
    ['Inglés', 'Lengua Extranjera'],
    ['Tecnología', 'Tecnología y Digitalización'],
    ['Digitalización', 'Digitalización'],
    ['Plástica', 'Educación Plástica, Visual y Audiovisual'],
  ])('"%s" empareja con "%s"', (asignatura, esperado) => {
    expect(emparejarMateria(asignatura, 'eso')).toBe(esperado);
  });

  it.each([
    // Ambiguas de verdad: no hay una única materia correcta.
    'Ciencias', 'Francés',
    // No existen en ninguno de los dos decretos.
    'Religión', 'Filosofía',
  ])('"%s" no empareja con nada (es ambigua o no existe)', asignatura => {
    expect(emparejarMateria(asignatura, 'eso')).toBeNull();
  });

  it('cada alias apunta a una materia que existe de verdad en los datos', () => {
    for (const asignatura of ['Biología y Geología', 'Sociales', 'Tecnología', 'Digitalización']) {
      const nombre = emparejarMateria(asignatura, 'eso');
      expect(buscarMateria('eso', nombre!)).toBeDefined();
    }
  });
});
