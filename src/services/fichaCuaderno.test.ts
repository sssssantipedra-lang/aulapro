import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildFichaHtml, buildFichaDocxBlob } from './exportFicha';
import { calculosHtml, completarHtml, esRespuestaCorta, lineasDeRespuesta, recuadroHtml, serieDe, tamanoTitulo } from './fichaCuaderno';
import type { Ficha } from '../types';
import type { FichaContent, FichaExercise } from './resources';

const t = (k: string) => k;

function ficha(over: Partial<FichaContent> = {}): Ficha {
  return {
    id: 'cq1', at: new Date().toISOString(), date: '2026-10-14', title: 'Números',
    request: { tema: 'Números hasta el millón', area: 'Matemáticas', nivel: '5º Primaria', numEjercicios: 5, niveles: false, contextoClase: '' },
    content: {
      titulo: 'Matemáticas 5.º Primaria', explicacion: '', instrucciones: '', estilo: 'cuaderno',
      actividades: [
        {
          titulo: 'Descomponemos números',
          recuadro: { tipo: 'recuerda', texto: '', lista: ['CM = centena de millar', 'DM = decena de millar'] },
          ejercicios: [
            { tipo: 'calculos', enunciado: 'Descompón:', lineas: ['583.742', '75.830 = '], respuesta: 'linea', solucion: '' },
            { tipo: 'calculos', enunciado: 'Escribe el número:', lineas: ['4 CM + 3 DM'], respuesta: 'caja', solucion: '' },
          ],
        },
        {
          titulo: 'Ordenamos',
          recuadro: { tipo: 'reto', texto: '¿Qué cifra ocupa las decenas de millar?' },
          ejercicios: [{ tipo: 'ordenar', enunciado: 'Ordena de mayor a menor:', elementos: ['345.678', '354.876', '345.768'], ordenCorrecto: [], solucion: '' }],
        },
        {
          titulo: 'Verdadero o falso',
          recuadro: { tipo: 'consejo', texto: 'Compara la cifra de mayor valor.' },
          ejercicios: [
            { tipo: 'verdadero_falso', enunciado: 'Marca:', afirmaciones: ['1.000 > 999'], solucion: 'V' },
            { tipo: 'abierta', enunciado: 'Explica por qué.', solucion: '' },
          ],
        },
      ],
      ...over,
    },
  };
}

