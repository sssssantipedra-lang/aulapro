/**
 * Las pizzas y tartas por fracciones en la hoja (ver `lib/fraccionesDibujo.ts`): cada figura con su
 * letra y su espacio para contestar, los tres modos (leer, colorear, unir), la figura suelta de un
 * problema, que los dibujos no choquen entre sí, y el Word.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildFichaDocxBlob, buildFichaHtml } from './exportFicha';
import { ordenUnir } from '../lib/fraccionesDibujo';
import type { FichaContent, FichaExercise } from './resources';
import type { Ficha } from '../types';

const F = (partes: number, tomadas: number, objeto?: 'pizza' | 'tarta') => ({ partes, tomadas, ...(objeto ? { objeto } : {}) });

const ficha = (ejercicios: FichaExercise[], estilo: FichaContent['estilo'] = 'cuaderno'): Ficha => ({
  id: 'fr', at: new Date().toISOString(), date: '2026-10-14', title: 'Fracciones',
  request: { tema: 'Las fracciones', area: 'Matemáticas', nivel: '5º Primaria', numEjercicios: 3, niveles: false, contextoClase: '' },
  content: { titulo: 'Fracciones', explicacion: 'Repaso.', instrucciones: 'Resuelve.', estilo, actividades: [{ titulo: 'Pizzas', dificultad: 1, ejercicios }] },
});

const ex = (o: Partial<FichaExercise>): FichaExercise => ({ tipo: 'fracciones', enunciado: 'ENUNCIADO', solucion: 'SOL-SECRETA', ...o });
const cuerpo = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');
const cuenta = (html: string, re: RegExp) => (html.match(re) ?? []).length;
/** Lo que hay dentro de los trozos de las pizzas (la hoja lleva otros dibujos con círculos, como las mascotas). */
const dentroDeTrozos = (html: string) => [...html.matchAll(/<g data-trozo="\d+"[^>]*>(.*?)<\/g>/g)].map(m => m[1]).join('');
const html = (e: FichaExercise[], estilo?: FichaContent['estilo']) => cuerpo(buildFichaHtml(ficha(e, estilo), 'es'));

