/**
 * El peldaño de la escalera de dificultad a la vista: las estrellas y su nombre en la
 * cabecera de cada bloque, en «Cuaderno», en los demás diseños y en Word.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildFichaDocxBlob, buildFichaHtml } from './exportFicha';
import { nivelHtml, seccionHtml } from './fichaCuaderno';
import type { FichaContent } from './resources';
import type { Ficha } from '../types';

const bloque = (titulo: string, dificultad?: 1 | 2 | 3) => ({
  titulo, ...(dificultad ? { dificultad } : {}),
  ejercicios: [{ tipo: 'abierta' as const, enunciado: `Pregunta de ${titulo}`, solucion: 'x' }],
});

const ficha = (estilo: FichaContent['estilo'], dificultades: (1 | 2 | 3 | undefined)[] = [1, 2, 3]): Ficha => ({
  id: 'e1', at: new Date().toISOString(), date: '2026-10-14', title: 'Escalera',
  request: { tema: 'Las rebajas', area: 'Matemáticas', nivel: '6º Primaria', numEjercicios: 3, niveles: false, contextoClase: '' },
  content: {
    titulo: 'Rebajas', explicacion: 'Repaso.', instrucciones: 'Resuelve.', estilo,
    actividades: dificultades.map((d, i) => bloque(['Calculamos', 'Resolvemos', 'Razonamos'][i] ?? `Bloque ${i}`, d)),
  },
});

const t = (k: string, v?: Record<string, string | number>) => (v ? k.replace(/\{(\w+)\}/g, (_, n) => String(v[n])) : k);
const cuerpo = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');
const cuenta = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('«Cuaderno»', () => {
  it('cada bloque lleva su nivel: tres estrellas, las que cuentan llenas, y su nombre', () => {
    const html = cuerpo(buildFichaHtml(ficha('cuaderno'), 'es'));
    expect(cuenta(html, /class="cq-niv"/g)).toBe(3);
    expect(html).toContain('data-dificultad="1"');
    expect(html).toContain('data-dificultad="3"');
    expect(html).toContain('<i>Para empezar</i>');
    expect(html).toContain('<i>Para practicar</i>');
    expect(html).toContain('<i>Para retarte</i>');
    expect(html).toContain('title="Nivel 2 de 3"');
    // 3 chips x 3 estrellas
    expect(cuenta(html, /<path d="M12 2\.4/g)).toBe(9);
    // llenas: 1 + 2 + 3 (solo dentro de los chips: la hoja lleva otros dibujos vectoriales)
    const chips = (html.match(/<span class="cq-niv".*?<\/span>/g) ?? []).join('');
    expect(cuenta(chips, /fill="#(?!fff)[0-9A-Fa-f]{6}" stroke/g)).toBe(6);
    expect(cuenta(chips, /fill="#fff" stroke/g)).toBe(3);
  });

  it('el nivel va después del título y sigue al filete punteado (se ordena por CSS)', () => {
    const html = buildFichaHtml(ficha('cuaderno'), 'es');
    const sec = cuerpo(html).match(/<div class="cq-sec"[^>]*>.*?<\/div>/)![0];
    expect(sec.indexOf('<h2>')).toBeLessThan(sec.indexOf('cq-niv'));
    expect(html).toMatch(/\.cq-sec::after \{[^}]*order: 2/);
    expect(html).toMatch(/\.cq-niv \{[^}]*order: 3/);
  });

  it('se traduce', () => {
    const en = cuerpo(buildFichaHtml(ficha('cuaderno'), 'en'));
    expect(en).toContain('<i>To start</i>');
    expect(en).toContain('title="Level 2 of 3"');
    const ca = cuerpo(buildFichaHtml(ficha('cuaderno'), 'ca'));
    expect(ca).toContain('<i>Per començar</i>');
    expect(ca).toContain('title="Nivell 2 de 3"');
  });

  it('una ficha guardada antes de la escalera no lleva nivel y se ve como siempre', () => {
    const html = cuerpo(buildFichaHtml(ficha('cuaderno', [undefined, undefined]), 'es'));
    expect(html).not.toContain('cq-niv');
    expect(html).not.toContain('data-dificultad');
  });

  it('las piezas sueltas', () => {
    expect(nivelHtml(2, { bg: '2563EB' }, t)).toContain('Nivel 2 de 3');
    expect(seccionHtml(1, 'Título', { bg: '2563EB', light: 'DBEAFE' }, 'Bloque 1')).not.toContain('cq-niv');
    expect(seccionHtml(1, 'Título', { bg: '2563EB', light: 'DBEAFE' }, 'Bloque 1', '', nivelHtml(3, { bg: '2563EB' }, t))).toContain('Para retarte');
  });
});

describe('los demás diseños', () => {
  it.each(['clasico', 'espacio'] as const)('«%s»: estrellas blancas en la cinta del bloque', estilo => {
    const html = cuerpo(buildFichaHtml(ficha(estilo), 'es'));
    expect(cuenta(html, /class="act-niv"/g)).toBe(3);
    expect(cuenta(html, /<path d="M12 2\.4/g)).toBe(9);
    expect(html).toContain('title="Nivel 3 de 3"');
    expect(html).not.toContain('cq-niv');
  });

  it('sin nivel, la cinta de siempre', () => {
    expect(cuerpo(buildFichaHtml(ficha('clasico', [undefined, undefined]), 'es'))).not.toContain('act-niv');
  });
});

describe('Word', () => {
  // Word lleva texto XML: las estrellas y el nombre del nivel van en runs seguidos
  const texto = async (f: Ficha) => {
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
    return zip.file('word/document.xml')!.async('string');
  };

  it('«Cuaderno»: ★☆☆ Para empezar en la línea del título', async () => {
    const xml = await texto(ficha('cuaderno'));
    expect(xml).toContain('★☆☆ Para empezar');
    expect(xml).toContain('★★☆ Para practicar');
    expect(xml).toContain('★★★ Para retarte');
  });

  it('los demás diseños: las estrellas en la cinta', async () => {
    const xml = await texto(ficha('clasico'));
    expect(xml).toContain('★☆☆');
    expect(xml).toContain('★★★');
  });

  it('sin nivel no hay estrellas', async () => {
    expect(await texto(ficha('cuaderno', [undefined]))).not.toContain('★');
  });
});
