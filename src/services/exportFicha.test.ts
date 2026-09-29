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

/** Ficha con tema y los cuatro tipos nuevos. */
function aventuraFixture(): Ficha {
  return {
    id: 'fic3', at: new Date().toISOString(), date: '2026-09-29', title: 'Rescate',
    request: { tema: 'fracciones', area: 'Matemáticas', nivel: '5º Primaria', numEjercicios: 4, niveles: false, contextoClase: '' },
    content: {
      estilo: 'espacio', titulo: 'Rescate en el planeta Fracción',
      historia: { personaje: 'Capitana Nova', emoji: '👩‍🚀', mision: 'Repara la nave.', cierre: '¡Lo habéis conseguido!', insignia: 'Piloto de las fracciones' },
      explicacion: 'Repaso.', instrucciones: 'Adelante.',
      actividades: [{
        titulo: 'Motor', emoji: '🚀', narrativa: 'El motor no arranca.',
        ejercicios: [
          { tipo: 'verdadero_falso', enunciado: 'V o F', afirmaciones: ['1/2 = 2/4', '1/3 = 1/2'], solucion: 'V, F' },
          { tipo: 'ordenar', enunciado: 'Ordena', elementos: ['1/2', '1/8', '1/4'], ordenCorrecto: ['1/8', '1/4', '1/2'], solucion: '1/8, 1/4, 1/2' },
          { tipo: 'crucigrama', enunciado: 'Crucigrama', pistas: [{ palabra: 'MITAD', pista: 'Una de dos partes' }, { palabra: 'UNIDAD', pista: 'El todo' }],
            crucigrama: { filas: 5, columnas: 6, entradas: [
              { numero: 1, palabra: 'UNIDAD', pista: 'El todo', fila: 2, columna: 0, dir: 'H' },
              { numero: 2, palabra: 'MITAD', pista: 'Una de dos partes', fila: 0, columna: 4, dir: 'V' },
            ] }, solucion: 'MITAD, UNIDAD' },
          { tipo: 'comic', enunciado: 'Completa', vinetas: [{ personaje: '👩‍🚀', texto: 'Tenemos 2/4.' }, { personaje: '🧑‍💻', texto: '' }], solucion: 'La mitad' },
        ],
      }],
    },
  };
}

describe('exportFicha — temas con historia y tipos nuevos', () => {
  it('pinta la cabecera del tema, la misión, los bloques con su nombre y la insignia', () => {
    const html = buildFichaHtml(aventuraFixture(), 'es');
    expect(html).toContain('ficha-banner');
    expect(html).toContain('Capitana Nova');
    expect(html).toContain('Misión 1: Motor');
    expect(html).toContain('El motor no arranca.');
    expect(html).toContain('Piloto de las fracciones');
    expect(html).toContain('¡Misión cumplida!');
  });

  it('pinta verdadero/falso, ordenar, crucigrama y cómic sin soluciones', () => {
    const html = buildFichaHtml(aventuraFixture(), 'es');
    expect(html).toContain('vf-box');
    expect(html).toContain('ord-num');
    expect(html).toContain('cw-cell');
    expect(html).toContain('Una de dos partes');
    expect(html).toContain('bubble empty');
    // Las letras del crucigrama y el orden correcto no se imprimen
    expect(html).not.toMatch(/cw-cell">[A-Z]/);
    expect(html).not.toContain('1/8, 1/4, 1/2');
  });

  it('en «Clásica» no hay historia aunque la ficha la tenga guardada', () => {
    const f = aventuraFixture();
    f.content.estilo = 'clasico';
    const html = buildFichaHtml(f, 'es');
    expect(html).not.toContain('<header class="ficha-banner"');
    expect(html).not.toContain('Capitana Nova');
    expect(html).toContain('Actividad 1: Motor');
  });

  it('la vista previa marca los bloques para seleccionarlos y la exportación no', () => {
    expect(buildFichaHtml(aventuraFixture(), 'es', { preview: true })).toContain('data-ex="0-2"');
    expect(buildFichaHtml(aventuraFixture(), 'es')).not.toContain('data-ex=');
  });

  it('el Word con tema y tipos nuevos se genera sin errores', async () => {
    const blob = await buildFichaDocxBlob(aventuraFixture(), 'es');
    expect(blob.size).toBeGreaterThan(0);
  });
});