describe('diseño «Cuaderno» — hoja', () => {
  const html = buildFichaHtml(ficha(), 'es');

  it('lleva la cinta con el título, la ilustración que encaja y los datos del alumno', () => {
    expect(html).toContain('class="ficha-doc th-cuaderno"');
    expect(html).toContain('<header class="cq-cab"');
    expect(html).toContain('Matemáticas 5.º Primaria');
    expect(html).toContain('data-ilustracion="cab-base10"');
    expect(html).toContain('cq-datos');
    expect(html).not.toContain('Nombre: ____');
  });

  it('numera los bloques en círculos y no pinta la cabecera de bloque clásica', () => {
    expect(html.match(/class="cq-sec"/g)).toHaveLength(3);
    expect(html).toContain('<span class="cq-num">1</span><h2>Descomponemos números</h2>');
    expect(html).not.toContain('class="act-header"');
  });

  it('una lista de cálculos pone el número, el «=» y el hueco, sin el «=» que traiga la línea', () => {
    expect(html).toContain('<span class="cq-val">583.742</span><span class="cq-eq">=</span><span class="cq-linea"></span>');
    expect(html).toContain('<span class="cq-val">75.830</span>');
    expect(html).toContain('cq-calculos con-caja');
    // los «=» van alineados: el ancho de la columna del cálculo es el del más largo
    expect(html).toContain('style="--w:7ch"');
    expect(html).toContain('<span class="cq-caja"></span>');
  });

  it('con listas de cálculos los ejercicios van con letras; con uno solo, sin marca; si no, con números', () => {
    const [a, b, c] = html.split('<section class="ficha-actividad').slice(1);
    expect(a).toContain('ficha-ejercicios letras');
    expect(b).toContain('ficha-ejercicios sin');
    expect(c).toContain('<ol class="ficha-ejercicios" ');
  });

  it('el recuadro es una franja con su mascota: «Recuerda» y «Consejo» antes de los ejercicios, «Reto» después con su hueco', () => {
    expect(html).toContain('class="cq-nota recuerda"');
    expect(html).toContain('<span><b>CM</b><i>=</i>centena de millar</span>');
    expect(html).toContain('class="cq-nota reto"');
    expect(html).toContain('<div class="cq-respuesta"><b>Respuesta:</b>');
    expect(html).toContain('class="cq-nota consejo"');
    expect(html).toContain('Compara la cifra de mayor valor.');
    const [a, b, c] = html.split('<section class="ficha-actividad').slice(1);
    // «Recuerda» y «Consejo» van antes de la lista de ejercicios; el «Reto», después
    expect(a.indexOf('cq-nota')).toBeLessThan(a.indexOf('<ol'));
    expect(c.indexOf('cq-nota')).toBeLessThan(c.indexOf('<ol'));
    expect(b.indexOf('cq-nota')).toBeGreaterThan(b.indexOf('</ol>'));
  });

  it('una serie corta se escribe en orden: la serie y tantas casillas como elementos; el recuadro sin lista de pares sale como lista', () => {
    expect(html).toContain('<div class="cq-serie"><span>345.678</span><i>–</i><span>354.876</span>');
    expect(html.match(/<div class="cq-celdas">(.*?)<\/div>/)![1].match(/class="cq-caja"/g)).toHaveLength(3);
    const r = recuadroHtml({ tipo: 'recuerda', texto: '', lista: ['Se suma', 'Se resta'] }, t);
    expect(r).toContain('<ul class="cq-lista"><li>Se suma</li><li>Se resta</li></ul>');
  });

  it('las soluciones no salen en la hoja', () => {
    const f = ficha();
    f.content.actividades[0].ejercicios[0].solucion = 'SOLUCION-SECRETA';
    expect(buildFichaHtml(f, 'es')).not.toContain('SOLUCION-SECRETA');
  });

  it('la vista previa marca los bloques para seleccionarlos', () => {
    const p = buildFichaHtml(ficha(), 'es', { preview: true });
    expect(p).toContain('data-part="titulo"');
    expect(p).toContain('data-ex="0-0"');
    expect(p).toContain('data-act="1"');
  });

  it('en «Clásica» y con historia no cambia nada: sin cinta ni círculos', () => {
    const clasica = buildFichaHtml(ficha({ estilo: 'clasico' }), 'es');
    expect(clasica).toContain('class="act-header"');
    expect(clasica).not.toContain('<header class="cq-cab"');
    expect(buildFichaHtml(ficha({ estilo: 'espacio' }), 'es')).toContain('ficha-banner');
  });

  it('con otro tema, el recuadro sale igual, debajo de los ejercicios', () => {
    const clasica = buildFichaHtml(ficha({ estilo: 'clasico' }), 'es');
    expect(clasica).toContain('class="cq-nota recuerda"');
    expect(clasica).not.toContain('class="cq-sec"');
  });

  it('la letra de la cinta baja con los títulos largos', () => {
    expect(tamanoTitulo('Fracciones')).toBe(30);
    expect(tamanoTitulo('Matemáticas 5.º Primaria')).toBeLessThan(30);
    expect(tamanoTitulo('Un título larguísimo que no cabe en una sola línea de la cinta azul')).toBe(17);
  });
});

describe('diseño «Cuaderno» — letra incrustada', () => {
  it('la incrusta solo en «Cuaderno» y, sin ella, usa las letras del sistema', () => {
    const css = "@font-face{font-family:'Outfit';src:url(data:font/woff2;base64,AAAA) format('woff2');}";
    expect(buildFichaHtml(ficha(), 'es', { fontCss: css })).toContain(css);
    expect(buildFichaHtml(ficha({ estilo: 'clasico' }), 'es', { fontCss: css })).not.toContain(css);
    expect(buildFichaHtml(ficha(), 'es')).toContain('--font:Outfit, "Trebuchet MS"');
  });

  it('si la letra no se puede cargar, devuelve vacío sin romper', async () => {
    const { cargarFuenteCuaderno } = await import('../lib/fuenteCuaderno');
    expect(typeof (await cargarFuenteCuaderno())).toBe('string');
  });
});

