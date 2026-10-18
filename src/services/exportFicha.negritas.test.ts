/**
 * Los `**asteriscos**` que la IA pone donde le parece: en la hoja y en el Word, lo que no se pinta con negritas sale sin
 * asteriscos, y lo que sí se pinta (enunciados, opciones, explicación…) sale en negrita.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildFichaHtml, buildFichaDocxBlob } from './exportFicha';
import type { Ficha } from '../types';

const contenido = (extra: object = {}) => ({
  titulo: 'Las **fracciones**', explicacion: 'Una **fracción** es parte de un todo.', instrucciones: '**Lee** y contesta.',
  estilo: 'clasico',
  historia: { personaje: 'Capitán', emoji: '🚀', mision: 'Salva la **nave**', cierre: 'Fin **bien**', insignia: '**Piloto**' },
  actividades: [{
    titulo: 'Bloque **uno**', dificultad: 1, emoji: '🚀', narrativa: 'La **nave** despega.',
    recuadro: { tipo: 'recuerda', texto: 'No olvides **esto**.', lista: ['**Primero**', 'Después'] },
    candado: { codigo: 'ABC', pista: 'La **fruta**' },
    ejercicios: [
      { tipo: 'abierta', enunciado: '**Explica** por qué.', solucion: 'Porque **sí**' },
      { tipo: 'opcion_multiple', enunciado: 'Elige.', opciones: ['**a**', 'b', 'c'], solucion: 'a' },
      { tipo: 'tabla_rellenar', enunciado: 'Tabla.', columnas: ['**A**', 'B'], filas: [['**1**', ''], ['2', '']], solucion: '1' },
      { tipo: 'calculos', enunciado: 'Calcula.', lineas: ['**1 + 1**', '2 + 2'], respuesta: 'linea', solucion: '2, 4' },
      { tipo: 'colorear', enunciado: 'Colorea.', leyenda: [{ color: 'rojo', criterio: '**pares**' }], itemsColorear: ['**2**', '3'], solucion: '' },
    ],
  }],
  ...extra,
});

const ficha = (c: object): Ficha => ({
  id: 'n', at: new Date().toISOString(), date: '2026-10-18', title: 'N',
  request: { tema: 'fracciones', area: 'Matemáticas', nivel: '4º Primaria', numEjercicios: 5, niveles: false, contextoClase: '' },
  content: c as Ficha['content'],
});

const variantes: [string, object][] = [
  ['clásica', {}],
  ['cuaderno', { estilo: 'cuaderno' }],
  ['con historia', { estilo: 'espacio' }],
  ['escape room', { estilo: 'espacio', formato: 'escape' }],
  ['lectura fácil', { variante: 'lectura_facil', estilo: 'cuaderno' }],
  ['con apoyos visuales', { visual: true, conceptos: [{ picto: 'apple', titulo: '**Fruta**', texto: 'Se **cuenta**.' }],
    actividades: [{ titulo: 'B **1**', indicacion: '**Mira**.', pasos: [{ picto: 'eye', verbo: '**Mira**', detalle: 'los **dibujos**' }], recuerda: [{ texto: 'Cada uno **vale** uno.' }],
      ejercicios: [{ tipo: 'abierta', enunciado: 'Cuenta.', solucion: '3' }] }] }],
  ['comprensión lectora', { estilo: 'cuaderno', lectura: { genero: 'cuento', parrafos: ['El **dragón** vive.'], dibujos: [], pista: 'Mira **bien**', destrezas: ['**Vocabulario**'] } }],
];

describe('asteriscos de negrita en la ficha', () => {
  for (const [nombre, extra] of variantes) {
    it(`${nombre}: ninguno queda a la vista, en la hoja ni en el Word`, async () => {
      const f = ficha(contenido(extra));
      const html = buildFichaHtml(f, 'es', { preview: true });
      expect(html.match(/\*\*/g) ?? [], 'HTML').toHaveLength(0);
      const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml.match(/\*\*/g) ?? [], 'Word').toHaveLength(0);
    });
  }

  it('lo que sí se pinta sale en negrita, en la hoja y en el Word', async () => {
    const f = ficha(contenido({ variante: 'lectura_facil', estilo: 'cuaderno' }));
    const html = buildFichaHtml(f, 'es');
    expect(html).toContain('<b>Explica</b>');
    expect(html).toContain('<b>fracción</b>');
    expect(html).toContain('<b>Lee</b>');
    expect(html).toContain('<b>a</b>');
    // Y lo que no, solo con su texto
    expect(html).toContain('Las fracciones');
    expect(html).toContain('No olvides esto.');
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toMatch(/<w:b\/>(?:(?!<\/w:r>).)*<w:t[^>]*>Explica<\/w:t>/);
  });

  it('con apoyos visuales, la consigna amarilla también pinta la negrita en el Word', async () => {
    const f = ficha(contenido({ visual: true, instrucciones: '**Mira** y cuenta.', actividades: [{ titulo: 'B', ejercicios: [{ tipo: 'abierta', enunciado: 'Cuenta.', solucion: '3' }] }] }));
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('**');
    expect(xml).toMatch(/<w:b\/>(?:(?!<\/w:r>).)*<w:t[^>]*>Mira<\/w:t>/);
  });
});
