import { describe, it, expect } from 'vitest';
import { areasSinCriterio, type SdaContent } from './learningSituations';
import { tablaDianaSda } from './instrumentoEmbebido';

const sda = {
  areas: [
    { area: 'Lengua', materia: 'lengua', oficial: true, criteriosEvaluacion: '1.1 Comprende textos\n1.2 Produce textos' },
    { area: 'Matemáticas', materia: 'mates', oficial: true, criteriosEvaluacion: '2.1 Resuelve problemas' },
  ],
} as unknown as SdaContent;

describe('SdA interdisciplinar', () => {
  it('avisa de las áreas a las que ningún criterio apunta', () => {
    expect(areasSinCriterio(sda, [{ criteriosOficiales: ['Lengua|1.1'] }])).toEqual(['Matemáticas']);
    expect(areasSinCriterio(sda, [{ criteriosOficiales: ['Lengua|1.1', 'Matemáticas|2.1'] }])).toEqual([]);
  });
});

describe('diana de una SdA', () => {
  it('sale dibujada (círculo con ítems numerados), no solo como tabla', () => {
    const html = tablaDianaSda([{ item: 'Exposición', peso: 1, nivel1: 'a', nivel2: 'b', nivel3: 'c', nivel4: 'd', competencias: [] }], 'es');
    expect(html).toContain('<svg');
    expect(html).toContain('Exposición');
  });
});
