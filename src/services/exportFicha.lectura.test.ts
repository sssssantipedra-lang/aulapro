/**
 * La comprensión lectora y la lectura fácil en la hoja (HTML del PDF y de la vista previa) y en el Word: el texto con sus
 * párrafos numerados y sus dibujos al lado, los ejercicios de lectura, las negritas y la letra de la lectura fácil.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildFichaDocxBlob, buildFichaHtml, ilustracionesDeFicha } from './exportFicha';
import { CUADERNO_STYLE, contestarHtml, dibujarHtml, bancoHtml, lecturaHtml } from './fichaCuaderno';
import { prepareExercise, type FichaContent, type FichaExercise } from './resources';
import type { FichaLectura } from '../lib/lectura';
import type { Ficha } from '../types';

const IMG = 'data:image/webp;base64,AAAA';
const lectura = (over: Partial<FichaLectura> = {}): FichaLectura => ({
  genero: 'cuento',
  parrafos: ['Hace mucho vivía un **dragón** llamado Brasas.', 'Un día perdió su fuego <b>y lloró</b>.', 'Una princesa le ayudó.', 'Y vivieron felices.'],
  dibujos: [{ ilustracion: 'cue-dragon', parrafo: 0 }, { ilustracion: 'cue-princesa', parrafo: 2 }],
  pista: 'Fíjate en quién ayuda a Brasas.', destrezas: ['Vocabulario', 'Orden de los hechos'], ...over,
});

const ej = (tipo: FichaExercise['tipo'], extra: Partial<FichaExercise> = {}): FichaExercise => prepareExercise({ tipo, enunciado: `Enunciado ${tipo}.`, solucion: 'sol', ...extra });

const ficha = (extra: Partial<FichaContent> = {}, l: FichaLectura | null = lectura()): Ficha => ({
  id: 'l1', at: new Date().toISOString(), date: '2026-10-17', title: 'El dragón',
  request: { tema: 'Un dragón', area: 'Lengua', nivel: '3º Primaria', numEjercicios: 6, niveles: false, contextoClase: '' },
  content: {
    titulo: 'El dragón que perdió su fuego', explicacion: '', instrucciones: 'Lee el texto.', estilo: 'cuaderno', formato: 'ficha', ...(l ? { lectura: l } : {}),
    actividades: [
      { titulo: 'Buscamos', dificultad: 1, ejercicios: [ej('en_texto', { enunciado: 'Rodea las palabras del dragón.', lineasRespuesta: 2 }), ej('ordenar', { elementos: ['uno', 'dos', 'tres'] })] },
      { titulo: 'Pensamos', dificultad: 2, ejercicios: [ej('contestar', { preguntas: ['¿Quién?', '¿Dónde?'] }), ej('completar', { enunciado: 'El dragón es ______.', bancoPalabras: ['verde', 'rojo'] })] },
      { titulo: 'Creamos', dificultad: 3, ejercicios: [ej('dibujar', { enunciado: 'Dibuja al dragón.', lineasRespuesta: 1 }), ej('abierta')] },
    ],
    ...extra,
  },
});

const cargadas = (f: Ficha) => Object.fromEntries(ilustracionesDeFicha(f.content).map(id => [id, IMG]));
const html = (f: Ficha, opts: Parameters<typeof buildFichaHtml>[2] = {}) => buildFichaHtml(f, 'es', { ilustraciones: cargadas(f), ...opts });
const cuerpo = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/, '');
const cuenta = (h: string, re: RegExp) => (h.match(re) ?? []).length;

describe('el texto de una ficha de lectura', () => {
  it('lleva sus párrafos numerados, sus etiquetas y la pista de la mascota', () => {
    const h = cuerpo(html(ficha()));
    expect(cuenta(h, /<p class="lc-p">/g)).toBe(4);
    expect(h).toContain('<span class="lc-n">1</span>');
    expect(h).toContain('<span class="lc-n">4</span>');
    expect(h).toContain('<span class="lc-chip">Vocabulario</span>');
    expect(h).toContain('<span class="lc-chip">Orden de los hechos</span>');
    expect(h).toContain('Fíjate en quién ayuda a Brasas.');
    expect(h).toContain('class="lc-mascota"');
  });

  it('los dibujos van junto a su párrafo, dentro del mismo, y solo los que se han cargado', () => {
    const f = ficha();
    const h = cuerpo(html(f));
    expect(cuenta(h, /class="lc-fig"/g)).toBe(2);
    expect(h).toMatch(/<p class="lc-p"><span class="lc-fig" data-ilustracion="cue-dragon"><img class="lc-img" src="data:image\/webp;base64,AAAA" alt=""><\/span><span class="lc-n">1<\/span>/);
    expect(h).toMatch(/<p class="lc-p"><span class="lc-fig" data-ilustracion="cue-princesa">.*?<span class="lc-n">3<\/span>/);
    // Sin cargar todavía (la vista previa los trae después), el texto sale igual, sin huecos
    const sin = cuerpo(buildFichaHtml(f, 'es'));
    expect(sin).not.toContain('lc-fig');
    expect(cuenta(sin, /<p class="lc-p">/g)).toBe(4);
  });

  it('todo lo que escribe la IA va escapado: solo las negritas marcadas con ** se pintan', () => {
    const h = cuerpo(html(ficha()));
    expect(h).toContain('un <b>dragón</b> llamado Brasas');
    expect(h).toContain('&lt;b&gt;y lloró&lt;/b&gt;');
    expect(h).not.toContain('<b>y lloró</b>');
    expect(h).not.toContain('**');
  });

  it('un poema: un verso por línea, numerados el primero y de cinco en cinco', () => {
    const versos = (n: number, desde: number) => Array.from({ length: n }, (_, i) => `verso ${desde + i}`).join('\n');
    const h = cuerpo(html(ficha({}, lectura({ genero: 'poema', parrafos: [versos(4, 1), versos(4, 5), versos(4, 9)], dibujos: [] }))));
    expect(cuenta(h, /class="lc-v"/g)).toBe(12);
    expect(cuenta(h, /<div class="lc-estrofa">/g)).toBe(3);
    expect([...h.matchAll(/<i class="lc-vn">(\d+)<\/i>/g)].map(m => m[1])).toEqual(['1', '5', '10']);
    expect(h).not.toContain('class="lc-p"');
  });

  it('en la vista previa se puede tocar para editarlo; en el PDF no', () => {
    expect(html(ficha(), { preview: true })).toContain('data-part="lectura"');
    expect(html(ficha())).not.toContain('data-part');
  });

  it('sin texto, la ficha es la de siempre', () => {
    const h = cuerpo(html(ficha({}, null)));
    expect(h).not.toContain('class="lc');
  });

  it('los dibujos del texto se cargan aunque no haya hilo conductor', () => {
    expect(ilustracionesDeFicha(ficha().content).sort()).toEqual(['cue-dragon', 'cue-princesa']);
    expect(ilustracionesDeFicha(ficha({}, null).content)).toEqual([]);
  });

  it('lecturaHtml sin dibujos ni cabecera: solo el texto', () => {
    const h = lecturaHtml({ genero: 'cuento', parrafos: ['Uno.'], dibujos: [] }, {});
    expect(h).not.toContain('lc-cab');
    expect(h).toContain('<p class="lc-p"><span class="lc-n">1</span>Uno.</p>');
  });
});

describe('los ejercicios de lectura en la hoja', () => {
  const h = () => cuerpo(html(ficha()));

  it('«en_texto»: una lupa delante de la consigna y las líneas que se pidieron', () => {
    const x = h();
    expect(x).toContain('class="cq-lupa"');
    expect(x).toMatch(/cq-lupa[\s\S]*?Rodea las palabras del dragón\./);
    expect(cuenta(x.slice(x.indexOf('Rodea las palabras'), x.indexOf('Enunciado ordenar')), /<div><\/div>/g)).toBe(2);
  });

  it('«contestar»: cada pregunta con su línea', () => {
    const x = contestarHtml(ej('contestar', { preguntas: ['¿Quién?', '¿Dónde?'], solucion: 'corta' }));
    expect(cuenta(x, /class="cq-pq"/g)).toBe(2);
    expect(cuenta(x, /<div><\/div>/g)).toBe(2);
    // Con una solución larga, dos líneas por pregunta
    expect(cuenta(contestarHtml(ej('contestar', { preguntas: ['a', 'b'], solucion: 'x'.repeat(200) })), /<div><\/div>/g)).toBe(4);
    expect(h()).toContain('¿Dónde?');
  });

  it('«dibujar»: un marco vacío y, si se pide, líneas debajo', () => {
    expect(dibujarHtml(ej('dibujar', { lineasRespuesta: 0 }))).not.toContain('cq-lineas');
    expect(dibujarHtml(ej('dibujar', { lineasRespuesta: 2 }))).toContain('cq-lineas');
    expect(h()).toContain('class="cq-dibujo"');
  });

  it('«completar» con recuadro: las palabras van antes de las frases', () => {
    const x = h();
    expect(x.indexOf('class="cq-banco"')).toBeGreaterThan(-1);
    expect(x.indexOf('class="cq-banco"')).toBeLessThan(x.indexOf('El dragón es'));
    expect(bancoHtml(['a<b', 'c'])).toBe('<div class="cq-banco"><span>a&lt;b</span><span>c</span></div>');
  });

  it('el resto de la hoja sigue igual: los bloques, sus niveles y la autoevaluación', () => {
    const x = h();
    expect(cuenta(x, /class="cq-niv"/g)).toBe(3);
    expect(x).toContain('class="cq-fin"');
  });
});

describe('lectura fácil en la hoja', () => {
  const facil = () => ficha({ variante: 'lectura_facil', actividades: [{ titulo: 'A', dificultad: 1, ejercicios: [ej('abierta', { enunciado: '**Escribe** el nombre del **dragón**.' })] }] });

  it('la ficha lleva la clase lf y la letra Lexend, y las palabras clave en negrita', () => {
    const x = html(facil());
    expect(x).toMatch(/<article class="[^"]*\blf\b/);
    expect(x).toContain('--font:"Lexend", Verdana');
    expect(cuerpo(x)).toContain('<b>Escribe</b> el nombre del <b>dragón</b>');
  });

  it('sin lectura fácil, ni la clase ni la letra', () => {
    const x = html(ficha());
    expect(x).not.toMatch(/<article class="[^"]*\blf\b/);
    expect(cuerpo(x)).not.toContain('Lexend');
  });

  it('el CSS: letra más grande, más aire, sin mayúsculas ni cursiva, palabras clave con rotulador y aire escalado', () => {
    const lf = CUADERNO_STYLE.slice(CUADERNO_STYLE.indexOf('Lectura fácil (dislexia'));
    expect(lf).toMatch(/\.th-cuaderno\.lf \.lc-texto \{[^}]*font-size: 17px; line-height: 2/);
    expect(lf).toMatch(/\.th-cuaderno\.lf \.ficha-enunciado[^{]*\{ font-size: 16\.5px/);
    expect(lf).toMatch(/text-transform: none/);
    expect(lf).toMatch(/font-style: normal/);
    expect(lf).toMatch(/\.th-cuaderno\.lf b \{[^}]*linear-gradient/);
    expect(lf).toMatch(/word-spacing/);
    expect(lf).toMatch(/\.th-cuaderno\.lf \{[^}]*--d: 1\.2/);
    // El texto no se justifica en ninguna parte
    expect(CUADERNO_STYLE).not.toMatch(/text-align: justify/);
  });

  it('la lectura fácil entra en la densidad: apretar o aflojar no cambia el tamaño de la letra', () => {
    expect(CUADERNO_STYLE).toContain('.th-cuaderno.lf.d-apretada');
    expect(/font-size:[^;]*var\(--d/.test(CUADERNO_STYLE)).toBe(false);
  });

  it('el explicación y las instrucciones también llevan negritas', () => {
    const f = ficha({ variante: 'lectura_facil', explicacion: 'Sumar es **juntar**.', instrucciones: 'Lee **despacio**.' }, null);
    const x = cuerpo(html(f));
    expect(x).toContain('Sumar es <b>juntar</b>.');
  });
});

describe('Word', () => {
  const xmlDe = async (f: Ficha) => {
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
    return zip.file('word/document.xml')!.async('string');
  };

  it('el texto, los ejercicios de lectura y las negritas', async () => {
    const x = await xmlDe(ficha());
    expect(x).toContain('Brasas');
    expect(x).toContain('Una princesa le ayudó.');
    expect(x).toContain('Vocabulario');
    expect(x).toContain('Fíjate en quién ayuda a Brasas.');
    expect(x).toContain('¿Quién?');
    expect(x).toContain('Dibuja al dragón.');
    // La palabra clave en negrita, sin los asteriscos
    expect(x).toMatch(/<w:b\/>[\s\S]*?dragón/);
    expect(x).not.toContain('**');
    // El recuadro de palabras va antes de la frase
    expect(x.indexOf('verde')).toBeLessThan(x.indexOf('El dragón es'));
  });

  it('lectura fácil: Verdana grande y con interlineado, sin justificar', async () => {
    const f = ficha({ variante: 'lectura_facil' });
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
    const estilos = await zip.file('word/styles.xml')!.async('string');
    expect(estilos).toContain('Verdana');
    expect(estilos).toContain('w:val="28"');
    expect(estilos).toMatch(/w:line="360"/);
    expect(estilos).not.toContain('w:jc w:val="both"');
  });

  it('una ficha normal no cambia de letra ni de interlineado', async () => {
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(ficha(), 'es')).arrayBuffer());
    const estilos = await zip.file('word/styles.xml')!.async('string');
    expect(estilos).toContain('Calibri');
    expect(estilos).not.toMatch(/w:line="360"/);
  });
});
