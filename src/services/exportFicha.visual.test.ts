/**
 * La ficha con apoyos visuales impresa: la consigna amarilla, los pasos
 * numerados con su pictograma, el «Recuerda», los dibujos para contar, las
 * tarjetas de la explicación y la atribución de Mulberry cuando sale alguno.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import JSZip from 'jszip';
import { buildFichaHtml, buildFichaDocxBlob, pictosDeFicha } from './exportFicha';
import type { Ficha } from '../types';

function visualFixture(visual = true): Ficha {
  return {
    id: 'fv1', at: new Date().toISOString(), date: '2026-10-06', title: 'La frutería',
    request: { tema: 'la frutería', area: 'Matemáticas', nivel: '3º Primaria', numEjercicios: 2, niveles: false, contextoClase: '' },
    content: {
      titulo: 'La frutería de la clase', explicacion: 'Contamos con palotes.', instrucciones: 'Sigue los pasos para completar la tabla.',
      visual,
      conceptos: [{ picto: 'apple', titulo: 'Fruta', texto: 'Se puede contar.' }],
      actividades: [{
        titulo: 'Contamos',
        indicacion: 'Primero, mira. Luego, cuenta.',
        pasos: [{ picto: 'eye', verbo: 'Mira', detalle: 'los dibujos' }, { picto: 'ap-palotes', verbo: 'Dibuja', detalle: 'los palotes' }],
        recuerda: [{ picto: 'apple', texto: 'Cada palote vale uno.' }],
        ejercicios: [
          { tipo: 'abierta', enunciado: 'Cuenta las frutas que ves.', consigna: 'count', imagenes: [{ picto: 'apple', cantidad: 2 }, { picto: 'banana', cantidad: 1 }], solucion: '3' },
          { tipo: 'tabla_rellenar', enunciado: 'Completa la tabla.', consigna: 'ap-tabla', columnas: ['Fruta', 'Total'], filas: [['Manzana', ''], ['Plátano', '']], pictosFilas: ['apple', 'banana'], solucion: '2, 1' },
        ],
      }],
    },
  };
}

const pictos = (ids: string[]) => Object.fromEntries(ids.map(id => [id, `data:image/svg+xml,${id}`]));

afterEach(() => vi.restoreAllMocks());

describe('ficha con apoyos visuales', () => {
  it('reúne todos sus pictogramas, sin repetir', () => {
    expect(pictosDeFicha(visualFixture().content).sort()).toEqual(['ap-palotes', 'ap-tabla', 'apple', 'banana', 'count', 'eye']);
    expect(pictosDeFicha(visualFixture(false).content)).toEqual([]);
  });

  it('pinta la consigna, los pasos, el «Recuerda», los dibujos intercalados y las tarjetas', () => {
    const f = visualFixture();
    const html = buildFichaHtml(f, 'es', { pictos: pictos(pictosDeFicha(f.content)) });
    expect(html).toContain('class="ficha-doc th-clasico vis"');
    expect(html).toContain('vis-instr');
    expect(html).toContain('Primero, mira. Luego, cuenta.');
    expect(html.match(/class="vis-paso"/g)).toHaveLength(2);
    expect(html).toContain('<strong>Mira</strong><span>los dibujos</span>');
    expect(html).toContain('src="data:image/svg+xml,ap-palotes"');
    expect(html).toContain('Recuerda');
    expect(html).toContain('<img class="vis-consigna" src="data:image/svg+xml,count" alt="Contar">');
    // Manzana, plátano, manzana: intercalados, para contarlos
    const dibujos = [...html.matchAll(/class="vis-img" src="data:image\/svg\+xml,([a-z-]+)"/g)].map(m => m[1]);
    expect(dibujos).toEqual(['apple', 'banana', 'apple']);
    expect(html.match(/class="vis-fila"/g)).toHaveLength(2);
    expect(html).toContain('<strong>Fruta</strong><span>Se puede contar.</span>');
    expect(html).toContain('Mulberry Symbols by Steve Lee');
  });

  it('sin pictogramas de Mulberry no lleva su atribución; sin apoyos visuales, nada de esto', () => {
    const f = visualFixture();
    expect(buildFichaHtml(f, 'es', { pictos: pictos(['ap-palotes', 'ap-tabla']) })).not.toContain('Mulberry');
    const plain = buildFichaHtml(visualFixture(false), 'es', { pictos: pictos(['apple']) });
    expect(plain).not.toContain('class="vis-paso"');
    expect(plain).not.toContain('class="vis-consigna"');
    expect(plain).not.toContain('Mulberry');
  });

  it('en catalán, el recuadro es «Recorda»', () => {
    const f = visualFixture();
    expect(buildFichaHtml(f, 'ca', { pictos: pictos(['apple']) })).toContain('Recorda');
  });

  it('el Word sale con la indicación, los pasos y el «Recuerda», aunque no haya dibujos que convertir', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sin red'));
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(visualFixture(), 'es')).arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Primero, mira. Luego, cuenta.');
    expect(xml).toContain('Mira');
    expect(xml).toContain('los palotes');
    expect(xml).toContain('RECUERDA');
    expect(xml).toContain('Cada palote vale uno.');
    expect(xml).toContain('Sigue los pasos para completar la tabla.');
  });
});
