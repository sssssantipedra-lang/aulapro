// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  imagenesValidas, leerTransferencia, direccionesDeHtml, traeImagen, imagenesDeTransferencia, prepararNuevas,
  MAX_IMAGENES_SESION,
} from './imagenesSesion';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQ';
const png = (n = 'a.png') => new File(['x'], n, { type: 'image/png' });

/** Un DataTransfer de mentira: solo lo que lee la app. */
function dt(p: { files?: File[]; items?: { kind: string; type: string; getAsFile: () => File | null }[]; datos?: Record<string, string> } = {}) {
  return {
    files: p.files ?? [], items: p.items ?? [], types: Object.keys(p.datos ?? {}),
    getData: (t: string) => p.datos?.[t] ?? '',
  } as unknown as DataTransfer;
}

describe('imágenes guardadas: se comprueban al leerlas', () => {
  it('deja pasar una imagen buena y conserva el pie', () => {
    expect(imagenesValidas([{ id: 'a', src: PNG, ancho: 800, alto: 600, pie: ' Mi pie ' }]))
      .toEqual([{ id: 'a', src: PNG, ancho: 800, alto: 600, pie: ' Mi pie ' }]);
  });

  it('descarta lo que no es una imagen de verdad: SVG, otras direcciones, sin id, ids repetidos', () => {
    const malas = [
      { id: 's', src: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { id: 'h', src: 'https://ejemplo.com/a.png' },
      { id: 'j', src: 'javascript:alert(1)' },
      { src: PNG },
      { id: 'a', src: PNG }, { id: 'a', src: JPG },
      null, 'texto', 5,
    ];
    expect(imagenesValidas(malas as unknown[]).map(i => i.id)).toEqual(['a']);
  });

  it('descarta una imagen enorme y limita cuántas se aceptan', () => {
    const enorme = { id: 'big', src: 'data:image/png;base64,' + 'A'.repeat(3_000_001) };
    expect(imagenesValidas([enorme])).toEqual([]);
    const muchas = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, src: PNG }));
    expect(imagenesValidas(muchas)).toHaveLength(MAX_IMAGENES_SESION);
  });

  it('un tamaño raro se queda en 0 en vez de romper', () => {
    expect(imagenesValidas([{ id: 'a', src: PNG, ancho: -4, alto: 'x' }])[0]).toMatchObject({ ancho: 0, alto: 0 });
  });
});

describe('qué trae un pegado o un arrastre', () => {
  it('un archivo de imagen es lo primero', () => {
    const t = leerTransferencia(dt({ files: [png(), new File(['t'], 'a.txt', { type: 'text/plain' })] }));
    expect(t.archivos).toHaveLength(1);
    expect(traeImagen(t)).toBe(true);
  });

  it('sin archivos, mira los elementos del portapapeles', () => {
    const f = png('captura.png');
    const t = leerTransferencia(dt({ items: [{ kind: 'file', type: 'image/png', getAsFile: () => f }, { kind: 'string', type: 'text/plain', getAsFile: () => null }] }));
    expect(t.archivos).toEqual([f]);
  });

  it('una imagen copiada de una web llega como HTML con <img>', () => {
    const html = '<meta charset="utf-8"><img src="https://ejemplo.com/foto.jpg" alt="x"><img src="https://ejemplo.com/foto.jpg"><img src="blob:nope"><img src="' + PNG + '">';
    expect(direccionesDeHtml(html)).toEqual(['https://ejemplo.com/foto.jpg', PNG]);
    expect(traeImagen(leerTransferencia(dt({ datos: { 'text/html': html } })))).toBe(true);
  });

  it('una dirección que acaba en una imagen vale; una web cualquiera, no', () => {
    expect(traeImagen(leerTransferencia(dt({ datos: { 'text/uri-list': 'https://ejemplo.com/a/foto.PNG?x=1' } })))).toBe(true);
    expect(traeImagen(leerTransferencia(dt({ datos: { 'text/plain': 'https://ejemplo.com/pagina' } })))).toBe(false);
    expect(traeImagen(leerTransferencia(dt({ datos: { 'text/plain': 'hola' } })))).toBe(false);
    expect(traeImagen(leerTransferencia(null))).toBe(false);
  });

  it('un texto copiado con negritas, sin imágenes, no se toma por una imagen', () => {
    expect(traeImagen(leerTransferencia(dt({ datos: { 'text/html': '<b>hola</b> <a href="https://x.com">enlace</a>', 'text/plain': 'hola enlace' } })))).toBe(false);
  });
});

describe('traer las imágenes', () => {
  it('con archivos, no descarga nada', async () => {
    const r = await imagenesDeTransferencia(leerTransferencia(dt({ files: [png()] })), async () => { throw new Error('no debería'); });
    expect(r.blobs).toHaveLength(1);
    expect(r.sinRecuperar).toBe(0);
  });

  it('descarga las de las direcciones y cuenta las que no se pudieron traer', async () => {
    const html = '<img src="https://a.com/1.png"><img src="https://b.com/2.png"><img src="https://c.com/3.png">';
    const r = await imagenesDeTransferencia(leerTransferencia(dt({ datos: { 'text/html': html } })), async url => {
      if (url.includes('b.com')) throw new Error('CORS');
      if (url.includes('c.com')) return new Blob(['<html>'], { type: 'text/html' });
      return new Blob(['x'], { type: 'image/png' });
    });
    expect(r.blobs).toHaveLength(1);
    expect(r.sinRecuperar).toBe(2);
  });
});

describe('preparar las nuevas', () => {
  const bien = async () => ({ src: JPG, ancho: 10, alto: 10 });

  it('respeta el sitio que queda y avisa de las que no caben', async () => {
    const r = await prepararNuevas([png(), png(), png()], 2, bien);
    expect(r.nuevas).toHaveLength(2);
    expect(r.porElTope).toBe(1);
    expect(new Set(r.nuevas.map(n => n.id)).size).toBe(2);
  });

  it('las que no se pueden leer se cuentan y no frenan a las demás', async () => {
    let n = 0;
    const r = await prepararNuevas([png(), png(), png()], 12, async () => { if (++n === 2) throw new Error('rota'); return bien(); });
    expect(r.nuevas).toHaveLength(2);
    expect(r.ilegibles).toBe(1);
  });

  it('sin sitio no prepara ninguna', async () => {
    const r = await prepararNuevas([png()], 0, bien);
    expect(r).toEqual({ nuevas: [], porElTope: 1, ilegibles: 0 });
  });
});
