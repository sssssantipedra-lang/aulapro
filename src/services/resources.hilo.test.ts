/**
 * El hilo conductor en lo que se le pide a la IA y en lo que devuelve (ver
 * `lib/hilos.ts`): el hilo que se le pone a la ficha, la lista cerrada de
 * dibujos del prompt, el esquema, la limpieza de los dibujos y el dibujo de cada
 * bloque.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import {
  adaptFicha, asignarDibujosDeBloque, cleanDibujos, conHilo, generateFicha, resolverHilo, regenerateExercise,
  type FichaContent, type FichaRequest,
} from './resources';
import { hiloPorId } from '../lib/hilos';

const req = (over: Partial<FichaRequest> = {}): FichaRequest => ({
  tema: 'Los animales de la granja', area: 'Ciencias Naturales', nivel: '2º Primaria', numEjercicios: 4, niveles: false, contextoClase: '', estilo: 'cuaderno', ...over,
});

const ejercicio = (dibujos?: unknown) => ({ tipo: 'abierta', enunciado: 'Cuenta las vacas.', solucion: '5', ...(dibujos ? { dibujos } : {}) });
const respuesta = (dibujos?: unknown) => JSON.stringify({
  titulo: 'La granja', explicacion: 'Repaso.', instrucciones: 'Cuenta.',
  actividades: [
    { titulo: 'Cuenta', ejercicios: [ejercicio(dibujos), ejercicio()] },
    { titulo: 'Piensa', ejercicios: [ejercicio()] },
  ],
});

const sistema = () => callGemini.mock.calls[0][0] as string;
const esquema = () => callGemini.mock.calls[0][4].responseSchema;
const esquemaEj = () => esquema().properties.actividades.items.properties.ejercicios.items;

beforeEach(() => callGemini.mockReset());

describe('el hilo de una ficha nueva', () => {
  it('«Cuaderno» sin apoyos visuales lleva el hilo que encaja con el tema', () => {
    expect(resolverHilo({ tema: 'Los animales de la granja', area: 'Ciencias Naturales' }, 'cuaderno', 'ficha', false)?.id).toBe('granja');
    expect(resolverHilo({ tema: 'Las fracciones', area: 'Matemáticas' }, 'cuaderno', 'ficha', false)?.id).toBe('fracciones-reparto');
  });

  it('un identificador lo fija, «ninguno» lo quita y uno que no existe vuelve a la detección', () => {
    expect(resolverHilo({ tema: 'Las fracciones', hilo: 'espacio' }, 'cuaderno', 'ficha', false)?.id).toBe('espacio');
    expect(resolverHilo({ tema: 'Las fracciones', hilo: 'ninguno' }, 'cuaderno', 'ficha', false)).toBeUndefined();
    expect(resolverHilo({ tema: 'Las fracciones', hilo: 'inventado' }, 'cuaderno', 'ficha', false)?.id).toBe('fracciones-reparto');
    expect(resolverHilo({ tema: 'Las fracciones', hilo: 'auto' }, 'cuaderno', 'ficha', false)?.id).toBe('fracciones-reparto');
  });

  it('con otro tema, con tarjetas, con escape room o con apoyos visuales no hay hilo', () => {
    const r = { tema: 'Las fracciones', area: 'Matemáticas' };
    expect(resolverHilo(r, 'clasico', 'ficha', false)).toBeUndefined();
    expect(resolverHilo(r, 'espacio', 'ficha', false)).toBeUndefined();
    expect(resolverHilo(r, 'cuaderno', 'tarjetas', false)).toBeUndefined();
    expect(resolverHilo(r, 'cuaderno', 'escape', false)).toBeUndefined();
    expect(resolverHilo(r, 'cuaderno', 'ficha', true)).toBeUndefined();
  });
});

describe('generateFicha con hilo conductor', () => {
  it('le dice a la IA el hilo y le da la lista cerrada de dibujos, marcando los que no se repiten', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req(), 'es');
    const s = sistema();
    expect(s).toContain('HILO CONDUCTOR');
    expect(s).toContain('«La granja»');
    expect(s).toContain('ani-vaca (');
    expect(s).toContain('lug-granja [solo 1] (');
    // No le da los de otros hilos
    expect(s).not.toContain('esp-cohete');
  });

  it('el esquema de cada ejercicio admite «dibujos» (identificador y cantidad), nunca obligatorios', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req(), 'es');
    const dib = esquemaEj().properties.dibujos;
    expect(dib.type).toBe('ARRAY');
    expect(dib.items.required).toEqual(['ilustracion', 'cantidad']);
    expect(esquemaEj().required).not.toContain('dibujos');
  });

  it('guarda el hilo en la ficha y le pone a cada bloque su dibujo, distinto en cada uno', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await generateFicha(req(), 'es');
    expect(f?.hilo).toBe('granja');
    const dibujos = f!.actividades.map(a => a.dibujo);
    expect(dibujos.every(Boolean)).toBe(true);
    expect(new Set(dibujos).size).toBe(dibujos.length);
    // Los de la cabecera (los tres primeros del hilo) no se repiten en los bloques
    const cabecera = hiloPorId('granja')!.dibujos.slice(0, 3);
    expect(dibujos.some(d => cabecera.includes(d!))).toBe(false);
  });

  it('comprueba los dibujos: solo los del catálogo, sin repetir, cantidad de 1 a 10, y 1 en los que no se cuentan', async () => {
    callGemini.mockResolvedValueOnce(respuesta([
      { ilustracion: 'ani-vaca', cantidad: 5 },
      { ilustracion: 'ani-vaca', cantidad: 2 },
      { ilustracion: 'inventado', cantidad: 3 },
      { ilustracion: 'ani-cerdo', cantidad: 99 },
      { ilustracion: 'lug-granja', cantidad: 4 },
      { ilustracion: 'ani-oveja', cantidad: 0 },
    ]));
    const f = await generateFicha(req(), 'es');
    expect(f!.actividades[0].ejercicios[0].dibujos).toEqual([
      { ilustracion: 'ani-vaca', cantidad: 5 },
      { ilustracion: 'ani-cerdo', cantidad: 10 },
      { ilustracion: 'lug-granja', cantidad: 1 },
    ]);
    expect(f!.actividades[0].ejercicios[1].dibujos).toBeUndefined();
  });

  it('con «ninguno» no pide dibujos, no lleva hilo y quita los que la IA ponga igualmente', async () => {
    callGemini.mockResolvedValueOnce(respuesta([{ ilustracion: 'ani-vaca', cantidad: 2 }]));
    const f = await generateFicha(req({ hilo: 'ninguno' }), 'es');
    expect(sistema()).not.toContain('HILO CONDUCTOR');
    expect(esquemaEj().properties.dibujos).toBeUndefined();
    expect(f?.hilo).toBeUndefined();
    expect(f!.actividades[0].ejercicios[0].dibujos).toBeUndefined();
    expect(f!.actividades.every(a => !a.dibujo)).toBe(true);
  });

  it('con apoyos visuales usa sus pictogramas y no el hilo', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await generateFicha(req({ visual: true }), 'es');
    expect(sistema()).not.toContain('HILO CONDUCTOR');
    expect(f?.hilo).toBeUndefined();
  });

  it('un hilo elegido por el docente manda sobre el tema', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await generateFicha(req({ hilo: 'espacio' }), 'es');
    expect(sistema()).toContain('«El Sistema Solar y el espacio»');
    expect(f?.hilo).toBe('espacio');
  });
});

describe('cleanDibujos', () => {
  it('sin lista o con basura, nada', () => {
    expect(cleanDibujos(undefined)).toBeUndefined();
    expect(cleanDibujos([])).toBeUndefined();
    expect(cleanDibujos([{ ilustracion: '' }, { ilustracion: 'cab-fracciones' }] as never)).toBeUndefined();
  });
});

describe('conHilo y los dibujos de bloque', () => {
  const base = (): FichaContent => ({
    titulo: 'T', explicacion: '', instrucciones: '', estilo: 'cuaderno',
    actividades: [
      { titulo: 'A', ejercicios: [{ tipo: 'abierta', enunciado: 'x', solucion: '', dibujos: [{ ilustracion: 'com-sandia', cantidad: 2 }] }] },
      { titulo: 'B', ejercicios: [{ tipo: 'abierta', enunciado: 'y', solucion: '' }] },
    ],
  });

  it('cambiar de hilo cambia la cabecera y los bloques, y deja los dibujos de los ejercicios', () => {
    const c = conHilo(base(), 'fracciones-reparto');
    expect(c.hilo).toBe('fracciones-reparto');
    expect(c.actividades.map(a => a.dibujo)).toEqual(expect.arrayContaining([expect.any(String)]));
    const otro = conHilo(c, 'granja');
    expect(otro.hilo).toBe('granja');
    expect(otro.actividades[0].dibujo).not.toBe(c.actividades[0].dibujo);
    expect(otro.actividades[0].ejercicios[0].dibujos).toEqual([{ ilustracion: 'com-sandia', cantidad: 2 }]);
  });

  it('un bloque no repite como adorno el dibujo que ya usa en sus ejercicios', () => {
    const hilo = hiloPorId('fracciones-reparto')!;
    const c = base();
    // La sandía es el primero de los candidatos (el 4.º del hilo): el bloque 0 salta al siguiente
    const [a0] = asignarDibujosDeBloque(c.actividades, hilo);
    expect(a0.dibujo).not.toBe('com-sandia');
    expect(hilo.dibujos).toContain(a0.dibujo);
  });

  it('sin hilo, o con uno que no existe, se quitan el hilo y los dibujos de bloque', () => {
    const c = conHilo(base(), 'granja');
    for (const id of [undefined, 'inventado']) {
      const sin = conHilo(c, id);
      expect(sin.hilo).toBeUndefined();
      expect(sin.actividades.every(a => !a.dibujo)).toBe(true);
    }
  });
});

describe('las demás llamadas conservan el hilo', () => {
  const conHiloGranja = (): FichaContent => conHilo({
    titulo: 'La granja', explicacion: '', instrucciones: '', estilo: 'cuaderno',
    actividades: [{ titulo: 'Cuenta', ejercicios: [{ tipo: 'abierta', enunciado: 'Cuenta las vacas.', solucion: '5', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 5 }] }] }],
  }, 'granja');

  it('la versión de apoyo sigue con el mismo hilo y los mismos dibujos', async () => {
    callGemini.mockResolvedValueOnce(respuesta([{ ilustracion: 'ani-vaca', cantidad: 3 }]));
    const f = await adaptFicha(conHiloGranja(), req(), 'apoyo', 'es');
    expect(sistema()).toContain('HILO CONDUCTOR');
    expect(f?.hilo).toBe('granja');
    expect(f?.actividades[0].ejercicios[0].dibujos).toEqual([{ ilustracion: 'ani-vaca', cantidad: 3 }]);
  });

  it('la versión visual deja el hilo y usa pictogramas', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await adaptFicha(conHiloGranja(), req(), 'visual', 'es');
    expect(sistema()).not.toContain('HILO CONDUCTOR');
    expect(f?.hilo).toBeUndefined();
  });

  it('rehacer un ejercicio lo hace con los dibujos del hilo de la ficha', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify(ejercicio([{ ilustracion: 'ani-cerdo', cantidad: 4 }, { ilustracion: 'esp-cohete', cantidad: 2 }])));
    const ex = await regenerateExercise(conHiloGranja(), req(), 0, 0, { instruccion: 'otro distinto' }, 'es');
    expect(sistema()).toContain('«La granja»');
    expect(callGemini.mock.calls[0][4].responseSchema.properties.dibujos).toBeDefined();
    // Un dibujo de otro hilo que exista en el catálogo se admite: lo comprueba el catálogo, no el hilo
    expect(ex?.dibujos?.map(d => d.ilustracion)).toEqual(['ani-cerdo', 'esp-cohete']);
  });
});
