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
