/**
 * La hoja con hilo conductor: los tres dibujos de la cabecera, los dibujos de los
 * ejercicios (cada uno repetido su cantidad de veces, puestas por el código, y cada
 * uno con su espacio para contestar) y lo que pasa si los dibujos aún no se han cargado.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildFichaDocxBlob, buildFichaHtml, ilustracionesDeFicha } from './exportFicha';
import { dibujosDeLaCabecera, dibujosHtml } from './fichaCuaderno';
import { conHilo, type FichaContent } from './resources';
import type { Ficha } from '../types';

const ficha = (over: Partial<FichaContent> = {}): Ficha => ({
  id: 'h1', at: new Date().toISOString(), date: '2026-10-14', title: 'La granja',
  request: { tema: 'Los animales de la granja', area: 'Ciencias Naturales', nivel: '2º Primaria', numEjercicios: 4, niveles: false, contextoClase: '' },
  content: conHilo({
    titulo: 'La granja', explicacion: 'Los animales de la granja.', instrucciones: 'Cuenta.', estilo: 'cuaderno',
    actividades: [
      {
        titulo: 'Cuenta',
        ejercicios: [
          { tipo: 'abierta', enunciado: '¿Cuántas vacas hay?', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 5 }], solucion: 'SOL-VACAS' },
          { tipo: 'abierta', enunciado: '¿Cuántos animales hay en total?', dibujos: [{ ilustracion: 'ani-gallina', cantidad: 4 }, { ilustracion: 'ani-cerdo', cantidad: 3 }], solucion: '7' },
          { tipo: 'abierta', enunciado: 'Explica qué nos da la oveja y por qué es importante para las personas.', dibujos: [{ ilustracion: 'ani-oveja', cantidad: 1 }], solucion: 'Nos da lana y también leche y carne.' },
          { tipo: 'abierta', enunciado: 'Escribe qué animal es.', solucion: 'x' },
        ],
      },
    ],
    ...over,
  }, 'granja'),
});

const ILUS: Record<string, string> = {};
for (const id of ['ani-vaca', 'ani-cerdo', 'ani-gallina', 'ani-oveja', 'ani-caballo', 'ani-pato', 'lug-granja', 'com-huevo', 'pro-agricultor']) ILUS[id] = `data:image/webp;base64,${id}`;

const cuenta = (html: string, re: RegExp) => (html.match(re) ?? []).length;
/** El documento sin su hoja de estilos (que nombra todas las clases aunque no se usen). */
const cuerpo = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');

describe('la hoja con hilo conductor', () => {
  it('la cabecera lleva los tres primeros dibujos del hilo, el del medio, el más grande', () => {
    const html = buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS });
    const cab = html.match(/<div class="cq-arte cq-arte-hilo"[^>]*>(.*?)<\/div>/)![1];
    expect(cuenta(cab, /<img /g)).toBe(3);
    expect(cab).toContain('data:image/webp;base64,ani-vaca');
    expect(cab).toContain('class="cq-hdib c"');
    // el pintado va 2.º, 1.º, 3.º: el 1.º (el grande) queda en medio
    expect(cab.indexOf('ani-cerdo')).toBeLessThan(cab.indexOf('ani-vaca'));
    expect(cab.indexOf('ani-vaca')).toBeLessThan(cab.indexOf('ani-gallina'));
  });

  it('no hay dibujos sueltos de adorno: ni junto al título del bloque ni en «Antes de empezar»', () => {
    const html = cuerpo(buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS }));
    expect(html).not.toContain('cq-med');
    expect(html).not.toContain('con-mascota');
    expect(html).not.toContain('cq-mascota-hilo');
  });

  it('cada dibujo se repite exactamente su cantidad, y los de un mismo ejercicio van agrupados', () => {
    const html = buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS });
    expect(cuenta(html, /base64,ani-vaca"/g)).toBeGreaterThanOrEqual(5);
    const bandejas = html.match(/<div class="cq-dibujos[^"]*">.*?<\/div>/g)!;
    expect(bandejas).toHaveLength(2);
    expect(cuenta(bandejas[0], /<img class="cq-dib"/g)).toBe(5);
    expect(cuenta(bandejas[1], /<img class="cq-dib"/g)).toBe(7);
    expect(cuenta(bandejas[1], /class="cq-grupo"/g)).toBe(2);
    expect(cuenta(bandejas[1], /ani-gallina/g)).toBe(4);
    expect(cuenta(bandejas[1], /ani-cerdo/g)).toBe(3);
  });

  it('el tamaño de la bandeja baja con el número de dibujos', () => {
    const tam = (n: number) => dibujosHtml({ tipo: 'abierta', enunciado: '', solucion: '', dibujos: [{ ilustracion: 'ani-vaca', cantidad: n }] }, (id, c) => `<img class="${c}" src="${id}">`).bandeja;
    expect(tam(3)).toContain('cq-dibujos g');
    expect(tam(6)).toContain('cq-dibujos m');
    expect(tam(10)).toContain('cq-dibujos p');
  });

  it('un solo dibujo va enmarcado a un lado del enunciado, en la misma fila que su espacio, y no en bandeja', () => {
    const html = buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS });
    expect(cuenta(html, /class="cq-fig"/g)).toBe(1);
    expect(html).toMatch(/<div class="cq-ej con-fig"><div class="cq-fig"><img class="cq-dib" src="data:image\/webp;base64,ani-oveja"/);
  });

  it('el espacio sigue a lo que se espera: una caja para una respuesta corta, líneas para una frase', () => {
    const html = cuerpo(buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS }));
    expect(cuenta(html, /class="cq-respuesta"/g)).toBe(3);
    // el ejercicio de la oveja tiene una solución de una frase: dos líneas
    expect(cuenta(html, /class="cq-lineas"/g)).toBe(1);
    expect(html).toContain('<div class="cq-lineas"><div></div><div></div></div>');
  });

  it('las soluciones no salen en la hoja', () => {
    expect(buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS })).not.toContain('SOL-VACAS');
  });

  it('si los dibujos aún no se han cargado, la cabecera es la del área y no salen imágenes rotas', () => {
    const html = cuerpo(buildFichaHtml(ficha(), 'es', { ilustraciones: {} }));
    expect(html).not.toContain('cq-arte-hilo');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
  });

  it('sin hilo no hay dibujos aunque los ejercicios los traigan guardados', () => {
    const f = ficha();
    delete f.content.hilo;
    const html = cuerpo(buildFichaHtml(f, 'es', { ilustraciones: ILUS }));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('cq-dibujos');
    expect(ilustracionesDeFicha(f.content)).toEqual([]);
  });

  it('con apoyos visuales no se pintan: ahí van los pictogramas', () => {
    const f = ficha({ visual: true });
    const html = cuerpo(buildFichaHtml(f, 'es', { ilustraciones: ILUS }));
    expect(html).not.toContain('cq-dibujos');
    expect(html).not.toContain('cq-arte-hilo');
  });
});

