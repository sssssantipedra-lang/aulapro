import { describe, it, expect } from 'vitest';
import { limpiarSdaDePdf } from './learningSituations';

describe('limpiarSdaDePdf (extraer una SdA de un PDF)', () => {
  it('conserva los elementos y las sesiones en orden', () => {
    const r = limpiarSdaDePdf({
      titulo: '  Nuestro huerto  ',
      idea: 'Diseñar y cuidar un huerto escolar.  ',
      areas: ['Ciencias', ' Matemáticas'],
      nivel: '5º de Primaria',
      metodologia: 'Aprendizaje por proyectos',
      temporalizacion: '3 semanas',
      meses: 'Abril',
      sesiones: [
        { titulo: 'Preparar la tierra', resumen: 'Acondicionamos el bancal.' },
        { titulo: 'Plantar', resumen: 'Sembramos hortalizas.' },
        { titulo: 'Cosecha', resumen: 'Recogemos y evaluamos.' },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.titulo).toBe('Nuestro huerto');
    expect(r!.areas).toEqual(['Ciencias', 'Matemáticas']);
    expect(r!.sesiones.map(s => s.titulo)).toEqual(['Preparar la tierra', 'Plantar', 'Cosecha']);
  });

  it('descarta sesiones y áreas vacías y rellena los textos ausentes', () => {
    const r = limpiarSdaDePdf({
      titulo: 'T',
      idea: '',
      areas: ['', 'Lengua', null],
      sesiones: [
        { titulo: 'A', resumen: 'r' },
        { titulo: '', resumen: '' },
        {},
        null,
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.areas).toEqual(['Lengua']);
    expect(r!.sesiones).toEqual([{ titulo: 'A', resumen: 'r' }]);
    expect(r!.metodologia).toBe('');
  });

  it('devuelve null cuando no hay nada aprovechable', () => {
    expect(limpiarSdaDePdf(null)).toBeNull();
    expect(limpiarSdaDePdf('no')).toBeNull();
    expect(limpiarSdaDePdf({})).toBeNull();
    expect(limpiarSdaDePdf({ titulo: '', idea: '', areas: [], sesiones: [] })).toBeNull();
  });
});
