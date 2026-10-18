import { describe, it, expect } from 'vitest';
import { ALFA_SUBRAYADOR, ANCHOS, anchoConPresion, pintarTramos, pintarTrazo, recolorear, type Trazo } from './trazos';

/** Un contexto de mentira que anota lo que se le pide. */
function falso() {
  const llamadas: string[] = [];
  const ctx = {
    canvas: { width: 100, height: 100 },
    lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
    save: () => llamadas.push('save'), restore: () => llamadas.push('restore'),
    beginPath: () => llamadas.push('beginPath'), moveTo: () => llamadas.push('moveTo'),
    lineTo: () => llamadas.push('lineTo'), quadraticCurveTo: () => llamadas.push('curva'),
    arc: () => llamadas.push('arc'), fill: () => llamadas.push('fill'),
    stroke: function () { llamadas.push(`stroke:${ctx.globalCompositeOperation}:${ctx.globalAlpha}:${ctx.lineWidth}`); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, llamadas };
}
const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 10, y: i * 5, p: 0.5 }));
const trazo = (h: Trazo['h'], n: number): Trazo => ({ h, color: '#2563eb', ancho: ANCHOS[h][1], puntos: pts(n) });

describe('trazos', () => {
  it('un toque sin arrastrar deja un punto', () => {
    const { ctx, llamadas } = falso();
    pintarTramos(ctx, trazo('lapiz', 1));
    expect(llamadas).toContain('arc');
    expect(llamadas).toContain('fill');
  });

  it('en vivo solo se pintan los tramos nuevos, no todo el camino', () => {
    const { ctx, llamadas } = falso();
    pintarTramos(ctx, trazo('rotulador', 50), 48);
    expect(llamadas.filter(l => l === 'curva')).toHaveLength(2);
  });

  it('el borrador borra por debajo y el subrayador es translúcido solo al terminar el trazo', () => {
    const b = falso();
    pintarTrazo(b.ctx, trazo('borrador', 4));
    expect(b.llamadas.some(l => l.startsWith('stroke:destination-out'))).toBe(true);

    const vivo = falso();
    pintarTramos(vivo.ctx, trazo('subrayador', 4), 1, false, true);
    expect(vivo.llamadas.every(l => !l.startsWith('stroke') || l.includes(':1:'))).toBe(true);

    const fin = falso();
    pintarTrazo(fin.ctx, trazo('subrayador', 6));
    // De una sola pasada: un único stroke, con la opacidad del subrayador
    const strokes = fin.llamadas.filter(l => l.startsWith('stroke'));
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toContain(`:${ALFA_SUBRAYADOR}:`);
  });

  it('el lápiz engorda con la presión y el rotulador no', () => {
    expect(anchoConPresion(4, 0)).toBe(2);
    expect(anchoConPresion(4, 1)).toBe(6);
    const l = falso();
    pintarTramos(l.ctx, { ...trazo('rotulador', 3), puntos: [{ x: 0, y: 0, p: 1 }, { x: 5, y: 5, p: 1 }, { x: 9, y: 9, p: 1 }] });
    expect(l.llamadas.filter(x => x.startsWith('stroke')).every(x => x.endsWith(`:${ANCHOS.rotulador[1]}`))).toBe(true);
  });

  it('recolorear cambia al color equivalente de la otra paleta y deja el borrador y lo desconocido', () => {
    const r = recolorear(
      [trazo('lapiz', 2), { ...trazo('borrador', 2), color: '#2563eb' }, { ...trazo('subrayador', 2), color: '#fde047' }],
      ['#0f172a', '#2563eb'], ['#f8fafc', '#38bdf8'],
    );
    expect(r[0].color).toBe('#38bdf8');
    expect(r[1].color).toBe('#2563eb');
    expect(r[2].color).toBe('#fde047');
  });
});
