import { describe, it, expect } from 'vitest';
import {
  FACTOR_MAX, FACTOR_MIN, MAX_OPERACIONES, OPERACIONES, areaPropuesta, cuentaTexto, ejercicioDeCuentas, enEscalera, enTresPartes, fichaCrucigrama, fichaFracciones, fichaOperaciones,
  fichaSopa, generarCuentas, llevadas, palabrasDeTexto, pesoDeCuenta, pistasDeTexto, rangoSugerido, resultadoDe, signoDe, tituloDeOperaciones, type Cuenta,
} from './fichaInstante';
import { translate } from '../i18n';
import { buildFichaHtml } from '../services/exportFicha';
import { crosswordCells } from './crossword';
import { normalizeLetters } from './wordSearch';
import { vaDeMenosAMas } from './escalera';
import type { Ficha } from '../types';

const t = (k: string, v?: Record<string, string | number>) => translate('es', k, v);

/** Un generador repetible, para que las pruebas no dependan del azar. */
function azar(semilla = 7): () => number {
  let s = semilla >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const comoFicha = (content: Ficha['content']): Ficha => ({
  id: 'f1', at: '2026-11-20T10:00:00.000Z', date: '2026-11-20', title: content.titulo,
  request: { tema: '', area: '', nivel: '', numEjercicios: 0, niveles: false, contextoClase: '' }, content,
});

describe('palabras escritas a mano', () => {
  it('lee una por línea o separadas por comas, sin repetidas ni restos', () => {
    expect(palabrasDeTexto('sol\n luna ,  mar;río\n\nSOL\na\nLúna')).toEqual(['sol', 'luna', 'mar', 'río']);
    expect(palabrasDeTexto('arco   iris')).toEqual(['arco iris']);
    expect(palabrasDeTexto('  \n ,, ')).toEqual([]);
  });

  it('separa palabra y pista por dos puntos, tabulador o guion, y aparta las que no tienen pista', () => {
    const r = pistasDeTexto('sol: estrella que nos da luz\nluna\tsatélite de la Tierra\nmar - agua salada\nrío\n\nSol: repetida\nhora: las 10:30');
    expect(r.pistas).toEqual([
      { palabra: 'sol', pista: 'estrella que nos da luz' },
      { palabra: 'luna', pista: 'satélite de la Tierra' },
      { palabra: 'mar', pista: 'agua salada' },
      { palabra: 'hora', pista: 'las 10:30' },
    ]);
    expect(r.sinPista).toEqual(['río']);
  });
});

describe('sopa de letras al instante', () => {
  const palabras = ['raíz', 'tallo', 'hoja', 'flor', 'fruto', 'semilla', 'arco iris'];

  it('cada palabra de la lista está en la rejilla, en el sitio que dice la solución', () => {
    for (let k = 0; k < 20; k++) {
      const { content, fuera } = fichaSopa({ palabras }, t);
      const ex = content.actividades[0].ejercicios[0];
      expect(fuera).toEqual([]);
      expect(ex.tipo).toBe('sopa_letras');
      expect(ex.palabras).toEqual(palabras.map(p => p.toUpperCase()));
      for (const p of ex.posiciones!) {
        const letras = normalizeLetters(p.palabra);
        const leidas = [...letras].map((_, i) => ex.rejilla![p.fila + p.dir[0] * i][p.columna + p.dir[1] * i]).join('');
        expect(leidas).toBe(letras);
        expect(ex.solucion).toContain(`${p.palabra}: fila ${p.fila + 1}, columna ${p.columna + 1}`);
      }
      expect(ex.enunciado).toContain('7 palabras');
    }
  });

  it('una palabra que no cabe se deja fuera y se dice cuál', () => {
    const larga = 'electroencefalografista';
    const { content, fuera } = fichaSopa({ palabras: ['sol', 'luna', 'mar', larga] }, t);
    expect(fuera).toEqual([larga]);
    expect(content.actividades[0].ejercicios[0].palabras).toEqual(['SOL', 'LUNA', 'MAR']);
    // No se intenta colocar: la rejilla no crece por una palabra que no va a caber
    expect(content.actividades[0].ejercicios[0].rejilla).toHaveLength(10);
  });

  it('es una ficha «Cuaderno» de un bloque, con el título pedido o el suyo, y se pinta', () => {
    const { content } = fichaSopa({ titulo: ' Las partes de la planta ', palabras }, t);
    expect(content).toMatchObject({ titulo: 'Las partes de la planta', estilo: 'cuaderno', formato: 'ficha' });
    expect(content.actividades).toHaveLength(1);
    expect(fichaSopa({ palabras }, t).content.titulo).toBe('Sopa de letras');
    const html = buildFichaHtml(comoFicha(content), 'es');
    expect(html).toContain('ficha-sopa');
    expect(html).not.toMatch(/undefined|NaN/);
  });
});

describe('crucigrama al instante', () => {
  const pistas = [
    { palabra: 'planeta', pista: 'Gira alrededor de una estrella' },
    { palabra: 'luna', pista: 'Satélite de la Tierra' },
    { palabra: 'sol', pista: 'Nuestra estrella' },
    { palabra: 'cometa', pista: 'Tiene cola' },
    { palabra: 'estrella', pista: 'Brilla con luz propia' },
  ];

  it('las palabras cruzan letra a letra y la solución las da por su número', () => {
    const { content, fuera } = fichaCrucigrama({ pistas }, t, azar(3));
    const ex = content.actividades[0].ejercicios[0];
    expect(ex.tipo).toBe('crucigrama');
    const cw = ex.crucigrama!;
    expect(cw.entradas.length + fuera.length).toBe(pistas.length);
    expect(cw.entradas.length).toBeGreaterThanOrEqual(3);
    // crosswordCells lanzaría o pisaría letras si dos palabras no encajaran
    const celdas = crosswordCells(cw);
    for (const e of cw.entradas) {
      const leida = [...e.palabra].map((_, i) => celdas[e.fila + (e.dir === 'V' ? i : 0)][e.columna + (e.dir === 'H' ? i : 0)]!.letra).join('');
      expect(leida).toBe(e.palabra);
      expect(ex.solucion).toContain(`${e.numero}. ${e.palabra}`);
    }
    expect(ex.pistas!.map(p => normalizeLetters(p.palabra)).sort()).toEqual(cw.entradas.map(e => e.palabra).sort());
  });

  it('una palabra que no cruza con ninguna se queda fuera y se dice', () => {
    const { content, fuera } = fichaCrucigrama({ pistas: [...pistas.slice(0, 3), { palabra: 'kiwi', pista: 'No comparte letras' }] }, t, azar());
    expect(fuera).toEqual(['kiwi']);
    expect(content.actividades[0].ejercicios[0].pistas!.some(p => p.palabra === 'kiwi')).toBe(false);
  });

  it('se pinta en la hoja', () => {
    const html = buildFichaHtml(comoFicha(fichaCrucigrama({ pistas }, t, azar()).content), 'es');
    expect(html).toContain('cw-cell');
    expect(html).toContain('Gira alrededor de una estrella');
  });
});

describe('cuentas', () => {
  it('cuenta las llevadas de una suma y los préstamos de una resta', () => {
    expect(llevadas('suma', 23, 45)).toBe(0);
    expect(llevadas('suma', 27, 45)).toBe(1);
    expect(llevadas('suma', 99, 1)).toBe(2);
    expect(llevadas('suma', 50, 60)).toBe(1);
    expect(llevadas('resta', 58, 23)).toBe(0);
    expect(llevadas('resta', 52, 27)).toBe(1);
    expect(llevadas('resta', 100, 1)).toBe(2);
    expect(llevadas('multiplicacion', 99, 9)).toBe(0);
  });

  it('el signo y el texto de cada cuenta', () => {
    expect(OPERACIONES.map(o => signoDe(o))).toEqual(['+', '−', '×', ':']);
    expect(signoDe('division', 'en')).toBe('÷');
    expect(cuentaTexto({ op: 'resta', a: 15, b: 7, resultado: 8 })).toBe('15 − 7');
  });

  it('todas las cuentas están bien hechas, con los números en su rango', () => {
    for (const [min, max] of [[1, 10], [10, 99], [100, 999], [0, 20], [2500, 90000]] as const) {
      const cuentas = generarCuentas({ operaciones: [...OPERACIONES], min, max, cantidad: 40 }, azar(min + max));
      expect(cuentas.length).toBeGreaterThan(20);
      for (const c of cuentas) {
        expect(c.resultado, cuentaTexto(c)).toBe(resultadoDe(c.op, c.a, c.b));
        expect(Number.isInteger(c.resultado), cuentaTexto(c)).toBe(true);
        expect(c.resultado, cuentaTexto(c)).toBeGreaterThanOrEqual(0);
        expect(c.a).toBeGreaterThanOrEqual(min);
        expect(c.a).toBeLessThanOrEqual(max);
        if (c.op === 'suma' || c.op === 'resta') {
          expect(c.b).toBeGreaterThanOrEqual(min);
          expect(c.b).toBeLessThanOrEqual(max);
        } else {
          expect(c.b).toBeGreaterThanOrEqual(FACTOR_MIN);
          expect(c.b).toBeLessThanOrEqual(FACTOR_MAX);
        }
        if (c.op === 'division') expect(c.a % c.b).toBe(0);
      }
    }
  });

  it('se reparten entre las operaciones pedidas y no se repiten si el rango da para ello', () => {
    const cuentas = generarCuentas({ operaciones: ['suma', 'division'], min: 10, max: 200, cantidad: 30 }, azar());
    expect(cuentas).toHaveLength(30);
    expect(cuentas.filter(c => c.op === 'suma')).toHaveLength(15);
    expect(cuentas.filter(c => c.op === 'division')).toHaveLength(15);
    expect(new Set(cuentas.map(c => cuentaTexto(c))).size).toBe(30);
  });

  it('sin llevadas, ninguna suma se lleva y ninguna resta pide prestado, también en rangos difíciles', () => {
    for (const [min, max] of [[1, 9], [10, 99], [50, 99], [100, 999], [600, 999]] as const) {
      const cuentas = generarCuentas({ operaciones: ['suma', 'resta'], min, max, cantidad: 30, sinLlevadas: true }, azar(max));
      expect(cuentas.length, `${min}-${max}`).toBeGreaterThanOrEqual(6);
      for (const c of cuentas) {
        expect(llevadas(c.op, c.a, c.b), cuentaTexto(c)).toBe(0);
        expect(c.resultado).toBe(resultadoDe(c.op, c.a, c.b));
        expect(c.b).toBeGreaterThan(0);
        expect(c.a).toBeLessThanOrEqual(max);
      }
    }
  });

  it('salen ordenadas de la que menos cuesta a la que más', () => {
    const cuentas = generarCuentas({ operaciones: [...OPERACIONES], min: 2, max: 500, cantidad: 36 }, azar(11));
    const pesos = cuentas.map(pesoDeCuenta);
    expect([...pesos].sort((a, b) => a - b)).toEqual(pesos);
    const facil: Cuenta = { op: 'suma', a: 12, b: 5, resultado: 17 };
    const conLlevada: Cuenta = { op: 'suma', a: 18, b: 5, resultado: 23 };
    const grande: Cuenta = { op: 'suma', a: 412, b: 105, resultado: 517 };
    expect(pesoDeCuenta(facil)).toBeLessThan(pesoDeCuenta(conLlevada));
    expect(pesoDeCuenta(conLlevada)).toBeLessThan(pesoDeCuenta(grande));
  });

  it('aguanta pedidos raros: rango al revés, cantidad enorme, ninguna operación, rango mínimo', () => {
    expect(generarCuentas({ operaciones: [], min: 1, max: 10, cantidad: 10 })).toEqual([]);
    const alReves = generarCuentas({ operaciones: ['suma'], min: 50, max: 10, cantidad: 8 }, azar());
    expect(alReves.every(c => c.a >= 10 && c.a <= 50)).toBe(true);
    expect(generarCuentas({ operaciones: ['suma'], min: 1, max: 1000, cantidad: 5000 }, azar())).toHaveLength(MAX_OPERACIONES);
    // Del 1 al 2 solo hay cuatro sumas distintas: salen menos de las pedidas, no repetidas sin fin
    const pocas = generarCuentas({ operaciones: ['suma'], min: 1, max: 2, cantidad: 20 }, azar());
    expect(pocas.length).toBeLessThanOrEqual(4);
    expect(new Set(pocas.map(c => cuentaTexto(c))).size).toBe(pocas.length);
    // Una división con el dividendo entre 1 y 1 no existe
    expect(generarCuentas({ operaciones: ['division'], min: 1, max: 1, cantidad: 6 }, azar())).toEqual([]);
  });

  it('reparte en tres partes seguidas y parejas', () => {
    expect(enTresPartes([1, 2, 3, 4, 5, 6, 7]).map(p => p.length)).toEqual([3, 2, 2]);
    expect(enTresPartes([1, 2, 3, 4, 5, 6]).flat()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(enTresPartes([1, 2, 3, 4, 5, 6, 7, 8]).map(p => p.length)).toEqual([3, 3, 2]);
    expect(enTresPartes([1, 2, 3, 4, 5, 6, 7], 1).map(p => p.length)).toEqual([2, 3, 2]);
    expect(enTresPartes([1, 2, 3, 4, 5, 6, 7], 2).map(p => p.length)).toEqual([2, 2, 3]);
    expect(enTresPartes([1, 2, 3, 4, 5, 6, 7], 2).flat()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('en la escalera cada operación sube por su cuenta y los tres bloques tienen de todas', () => {
    const cuentas = generarCuentas({ operaciones: ['suma', 'multiplicacion'], min: 2, max: 300, cantidad: 24 }, azar(9));
    const bloques = enEscalera(cuentas);
    expect(bloques.map(b => b.length)).toEqual([8, 8, 8]);
    expect(bloques.flat()).toHaveLength(24);
    for (const b of bloques) {
      expect(b.filter(c => c.op === 'suma')).toHaveLength(4);
      // Dentro del bloque, primero las sumas y después las multiplicaciones
      expect(b.map(c => c.op)).toEqual([...Array(4).fill('suma'), ...Array(4).fill('multiplicacion')]);
    }
    for (const op of ['suma', 'multiplicacion'] as const) {
      const pesos = bloques.flatMap(b => b.filter(c => c.op === op)).map(pesoDeCuenta);
      expect([...pesos].sort((x, y) => x - y)).toEqual(pesos);
    }
  });

  it('propone un rango de números según el curso, y uno pequeño si no lo reconoce', () => {
    expect(rangoSugerido('1º Primaria A')).toEqual({ min: 1, max: 10 });
    expect(rangoSugerido('2º de Primaria')).toEqual({ min: 1, max: 50 });
    expect(rangoSugerido('4º Primaria')).toEqual({ min: 10, max: 999 });
    expect(rangoSugerido('6º Primaria A')).toEqual({ min: 100, max: 9999 });
    expect(rangoSugerido('1º ESO A')).toEqual({ min: 10, max: 999 });
    expect(rangoSugerido('')).toEqual({ min: 1, max: 20 });
    expect(rangoSugerido(undefined)).toEqual({ min: 1, max: 20 });
  });

  it('el título dice las operaciones', () => {
    expect(tituloDeOperaciones(['suma'], t)).toBe('Sumas');
    expect(tituloDeOperaciones(['resta', 'suma'], t)).toBe('Sumas y restas');
    expect(tituloDeOperaciones([...OPERACIONES], t)).toBe('Sumas, restas, multiplicaciones y divisiones');
    expect(tituloDeOperaciones([], t)).toBe('Operaciones');
  });
});

describe('hoja de operaciones al instante', () => {
  it('va de menos a más en los tres bloques, con una lista de cálculos y su solución exacta en cada uno', () => {
    const r = fichaOperaciones({ operaciones: ['suma', 'resta'], min: 10, max: 99, cantidad: 20 }, t, 'es', azar(5))!;
    const { actividades } = r.content;
    expect(r.content).toMatchObject({ titulo: 'Sumas y restas', estilo: 'cuaderno', formato: 'ficha' });
    expect(actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(vaDeMenosAMas(actividades.map(a => a.dificultad))).toBe(true);
    expect(actividades.map(a => a.ejercicios[0].lineas!.length)).toEqual([7, 7, 6]);
    for (const a of actividades) {
      const ex = a.ejercicios[0];
      expect(ex.tipo).toBe('calculos');
      expect(ex.respuesta).toBe('caja');
      const partes = ex.solucion.split('; ');
      expect(partes).toHaveLength(ex.lineas!.length);
      ex.lineas!.forEach((l, i) => {
        const m = /^(\d+) ([+−]) (\d+)$/.exec(l)!;
        const esperado = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
        expect(partes[i]).toBe(`${i + 1}. ${l} = ${esperado}`);
      });
    }
  });

  it('con menos de seis cuentas es un solo bloque, sin escalera', () => {
    const r = fichaOperaciones({ operaciones: ['multiplicacion'], min: 1, max: 10, cantidad: 5 }, t, 'es', azar())!;
    expect(r.content.actividades).toHaveLength(1);
    expect(r.content.actividades[0].dificultad).toBeUndefined();
  });

  it('si en el rango no sale ninguna cuenta, no hay ficha', () => {
    expect(fichaOperaciones({ operaciones: ['division'], min: 1, max: 1, cantidad: 12 }, t, 'es', azar())).toBeNull();
    expect(fichaOperaciones({ operaciones: [], min: 1, max: 10, cantidad: 12 }, t)).toBeNull();
  });

  it('se pinta en la hoja con sus cajas y, en inglés, divide con ÷', () => {
    const r = fichaOperaciones({ operaciones: ['division'], min: 10, max: 100, cantidad: 9, respuesta: 'linea' }, k => translate('en', k), 'en', azar())!;
    expect(r.content.actividades[0].ejercicios[0].lineas![0]).toMatch(/^\d+ ÷ \d+$/);
    expect(r.content.actividades[0].ejercicios[0].respuesta).toBe('linea');
    const html = buildFichaHtml(comoFicha(fichaOperaciones({ operaciones: ['suma'], min: 1, max: 20, cantidad: 12 }, t, 'es', azar())!.content), 'es');
    expect(html).toContain('cq-calculos con-caja');
    expect(html).toContain('data-dificultad="3"');
    expect(html).not.toMatch(/undefined|NaN/);
  });

  it('ejercicioDeCuentas numera la solución como la hoja numera las líneas', () => {
    const ex = ejercicioDeCuentas([{ op: 'multiplicacion', a: 7, b: 8, resultado: 56 }, { op: 'division', a: 81, b: 9, resultado: 9 }], t, 'es');
    expect(ex.lineas).toEqual(['7 × 8', '81 : 9']);
    expect(ex.solucion).toBe('1. 7 × 8 = 56; 2. 81 : 9 = 9');
  });
});

describe('el área que se propone', () => {
  const tutoria = { subject: 'Lengua Castellana y Literatura', subjects: ['Lengua Castellana y Literatura', 'Mates', 'Matemáticas y robótica'] };
  it('en una hoja de cuentas o de fracciones no deja el área de la tutoría: propone las matemáticas de la clase o «Matemáticas»', () => {
    expect(areaPropuesta('operaciones', tutoria.subject, { subject: tutoria.subject }, 'Matemáticas')).toBe('Matemáticas');
    expect(areaPropuesta('fracciones', tutoria.subject, tutoria, 'Matemáticas')).toBe('Matemáticas y robótica');
    expect(areaPropuesta('operaciones', 'Llengua', { subject: 'Llengua', subjects: ['Llengua', 'Matemàtiques'] }, 'Matemàtiques')).toBe('Matemàtiques');
  });
  it('respeta lo que escribe el docente, las clases de matemáticas, las hojas de palabras y el formulario sin clase', () => {
    expect(areaPropuesta('operaciones', 'Refuerzo', tutoria, 'Matemáticas')).toBe('Refuerzo');
    expect(areaPropuesta('operaciones', '', tutoria, 'Matemáticas')).toBe('');
    expect(areaPropuesta('operaciones', 'Matemáticas', { subject: 'Matemáticas' }, 'Matemáticas')).toBe('Matemáticas');
    expect(areaPropuesta('operaciones', 'Maths', { subject: 'Maths' }, 'Mathematics')).toBe('Maths');
    expect(areaPropuesta('sopa', tutoria.subject, tutoria, 'Matemáticas')).toBe(tutoria.subject);
    expect(areaPropuesta('crucigrama', tutoria.subject, tutoria, 'Matemáticas')).toBe(tutoria.subject);
    expect(areaPropuesta('operaciones', 'Lengua', null, 'Matemáticas')).toBe('Lengua');
    expect(areaPropuesta('operaciones', 'Lengua', undefined, 'Matemáticas')).toBe('Lengua');
  });
});

describe('fracciones con pizzas al instante', () => {
  it('tres bloques de menos a más: leer, colorear y unir, con la solución de los mismos números', () => {
    const { content } = fichaFracciones({}, t, 'es', azar(2));
    expect(content.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(content.actividades.map(a => a.ejercicios[0].modo)).toEqual(['leer', 'colorear', 'unir']);
    for (const a of content.actividades) {
      const ex = a.ejercicios[0];
      expect(ex.tipo).toBe('fracciones');
      expect(ex.fracciones).toHaveLength(4);
      for (const f of ex.fracciones!) {
        expect(f.tomadas).toBeGreaterThan(0);
        expect(f.tomadas).toBeLessThan(f.partes);
      }
      expect(ex.solucion.split('; ')).toHaveLength(4);
    }
    const leer = content.actividades[0].ejercicios[0];
    expect(leer.solucion).toBe(leer.fracciones!.map((f, i) => `${'ABCD'[i]}: ${f.tomadas}/${f.partes}`).join('; '));
  });

  it('con decimales, el último bloque une con el decimal y solo usa trozos de decimal exacto', () => {
    const { content } = fichaFracciones({ decimal: true, figuras: 3 }, t, 'es', azar(4));
    const [leer, , unir] = content.actividades.map(a => a.ejercicios[0]);
    expect(leer.decimal).toBeUndefined();
    expect(unir.decimal).toBe(true);
    expect(unir.fracciones).toHaveLength(3);
    expect(unir.fracciones!.every(f => [2, 4, 5, 8, 10].includes(f.partes))).toBe(true);
    expect(unir.solucion).toMatch(/0,\d/);
  });

  it('se pinta con una pizza por fracción', () => {
    const { content } = fichaFracciones({}, t, 'es', azar());
    const html = buildFichaHtml(comoFicha(content), 'es');
    expect((html.match(/<svg[^>]*class="[^"]*fr-svg|cq-fr-c/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