describe('los dibujos que hay que cargar', () => {
  it('son los de la cabecera y los de los ejercicios, sin repetir', () => {
    const f = ficha();
    const ids = ilustracionesDeFicha(f.content);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...dibujosDeLaCabecera('granja'), 'ani-vaca', 'ani-gallina', 'ani-cerdo', 'ani-oveja']) expect(ids).toContain(id);
    expect(dibujosDeLaCabecera(undefined)).toEqual([]);
    expect(dibujosDeLaCabecera('inventado')).toEqual([]);
  });
});

/** Una ficha con un solo bloque y los ejercicios dados. */
const conEjercicios = (ejercicios: FichaContent['actividades'][number]['ejercicios'], hilo = 'granja'): Ficha => {
  const f = ficha();
  f.content = conHilo({ ...f.content, actividades: [{ titulo: 'Bloque', ejercicios }] }, hilo);
  return f;
};
const ILUS2: Record<string, string> = { ...ILUS };
for (const id of ['ani-perro', 'ani-gato', 'ani-leon', 'ani-conejo', 'cue-corazon', 'cue-pulmones', 'com-manzana', 'com-pera', 'com-fresa']) ILUS2[id] = `data:image/webp;base64,${id}`;

describe('ejercicios con dibujos y su espacio para contestar', () => {
  it('«contar»: una fila por grupo con su caja en la misma fila, con la cantidad exacta, y la fila del total', () => {
    const html = cuerpo(buildFichaHtml(conEjercicios([
      { tipo: 'contar', enunciado: 'Cuenta.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 4 }, { ilustracion: 'ani-cerdo', cantidad: 3 }], total: true, solucion: '' },
    ]), 'es', { ilustraciones: ILUS2 }));
    const filas = html.match(/<div class="cq-crow[^"]*">.*?<\/div><\/div>/g)!;
    expect(filas).toHaveLength(3);
    expect(cuenta(filas[0], /ani-vaca/g)).toBe(4);
    expect(cuenta(filas[1], /ani-cerdo/g)).toBe(3);
    for (const fila of filas) expect(fila).toContain('class="cq-caja"');
    expect(filas[2]).toContain('cq-ctot');
    expect(filas[2]).toContain('>Total<');
  });

  it('«contar» sin «total» no lleva fila de total, aunque haya varios grupos', () => {
    const html = cuerpo(buildFichaHtml(conEjercicios([
      { tipo: 'contar', enunciado: 'Cuenta.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 4 }, { ilustracion: 'ani-cerdo', cantidad: 3 }], solucion: '' },
    ]), 'es', { ilustraciones: ILUS2 }));
    expect(cuenta(html, /class="cq-crow/g)).toBe(2);
    expect(html).not.toContain('cq-ctot');
  });

  it('«etiquetar»: cada dibujo con su línea debajo, y con banco las palabras ordenadas por el abecedario', () => {
    const f = conEjercicios([
      { tipo: 'etiquetar', enunciado: 'Escribe el nombre.', dibujos: ['ani-perro', 'ani-gato', 'ani-vaca', 'ani-leon'].map(ilustracion => ({ ilustracion, cantidad: 1 })), banco: true, solucion: '' },
    ]);
    const html = cuerpo(buildFichaHtml(f, 'es', { ilustraciones: ILUS2 }));
    expect(cuenta(html, /class="cq-etiq-c"/g)).toBe(4);
    expect(cuenta(html, /class="cq-linea-e"/g)).toBe(4);
    expect(html).toContain('<div class="cq-banco-p"><span>gato</span><span>león</span><span>perro</span><span>vaca</span></div>');
    expect(cuerpo(buildFichaHtml(f, 'en', { ilustraciones: ILUS2 }))).toContain('<span>cat</span><span>cow</span><span>dog</span><span>lion</span>');
    const sinBanco = cuerpo(buildFichaHtml(conEjercicios([{ ...f.content.actividades[0].ejercicios[0], banco: false }]), 'es', { ilustraciones: ILUS2 }));
    expect(sinBanco).not.toContain('cq-banco-p');
  });

  it('«clasificar»: los dibujos mezclados y numerados con su nombre y un cuadro por grupo; siempre la misma mezcla', () => {
    const f = conEjercicios([
      { tipo: 'clasificar', enunciado: 'Clasifica.', categorias: [
        { nombre: 'Domésticos', dibujos: ['ani-vaca', 'ani-perro', 'ani-gato'] },
        { nombre: 'Salvajes', dibujos: ['ani-leon', 'ani-conejo'] },
      ], solucion: '' },
    ]);
    const a = cuerpo(buildFichaHtml(f, 'es', { ilustraciones: ILUS2 }));
    expect(cuenta(a, /class="cq-pic"/g)).toBe(5);
    for (let n = 1; n <= 5; n++) expect(a).toContain(`<b>${n}</b>`);
    expect(a).toContain('<h4>Domésticos</h4>');
    expect(a).toContain('<h4>Salvajes</h4>');
    expect(cuenta(a, /class="cq-cat"/g)).toBe(2);
    expect(a).toContain('<span>león</span>');
    expect(cuerpo(buildFichaHtml(f, 'es', { ilustraciones: ILUS2 }))).toBe(a);
  });

  it('«relacionar» con un dibujo por elemento: la fila lleva el dibujo y el texto sigue escrito', () => {
    const html = cuerpo(buildFichaHtml(conEjercicios([
      { tipo: 'relacionar', enunciado: 'Une.', izquierda: ['Vaca', 'Gallina'], derecha: ['Huevos', 'Leche'], dibujos: [{ ilustracion: 'ani-vaca', cantidad: 1 }, { ilustracion: 'ani-gallina', cantidad: 1 }], solucion: '' },
    ]), 'es', { ilustraciones: ILUS2 }));
    expect(html).toContain('class="cq-rel"');
    expect(cuenta(html, /class="item con-dib"/g)).toBe(2);
    expect(html).toContain('<b>1.</b> Vaca');
    expect(html).toContain('<b>B.</b> Leche');
  });

  it('una tabla con un dibujo por fila lleva su columna de dibujos', () => {
    const html = cuerpo(buildFichaHtml(conEjercicios([
      { tipo: 'tabla_rellenar', enunciado: 'Completa.', columnas: ['Fruta', 'Cantidad'], filas: [['Manzanas', '5'], ['Peras', '']], dibujos: [{ ilustracion: 'com-manzana', cantidad: 1 }, { ilustracion: 'com-pera', cantidad: 1 }], solucion: '' },
    ]), 'es', { ilustraciones: ILUS2 }));
    expect(cuenta(html, /class="cq-tdib"/g)).toBe(2);
    expect(html).toContain('class="vis-col"');
  });

  it('un problema lleva su cuadrícula de operaciones y la respuesta debajo', () => {
    const html = cuerpo(buildFichaHtml(conEjercicios([
      { tipo: 'problema', enunciado: 'Hay 12 vacas y se van 5. ¿Cuántas quedan?', solucion: '7' },
    ]), 'es', { ilustraciones: ILUS2 }));
    expect(html).toContain('<div class="cq-op"><span>Operación</span></div>');
    expect(html).toContain('<div class="cq-respuesta"><b>Respuesta:</b><span class="cq-linea larga"></span></div>');
  });

  it('«completar» pone el hueco en la propia frase y, si no hay hueco, una línea debajo', () => {
    const con = cuerpo(buildFichaHtml(conEjercicios([{ tipo: 'completar', enunciado: 'La vaca da ____ y la gallina ____.', solucion: 'leche, huevos' }]), 'es', { ilustraciones: ILUS2 }));
    expect(cuenta(con, /class="cq-hueco"/g)).toBe(2);
    expect(con).not.toContain('cq-respuesta');
    const sin = cuerpo(buildFichaHtml(conEjercicios([{ tipo: 'completar', enunciado: 'Escribe la palabra que falta.', solucion: 'leche' }]), 'es', { ilustraciones: ILUS2 }));
    expect(sin).toContain('cq-linea larga');
  });

  it('los ejercicios van en una columna con su número aparte; el verdadero o falso largo puede partirse por una fila', () => {
    const html = buildFichaHtml(conEjercicios([
      { tipo: 'abierta', enunciado: 'Uno.', solucion: 'x' },
      { tipo: 'verdadero_falso', enunciado: 'Marca.', afirmaciones: ['a', 'b'], solucion: 'V F' },
    ]), 'es', { ilustraciones: ILUS2 });
    expect(cuenta(cuerpo(html), /<div class="cq-ej/g)).toBe(2);
    expect(html).toContain('<li class="largo">');
  });

  it('sin hilo, «contar», «etiquetar» y «clasificar» salen como una pregunta abierta, sin imágenes', () => {
    const f = conEjercicios([
      { tipo: 'contar', enunciado: 'Cuenta las vacas.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 4 }], solucion: 'vaca: 4' },
      { tipo: 'etiquetar', enunciado: 'Escribe los nombres.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 1 }, { ilustracion: 'ani-gato', cantidad: 1 }], solucion: '' },
      { tipo: 'clasificar', enunciado: 'Clasifica.', categorias: [{ nombre: 'A', dibujos: ['ani-vaca'] }, { nombre: 'B', dibujos: ['ani-gato'] }], solucion: '' },
    ]);
    delete f.content.hilo;
    const html = cuerpo(buildFichaHtml(f, 'es', { ilustraciones: ILUS2 }));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('cq-crow');
    expect(html).not.toContain('cq-etiq');
    expect(html).not.toContain('cq-cat"');
    expect(html).toContain('Cuenta las vacas.');
    expect(ilustracionesDeFicha(f.content)).toEqual([]);
  });

  it('los dibujos de «clasificar» y los de relacionar se cargan con la ficha', () => {
    const f = conEjercicios([
      { tipo: 'clasificar', enunciado: 'Clasifica.', categorias: [{ nombre: 'A', dibujos: ['ani-leon'] }, { nombre: 'B', dibujos: ['ani-conejo'] }], solucion: '' },
      { tipo: 'relacionar', enunciado: 'Une.', izquierda: ['a', 'b'], derecha: ['c', 'd'], dibujos: [{ ilustracion: '', cantidad: 1 }, { ilustracion: 'ani-perro', cantidad: 1 }], solucion: '' },
    ]);
    const ids = ilustracionesDeFicha(f.content);
    expect(ids).toEqual(expect.arrayContaining(['ani-leon', 'ani-conejo', 'ani-perro']));
    expect(ids).not.toContain('');
  });

  it('el Word de los tipos con dibujos se genera sin romperse', async () => {
    const f = conEjercicios([
      { tipo: 'contar', enunciado: 'CONTAR-WORD', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 2 }], total: true, solucion: 'SOL-SECRETA' },
      { tipo: 'etiquetar', enunciado: 'ETIQUETAR-WORD', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 1 }, { ilustracion: 'ani-gato', cantidad: 1 }], banco: true, solucion: '' },
      { tipo: 'clasificar', enunciado: 'CLASIFICAR-WORD', categorias: [{ nombre: 'Grupo uno', dibujos: ['ani-vaca'] }, { nombre: 'Grupo dos', dibujos: ['ani-gato'] }], solucion: '' },
    ]);
    const zip = await JSZip.loadAsync(await (await buildFichaDocxBlob(f, 'es')).arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    for (const x of ['CONTAR-WORD', 'ETIQUETAR-WORD', 'CLASIFICAR-WORD']) expect(xml).toContain(x);
    expect(xml).not.toContain('SOL-SECRETA');
  }, 30000);
});

describe('el Word con hilo conductor', () => {
  it('se genera sin romperse aunque no se puedan rasterizar los dibujos, y sin soluciones', async () => {
    const blob = await buildFichaDocxBlob(ficha(), 'es');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('LA GRANJA');
    expect(xml).toContain('¿Cuántas vacas hay?');
    expect(xml).not.toContain('SOL-VACAS');
  }, 30000);
});
