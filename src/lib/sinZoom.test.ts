// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinAlejarConLosDedos } from './sinZoom';

const gesto = (tipo: string, scale: number) => {
  const e = new Event(tipo, { cancelable: true }) as Event & { scale: number };
  e.scale = scale;
  document.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('zoom con los dedos (3-11-2026)', () => {
  it('deja ampliar y cancela alejar por debajo del tamaño normal', () => {
    const quitar = sinAlejarConLosDedos();
    expect(gesto('gesturechange', 1.8), 'ampliar').toBe(false);
    expect(gesto('gesturechange', 0.6), 'alejar a escala 1').toBe(true);
    quitar();
    expect(gesto('gesturechange', 0.6)).toBe(false);
  });

  it('el viewport no impide ampliar y no deja alejar por debajo de 1', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const vp = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
    for (const p of ['width=device-width', 'initial-scale=1.0', 'minimum-scale=1.0', 'shrink-to-fit=no']) expect(vp, p).toContain(p);
    for (const p of ['maximum-scale', 'user-scalable=no']) expect(vp, p).not.toContain(p);
  });

  it('el CSS deja pellizcar', () => {
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toMatch(/html \{ touch-action: manipulation;/);
    expect(css).not.toMatch(/html \{ touch-action: pan-x pan-y;/);
  });
});
