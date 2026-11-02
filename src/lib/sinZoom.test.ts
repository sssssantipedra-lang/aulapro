// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinZoomConLosDedos } from './sinZoom';

describe('sin zoom con los dedos', () => {
  it('cancela los gestos de pellizco de Safari', () => {
    const quitar = sinZoomConLosDedos();
    for (const g of ['gesturestart', 'gesturechange', 'gestureend']) {
      const e = new Event(g, { cancelable: true });
      document.dispatchEvent(e);
      expect(e.defaultPrevented, g).toBe(true);
    }
    quitar();
    const e = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('el viewport fija la escala en 1 y no encoge la página para que quepa', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const vp = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
    for (const p of ['width=device-width', 'initial-scale=1.0', 'minimum-scale=1.0', 'maximum-scale=1.0', 'user-scalable=no', 'shrink-to-fit=no'])
      expect(vp, p).toContain(p);
  });
});