describe('diseño «Cuaderno» — piezas', () => {
  it('serieDe solo toma series cortas de al menos 3 elementos', () => {
    const ord = (elementos: string[]): FichaExercise => ({ tipo: 'ordenar', enunciado: '', elementos, solucion: '' });
    expect(serieDe(ord(['1', '2', '3']))).toEqual(['1', '2', '3']);
    expect(serieDe(ord(['1', '2']))).toBeNull();
    expect(serieDe(ord(['Primero se lava la fruta', 'Luego se corta', 'Después se sirve']))).toBeNull();
    expect(serieDe({ tipo: 'abierta', enunciado: '', elementos: ['1', '2', '3'], solucion: '' })).toBeNull();
  });

  it('escapa el HTML de las líneas', () => {
    expect(calculosHtml({ tipo: 'calculos', enunciado: '', lineas: ['3 < 5 & 2 > 1'], solucion: '' })).toContain('3 &lt; 5 &amp; 2 &gt; 1');
  });
});

describe('diseño «Cuaderno» — espacios de respuesta', () => {
  it('una respuesta corta cabe en una caja; una frase, en líneas, y las justas', () => {
    expect(esRespuestaCorta('3/8')).toBe(true);
    expect(esRespuestaCorta('Madrid')).toBe(true);
    expect(esRespuestaCorta('')).toBe(false);
    expect(esRespuestaCorta('Nos da lana y leche.')).toBe(false);
    expect(lineasDeRespuesta('Lana y leche.')).toBe(2);
    expect(lineasDeRespuesta('x'.repeat(100))).toBe(3);
    expect(lineasDeRespuesta('x'.repeat(200))).toBe(4);
    // De opinión o sin solución, tres
    expect(lineasDeRespuesta('Respuesta libre.')).toBe(3);
    expect(lineasDeRespuesta('')).toBe(3);
    expect(lineasDeRespuesta(undefined)).toBe(3);
  });

  it('«completar»: los guiones bajos de la frase pasan a un hueco, escapando el resto', () => {
    expect(completarHtml('La vaca da ____ y <b>.')).toEqual({ html: 'La vaca da <span class="cq-hueco"></span> y &lt;b&gt;.', hueco: true });
    expect(completarHtml('Escribe la palabra.').hueco).toBe(false);
    expect(completarHtml('Un guion_bajo suelto').hueco).toBe(false);
  });

  it('los cálculos largos van en una columna y los cortos, de cuatro en adelante, en dos', () => {
    const lineas = (l: string[]) => calculosHtml({ tipo: 'calculos', enunciado: '', lineas: l, solucion: '' });
    expect(lineas(['1+1', '2+2', '3+3', '4+4'])).toContain('cq-calculos dos');
    expect(lineas(['1+1', '2+2', '3+3'])).not.toContain(' dos');
    expect(lineas(['1+1', '2+2', '3+3', 'una cuenta bastante más larga que las demás'])).not.toContain(' dos');
  });
});

describe('diseño «Cuaderno» — Word', () => {
  it('genera el .docx con la lista de cálculos, el recuadro y el título en mayúsculas, sin soluciones', async () => {
    const f = ficha();
    f.content.actividades[0].ejercicios[0].solucion = 'SOLUCION-SECRETA';
    const blob = await buildFichaDocxBlob(f, 'es');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('MATEMÁTICAS 5.º PRIMARIA');
    expect(xml).toContain('DESCOMPONEMOS NÚMEROS');
    expect(xml).toContain('583.742');
    expect(xml).toContain('CM = centena de millar');
    expect(xml).toContain('RETO');
    expect(xml).toContain('345.678   –   354.876');
    expect(xml).not.toContain('SOLUCION-SECRETA');
  });
});
