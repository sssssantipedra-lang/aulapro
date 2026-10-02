/**
 * Emparejar «Mates» o «Ciencias» con una materia del decreto es donde un error
 * sale más caro: la SdA se generaría con las competencias de otra. Se
 * comprueba que nunca se adivina, que lo elegido por el docente manda y que
 * una elección que ya no vale se vuelve a preguntar.
 */
import { describe, it, expect } from 'vitest';
import { estadoDeMateria, materiasDelCurso, type ContextoClase } from './materiasDeClase';
import { materiasDe, type CurriculumEntry } from './index';

const PRIMARIA = materiasDe('primaria');
const ESO = materiasDe('eso');
const quinto: ContextoClase = { etapa: 'primaria', curso: 5 };

describe('asignaturas con alias seguro', () => {
  it('«Mates» es Matemáticas sin preguntar, y se marca que lo dedujo el alias', () => {
    expect(estadoDeMateria('Mates', quinto, PRIMARIA)).toEqual({ tipo: 'oficial', materia: 'Matemáticas', porAlias: true });
  });

  it('el nombre idéntico al del decreto también empareja', () => {
    expect(estadoDeMateria('Educación Física', quinto, PRIMARIA))
      .toEqual({ tipo: 'oficial', materia: 'Educación Física', porAlias: true });
  });
});

describe('asignaturas sin alias', () => {
  it('«Ciencias» en la ESO no se adivina: se pregunta, con las materias reales de ese curso', () => {
    const e = estadoDeMateria('Ciencias', { etapa: 'eso', curso: 2 }, ESO);
    expect(e.tipo).toBe('sin-decidir');
    if (e.tipo !== 'sin-decidir') return;
    expect(e.opciones).toContain('Biología y Geología');
    expect(e.opciones).toContain('Física y Química');
  });

  it('las opciones solo incluyen las materias que existen en ese curso', () => {
    // Educación en Valores solo tiene criterios en el 3er ciclo de Primaria
    expect(materiasDelCurso({ etapa: 'primaria', curso: 2 }, PRIMARIA)).not.toContain('Educación en Valores Cívicos y Éticos');
    expect(materiasDelCurso(quinto, PRIMARIA)).toContain('Educación en Valores Cívicos y Éticos');
  });

  it('en Primaria las ofrece todas las del ciclo: 7 áreas en 5º', () => {
    expect(materiasDelCurso(quinto, PRIMARIA)).toHaveLength(7);
  });
});

describe('lo que decide el docente', () => {
  it('una materia elegida manda sobre el alias', () => {
    const ctx = { ...quinto, materiasOficiales: { Mates: 'Lengua Castellana y Literatura' } };
    expect(estadoDeMateria('Mates', ctx, PRIMARIA))
      .toEqual({ tipo: 'oficial', materia: 'Lengua Castellana y Literatura', porAlias: false });
  });

  it('elegir «ninguna» (null) la deja en modo libre aunque el alias la emparejara', () => {
    const ctx = { ...quinto, materiasOficiales: { Mates: null } };
    expect(estadoDeMateria('Mates', ctx, PRIMARIA)).toEqual({ tipo: 'libre' });
  });

  it('una elección que no existe en este curso o comunidad se ignora y se vuelve a preguntar', () => {
    const ctx = { ...quinto, materiasOficiales: { Ciencias: 'Ciencias de la Naturaleza' } };
    expect(estadoDeMateria('Ciencias', ctx, PRIMARIA).tipo).toBe('sin-decidir');
  });

  it('un nombre de asignatura como «constructor» no coge propiedades del objeto', () => {
    expect(estadoDeMateria('constructor', { ...quinto, materiasOficiales: {} }, PRIMARIA).tipo).toBe('sin-decidir');
  });
});

describe('Matemáticas de 4º de ESO', () => {
  it('existe aunque falte elegir la opción A o B: es otra pregunta', () => {
    expect(estadoDeMateria('Matemáticas', { etapa: 'eso', curso: 4 }, ESO))
      .toEqual({ tipo: 'oficial', materia: 'Matemáticas', porAlias: true });
  });

  it('con la opción elegida sigue emparejando', () => {
    expect(estadoDeMateria('Matemáticas', { etapa: 'eso', curso: 4, opcionMatematicas: 'B' }, ESO).tipo).toBe('oficial');
  });
});

describe('con el currículo de una comunidad cuyas materias se llaman distinto', () => {
  const MADRID: CurriculumEntry[] = [
    { ...PRIMARIA.find(m => m.nombre === 'Matemáticas')!, nombre: 'Matemáticas' },
    { ...PRIMARIA.find(m => m.nombre === 'Conocimiento del Medio Natural, Social y Cultural')!, nombre: 'Ciencias de la Naturaleza' },
    { ...PRIMARIA.find(m => m.nombre === 'Conocimiento del Medio Natural, Social y Cultural')!, nombre: 'Ciencias Sociales' },
  ];

  it('«Cono» ya no empareja por alias, porque esa materia no existe allí: se pregunta con las de su comunidad', () => {
    const e = estadoDeMateria('Cono', quinto, MADRID);
    expect(e).toEqual({ tipo: 'sin-decidir', opciones: ['Matemáticas', 'Ciencias de la Naturaleza', 'Ciencias Sociales'] });
  });

  it('lo que elija el docente entre las materias de su comunidad se respeta', () => {
    const ctx = { ...quinto, materiasOficiales: { Cono: 'Ciencias Sociales' } };
    expect(estadoDeMateria('Cono', ctx, MADRID)).toEqual({ tipo: 'oficial', materia: 'Ciencias Sociales', porAlias: false });
  });

  it('una materia que sí se llama igual en las dos sigue emparejando', () => {
    expect(estadoDeMateria('Mates', quinto, MADRID)).toEqual({ tipo: 'oficial', materia: 'Matemáticas', porAlias: true });
  });
});
