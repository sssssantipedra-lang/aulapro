import { describe, it, expect } from 'vitest';
import { adaptacionExistente, textoCriterios, textoSaberes } from './apoyoAdaptacion';
import { APOYO_VACIO } from '../lib/apoyo';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { ApoyoData } from '../types/apoyo';

const materia = {
  asignatura: 'Lengua', grupo: '1',
  entry: {
    id: 'lengua', nombre: 'Lengua Castellana y Literatura', competencias: [],
    criterios: { '1': [{ codigo: '1.1', competencia: 1, texto: 'Comprender textos orales', codigoLiteral: true }, { codigo: '2.1', competencia: 2, texto: 'Producir textos', codigoLiteral: true }] },
    saberes: { '1': [{ bloque: 'A', tituloBloque: 'Las lenguas y sus hablantes', epigrafes: [] }, { bloque: 'B', tituloBloque: 'Comunicación', epigrafes: [] }] },
  },
} as unknown as MateriaDeClase;

describe('adaptación de la programación de aula', () => {
  it('los criterios los escribe el código con su texto oficial y no deja pasar los que no son del curso', () => {
    const n = materia.entry.nombre;
    expect(textoCriterios(materia, [`${n}|2.1`, `${n}|9.9`, `Matemáticas|1.1`, `${n}|2.1`, 7])).toBe('- 2.1 Producir textos');
    expect(textoCriterios(materia, undefined)).toBe('');
  });
  it('los saberes, por los bloques elegidos que existen', () => {
    expect(textoSaberes(materia, ['B', 'Z'])).toBe('- B. Comunicación');
    expect(textoSaberes(materia, [])).toBe('');
  });
  it('un alumno, un área y un trimestre tienen un solo documento', () => {
    const d: ApoyoData = { ...APOYO_VACIO, documentos: [
      { id: 'd1', alumnoId: 'a', tipo: 'adaptacion', area: 'Lengua', trimestre: 1, fecha: '', titulo: 't', apartados: [] },
      { id: 'd2', alumnoId: 'a', tipo: 'familia', trimestre: 1, fecha: '', titulo: 't', apartados: [] },
    ] };
    expect(adaptacionExistente(d, 'a', 'Lengua', 1)?.id).toBe('d1');
    expect(adaptacionExistente(d, 'a', 'Lengua', 2)).toBeUndefined();
    expect(adaptacionExistente(d, 'a', 'Matemáticas', 1)).toBeUndefined();
  });
});
