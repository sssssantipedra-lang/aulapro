/**
 * La hoja con hilo conductor: los tres dibujos de la cabecera, el dibujo de cada
 * bloque, los dibujos de los ejercicios (cada uno repetido su cantidad de veces,
 * puestas por el código) y lo que pasa si los dibujos aún no se han cargado.
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

  it('cada bloque lleva su dibujo junto al título', () => {
    const f = ficha();
    const html = buildFichaHtml(f, 'es', { ilustraciones: ILUS });
    expect(cuenta(html, /class="cq-med"/g)).toBe(1);
    expect(html).toContain(`data:image/webp;base64,${f.content.actividades[0].dibujo}`);
  });

  it('un dibujo de «Antes de empezar» asoma en su esquina', () => {
    const html = buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS });
    expect(html).toContain('ficha-explicacion con-mascota');
    expect(html).toContain('class="cq-mascota-hilo"');
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

  it('un solo dibujo va a un lado del enunciado y no en bandeja', () => {
    const html = buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS });
    expect(cuenta(html, /class="cq-dib-lado"/g)).toBe(1);
    expect(html).toMatch(/<div class="cq-dib-lado"><img class="cq-dib" src="data:image\/webp;base64,ani-oveja"/);
  });

  it('con dibujos que contar, la respuesta corta es una caja; la larga sigue con sus líneas', () => {
    const html = buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS });
    expect(cuenta(html, /class="cq-respuesta"/g)).toBe(2);
    // el ejercicio de la oveja tiene una solución larga: líneas; y el último no lleva dibujos: líneas
    expect(cuenta(html, /class="ficha-espacio lines"/g)).toBe(2);
  });

  it('las soluciones no salen en la hoja', () => {
    expect(buildFichaHtml(ficha(), 'es', { ilustraciones: ILUS })).not.toContain('SOL-VACAS');
  });

  it('si los dibujos aún no se han cargado, la cabecera es la del área y no salen imágenes rotas', () => {
    const html = cuerpo(buildFichaHtml(ficha(), 'es', { ilustraciones: {} }));
    expect(html).not.toContain('cq-arte-hilo');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('con-mascota');
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
  it('son los de la cabecera, los de cada bloque y los de los ejercicios, sin repetir', () => {
    const f = ficha();
    const ids = ilustracionesDeFicha(f.content);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...dibujosDeLaCabecera('granja'), f.content.actividades[0].dibujo!, 'ani-vaca', 'ani-gallina', 'ani-cerdo', 'ani-oveja']) expect(ids).toContain(id);
    expect(dibujosDeLaCabecera(undefined)).toEqual([]);
    expect(dibujosDeLaCabecera('inventado')).toEqual([]);
  });
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
