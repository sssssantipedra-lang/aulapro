/**
 * Un emparejamiento equivocado aquí es peor que no emparejar nada: generaría
 * una situación de aprendizaje de «Ciencias» con las competencias de otra
 * materia, presentado como si fuera currículo oficial. Por eso se comprueba
 * tanto que los alias claros emparejan como que los casos ambiguos o
 * inexistentes se quedan sin emparejar, a propósito.
 */
import { describe, it, expect } from 'vitest';
import { emparejarMateria, tablaDeAlias } from './mapeoMaterias';
import { buscarMateria, materiasDe, type CurriculumEntry } from './index';
import { cargarCurriculo } from './cargar';

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

describe('emparejarMateria — con el currículo de una comunidad', () => {
  const valenciana = async (idioma: 'es' | 'ca') =>
    (await cargarCurriculo('comunitat-valenciana', 'primaria', idioma)).materias;

  it.each([
    ['Música', 'Música y Danza'],
    ['Plástica', 'Educación Plástica y Visual'],
    ['Valenciano', 'Valenciano: Lengua y Literatura'],
    ['Lengua', 'Lengua Castellana y Literatura'],
    ['Castellano', 'Lengua Castellana y Literatura'],
    ['Mates', 'Matemáticas'],
    ['Inglés', 'Lengua Extranjera'],
    ['Naturales', 'Conocimiento del Medio Natural, Social y Cultural'],
    ['Valores', 'Educación en Valores Cívicos y Éticos'],
  ])('Comunitat Valenciana: "%s" empareja con "%s"', async (asignatura, esperado) => {
    expect(emparejarMateria(asignatura, 'primaria', await valenciana('es'))).toBe(esperado);
  });

  it.each([
    // Dos áreas en la Comunitat Valenciana: no se adivina cuál
    'Educación Artística',
    // Puede ser cualquiera de las dos lenguas oficiales
    'Lengua y Literatura',
    'Religión',
  ])('Comunitat Valenciana: "%s" no empareja', async asignatura => {
    expect(emparejarMateria(asignatura, 'primaria', await valenciana('es'))).toBeNull();
  });

  it('con la app en valenciano, devuelve el nombre valenciano, y entiende lo escrito en valenciano', async () => {
    const ca = await valenciana('ca');
    expect(emparejarMateria('Mates', 'primaria', ca)).toBe('Matemàtiques');
    expect(emparejarMateria('Música', 'primaria', ca)).toBe('Música i Dansa');
    expect(emparejarMateria('Anglès', 'primaria', ca)).toBe('Llengua Estrangera');
    expect(emparejarMateria('Valors', 'primaria', ca)).toBe('Educació en Valors Cívics i Ètics');
    // Y lo escrito en valenciano también empareja con la app en castellano
    expect(emparejarMateria('Matemàtiques', 'primaria', await valenciana('es'))).toBe('Matemáticas');
  });

  const madrid = async () => (await cargarCurriculo('madrid', 'primaria', 'es')).materias;

  it.each([
    ['Naturales', 'Ciencias de la Naturaleza'],
    ['Sociales', 'Ciencias Sociales'],
    ['Música', 'Educación Artística'],
    ['Plástica', 'Educación Artística'],
    ['Inglés', 'Lengua Extranjera: Inglés'],
    ['Francés', 'Segunda Lengua Extranjera'],
    ['Robótica', 'Tecnología y Robótica'],
    ['Lengua', 'Lengua Castellana y Literatura'],
    ['Valores', 'Educación en Valores Cívicos y Éticos'],
  ])('Madrid: "%s" empareja con "%s"', async (asignatura, esperado) => {
    expect(emparejarMateria(asignatura, 'primaria', await madrid())).toBe(esperado);
  });

  it.each([
    // Dos áreas en Madrid: Ciencias de la Naturaleza y Ciencias Sociales
    'Conocimiento del Medio', 'Cono',
    'Valenciano', 'Religión',
  ])('Madrid: "%s" no empareja', async asignatura => {
    expect(emparejarMateria(asignatura, 'primaria', await madrid())).toBeNull();
  });

  it('el estatal sigue igual: «Música» es Educación Artística y «Valenciano» no existe', () => {
    expect(emparejarMateria('Música', 'primaria')).toBe('Educación Artística');
    expect(emparejarMateria('Valenciano', 'primaria')).toBeNull();
  });

  it('ningún alias puede caer en dos materias del mismo currículo', async () => {
    const curriculos: [string, CurriculumEntry[]][] = [
      ['estatal', materiasDe('primaria')],
      ['valenciana es', await valenciana('es')],
      ['valenciana ca', await valenciana('ca')],
      ['Madrid', await madrid()],
      ['Cataluña', (await cargarCurriculo('cataluna', 'primaria')).materias],
    ];
    for (const [nombre, materias] of curriculos) {
      for (const [alias, ids] of tablaDeAlias('primaria')) {
        const existen = ids.filter(id => materias.some(m => m.id === id));
        expect(existen.length, `${nombre}: «${alias}» → ${existen.join(', ')}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('cada identificador de la tabla existe en algún currículo', async () => {
    const todos = [
      ...materiasDe('primaria'), ...await valenciana('es'), ...await madrid(),
      ...(await cargarCurriculo('cataluna', 'primaria')).materias,
    ].map(m => m.id);
    for (const [alias, ids] of tablaDeAlias('primaria')) {
      for (const id of ids) expect(todos, `«${alias}» → ${id}`).toContain(id);
    }
    const eso = [
      ...materiasDe('eso'), ...(await cargarCurriculo('madrid', 'eso')).materias,
      ...(await cargarCurriculo('comunitat-valenciana', 'eso')).materias,
      ...(await cargarCurriculo('cataluna', 'eso')).materias,
    ].map(m => m.id);
    for (const [alias, ids] of tablaDeAlias('eso')) {
      for (const id of ids) expect(eso, `«${alias}» → ${id}`).toContain(id);
    }
  });

  const madridEso = async () => (await cargarCurriculo('madrid', 'eso', 'es')).materias;

  it.each([
    ['Biología', 'Biología y Geología'],
    ['Sociales', 'Geografía e Historia'],
    ['Inglés', 'Lengua Extranjera'],
    ['Informática', 'Ciencias de la Computación'],
    ['Cultura Clásica', 'Cultura Clásica'],
    ['Filosofía', 'Filosofía'],
    ['Plástica', 'Educación Plástica, Visual y Audiovisual'],
    // El nombre exacto manda: en Madrid «Tecnología» es la materia de cuarto
    ['Tecnología', 'Tecnología'],
    ['Tecnología y Digitalización', 'Tecnología y Digitalización'],
  ])('Madrid, ESO: "%s" empareja con "%s"', async (asignatura, esperado) => {
    expect(emparejarMateria(asignatura, 'eso', await madridEso())).toBe(esperado);
  });

  it('Madrid, ESO: «Francés» sigue sin emparejar (puede ser la primera o la segunda lengua)', async () => {
    expect(emparejarMateria('Francés', 'eso', await madridEso())).toBeNull();
  });

  it('ningún alias de la ESO puede caer en dos materias del mismo currículo', async () => {
    for (const [nombre, materias] of [
      ['estatal', materiasDe('eso')], ['Madrid', await madridEso()],
      ['Comunitat Valenciana', (await cargarCurriculo('comunitat-valenciana', 'eso')).materias],
      ['Cataluña', (await cargarCurriculo('cataluna', 'eso')).materias],
    ] as const) {
      for (const [alias, ids] of tablaDeAlias('eso')) {
        const existen = ids.filter(id => materias.some(m => m.id === id));
        expect(existen.length, `${nombre}: «${alias}» → ${existen.join(', ')}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
