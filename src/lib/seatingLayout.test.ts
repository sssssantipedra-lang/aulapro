import { describe, it, expect } from 'vitest';
import { buildTableSvg, type SeatVisual } from './seatingLayout';

describe('buildTableSvg', () => {
  it('dibuja un pupitre por asiento, sin NaN ni etiquetas rotas', () => {
    const seats: SeatVisual[] = [
      { studentName: 'Ana García', roleName: 'Portavoz' },
      { studentName: 'Bruno Ruiz', roleName: 'Secretario/a' },
      { studentName: 'Clara Soto', roleName: 'Material' },
      { studentName: 'Diego Vega', roleName: 'Tiempo' },
    ];
    const svg = buildTableSvg(seats, '#0284c7', 'Mesa 1');

    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
    expect((svg.match(/<path/g) ?? []).length).toBe(4);
    for (const s of seats) {
      expect(svg).toContain(s.studentName!);
      expect(svg).toContain(s.roleName!);
    }
    expect(svg).toContain('Mesa 1');
  });

  it('un asiento vacío se dibuja sin nombre ni rol, no revienta', () => {
    const svg = buildTableSvg([{ studentName: null, roleName: null }], '#0284c7', 'Mesa 2');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
    expect((svg.match(/<path/g) ?? []).length).toBe(1);
  });

  it('un nombre largo se reparte en varias líneas en vez de desbordar', () => {
    const svg = buildTableSvg(
      [{ studentName: 'María Fernanda de la Concepción', roleName: 'Portavoz' }],
      '#0284c7', 'Mesa 3',
    );
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it('sin roleName, no deja un rol vacío colgando', () => {
    const svg = buildTableSvg([{ studentName: 'Ana', roleName: null }], '#0284c7', 'Mesa 4');
    expect(svg).toContain('Ana');
    // Sin rol, no debe haber un segundo <text> de rol tras el del nombre.
    expect((svg.match(/<text/g) ?? []).length).toBe(2); // el nombre + la etiqueta de la mesa
  });

  it('escapa caracteres especiales en el nombre (no rompe el XML del SVG)', () => {
    const svg = buildTableSvg([{ studentName: 'Alumno <script>', roleName: null }], '#0284c7', 'Mesa 5');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('con cero asientos, no revienta (se dibuja como una sola pieza vacía)', () => {
    const svg = buildTableSvg([], '#0284c7', 'Mesa 6');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
  });
});
