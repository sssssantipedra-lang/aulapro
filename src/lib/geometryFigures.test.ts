import { describe, it, expect } from 'vitest';
import { buildFigureSvg, FIGURE_SHAPES, FIGURE_SLOTS, type FigureMedida } from './geometryFigures';

describe('buildFigureSvg', () => {
  it.each(FIGURE_SHAPES)('dibuja "%s" con sus medidas, sin NaN ni etiquetas rotas', (forma) => {
    const medidas: FigureMedida[] = FIGURE_SLOTS[forma].map((slot, i) => ({ etiqueta: slot, valor: `${i + 3} cm` }));
    const svg = buildFigureSvg(forma, medidas, '#0369A1');

    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
    for (const m of medidas) expect(svg).toContain(`>${m.valor}<`);
  });

  it('una forma sin todas las medidas no revienta y solo dibuja las que tiene', () => {
    const svg = buildFigureSvg('cilindro', [{ etiqueta: 'radio', valor: '4 cm' }], '#0369A1');
    expect(svg).toContain('>4 cm<');
    expect(svg).not.toContain('NaN');
  });

  it('recorta un valor demasiado largo en vez de desbordar el dibujo', () => {
    const svg = buildFigureSvg('cubo', [{ etiqueta: 'lado', valor: 'aproximadamente 6 cm' }], '#0369A1');
    expect(svg).toContain('aproxima…');
    expect(svg).not.toContain('aproximadamente 6 cm');
  });

  it('una forma desconocida no lanza y devuelve un <svg> vacío', () => {
    const svg = buildFigureSvg('no-existe' as never, [], '#0369A1');
    expect(svg).toContain('<svg');
  });

  /** Extrae la coordenada "y" del <text> que contiene exactamente ese valor. */
  function labelY(svg: string, valor: string): number {
    const m = svg.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${valor}<`));
    if (!m) throw new Error(`No se encontró la etiqueta "${valor}" en el SVG`);
    return Number(m[1]);
  }

  it('prisma_rectangular: "ancho" va en la arista de profundidad (arriba), "altura" en la vertical frontal (medio) — no al revés', () => {
    const svg = buildFigureSvg('prisma_rectangular', [
      { etiqueta: 'largo', valor: '5 cm' },
      { etiqueta: 'ancho', valor: '3 cm' },
      { etiqueta: 'altura', valor: '4 cm' },
    ], '#0369A1');
    const yAncho = labelY(svg, '3 cm');
    const yAltura = labelY(svg, '4 cm');
    // La arista de profundidad ("ancho") queda arriba del todo; la vertical frontal ("altura") va más abajo, a media altura.
    expect(yAncho).toBeLessThan(yAltura);
  });
});
