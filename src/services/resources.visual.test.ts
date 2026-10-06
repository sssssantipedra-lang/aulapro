/**
 * Fichas con apoyos visuales: qué se le pide a la IA y qué se hace con lo que
 * devuelve (pictogramas del catálogo, cantidades razonables, pasos con verbo).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import { adaptFicha, generateFicha, type FichaContent, type FichaRequest } from './resources';

const req: FichaRequest = { tema: 'la frutería', area: 'Matemáticas', nivel: '3º de Primaria', numEjercicios: 2, niveles: false, contextoClase: '', estilo: 'clasico', visual: true };

const respuesta = {
  titulo: 'La frutería',
  explicacion: 'Contamos con palotes.',
  conceptos: [
    { picto: 'apple', titulo: 'Fruta', texto: 'Se puede contar.' },
    { picto: 'inventado', titulo: 'Palote', texto: 'Una raya es uno.' },
    { picto: 'x', titulo: '', texto: '' },
  ],
  instrucciones: 'Sigue los pasos.',
  actividades: [{
    titulo: 'Contamos',
    indicacion: 'Primero, mira. Luego, cuenta.',
    pasos: [
      { picto: 'eye', verbo: 'Mira', detalle: 'los dibujos' },
      { picto: 'no-existe', verbo: 'Cuenta', detalle: 'las frutas' },
      { picto: 'write', verbo: '', detalle: 'sin verbo no vale' },
    ],
    recuerda: [{ picto: '', texto: 'Cada palote vale uno.' }, { picto: 'apple', texto: '' }],
    ejercicios: [
      {
        tipo: 'abierta', enunciado: 'Cuenta las manzanas que ves.', consigna: 'count',
        imagenes: [{ picto: 'apple', cantidad: 40 }, { picto: 'tigre', cantidad: 2 }, { picto: 'banana', cantidad: 0 }],
        solucion: '10',
      },
      {
        tipo: 'tabla_rellenar', enunciado: 'Completa la tabla.', consigna: 'ap-tabla',
        columnas: ['Fruta', 'Total'], filas: [['Manzana', ''], ['Tigre', '']], pictosFilas: ['apple', 'tigre', 'banana'],
        solucion: '…',
      },
    ],
  }],
};

beforeEach(() => callGemini.mockReset());

describe('fichas con apoyos visuales', () => {
  it('pide pasos, consignas y tarjetas con las dos listas de pictogramas', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify(respuesta));
    await generateFicha(req, 'es');
    const [system, , , , opts] = callGemini.mock.calls[0];
    expect(system).toContain('APOYOS VISUALES');
    expect(system).toMatch(/CONSIGNAS: read-book \(Leer\)/);
    expect(system).toContain('ap-rodear (Rodear)');
    expect(system).toContain('apple (Manzana)');
    const actividad = opts.responseSchema.properties.actividades.items;
    expect(actividad.required).toEqual(expect.arrayContaining(['indicacion', 'pasos', 'recuerda']));
    expect(actividad.properties.ejercicios.items.required).toContain('consigna');
    expect(opts.responseSchema.required).toContain('conceptos');
  });

  it('sin apoyos visuales no se pide nada de esto', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify(respuesta));
    const c = await generateFicha({ ...req, visual: false }, 'es');
    const [system, , , , opts] = callGemini.mock.calls[0];
    expect(system).not.toContain('APOYOS VISUALES');
    expect(opts.responseSchema.properties.conceptos).toBeUndefined();
    // Y lo que llegue de más, se quita
    expect(c?.visual).toBeUndefined();
    expect(c?.actividades[0].pasos).toBeUndefined();
    expect(c?.actividades[0].ejercicios[0].consigna).toBeUndefined();
  });

  it('solo se quedan pictogramas del catálogo, con cantidades razonables', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify(respuesta));
    const c = (await generateFicha(req, 'es'))!;
    expect(c.visual).toBe(true);
    // Tarjetas: la del dibujo inventado se queda sin dibujo; la vacía, fuera
    expect(c.conceptos).toEqual([
      { picto: 'apple', titulo: 'Fruta', texto: 'Se puede contar.' },
      { picto: '', titulo: 'Palote', texto: 'Una raya es uno.' },
    ]);
    const act = c.actividades[0];
    expect(act.indicacion).toBe('Primero, mira. Luego, cuenta.');
    // El paso con un pictograma que no existe toma el de su verbo; sin verbo, fuera
    expect(act.pasos).toEqual([
      { picto: 'eye', verbo: 'Mira', detalle: 'los dibujos' },
      { picto: 'count', verbo: 'Cuenta', detalle: 'las frutas' },
    ]);
    expect(act.recuerda).toEqual([{ texto: 'Cada palote vale uno.' }]);
    const [ex1, ex2] = act.ejercicios;
    expect(ex1.consigna).toBe('count');
    expect(ex1.imagenes).toEqual([{ picto: 'apple', cantidad: 10 }, { picto: 'banana', cantidad: 1 }]);
    // Un dibujo por fila de la tabla, ni uno más; el que no existe, en blanco
    expect(ex2.pictosFilas).toEqual(['apple', '']);
  });

  it('«Versión visual» rehace la ficha con los apoyos y una ficha visual sigue siéndolo en sus otras versiones', async () => {
    const base: FichaContent = { titulo: 'La frutería', explicacion: '', instrucciones: '', actividades: [{ titulo: 'Contamos', ejercicios: [{ tipo: 'abierta', enunciado: '¿Cuántas?', solucion: '3' }] }] };
    callGemini.mockResolvedValueOnce(JSON.stringify(respuesta));
    const v = await adaptFicha(base, { ...req, visual: false }, 'visual', 'es');
    expect(callGemini.mock.calls[0][1]).toContain('CON APOYOS VISUALES');
    expect(v?.variante).toBe('visual');
    expect(v?.visual).toBe(true);

    callGemini.mockResolvedValueOnce(JSON.stringify(respuesta));
    const a = await adaptFicha({ ...base, visual: true }, req, 'apoyo', 'es');
    expect(callGemini.mock.calls[1][0]).toContain('APOYOS VISUALES');
    expect(a?.variante).toBe('apoyo');
    expect(a?.visual).toBe(true);
  });
});
