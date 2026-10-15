/**
 * La densidad de la hoja «Cuaderno» en el HTML que se imprime: una clase en la ficha (`d-…`) que cambia
 * unas variables de CSS (el aire entre ejercicios y el tamaño de los espacios de respuesta), no el contenido.
 */
import { describe, it, expect } from 'vitest';
import { buildFichaHtml, admiteDensidad } from './exportFicha';
import { CUADERNO_STYLE } from './fichaCuaderno';
import type { FichaContent } from './resources';
import type { Ficha } from '../types';

const ficha = (extra: Partial<FichaContent> = {}): Ficha => ({
  id: 'd1', at: new Date().toISOString(), date: '2026-10-15', title: 'Densidad',
  request: { tema: 'Las rebajas', area: 'Matemáticas', nivel: '6º Primaria', numEjercicios: 3, niveles: false, contextoClase: '' },
  content: {
    titulo: 'Rebajas', explicacion: 'Repaso.', instrucciones: 'Resuelve.', estilo: 'cuaderno',
    actividades: [{ titulo: 'Calculamos', dificultad: 1, ejercicios: [{ tipo: 'problema', enunciado: 'Un libro cuesta 12 € y se rebaja un 25 %. ¿Cuánto cuesta?', solucion: '9 €' }] }],
    ...extra,
  },
});

const claseDeLaFicha = (html: string) => /<article class="([^"]*)"/.exec(html)![1].split(' ');
const cuerpo = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');

describe('la clase de densidad en la ficha', () => {
  it('sin densidad, la normal: ninguna clase d-…', () => {
    expect(claseDeLaFicha(buildFichaHtml(ficha(), 'es')).some(c => c.startsWith('d-'))).toBe(false);
    expect(claseDeLaFicha(buildFichaHtml(ficha(), 'es', { densidad: 'normal' })).some(c => c.startsWith('d-'))).toBe(false);
  });

  it.each(['apretada', 'compacta', 'holgada'] as const)('%s: su clase, junto al tema', d => {
    const cls = claseDeLaFicha(buildFichaHtml(ficha(), 'es', { densidad: d }));
    expect(cls).toContain('th-cuaderno');
    expect(cls).toContain(`d-${d}`);
  });

  it('la que fija el docente en la ficha vale si la hoja no trae otra; la de la opción manda', () => {
    expect(claseDeLaFicha(buildFichaHtml(ficha({ densidad: 'holgada' }), 'es'))).toContain('d-holgada');
    expect(claseDeLaFicha(buildFichaHtml(ficha({ densidad: 'holgada' }), 'es', { densidad: 'apretada' }))).toContain('d-apretada');
    // el compositor mide siempre con la normal, aunque el docente haya elegido otra
    expect(claseDeLaFicha(buildFichaHtml(ficha({ densidad: 'holgada' }), 'es', { densidad: 'normal' })).some(c => c.startsWith('d-'))).toBe(false);
  });

  it('un valor que no es una densidad se ignora', () => {
    const html = buildFichaHtml(ficha({ densidad: 'enorme' as never }), 'es');
    expect(claseDeLaFicha(html).some(c => c.startsWith('d-'))).toBe(false);
  });

  it('los demás diseños no la llevan', () => {
    for (const estilo of ['clasico', 'espacio'] as const) {
      const cls = claseDeLaFicha(buildFichaHtml(ficha({ estilo, densidad: 'apretada' }), 'es', { densidad: 'apretada' }));
      expect(cls.some(c => c.startsWith('d-'))).toBe(false);
    }
  });

  it('solo cambia la clase: el contenido es el mismo con cualquier densidad', () => {
    const quita = (h: string) => cuerpo(h).replace(/ d-(apretada|compacta|holgada)/, '');
    const base = quita(buildFichaHtml(ficha(), 'es'));
    for (const d of ['apretada', 'compacta', 'holgada'] as const) expect(quita(buildFichaHtml(ficha(), 'es', { densidad: d }))).toBe(base);
  });
});

describe('qué fichas admiten densidad', () => {
  it('«Cuaderno» con hoja de ejercicios o de escape; no las tarjetas ni los otros diseños', () => {
    expect(admiteDensidad(ficha().content)).toBe(true);
    expect(admiteDensidad(ficha({ formato: 'ficha' }).content)).toBe(true);
    expect(admiteDensidad(ficha({ formato: 'tarjetas' }).content)).toBe(false);
    expect(admiteDensidad(ficha({ estilo: 'clasico' }).content)).toBe(false);
  });
});

describe('el CSS de las densidades', () => {
  it('define el factor de cada una y lo usa en el aire vertical y en los espacios de respuesta', () => {
    expect(CUADERNO_STYLE).toMatch(/\.th-cuaderno \{ --d: 1; --di: 1; \}/);
    for (const d of ['apretada', 'compacta', 'holgada']) expect(CUADERNO_STYLE).toContain(`.th-cuaderno.d-${d} {`);
    // la apretada afloja menos que la holgada y siempre dentro de lo razonable
    const f = (d: string) => Number(new RegExp(`\\.th-cuaderno\\.d-${d} \\{ --d: ([\\d.]+);`).exec(CUADERNO_STYLE)![1]);
    expect(f('apretada')).toBeLessThan(f('compacta'));
    expect(f('compacta')).toBeLessThan(1);
    expect(f('holgada')).toBeGreaterThan(1);
    expect(f('apretada')).toBeGreaterThanOrEqual(0.75);
    expect(CUADERNO_STYLE).toContain('calc(6mm * var(--d, 1))');
    expect(CUADERNO_STYLE).toContain('var(--di, 1)');
  });

  it('las letras no cambian con la densidad: ningún font-size usa --d', () => {
    expect(/font-size:[^;]*var\(--d/.test(CUADERNO_STYLE)).toBe(false);
  });

  it('una línea de cálculo larga puede encogerse y partirse: no ensancha la hoja (el navegador reduciría toda la página al imprimir)', () => {
    expect(CUADERNO_STYLE).toMatch(/\.cq-val \{ flex: 0 1 auto;[^}]*overflow-wrap: anywhere/);
  });
});
