import { describe, it, expect } from 'vitest';
import { buildFichaHtml, buildFichaDocxBlob } from './exportFicha';
import { buildWordSearchGrid } from '../lib/wordSearch';
import type { Ficha } from '../types';

/** Ficha mínima con un ejercicio de cada tipo "con dibujo": tabla, relacionar y ahora sopa de letras. */
function fixture(): Ficha {
  const { rejilla, posiciones } = buildWordSearchGrid(['sol', 'luna', 'estrella']);
  return {
    id: 'fic1',
    at: new Date().toISOString(),
    date: '2026-08-25',
    title: 'El sistema solar',
    request: { tema: 'el sistema solar', area: 'Ciencias', nivel: '4º Primaria', numEjercicios: 1, niveles: false, contextoClase: '' },
    content: {
      titulo: 'El sistema solar',
      explicacion: 'Repaso breve.',
      instrucciones: 'Completa los ejercicios.',
      actividades: [{
        titulo: 'Vocabulario',
        ejercicios: [{
          tipo: 'sopa_letras',
          enunciado: 'Encuentra estas palabras.',
          palabras: posiciones.map(p => p.palabra),
          rejilla,
          posiciones,
          solucion: posiciones.map(p => p.palabra).join(', '),
        }],
      }],
    },
  };
}

describe('exportFicha — sopa_letras', () => {
  it('buildFichaHtml incluye la rejilla en blanco y la lista de palabras, sin coordenadas de solución', () => {
    const html = buildFichaHtml(fixture(), 'es');
    expect(html).toContain('ficha-sopa');
    expect(html).toContain('SOL');
    expect(html).toContain('LUNA');
    expect(html).toContain('ESTRELLA');
    // La solución (posiciones fila/columna) es solo para la vista en la app, nunca para el HTML exportado.
    expect(html).not.toContain('"fila"');
    expect(html).not.toContain('"posiciones"');
  });

  it('buildFichaDocxBlob genera un .docx sin lanzar excepción', async () => {
    const blob = await buildFichaDocxBlob(fixture(), 'es');
    expect(blob.size).toBeGreaterThan(0);
  });
});

/** Ficha con un "problema" que lleva figura geométrica (área de un rectángulo). */
function figuraFixture(): Ficha {
  return {
    id: 'fic2',
    at: new Date().toISOString(),
    date: '2026-08-25',
    title: 'Área de rectángulos',
    request: { tema: 'área de rectángulos', area: 'Matemáticas', nivel: '5º Primaria', numEjercicios: 1, niveles: false, contextoClase: '' },
    content: {
      titulo: 'Área de rectángulos',
      explicacion: 'Repaso breve.',
      instrucciones: 'Calcula el área.',
      actividades: [{
        titulo: 'Problemas',
        ejercicios: [{
          tipo: 'problema',
          enunciado: 'Calcula el área de un rectángulo de base 6 cm y altura 4 cm.',
          figura: { forma: 'rectangulo', medidas: [{ etiqueta: 'base', valor: '6 cm' }, { etiqueta: 'altura', valor: '4 cm' }] },
          solucion: '24 cm²',
        }],
      }],
    },
  };
}

describe('exportFicha — figura geométrica', () => {
  it('buildFichaHtml incrusta el SVG del diagrama con las medidas dadas', () => {
    const html = buildFichaHtml(figuraFixture(), 'es');
    expect(html).toContain('ficha-figura');
    expect(html).toContain('<svg');
    expect(html).toContain('>6 cm<');
    expect(html).toContain('>4 cm<');
  });

  it('buildFichaDocxBlob no lanza excepción aunque no haya DOM/canvas para rasterizar (entorno de test)', async () => {
    const blob = await buildFichaDocxBlob(figuraFixture(), 'es');
    expect(blob.size).toBeGreaterThan(0);
  });
});
