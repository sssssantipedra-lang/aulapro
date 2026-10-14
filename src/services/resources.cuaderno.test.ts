/**
 * El diseño «Cuaderno» en lo que se le pide a la IA y en lo que devuelve: el
 * prompt, el esquema (con el recuadro solo en «Cuaderno»), la lista de
 * cálculos y la limpieza del recuadro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import { generateFicha, adaptFicha, cleanLineas, cleanRecuadro, TIPOS, type FichaContent, type FichaRequest } from './resources';

const req = (over: Partial<FichaRequest> = {}): FichaRequest => ({
  tema: 'Números hasta el millón', area: 'Matemáticas', nivel: '5º Primaria', numEjercicios: 4, niveles: false, contextoClase: '', ...over,
});

const respuesta = (over: Record<string, unknown> = {}) => JSON.stringify({
  titulo: 'Los números', explicacion: 'Repaso.', instrucciones: 'Resuelve.',
  actividades: [{
    titulo: 'Descomponemos',
    recuadro: { tipo: 'recuerda', texto: '', lista: ['CM = centena de millar', ' ', 'DM = decena de millar'] },
    ejercicios: [{ tipo: 'calculos', enunciado: 'Descompón:', lineas: ['583.742 = ', '75.830 ____', ''], respuesta: 'caja', solucion: '500.000 + …' }],
  }],
  ...over,
});

const esquema = () => callGemini.mock.calls[0][4].responseSchema;
const sistema = () => callGemini.mock.calls[0][0] as string;

beforeEach(() => callGemini.mockReset());

describe('generateFicha con el diseño «Cuaderno»', () => {
  it('pide el diseño, el tipo «calculos» y el recuadro; sin historia', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await generateFicha(req({ estilo: 'cuaderno' }), 'es');
    expect(sistema()).toContain('DISEÑO CUADERNO');
    expect(sistema()).toContain('"calculos"');
    expect(sistema()).not.toContain('HISTORIA:');
    const act = esquema().properties.actividades.items;
    expect(act.properties.recuadro.properties.tipo.enum).toEqual(['recuerda', 'reto', 'consejo']);
    expect(act.required).not.toContain('recuadro');
    expect(esquema().properties.historia).toBeUndefined();
    expect(f?.estilo).toBe('cuaderno');
    expect(f?.historia).toBeUndefined();
  });

  it('«calculos» es un tipo de ejercicio del esquema, con sus líneas y su respuesta', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req({ estilo: 'cuaderno' }), 'es');
    const ex = esquema().properties.actividades.items.properties.ejercicios.items;
    expect(ex.properties.tipo.enum).toContain('calculos');
    expect(TIPOS).toContain('calculos');
    expect(ex.properties.lineas.type).toBe('ARRAY');
    expect(ex.properties.respuesta.enum).toEqual(['linea', 'caja']);
  });

  it('limpia las líneas (sin «=», huecos ni líneas vacías) y el recuadro', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await generateFicha(req({ estilo: 'cuaderno' }), 'es');
    const act = f!.actividades[0];
    expect(act.ejercicios[0].lineas).toEqual(['583.742', '75.830']);
    expect(act.ejercicios[0].respuesta).toBe('caja');
    expect(act.recuadro).toEqual({ tipo: 'recuerda', texto: '', lista: ['CM = centena de millar', 'DM = decena de millar'] });
  });

  it('con «Clásica» o con historia no se pide el recuadro', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req({ estilo: 'clasico' }), 'es');
    expect(esquema().properties.actividades.items.properties.recuadro).toBeUndefined();
    expect(sistema()).not.toContain('DISEÑO CUADERNO');
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req({ estilo: 'espacio' }), 'es');
    expect(esquema().properties.actividades.items.properties.recuadro).toBeUndefined();
    expect(sistema()).toContain('HISTORIA:');
  });

  it('un escape room con «Cuaderno» deja que la IA elija un mundo, porque necesita historia', async () => {
    callGemini.mockResolvedValueOnce(respuesta({ estilo: 'selva', historia: { personaje: 'Lía', emoji: '🦁', mision: 'Sal.', cierre: 'Bien.', insignia: 'Exploradora' } }));
    const f = await generateFicha(req({ estilo: 'cuaderno', formato: 'escape' }), 'es');
    expect(sistema()).toContain('ESCAPE ROOM');
    expect(esquema().properties.estilo).toBeDefined();
    expect(f?.estilo).toBe('selva');
  });

  it('una versión adaptada de una ficha «Cuaderno» sigue siendo «Cuaderno»', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const original = { titulo: 'x', explicacion: '', instrucciones: '', estilo: 'cuaderno', actividades: [{ titulo: 'a', ejercicios: [] }] } as FichaContent;
    const f = await adaptFicha(original, req(), 'apoyo', 'es');
    expect(sistema()).toContain('DISEÑO CUADERNO');
    expect(esquema().properties.actividades.items.properties.recuadro).toBeDefined();
    expect(f?.estilo).toBe('cuaderno');
    expect(f?.variante).toBe('apoyo');
  });
});

describe('limpieza', () => {
  it('cleanLineas quita el «=» y los huecos del final, y las vacías', () => {
    expect(cleanLineas(['4 + 5 =', '7 + 1 = ___', '  ', '2^3'])).toEqual(['4 + 5', '7 + 1', '2³']);
    expect(cleanLineas(undefined)).toEqual([]);
    expect(cleanLineas(Array.from({ length: 12 }, (_, i) => String(i + 1)))).toHaveLength(8);
  });

  it('cleanRecuadro descarta lo que no tiene tipo válido o está vacío', () => {
    expect(cleanRecuadro(undefined)).toBeUndefined();
    expect(cleanRecuadro({ tipo: 'otro' as never, texto: 'x' })).toBeUndefined();
    expect(cleanRecuadro({ tipo: 'consejo', texto: '  ' })).toBeUndefined();
    expect(cleanRecuadro({ tipo: 'consejo', texto: ' Usa la regla ', lista: ['no sale'] })).toEqual({ tipo: 'consejo', texto: 'Usa la regla' });
    expect(cleanRecuadro({ tipo: 'recuerda', texto: '', lista: ['M = millón'] })).toEqual({ tipo: 'recuerda', texto: '', lista: ['M = millón'] });
  });
});
