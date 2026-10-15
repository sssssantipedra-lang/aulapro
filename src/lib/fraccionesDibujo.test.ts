import { describe, expect, it } from 'vitest';
import {
  DENOMINADORES_EXACTOS, MIN_FIGURAS_FRACCION, completarFiguras, decimalDe, fraccionSvg, fraccionSvgDato, fraccionTexto, fraccionValida, letraFraccion, ordenUnir, simplificada,
  fraccionesParaEjercicio, solucionFracciones, tieneDecimalExacto, valorUnir,
} from './fraccionesDibujo';

const cuenta = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const trozos = (svg: string) => [...svg.matchAll(/<g data-trozo="(\d+)"( data-cogido="1")?>(.*?)<\/g>/g)].map(m => ({ n: Number(m[1]), cogido: !!m[2], g: m[3] }));

describe('fraccionSvg: los trozos salen del dato, ni uno más ni uno menos', () => {
  it('de 2 a 12 trozos y de 0 a todos cogidos', () => {
    for (let n = 2; n <= 12; n++) {
      for (let k = 0; k <= n; k++) {
        const svg = fraccionSvg({ partes: n, tomadas: k });
        const t = trozos(svg);
        expect(t).toHaveLength(n);
        expect(new Set(t.map(x => x.n)).size).toBe(n);
        expect(t.filter(x => x.cogido)).toHaveLength(k);
        expect(svg).toContain(`data-partes="${n}"`);
        expect(svg).toContain(`data-tomadas="${k}"`);
      }
    }
  });

  it('los cogidos van en blanco y negro (rayados) y los demás en color', () => {
    const t = trozos(fraccionSvg({ partes: 8, tomadas: 3 }, { cogidos: 'bn', uid: 'x' }));
    for (const x of t) {
      if (x.cogido) { expect(x.g).toContain('url(#h-x)'); expect(x.g).not.toContain('#FFD95A'); expect(x.g).not.toContain('#D6453D'); }
      else { expect(x.g).not.toContain('url(#h-x)'); expect(x.g).toContain('#FFD95A'); expect(x.g).toContain('#D6453D'); }
    }
  });

  it('«separados» saca los cogidos del centro y los deja en color; «bn» los deja en su sitio', () => {
    const sep = trozos(fraccionSvg({ partes: 8, tomadas: 3 }, { cogidos: 'separados' }));
    const bn = trozos(fraccionSvg({ partes: 8, tomadas: 3 }, { cogidos: 'bn' }));
    // el vértice de cada trozo es el centro (50 50) si está en su sitio
    for (const x of sep) {
      expect(x.g.includes('M50 50')).toBe(!x.cogido);
      expect(x.g).not.toContain('url(#h-');
    }
    for (const x of bn) expect(x.g).toContain('M50 50');
    // «ambos»: separados y rayados
    const dos = trozos(fraccionSvg({ partes: 8, tomadas: 3 }));
    for (const x of dos.filter(y => y.cogido)) { expect(x.g.includes('M50 50')).toBe(false); expect(x.g).toContain('url(#h-'); }
  });

  it('los separados se dibujan al final: ningún vecino los tapa', () => {
    const svg = fraccionSvg({ partes: 6, tomadas: 2 });
    const orden = trozos(svg).map(x => x.cogido);
    expect(orden).toEqual([false, false, false, false, true, true]);
  });

  it('«vacía» (para colorear): todos en blanco y solo el contorno, sin ingredientes ni rayas', () => {
    const svg = fraccionSvg({ partes: 7, tomadas: 3 }, { vacia: true });
    expect(trozos(svg).filter(x => x.cogido)).toHaveLength(0);
    expect(cuenta(svg, /<circle/g)).toBe(0);
    expect(cuenta(svg, /url\(#h-/g)).toBe(0);
    expect(trozos(svg)).toHaveLength(7);
  });

  it('cada trozo lleva sus ingredientes, también con 12 trozos', () => {
    expect(cuenta(fraccionSvg({ partes: 12, tomadas: 0 }), /<circle/g)).toBeGreaterThanOrEqual(24);
    expect(cuenta(fraccionSvg({ partes: 2, tomadas: 0 }), /<circle/g)).toBeGreaterThanOrEqual(4);
  });

  it('una tarta tiene otra paleta que una pizza', () => {
    const tarta = fraccionSvg({ partes: 6, tomadas: 0, objeto: 'tarta' });
    expect(tarta).toContain('#F6A9C9');
    expect(tarta).toContain('data-objeto="tarta"');
    expect(fraccionSvg({ partes: 6, tomadas: 0 })).toContain('data-objeto="pizza"');
    expect(fraccionSvg({ partes: 6, tomadas: 0 })).not.toContain('#F6A9C9');
  });

  it('los ids del rayado llevan el uid, y se limpian', () => {
    expect(fraccionSvg({ partes: 4, tomadas: 1 }, { uid: 'fr3' })).toContain('id="h-fr3"');
    expect(fraccionSvg({ partes: 4, tomadas: 1 }, { uid: 'a"><script>' })).not.toContain('<script>');
    expect(fraccionSvg({ partes: 4, tomadas: 1 })).toContain('id="h-f"');
  });

  it('los números fuera de rango se acotan en vez de dibujar algo imposible', () => {
    expect(trozos(fraccionSvg({ partes: 40, tomadas: 90 }))).toHaveLength(12);
    expect(trozos(fraccionSvg({ partes: 1, tomadas: 0 }))).toHaveLength(2);
    expect(trozos(fraccionSvg({ partes: 5, tomadas: -3 })).filter(x => x.cogido)).toHaveLength(0);
  });

  it('el SVG tiene la caja y las marcas de un SVG normal, y el «data:» se puede decodificar', () => {
    const svg = fraccionSvg({ partes: 8, tomadas: 3 });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100"/);
    const dato = fraccionSvgDato({ partes: 8, tomadas: 3 });
    expect(dato.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const dec = decodeURIComponent(dato.split(',').slice(1).join(','));
    expect(dec).toContain('width="240" height="240"');
    expect(trozos(dec)).toHaveLength(8);
  });

  it('todo cabe en la caja aunque los trozos se separen', () => {
    for (const n of [2, 5, 12]) {
      const svg = fraccionSvg({ partes: n, tomadas: n });
      for (const m of svg.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0); expect(Number(m[1])).toBeLessThanOrEqual(100);
        expect(Number(m[2])).toBeGreaterThanOrEqual(0); expect(Number(m[2])).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('los números de una fracción', () => {
  it('fraccionValida', () => {
    expect(fraccionValida({ partes: 8, tomadas: 3 })).toBe(true);
    expect(fraccionValida({ partes: 2, tomadas: 0 })).toBe(true);
    expect(fraccionValida({ partes: 12, tomadas: 12 })).toBe(true);
    for (const f of [{ partes: 1, tomadas: 0 }, { partes: 13, tomadas: 1 }, { partes: 5, tomadas: 6 }, { partes: 5, tomadas: -1 }, { partes: 5.5, tomadas: 1 }, { partes: '8', tomadas: 3 }, {}]) {
      expect(fraccionValida(f as never)).toBe(false);
    }
  });

  it('el decimal, con coma o con punto, y solo exacto con 2, 4, 5, 8 y 10', () => {
    expect(decimalDe({ partes: 8, tomadas: 3 }, 'es')).toBe('0,375');
    expect(decimalDe({ partes: 8, tomadas: 3 }, 'ca')).toBe('0,375');
    expect(decimalDe({ partes: 8, tomadas: 3 }, 'en')).toBe('0.375');
    expect(decimalDe({ partes: 2, tomadas: 1 }, 'es')).toBe('0,5');
    expect(decimalDe({ partes: 4, tomadas: 3 }, 'es')).toBe('0,75');
    expect(decimalDe({ partes: 5, tomadas: 2 }, 'es')).toBe('0,4');
    expect(decimalDe({ partes: 10, tomadas: 7 }, 'es')).toBe('0,7');
    expect(decimalDe({ partes: 4, tomadas: 4 }, 'es')).toBe('1');
    expect(decimalDe({ partes: 4, tomadas: 0 }, 'es')).toBe('0');
    expect(DENOMINADORES_EXACTOS).toEqual([2, 4, 5, 8, 10]);
    for (let n = 2; n <= 12; n++) {
      const exacto = tieneDecimalExacto({ partes: n, tomadas: 1 });
      expect(exacto).toBe(DENOMINADORES_EXACTOS.includes(n));
      // los que no, no terminan: 1/3, 1/6, 1/7, 1/9, 1/11, 1/12
      if (!exacto) expect(Number.isInteger(1 / n * 1000)).toBe(false);
    }
  });

  it('texto, letras y simplificación', () => {
    expect(fraccionTexto({ partes: 8, tomadas: 3 })).toBe('3/8');
    expect([0, 1, 2, 3].map(letraFraccion)).toEqual(['A', 'B', 'C', 'D']);
    expect(simplificada({ partes: 8, tomadas: 4 })).toBe('1/2');
    expect(simplificada({ partes: 6, tomadas: 3 })).toBe('1/2');
    expect(simplificada({ partes: 8, tomadas: 3 })).toBeNull();
    expect(simplificada({ partes: 8, tomadas: 0 })).toBeNull();
  });
});

describe('ordenUnir: siempre hay algo que unir', () => {
  const figs = (n: number) => Array.from({ length: n }, (_, i) => ({ partes: i + 2, tomadas: 1 }));

  it('es una permutación sin ningún valor a la altura de su dibujo', () => {
    for (let n = 2; n <= 6; n++) {
      const o = ordenUnir(figs(n));
      expect([...o].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(o.every((v, i) => v !== i)).toBe(true);
    }
  });

  it('el mismo ejercicio se mezcla siempre igual', () => {
    expect(ordenUnir(figs(5))).toEqual(ordenUnir(figs(5)));
    expect(ordenUnir([{ partes: 4, tomadas: 1 }])).toEqual([0]);
  });
});

describe('solucionFracciones: la calcula el código', () => {
  const fr = [{ partes: 8, tomadas: 3 }, { partes: 2, tomadas: 1 }, { partes: 5, tomadas: 4 }];

  it('leer: la fracción y, si se pide, el decimal', () => {
    expect(solucionFracciones({ fracciones: fr, modo: 'leer' }, 'es')).toBe('A: 3/8; B: 1/2; C: 4/5');
    expect(solucionFracciones({ fracciones: fr, modo: 'leer', decimal: true }, 'es')).toBe('A: 3/8 = 0,375; B: 1/2 = 0,5; C: 4/5 = 0,8');
    expect(solucionFracciones({ fracciones: fr, decimal: true }, 'en')).toBe('A: 3/8 = 0.375; B: 1/2 = 0.5; C: 4/5 = 0.8');
  });

  it('el decimal se ignora si alguna no lo tiene exacto', () => {
    expect(solucionFracciones({ fracciones: [{ partes: 3, tomadas: 1 }, { partes: 2, tomadas: 1 }], decimal: true }, 'es')).toBe('A: 1/3; B: 1/2');
  });

  it('colorear: cuántos trozos de cuántos', () => {
    expect(solucionFracciones({ fracciones: fr, modo: 'colorear' }, 'es')).toBe('A: 3 de 8 trozos; B: 1 de 2 trozos; C: 4 de 5 trozos');
    expect(solucionFracciones({ fracciones: fr, modo: 'colorear' }, 'en')).toBe('A: 3 of 8 slices; B: 1 of 2 slices; C: 4 of 5 slices');
    expect(solucionFracciones({ fracciones: fr, modo: 'colorear' }, 'ca')).toContain('trossos');
  });

  it('unir: a qué número de la derecha va cada dibujo, según la mezcla fija del ejercicio', () => {
    const orden = ordenUnir(fr);
    const sol = solucionFracciones({ fracciones: fr, modo: 'unir' }, 'es');
    fr.forEach((f, i) => expect(sol).toContain(`${String.fromCharCode(65 + i)} con ${orden.indexOf(i) + 1} (${fraccionTexto(f)})`));
    expect(solucionFracciones({ fracciones: fr, modo: 'unir', decimal: true }, 'es')).toContain('(0,375)');
    expect(valorUnir(fr[0], true, 'es')).toBe('0,375');
    expect(valorUnir(fr[0], false, 'es')).toBe('3/8');
  });

  it('sin fracciones, nada', () => {
    expect(solucionFracciones({}, 'es')).toBe('');
    expect(solucionFracciones({ fracciones: [] }, 'es')).toBe('');
  });
});

describe('fraccionesParaEjercicio: el ejercicio que monta el código', () => {
  const azar = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

  it('pizzas de distinto número de trozos, entre 2 y 10, y con trozos cogidos de verdad', () => {
    for (let k = 0; k < 40; k++) {
      const e = fraccionesParaEjercicio('leer', 'es');
      expect(e.fracciones).toHaveLength(4);
      expect(new Set(e.fracciones.map(f => f.partes)).size).toBe(4);
      for (const f of e.fracciones) {
        expect(f.partes).toBeGreaterThanOrEqual(2);
        expect(f.partes).toBeLessThanOrEqual(10);
        expect(f.tomadas).toBeGreaterThanOrEqual(1);
        expect(f.tomadas).toBeLessThan(f.partes);
        expect(fraccionValida(f)).toBe(true);
      }
    }
  });

  it('con decimal, solo trozos con decimal exacto, y la solución trae los decimales', () => {
    for (let k = 0; k < 20; k++) {
      const e = fraccionesParaEjercicio('leer', 'es', { decimal: true });
      expect(e.decimal).toBe(true);
      expect(e.fracciones.every(tieneDecimalExacto)).toBe(true);
      expect(e.solucion).toMatch(/^A: \d+\/\d+ = [\d,]+; B: /);
      expect(e.enunciado).toContain('su decimal');
    }
  });

  it('colorear: tres pizzas y sin decimal; unir: nunca dos pizzas con el mismo valor', () => {
    const c = fraccionesParaEjercicio('colorear', 'es', { decimal: true });
    expect(c.fracciones).toHaveLength(3);
    expect(c.decimal).toBeUndefined();
    expect(c.enunciado).toBe('Colorea en cada pizza los trozos que dice su fracción.');
    for (let k = 0; k < 40; k++) {
      const u = fraccionesParaEjercicio('unir', 'es', { decimal: true });
      const valores = u.fracciones.map(f => f.tomadas / f.partes);
      expect(new Set(valores).size).toBe(valores.length);
      expect(u.enunciado).toContain('su decimal');
    }
  });

  it('con un azar fijo, siempre el mismo; los enunciados, en los tres idiomas', () => {
    const a = fraccionesParaEjercicio('leer', 'es', { rand: azar(0.1, 0.7, 0.3) });
    const b = fraccionesParaEjercicio('leer', 'es', { rand: azar(0.1, 0.7, 0.3) });
    expect(a).toEqual(b);
    expect(fraccionesParaEjercicio('leer', 'ca').enunciado).toContain('Escriu la fracció');
    expect(fraccionesParaEjercicio('unir', 'en').enunciado).toContain('Match each pizza with its fraction');
    expect(fraccionesParaEjercicio('colorear', 'ca').enunciado).toContain('Pinta');
  });
});

describe('completarFiguras: un ejercicio «fracciones» lleva al menos tres figuras', () => {
  const valores = (fr: { partes: number; tomadas: number }[]) => fr.map(f => f.tomadas / f.partes);

  it('con una o dos, se añaden pizzas de otro número de trozos y con otra fracción', () => {
    for (const ini of [[{ partes: 8, tomadas: 3 }], [{ partes: 8, tomadas: 3 }, { partes: 5, tomadas: 2 }]]) {
      const fr = completarFiguras(ini, 'leer', false);
      expect(fr).toHaveLength(MIN_FIGURAS_FRACCION);
      expect(fr.slice(0, ini.length)).toEqual(ini);
      expect(new Set(fr.map(f => f.partes)).size).toBe(3);
      for (const f of fr) expect(fraccionValida(f)).toBe(true);
    }
  });

  it('con tres o más no toca nada', () => {
    const tres = [{ partes: 4, tomadas: 1 }, { partes: 6, tomadas: 5 }, { partes: 3, tomadas: 1 }];
    expect(completarFiguras(tres, 'leer', false)).toEqual(tres);
    expect(completarFiguras(tres, 'unir', false)).toEqual(tres);
  });

  it('con decimal, las que se añaden tienen decimal exacto', () => {
    const fr = completarFiguras([{ partes: 8, tomadas: 3 }], 'leer', true);
    expect(fr.every(tieneDecimalExacto)).toBe(true);
    expect(fr).toHaveLength(3);
  });

  it('con una que no tiene decimal exacto, se añaden de las normales (el decimal se descarta más tarde)', () => {
    const fr = completarFiguras([{ partes: 7, tomadas: 2 }], 'leer', true);
    expect(fr).toHaveLength(3);
    expect(fr[0]).toEqual({ partes: 7, tomadas: 2 });
  });

  it('la misma entrada da siempre la misma salida, y conserva el objeto de la primera', () => {
    const a = completarFiguras([{ partes: 6, tomadas: 1, objeto: 'tarta' }], 'leer', false);
    expect(a).toEqual(completarFiguras([{ partes: 6, tomadas: 1, objeto: 'tarta' }], 'leer', false));
    expect(a.every(f => f.objeto === 'tarta')).toBe(true);
  });

  it('«unir»: se quitan las que valen lo mismo (1/2 y 2/4) y las añadidas no repiten ningún valor', () => {
    const fr = completarFiguras([{ partes: 2, tomadas: 1 }, { partes: 4, tomadas: 2 }], 'unir', false);
    expect(fr).toHaveLength(3);
    expect(new Set(valores(fr).map(v => Math.round(v * 1e6))).size).toBe(3);
    // en «leer» sí se dejan: son figuras distintas con el mismo valor, y es el contenido de la pregunta
    expect(completarFiguras([{ partes: 2, tomadas: 1 }, { partes: 4, tomadas: 2 }, { partes: 8, tomadas: 4 }], 'leer', false)).toHaveLength(3);
  });

  it('todas las salidas son dibujables, de cualquier modo', () => {
    for (const modo of ['leer', 'colorear', 'unir'] as const) {
      for (let n = 2; n <= 12; n++) {
        for (let k = 0; k <= n; k += 3) {
          const fr = completarFiguras([{ partes: n, tomadas: k }], modo, false);
          expect(fr.length).toBeGreaterThanOrEqual(MIN_FIGURAS_FRACCION);
          expect(fr.every(fraccionValida)).toBe(true);
        }
      }
    }
  });
});