describe('«leer»: la pizza con los trozos cogidos y la fracción por escribir', () => {
  const e = ex({ fracciones: [F(8, 3), F(5, 2), F(10, 7)], modo: 'leer' });

  it('una tarjeta por figura, con su letra y con tantos trozos como dice el dato', () => {
    const h = html([e]);
    expect(cuenta(h, /class="cq-fr-card"/g)).toBe(3);
    expect(['A', 'B', 'C'].every(l => h.includes(`<span class="cq-fr-l">${l}</span>`))).toBe(true);
    const partes = [...h.matchAll(/data-partes="(\d+)" data-tomadas="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
    expect(partes).toEqual([[8, 3], [5, 2], [10, 7]]);
    // 8 + 5 + 10 trozos dibujados, 3 + 2 + 7 cogidos
    expect(cuenta(h, /data-trozo="/g)).toBe(23);
    expect(cuenta(h, /data-cogido="1"/g)).toBe(12);
  });

  it('cada figura lleva su espacio: la fracción con su raya, y el decimal solo si se pide', () => {
    const h = html([e]);
    expect(cuenta(h, /<span class="cq-fr-frac"><i><\/i><i class="raya"><\/i><i><\/i><\/span>/g)).toBe(3);
    expect(h).not.toContain('cq-fr-dec');
    const d = html([ex({ fracciones: [F(8, 3), F(5, 2)], modo: 'leer', decimal: true })]);
    expect(cuenta(d, /class="cq-fr-eq"/g)).toBe(2);
    expect(cuenta(d, /class="cq-caja cq-fr-dec"/g)).toBe(2);
  });

  it('el decimal no sale si alguna figura no lo tiene exacto', () => {
    expect(html([ex({ fracciones: [F(8, 3), F(3, 1)], modo: 'leer', decimal: true })])).not.toContain('cq-fr-dec');
  });

  it('nunca sale la solución', () => {
    expect(html([e])).not.toContain('SOL-SECRETA');
  });

  it('sin modo, «leer»', () => {
    expect(cuenta(html([ex({ fracciones: [F(8, 3)] })]), /class="cq-fr-frac"/g)).toBe(1);
  });
});

describe('«colorear»: la pizza en blanco y la fracción debajo', () => {
  const e = ex({ fracciones: [F(6, 5), F(9, 4), F(7, 3)], modo: 'colorear' });

  it('todas las pizzas en blanco, con su fracción escrita y sin cajas para contestar', () => {
    const h = html([e]);
    expect(cuenta(h, /class="cq-fr-card"/g)).toBe(3);
    expect(cuenta(h, /data-cogido="1"/g)).toBe(0);
    expect(cuenta(dentroDeTrozos(h), /<circle/g)).toBe(0);
    expect(cuenta(h, /data-trozo="/g)).toBe(22);
    expect(['5/6', '4/9', '3/7'].every(f => h.includes(`<div class="cq-fr-lbl">${f}</div>`))).toBe(true);
    expect(h).not.toContain('cq-fr-frac');
  });
});

describe('«unir»: las pizzas a un lado y los valores mezclados al otro', () => {
  const fr = [F(2, 1), F(4, 3), F(5, 4), F(8, 5)];

  it('con la fracción o, si se pide, con el decimal; mezclados, ninguno a la altura de su pizza', () => {
    const h = html([ex({ fracciones: fr, modo: 'unir', decimal: true })]);
    expect(cuenta(h, /class="item con-dib cq-fr-item"/g)).toBe(4);
    const derecha = [...h.matchAll(/<span class="dot-l"><\/span><span><b>(\d)\.<\/b> ([^<]+)<\/span>/g)].map(m => m[2]);
    expect(derecha).toHaveLength(4);
    expect(new Set(derecha)).toEqual(new Set(['0,5', '0,75', '0,8', '0,625']));
    const valores = ['0,5', '0,75', '0,8', '0,625'];
    const orden = ordenUnir(fr);
    expect(derecha).toEqual(orden.map(i => valores[i]));
    derecha.forEach((v, i) => expect(v).not.toBe(valores[i]));
    const f = html([ex({ fracciones: fr, modo: 'unir' })]);
    expect(f).toMatch(/<b>1\.<\/b> \d\/\d/);
  });

  it('cada pizza lleva su letra y su dibujo', () => {
    const h = html([ex({ fracciones: fr, modo: 'unir' })]);
    expect(cuenta(h, /class="cq-fr-mini"/g)).toBe(4);
    expect(['A', 'B', 'C', 'D'].every(l => h.includes(`<span><b>${l}</b></span>`))).toBe(true);
  });
});

describe('la pizza de un problema o de una pregunta', () => {
  it('una sola, enmarcada junto al enunciado', () => {
    const h = html([ex({ tipo: 'problema', enunciado: 'Una pizza de 8 trozos.', fracciones: [F(8, 3)] })]);
    expect(h).toContain('class="cq-ej con-fig"');
    expect(h).toContain('class="cq-fig svg cq-fr-fig"');
    expect(cuenta(h, /data-trozo="/g)).toBe(8);
    // el problema sigue con su cuadrícula de operaciones
    expect(h).toContain('cq-op');
  });

  it('varias, en una bandeja debajo del enunciado, con su letra y sin espacio de respuesta', () => {
    const h = html([ex({ tipo: 'abierta', enunciado: 'Compara.', fracciones: [F(4, 2), F(8, 4, 'tarta')] })]);
    expect(cuenta(h, /class="cq-fr-card solo"/g)).toBe(2);
    expect(h).toContain('class="cq-fr bandeja"');
    expect(h).not.toContain('cq-fr-frac');
    expect(h).not.toContain('con-fig');
  });
});

describe('que los dibujos no choquen entre sí', () => {
  it('cada pizza del documento lleva su propio id de rayado', () => {
    const h = html([
      ex({ fracciones: [F(8, 3), F(5, 2)] }),
      ex({ tipo: 'problema', enunciado: 'x', fracciones: [F(8, 3)] }),
      ex({ fracciones: [F(8, 3), F(4, 1)], modo: 'unir' }),
    ]);
    const ids = [...h.matchAll(/<pattern id="(h-fr\d+)"/g)].map(m => m[1]);
    // 2 + 1 + 2 figuras
    expect(ids.length).toBe(5);
    expect(new Set(ids).size).toBe(ids.length);
    // y cada trozo rayado usa uno de ellos
    for (const m of h.matchAll(/url\(#(h-fr\d+)\)/g)) expect(ids).toContain(m[1]);
  });

  it('la misma ficha da siempre el mismo HTML', () => {
    const f = ficha([ex({ fracciones: [F(8, 3), F(5, 2)] })]);
    expect(buildFichaHtml(f, 'es')).toBe(buildFichaHtml(f, 'es'));
  });
});

describe('fuera de «Cuaderno»', () => {
  it('el ejercicio no se rompe: las pizzas salen debajo del enunciado', () => {
    const h = html([ex({ fracciones: [F(8, 3), F(5, 2)] })], 'clasico');
    expect(h).toContain('ENUNCIADO');
    expect(cuenta(h, /data-trozo="/g)).toBe(13);
  });

  it('la figura suelta de un problema sale debajo del enunciado', () => {
    const h = html([ex({ tipo: 'problema', enunciado: 'x', fracciones: [F(8, 3)] })], 'clasico');
    expect(cuenta(h, /data-trozo="/g)).toBe(8);
  });
});

describe('el cogidos se ve como se pidió', () => {
  it('«bn», «separados» o las dos', () => {
    const mira = (cogidos: FichaExercise['cogidos']) => html([ex({ fracciones: [F(8, 3)], cogidos })]);
    expect(cuenta(mira('bn'), /url\(#h-fr1\)/g)).toBe(3);
    expect(mira('separados')).not.toContain('url(#h-fr1)');
    expect(cuenta(mira('ambos'), /url\(#h-fr1\)/g)).toBe(3);
    expect(cuenta(mira(undefined), /url\(#h-fr1\)/g)).toBe(3);
    // en su sitio con «bn»: los 8 trozos salen del centro; con «separados», los 3 cogidos ya no
    const trozosDe = (h: string) => [...h.matchAll(/<g data-trozo="\d+"( data-cogido="1")?>(.*?)<\/g>/g)].map(m => ({ cogido: !!m[1], centro: m[2].includes('M50 50') }));
    expect(trozosDe(mira('bn')).every(t => t.centro)).toBe(true);
    expect(trozosDe(mira('separados')).filter(t => t.cogido).every(t => !t.centro)).toBe(true);
    expect(trozosDe(mira('separados')).filter(t => !t.cogido).every(t => t.centro)).toBe(true);
  });
});

describe('el Word', () => {
  const texto = async (e: FichaExercise[], estilo?: FichaContent['estilo']) => {
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(ficha(e, estilo), 'es')).arrayBuffer());
    return zip.file('word/document.xml')!.async('string');
  };

  it('«leer»: la letra de cada pizza y su fracción con la raya, sin la solución', async () => {
    const xml = await texto([ex({ fracciones: [F(8, 3), F(5, 2)], modo: 'leer', decimal: true })]);
    expect(xml).toContain('ENUNCIADO');
    expect(xml).toContain('>A<');
    expect(xml).toContain('>B<');
    expect(xml).toContain('= ____________');
    expect(xml).toContain('w:bottom');
    expect(xml).not.toContain('SOL-SECRETA');
  }, 30000);

  it('«colorear»: la fracción escrita debajo de cada pizza', async () => {
    const xml = await texto([ex({ fracciones: [F(6, 5), F(9, 4)], modo: 'colorear' })]);
    expect(xml).toContain('>5/6<');
    expect(xml).toContain('>4/9<');
  }, 30000);

  it('«unir»: las letras a la izquierda y los valores numerados a la derecha', async () => {
    const xml = await texto([ex({ fracciones: [F(2, 1), F(4, 3), F(5, 4)], modo: 'unir', decimal: true })]);
    expect(xml).toContain('>A<');
    expect(xml).toContain('>1.  <');
    for (const v of ['0,5', '0,75', '0,8']) expect(xml).toContain(`>${v}<`);
  }, 30000);

  it('un problema con su figura se exporta con su enunciado', async () => {
    const xml = await texto([ex({ tipo: 'problema', enunciado: 'PROBLEMA-PIZZA', fracciones: [F(8, 3)] })]);
    expect(xml).toContain('PROBLEMA-PIZZA');
    expect(xml).not.toContain('SOL-SECRETA');
  }, 30000);
});
