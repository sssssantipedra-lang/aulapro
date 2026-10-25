/**
 * El PDF y el Word de la SdA son lo que el docente entrega a su centro o a
 * inspección: llevan la cita del decreto del que salen las competencias y
 * saberes, y nada más. Ningún comentario sobre la aplicación, aunque se haya
 * usado el estatal por no tener aún el de su comunidad.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildSdaHtml, buildSdaDocxBlob } from './exportSda';
import type { LearningSituation } from '../types';

const CITA = 'Real Decreto 157/2022, de 1 de marzo (BOE núm. 52, de 2 de marzo de 2022)';

const base: LearningSituation = {
  id: 's1', at: '', date: '', title: 'Huerto',
  request: { idea: '', numero: '1', temporalizacion: '', meses: '', areas: ['Matemáticas'], numSesiones: 1, nivel: '5º de Primaria', contextoClase: '', metodologia: '' },
  content: {
    titulo: 'Huerto', justificacion: 'Un huerto escolar.', ods: '', objetivosEtapa: '', competenciasClave: '', explicacionCurricular: '',
    areas: [{ area: 'Matemáticas', competenciasEspecificas: '1. Interpretar…', criteriosEvaluacion: '1.1 …', saberesBasicos: 'A. Sentido numérico' }],
    inclusionUniversal: '', inclusionAdicional: '', inclusionIndividualizada: '', sesiones: [],
    metodologia: '', agrupamiento: '', recursos: '', productoFinal: '', evaluacionTecnicas: '', evaluacionInstrumentos: '',
  },
};
const conEstatal: LearningSituation = {
  ...base, content: { ...base.content, normativa: { comunidad: 'madrid', origen: 'estatal', cita: CITA } },
};

async function textoDelWord(sda: LearningSituation): Promise<string> {
  const zip = await JSZip.loadAsync(await (await buildSdaDocxBlob(sda, 'es')).arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

describe('normativa en el PDF', () => {
  it('lleva la cita del decreto usado, sin avisos sobre la aplicación', () => {
    const html = buildSdaHtml(conEstatal, 'es');
    expect(html).toContain('Normativa curricular');
    expect(html).toContain(CITA);
    expect(html).not.toMatch(/aún no tiene/);
    expect(html).not.toMatch(/Aula Pro/);
  });

  it('una SdA sin normativa guardada no lleva esa fila', () => {
    expect(buildSdaHtml(base, 'es')).not.toContain('Normativa curricular');
  });
});

describe('normativa en el Word', () => {
  it('lleva la cita del decreto usado, sin avisos sobre la aplicación', async () => {
    const xml = await textoDelWord(conEstatal);
    expect(xml).toContain('Normativa curricular');
    expect(xml).toContain('Real Decreto 157/2022, de 1 de marzo');
    expect(xml).not.toMatch(/aún no tiene/);
  });

  it('una SdA sin normativa guardada no lleva esa fila', async () => {
    expect(await textoDelWord(base)).not.toContain('Normativa curricular');
  });
});

describe('sesiones de EF con preimpacto, impacto y postimpacto', () => {
  const act = (nombre: string) => ({ nombre, minutos: 10, descripcion: 'Se juega por parejas.', organizacion: 'Parejas', material: '1 balón' });
  const conMomentos: LearningSituation = {
    ...base, content: {
      ...base.content,
      sesiones: [{
        fase: 'Desarrollo', titulo: 'Pases', descripcion: 'Resumen de la sesión.',
        momentos: {
          preimpacto: { texto: 'Se colocan zonas.', actividades: [act('Pilla-pilla de cadenas')] },
          impacto: { texto: 'Progresión.', actividades: [act('Rondo de 4 contra 1')] },
          postimpacto: { texto: 'Puesta en común.', actividades: [act('Estiramientos en círculo')] },
        },
      }],
    },
  };

  it('el PDF lleva los tres momentos con sus actividades', () => {
    const html = buildSdaHtml(conMomentos, 'es');
    for (const x of ['PREIMPACTO', 'IMPACTO', 'POSTIMPACTO', 'Pilla-pilla de cadenas (10 min).', 'Rondo de 4 contra 1', 'Estiramientos en círculo']) expect(html).toContain(x);
  });

  it('el Word también, cada línea en su párrafo', async () => {
    const xml = await textoDelWord(conMomentos);
    for (const x of ['PREIMPACTO', 'Rondo de 4 contra 1 (10 min).', 'POSTIMPACTO']) expect(xml).toContain(x);
    // «PREIMPACTO» y la actividad no comparten párrafo
    expect(xml).not.toMatch(/PREIMPACTO\nSe colocan/);
  });

  it('una SdA de antes, con solo la descripción, sigue igual', () => {
    const html = buildSdaHtml({ ...base, content: { ...base.content, sesiones: [{ fase: 'Activación', titulo: 'Hola', descripcion: 'Solo la descripción.' }] } }, 'es');
    expect(html).toContain('Solo la descripción.');
    expect(html).not.toContain('PREIMPACTO');
  });
});

describe('imágenes en las sesiones', () => {
  // Un PNG de 1 píxel y un JPEG mínimo: lo que importa es que la imagen llegue al documento
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  const conImagenes = (imagenes: { id: string; src: string; ancho: number; alto: number; pie?: string }[]): LearningSituation => ({
    ...base, content: { ...base.content, sesiones: [
      { fase: 'Activación', titulo: 'Recuento', descripcion: 'Contar residuos', imagenes },
      { fase: 'Producto', titulo: 'Mercado', descripcion: 'Celebrarlo' },
    ] },
  });
  const una = { id: 'a', src: PNG, ancho: 600, alto: 400, pie: 'Cajas del recuento' };

  it('el PDF pone las imágenes de la sesión con su pie, y nada si no hay', () => {
    const html = buildSdaHtml(conImagenes([una]), 'es');
    expect(html).toContain('<div class="sda-imgs">');
    expect(html).toContain(`<img src="${PNG}" alt="Cajas del recuento">`);
    expect(html).toContain('<figcaption>Cajas del recuento</figcaption>');
    expect(html.match(/class="sda-imgs"/g)).toHaveLength(1);   // solo en la sesión que las tiene
    expect(buildSdaHtml(conImagenes([]), 'es')).not.toContain('<div class="sda-imgs">');
  });

  it('el PDF escapa el pie y deja fuera lo que no es una imagen guardada (SVG, direcciones web)', () => {
    const html = buildSdaHtml(conImagenes([
      { ...una, pie: '<b>"x"</b>' },
      { id: 'svg', src: 'data:image/svg+xml;base64,PHN2Zz4=', ancho: 1, alto: 1 },
      { id: 'web', src: 'https://x.com/a.png', ancho: 1, alto: 1 },
    ]), 'es');
    expect(html).not.toContain('<b>"x"</b>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('image/svg');
    expect(html).not.toContain('https://x.com/a.png');
    expect(html.match(/<figure>/g)).toHaveLength(1);
  });

  it('el Word lleva la imagen dentro del archivo, y el pie como texto', async () => {
    const zip = await JSZip.loadAsync(await (await buildSdaDocxBlob(conImagenes([una]), 'es')).arrayBuffer());
    const media = Object.keys(zip.files).filter(f => f.startsWith('word/media/') && !zip.files[f].dir);
    expect(media).toHaveLength(1);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Cajas del recuento');
    expect(xml).toContain('Imágenes');
    expect(xml).toContain('<w:drawing>');
  });

  it('el Word deja fuera el WebP (Word no lo admite) y no escribe la fila vacía', async () => {
    const zip = await JSZip.loadAsync(await (await buildSdaDocxBlob(conImagenes([{ id: 'w', src: WEBP, ancho: 10, alto: 10, pie: 'No sale' }]), 'es')).arrayBuffer());
    expect(Object.keys(zip.files).filter(f => f.startsWith('word/media/') && !zip.files[f].dir)).toHaveLength(0);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('No sale');
    expect(xml).not.toContain('<w:drawing>');
  });

  it('una SdA sin imágenes sigue igual: sin fila ni archivos de imagen', async () => {
    const zip = await JSZip.loadAsync(await (await buildSdaDocxBlob(conImagenes([]), 'es')).arrayBuffer());
    expect(Object.keys(zip.files).filter(f => f.startsWith('word/media/') && !zip.files[f].dir)).toHaveLength(0);
  });
});
