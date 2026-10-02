import { describe, it, expect } from 'vitest';
import { buildSdaPosterHtml, firstSentences } from './exportSdaPoster';
import type { LearningSituation } from '../types';

const sda = {
  id: 's1', at: '', date: '', title: 'Mercado sostenible', class_name: '3º ESO A',
  request: { idea: '', numero: '2', temporalizacion: '1ª evaluación', meses: '', areas: ['Matemáticas'], numSesiones: 2, nivel: '', contextoClase: '', metodologia: '' },
  content: {
    titulo: 'Mercado sostenible', justificacion: 'El centro tira mucha basura. Vamos a montar un mercado de trueque. Y otras cosas más largas.',
    ods: 'ODS 12', objetivosEtapa: '', competenciasClave: 'STEM y CCL', explicacionCurricular: '',
    areas: [{ area: 'Matemáticas', competenciasEspecificas: '', criteriosEvaluacion: '', saberesBasicos: 'Estadística y porcentajes.' }],
    inclusionUniversal: '', inclusionAdicional: '', inclusionIndividualizada: '',
    sesiones: [{ fase: 'Activación', titulo: 'Recuento', descripcion: '' }, { fase: 'Activación', titulo: 'El reto', descripcion: '' }, { fase: 'Producto final', titulo: 'Mercado', descripcion: '' }],
    metodologia: '', agrupamiento: '', recursos: '', productoFinal: 'Un mercado en el patio.', evaluacionTecnicas: '', evaluacionInstrumentos: '',
  },
} as unknown as LearningSituation;

describe('cartel de la SdA', () => {
  it('pone la ilustración del tema si la hay, y si no el emoji', () => {
    const art = 'data:image/jpeg;base64,AAAA';
    expect(buildSdaPosterHtml(sda, 'selva', 'es', { art })).toContain(`<img class="hero art" src="${art}"`);
    expect(buildSdaPosterHtml(sda, 'selva', 'es')).toContain('<span class="hero">🦁</span>');
  });

  it('lleva el reto, el producto, las fases con sus sesiones y las competencias', () => {
    const html = buildSdaPosterHtml(sda, 'selva', 'es');
    expect(html).toContain('Mercado sostenible');
    expect(html).toContain('Nuestro reto');
    expect(html).toContain('Un mercado en el patio.');
    expect(html).toContain('Activación');
    expect(html).toContain('Recuento');
    expect(html).toContain('<b>STEM</b>');
    expect(html).toContain('<b>CCL</b>');
    expect(html).toContain('3º ESO A');
  });

  it('recorta por frases sin pasarse', () => {
    expect(firstSentences('Uno. Dos. Tres.', 9)).toBe('Uno. Dos.');
    expect(firstSentences('Corto', 50)).toBe('Corto');
    expect(firstSentences('Una frase larguísima sin punto final que no cabe', 10).endsWith('…')).toBe(true);
  });
});
