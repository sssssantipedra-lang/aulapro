// @vitest-environment jsdom
/**
 * Los pictogramas se incrustan en el PDF como `data:`: SVG los de Mulberry y
 * los propios, WebP los hechos con IA (`ia-`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pictoComoDato } from './exportAgenda';

const PUBLIC = join(__dirname, '../../public');

afterEach(() => vi.unstubAllGlobals());

function servirDesdePublic() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const ruta = join(PUBLIC, String(url).replace(/^.*?(pictos\/)/, '$1'));
    const buf = readFileSync(ruta);
    return {
      ok: true,
      text: async () => buf.toString('utf8'),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  }));
}

describe('pictoComoDato', () => {
  it('un SVG sale como data:image/svg+xml', async () => {
    servirDesdePublic();
    const d = await pictoComoDato('ap-pausa');
    expect(d).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(d!.split(',')[1])).toContain('<svg');
  });

  it('un WebP de IA sale como data:image/webp en base64, sin estropear los bytes', async () => {
    servirDesdePublic();
    const d = await pictoComoDato('ia-plastilina');
    expect(d).toMatch(/^data:image\/webp;base64,/);
    const bytes = Buffer.from(d!.split(',')[1], 'base64');
    expect(bytes.equals(readFileSync(join(PUBLIC, 'pictos/aulapro/ia-plastilina.webp')))).toBe(true);
    // RIFF....WEBP
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  });

  it('si no se puede leer, no devuelve nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await pictoComoDato('ia-abrazo')).toBeNull();
  });
});
