/**
 * La IA marca `**así**` donde le parece, aunque solo se le pida en lectura fácil: al recibir la ficha, lo que la hoja
 * no pinta con negritas queda sin asteriscos, y lo que sí se pinta solo se conserva en lectura fácil.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import { generateFicha, type FichaRequest } from './resources';

const req = (over: Partial<FichaRequest> = {}): FichaRequest => ({
  tema: 'Los animales', area: 'Ciencias Naturales', nivel: '4º Primaria', numEjercicios: 2, niveles: false, contextoClase: '', estilo: 'cuaderno',
  revisar: false, hilo: 'ninguno', ...over,
});

const respuesta = () => JSON.stringify({
  titulo: 'Las **fracciones**', explicacion: 'Una **fracción** es parte de un todo.', instrucciones: '**Lee** y contesta.',
  actividades: [
    {
      titulo: 'Bloque **uno**',
      recuadro: { tipo: 'recuerda', texto: 'No olvides **esto**.', lista: ['**Primero**', 'Después'] },
      ejercicios: [
        { tipo: 'abierta', enunciado: '**Rodea** la **fracción**.', solucion: 'Es la **primera**' },
        { tipo: 'tabla_rellenar', enunciado: 'Completa.', columnas: ['**A**', 'B'], filas: [['**1**', ''], ['2', '']], solucion: '1' },
      ],
    },
  ],
});

beforeEach(() => callGemini.mockReset());

// El código puede añadir ejercicios propios (pizzas, dibujos): se busca cada uno por su tipo
const ej = (c: Awaited<ReturnType<typeof generateFicha>>, tipo: string) => c!.actividades.flatMap(a => a.ejercicios).find(e => e.tipo === tipo)!;

describe('los asteriscos de la IA al recibir la ficha', () => {
  it('sin lectura fácil: ninguno, en ningún campo', async () => {
    callGemini.mockResolvedValue(respuesta());
    const c = await generateFicha(req(), 'es');
    expect(JSON.stringify(c)).not.toContain('**');
    expect(c!.titulo).toBe('Las fracciones');
    expect(c!.actividades[0].titulo).toBe('Bloque uno');
    expect(c!.actividades[0].recuadro).toMatchObject({ texto: 'No olvides esto.', lista: ['Primero', 'Después'] });
  });

  it('en lectura fácil: se conservan las de enunciados, explicación e instrucciones y se quitan las demás', async () => {
    callGemini.mockResolvedValue(respuesta());
    const c = await generateFicha(req({ facil: true }), 'es');
    expect(c!.explicacion).toBe('Una **fracción** es parte de un todo.');
    expect(c!.instrucciones).toBe('**Lee** y contesta.');
    expect(ej(c, 'abierta').enunciado).toBe('**Rodea** la **fracción**.');
    // Lo que la hoja no pinta con negritas
    expect(c!.titulo).toBe('Las fracciones');
    expect(c!.actividades[0].titulo).toBe('Bloque uno');
    expect(c!.actividades[0].recuadro).toMatchObject({ texto: 'No olvides esto.', lista: ['Primero', 'Después'] });
    expect(ej(c, 'abierta').solucion).toBe('Es la primera');
    expect(ej(c, 'tabla_rellenar').columnas).toEqual(['A', 'B']);
    expect(ej(c, 'tabla_rellenar').filas).toEqual([['1', ''], ['2', '']]);
  });

  it('a la IA se le pide texto plano, salvo en lectura fácil, que pide sus propias negritas', async () => {
    callGemini.mockResolvedValue(respuesta());
    await generateFicha(req(), 'es');
    expect(callGemini.mock.calls[0][0] as string).toContain('sin Markdown');
    callGemini.mockClear();
    await generateFicha(req({ facil: true }), 'es');
    const facil = callGemini.mock.calls[0][0] as string;
    expect(facil).not.toContain('sin Markdown');
    expect(facil).toContain('doble asterisco');
  });
});
