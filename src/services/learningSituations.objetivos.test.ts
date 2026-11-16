/**
 * Los objetivos de etapa de la SdA salen de la norma, no de la IA (16-11-2026, aviso del dueño: en la Comunitat
 * Valenciana salían resumidos o inventados, «a) Conocer y comprender las normas de convivencia», cuando el Decreto
 * 106/2022 tiene 17 numerados). La IA solo devuelve números o letras de la lista oficial; el texto lo pone la app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSda, type SdaRequest } from './learningSituations';
import { objetivosDeEtapa, objetivosElegidos } from '../lib/curriculum/objetivosEtapa';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});
beforeEach(() => callGemini.mockReset());

const BASE: SdaRequest = {
  idea: 'Un huerto en el colegio', numero: '1', temporalizacion: '3 semanas', meses: 'Noviembre',
  areas: ['Conocimiento del Medio'], numSesiones: 3, nivel: '5º de Primaria', contextoClase: '', metodologia: '', documentos: [],
};
const respuesta = (objetivosEtapa: unknown) => JSON.stringify({
  titulo: 't', justificacion: 'j', ods: 'o', objetivosEtapa, competenciasClave: 'CCL', explicacionCurricular: 'e', areas: [],
  inclusionUniversal: 'u', inclusionAdicional: 'a', inclusionIndividualizada: 'i', metodologia: 'm', agrupamiento: 'g',
  recursos: 'r', productoFinal: 'p', evaluacionTecnicas: 't', evaluacionInstrumentos: 'i', sesiones: [],
});

describe('los objetivos de etapa de cada norma', () => {
  it('Comunitat Valenciana: 17 en Primaria y 14 en la ESO, numerados, en castellano y en valenciano', () => {
    const pri = objetivosDeEtapa('comunitat-valenciana', 'primaria', 'es');
    expect(pri.objetivos.map(o => o.id)).toEqual(Array.from({ length: 17 }, (_, i) => String(i + 1)));
    expect(pri.numerado).toBe(true);
    expect(pri.cita).toMatch(/^Decreto 106\/2022/);
    expect(pri.objetivos[15].texto).toBe('Desarrollar hábitos de consumo responsable en el contexto de la educación para la sostenibilidad y la protección del medio ambiente, en el camino hacia la transición ecológica.');
    expect(pri.objetivos[16].texto).toBe('Promover actitudes de respeto entre todos los miembros de la comunidad educativa, así como la cooperación entre iguales.');
    const va = objetivosDeEtapa('comunitat-valenciana', 'primaria', 'ca');
    expect(va.cita).toMatch(/^Decret 106\/2022/);
    expect(va.objetivos[0].texto).toMatch(/^Conéixer i apreciar els valors i les normes de convivència/);
    expect(objetivosDeEtapa('comunitat-valenciana', 'eso', 'es').objetivos).toHaveLength(14);
  });

  it('el resto, los suyos: estatal (14 y 12), Madrid, Cataluña (en catalán) y Andalucía (con la «ñ»)', () => {
    const rd = objetivosDeEtapa('galicia', 'primaria', 'es');
    expect(rd.cita).toMatch(/^Real Decreto 157\/2022/);
    expect(rd.objetivos.map(o => o.id).join('')).toBe('abcdefghijklmn');
    expect(rd.objetivos[0].texto).toMatch(/^Conocer y apreciar los valores y las normas de convivencia, aprender a obrar de acuerdo con ellas de forma empática/);
    expect(objetivosDeEtapa('fuera', 'eso', 'en').objetivos).toHaveLength(12);
    expect(objetivosDeEtapa('madrid', 'primaria', 'es').objetivos[4].texto).toBe('Conocer y utilizar de manera apropiada la lengua española y desarrollar hábitos de lectura.');
    const ct = objetivosDeEtapa('cataluna', 'eso', 'es');
    expect(ct.objetivos).toHaveLength(17);
    expect(ct.cita).toMatch(/^Decret 175\/2022/);   // solo se publicó en catalán: no se traduce
    expect(objetivosDeEtapa('andalucia', 'primaria', 'es').objetivos.map(o => o.id).slice(-3)).toEqual(['n', 'ñ', 'o']);
    expect(objetivosDeEtapa('andalucia', 'eso', 'es').objetivos).toHaveLength(14);
  });

  it('de lo elegido, solo lo que existe, sin repetir y en el orden de la norma', () => {
    const cv = objetivosDeEtapa('comunitat-valenciana', 'primaria', 'es');
    expect(objetivosElegidos(['16', '1.', '99', '1', ' 12 '], cv).map(o => o.id)).toEqual(['1', '12', '16']);
    const rd = objetivosDeEtapa('madrid', 'eso', 'es');
    expect(objetivosElegidos(['K)', 'a', 'z'], rd).map(o => o.id)).toEqual(['a', 'k']);
    expect(objetivosElegidos('a, b', rd)).toEqual([]);
  });
});

describe('generateSda con los objetivos de etapa', () => {
  it('en la Comunitat Valenciana, la IA elige de la lista oficial y el texto sale palabra por palabra del decreto', async () => {
    callGemini.mockResolvedValueOnce(respuesta(['16', '1', '99']));
    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5, comunidad: 'comunitat-valenciana' }, 'es');
    const [system, user, , , opciones] = callGemini.mock.calls[0];
    expect(system).toContain('OBJETIVOS DE ETAPA');
    expect(user).toContain('OBJETIVOS DE ETAPA OFICIALES (Decreto 106/2022, de 5 de agosto, artículo 7)');
    expect(user).toContain('17. Promover actitudes de respeto entre todos los miembros de la comunidad educativa');
    expect(opciones.responseSchema.properties.objetivosEtapa.items.enum).toHaveLength(17);
    expect(sda!.objetivosEtapa.split('\n')).toEqual([
      '1. Conocer y apreciar los valores y las normas de convivencia, aprender a obrar de acuerdo con estas de manera empática, prepararse para el ejercicio activo de la ciudadanía y respetar los derechos humanos, así como el pluralismo propio de una sociedad democrática.',
      '16. Desarrollar hábitos de consumo responsable en el contexto de la educación para la sostenibilidad y la protección del medio ambiente, en el camino hacia la transición ecológica.',
      '(Decreto 106/2022, de 5 de agosto, artículo 7)',
    ]);
  });

  it('en valenciano, el texto en valenciano; y lo que la IA escriba por su cuenta no llega nunca', async () => {
    callGemini.mockResolvedValueOnce(respuesta(['5']));
    const va = await generateSda({ ...BASE, etapa: 'primaria', curso: 5, comunidad: 'comunitat-valenciana' }, 'ca');
    expect(va!.objetivosEtapa).toMatch(/^5\. Conéixer i utilitzar de manera adequada i efectiva/);
    callGemini.mockResolvedValueOnce(respuesta('a) Conocer y comprender las normas de convivencia.'));
    const inventado = await generateSda({ ...BASE, etapa: 'primaria', curso: 5, comunidad: 'comunitat-valenciana' }, 'es');
    expect(inventado!.objetivosEtapa).toBe('');
  });

  it('sin etapa no se sabe qué norma: sigue en texto libre, como antes', async () => {
    callGemini.mockResolvedValueOnce(respuesta('Texto libre'));
    const sda = await generateSda(BASE, 'es');
    const [, user, , , opciones] = callGemini.mock.calls[0];
    expect(user).not.toContain('OBJETIVOS DE ETAPA OFICIALES');
    expect(opciones.responseSchema.properties.objetivosEtapa.type).toBe('STRING');
    expect(sda!.objetivosEtapa).toBe('Texto libre');
  });
});
