import { describe, it, expect } from 'vitest';
import { areaDe, comoEnImpresion, leerPagina } from './paginaDoc';

const mm = (n: number) => n * 96 / 25.4;

describe('leerPagina', () => {
  it('lee el @page del documento: orientación y márgenes', () => {
    const p = leerPagina('<style>@media print { @page { size: A4 landscape; margin: 12mm 14mm; } }</style>');
    expect(p.ancho).toBeCloseTo(mm(297), 1);
    expect(p.alto).toBeCloseTo(mm(210), 1);
    expect(p.margen).toEqual({ arriba: mm(12), derecha: mm(14), abajo: mm(12), izquierda: mm(14) });
    const a = areaDe(p);
    expect(a.ancho).toBeCloseTo(mm(297 - 28), 1);
    expect(a.alto).toBeCloseTo(mm(210 - 24), 1);
  });
  it('un solo valor vale para los cuatro lados', () => {
    expect(leerPagina('@page { size: A4 portrait; margin: 14mm; }').margen.izquierda).toBeCloseTo(mm(14), 1);
  });
  it('sin @page: A4 con los márgenes de siempre y la orientación de quien guarda', () => {
    const v = leerPagina('<p>x</p>');
    expect(v.ancho).toBeCloseTo(mm(210), 1);
    expect(v.margen.izquierda).toBeCloseTo(0.55 * 96, 5);
    expect(v.margen.arriba).toBeCloseTo(0.5 * 96, 5);
    expect(leerPagina('<p>x</p>', true).ancho).toBeCloseTo(mm(297), 1);
  });
  it('el @page del documento manda sobre la orientación pedida', () => {
    expect(leerPagina('@page { size: A4 portrait; margin: 20mm 18mm }', true).ancho).toBeCloseTo(mm(210), 1);
  });
});

describe('comoEnImpresion', () => {
  it('lo de imprimir vale siempre y lo de pantalla, nunca', () => {
    expect(comoEnImpresion('@media print { a{} } @media screen { b{} }')).toBe('@media all { a{} } @media not all { b{} }');
  });
  it('los saltos de página forzados pasan a saltos de columna, y los de evitar se quedan', () => {
    expect(comoEnImpresion('a{page-break-before: always; break-before: page} b{break-after: page} c{break-inside: avoid; page-break-after: avoid}'))
      .toBe('a{break-before: column; break-before: column} b{break-after: column} c{break-inside: avoid; page-break-after: avoid}');
  });
});
