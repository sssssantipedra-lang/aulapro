// @vitest-environment jsdom
/**
 * El compositor sin navegador de verdad: jsdom no maqueta, así que la medida (`medirPaginas`) se sustituye por una
 * de mentira y se comprueba lo que sí es suyo: que mide con cada densidad, que deja la hoja como estaba y que
 * elige bien. La medida real (columnas de CSS frente al PDF de Chromium) se verificó aparte, ver `docs/FICHAS.md`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedidaPaginas } from '../lib/densidad';

const medida = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../lib/paginacion', async importOriginal => ({ ...(await importOriginal<typeof import('../lib/paginacion')>()), medirPaginas: medida.fn }));

import { componerHoja, medirDensidades, medirHoja } from './compositor';
import { componerFicha, densidadDeFicha, buildFichaHtml } from './exportFicha';
import type { FichaContent } from './resources';
import type { Ficha } from '../types';

const documento = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');
const HTML = '<!doctype html><html><head></head><body><article class="ficha-doc th-cuaderno" style="--c:#000"><p>Hola</p></article></body></html>';

/** Una medida distinta según la clase de densidad que lleve la ficha en ese momento. */
function medirSegunClase(porClase: Record<string, MedidaPaginas>) {
  medida.fn.mockImplementation((doc: Document) => {
    const cls = doc.querySelector('.ficha-doc')!.className;
    const d = /\bd-(\w+)/.exec(cls)?.[1] ?? 'normal';
    return porClase[d];
  });
}

beforeEach(() => { medida.fn.mockReset(); });

describe('medirDensidades', () => {
  it('mide con cada una de las cuatro y deja la ficha como estaba', () => {
    const vistas: string[] = [];
    medida.fn.mockImplementation((doc: Document) => { vistas.push(doc.querySelector('.ficha-doc')!.className); return { paginas: 1, huecos: [10] }; });
    const doc = documento(HTML.replace('th-cuaderno', 'th-cuaderno d-holgada'));
    const r = medirDensidades(doc)!;
    expect(Object.keys(r).sort()).toEqual(['apretada', 'compacta', 'holgada', 'normal']);
    expect(vistas).toEqual(['ficha-doc th-cuaderno d-apretada', 'ficha-doc th-cuaderno d-compacta', 'ficha-doc th-cuaderno', 'ficha-doc th-cuaderno d-holgada']);
    // sin la clase que traía: la normal, que es la que se mide primero con el resto de cambios
    expect(doc.querySelector('.ficha-doc')!.className).toBe('ficha-doc th-cuaderno');
  });

  it('sin una ficha «Cuaderno» en el documento, no mide', () => {
    expect(medirDensidades(documento('<html><body><article class="ficha-doc th-clasico"></article></body></html>'))).toBeNull();
    expect(medida.fn).not.toHaveBeenCalled();
  });
});

describe('medirHoja y componerHoja', () => {
  it('cargan el HTML en un marco oculto y lo quitan al acabar, midan o no', async () => {
    medirSegunClase({ apretada: { paginas: 1, huecos: [5] }, compacta: { paginas: 1, huecos: [9] }, normal: { paginas: 2, huecos: [3, 700] }, holgada: { paginas: 2, huecos: [0, 800] } });
    const comp = await componerHoja(HTML, 150);
    // jsdom puede o no cargar el srcdoc del marco; si lo carga, la que ocupa menos páginas es la apretada
    if (comp) expect(comp.densidad).toBe('apretada');
    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('si no se puede medir, null', async () => {
    medida.fn.mockImplementation(() => { throw new Error('sin maqueta'); });
    expect(await medirHoja(HTML, 150)).toBeNull();
    expect(document.querySelectorAll('iframe').length).toBe(0);
  });
});

const ficha = (extra: Partial<FichaContent> = {}): Ficha => ({
  id: 'c1', at: new Date().toISOString(), date: '2026-10-15', title: 'Compositor',
  request: { tema: 'Las rebajas', area: 'Matemáticas', nivel: '6º Primaria', numEjercicios: 3, niveles: false, contextoClase: '' },
  content: {
    titulo: 'Rebajas', explicacion: 'Repaso.', instrucciones: 'Resuelve.', estilo: 'cuaderno',
    actividades: [{ titulo: 'Calculamos', dificultad: 1, ejercicios: [{ tipo: 'problema', enunciado: 'Un libro cuesta 12 €.', solucion: '9 €' }] }],
    ...extra,
  },
});

describe('el compositor sobre una ficha', () => {
  it('los demás diseños y las tarjetas no se miden', async () => {
    expect(await componerFicha(ficha({ estilo: 'clasico' }), 'es', {})).toBeNull();
    expect(await componerFicha(ficha({ formato: 'tarjetas' }), 'es', {})).toBeNull();
    expect(await densidadDeFicha(ficha({ estilo: 'clasico' }), 'es', {})).toBeUndefined();
    expect(medida.fn).not.toHaveBeenCalled();
  });

  it('si el docente fijó la densidad, esa: no se mide', async () => {
    expect(await densidadDeFicha(ficha({ densidad: 'compacta' }), 'es', {})).toBe('compacta');
    expect(medida.fn).not.toHaveBeenCalled();
  });

  it('el HTML que se mide es el de la hoja normal, aunque el docente haya fijado otra', () => {
    const html = buildFichaHtml(ficha({ densidad: 'holgada' }), 'es', { densidad: 'normal' });
    expect(html).not.toMatch(/class="[^"]*\bd-holgada/);
  });
});
