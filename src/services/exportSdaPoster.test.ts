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

  it('el cartel del alumnado lleva el reto, las áreas, las sesiones y el producto final, sin competencias', () => {
    const html = buildSdaPosterHtml(sda, 'selva', 'es');
    expect(html).toContain('Mercado sostenible');
    expect(html).toContain('¿Qué vamos a trabajar?');
    expect(html).toContain('El centro tira mucha basura.');
    expect(html).toContain('Nuestras sesiones');
    expect(html).toContain('Activación');
    expect(html).toContain('Recuento');
    expect(html).toContain('Nuestro producto final');
    expect(html).toContain('Un mercado en el patio.');
    expect(html).not.toContain('<b>STEM</b>');
    expect(html).not.toContain('Para el docente');
    expect(html).toContain('3º ESO A');
  });

  it('el cartel del docente lleva lo que se trabaja de cada área, las competencias, las sesiones y el producto final', () => {
    const html = buildSdaPosterHtml(sda, 'selva', 'es', { audiencia: 'docente' });
    expect(html).toContain('Para el docente');
    expect(html).toContain('Qué vamos a trabajar');
    expect(html).toContain('Estadística y porcentajes.');
    expect(html).toContain('<b>STEM</b>');
    expect(html).toContain('<b>CCL</b>');
    expect(html).toContain('Las sesiones');
    expect(html).toContain('Recuento');
    expect(html).toContain('Un mercado en el patio.');
    expect(html).not.toContain('Nuestro reto');
  });

  it('recorta por frases sin pasarse', () => {
    expect(firstSentences('Uno. Dos. Tres.', 9)).toBe('Uno. Dos.');
    expect(firstSentences('Corto', 50)).toBe('Corto');
    expect(firstSentences('Una frase larguísima sin punto final que no cabe', 10).endsWith('…')).toBe(true);
  });
});
