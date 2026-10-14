/**
 * El hilo conductor en lo que se le pide a la IA y en lo que devuelve (ver
 * `lib/hilos.ts`): el hilo que se le pone a la ficha, la lista cerrada de
 * dibujos del prompt, el esquema, la limpieza de los dibujos y los tipos de
 * ejercicio que viven de ellos (contar, etiquetar, clasificar).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import {
  adaptFicha, cleanDibujos, conHilo, generateFicha, resolverHilo, regenerateExercise,
  type FichaContent, type FichaRequest,
} from './resources';

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

  it('guarda el hilo en la ficha, sin dibujos sueltos de adorno en los bloques', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    const f = await generateFicha(req(), 'es');
    expect(f?.hilo).toBe('granja');
    expect(f!.actividades.every(a => !('dibujo' in a))).toBe(true);
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

describe('conHilo', () => {
  const base = (): FichaContent => ({
    titulo: 'T', explicacion: '', instrucciones: '', estilo: 'cuaderno',
    actividades: [
      { titulo: 'A', ejercicios: [{ tipo: 'abierta', enunciado: 'x', solucion: '', dibujos: [{ ilustracion: 'com-sandia', cantidad: 2 }] }] },
      { titulo: 'B', ejercicios: [{ tipo: 'abierta', enunciado: 'y', solucion: '' }] },
    ],
  });

  it('cambiar de hilo cambia la cabecera y deja los dibujos de los ejercicios', () => {
    const c = conHilo(base(), 'fracciones-reparto');
    expect(c.hilo).toBe('fracciones-reparto');
    const otro = conHilo(c, 'granja');
    expect(otro.hilo).toBe('granja');
    expect(otro.actividades[0].ejercicios[0].dibujos).toEqual([{ ilustracion: 'com-sandia', cantidad: 2 }]);
  });

  it('sin hilo, o con uno que no existe, se quita el hilo', () => {
    const c = conHilo(base(), 'granja');
    for (const id of [undefined, 'inventado']) expect(conHilo(c, id).hilo).toBeUndefined();
  });
});

const un = (ex: unknown) => JSON.stringify({ titulo: 'F', explicacion: '', instrucciones: '', actividades: [{ titulo: 'B', ejercicios: [ex] }] });
const ej = async (ex: unknown, lang: 'es' | 'ca' | 'en' = 'es', r: Partial<FichaRequest> = {}) => {
  callGemini.mockResolvedValueOnce(un(ex));
  return (await generateFicha(req(r), lang))!.actividades[0].ejercicios[0];
};

describe('los tipos con dibujos: «contar», «etiquetar» y «clasificar»', () => {
  it('el esquema los ofrece solo con hilo, y con sus campos', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req(), 'es');
    const props = esquemaEj().properties;
    expect(props.tipo.enum).toEqual(expect.arrayContaining(['contar', 'etiquetar', 'clasificar']));
    expect(props.categorias.items.required).toEqual(['nombre', 'dibujos']);
    expect(props.total.type).toBe('BOOLEAN');
    expect(props.banco.type).toBe('BOOLEAN');
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req({ hilo: 'ninguno' }), 'es');
    expect(esquemaEj().properties.tipo.enum).not.toContain('contar');
    expect(esquemaEj().properties.categorias).toBeUndefined();
  });

  it('el prompt explica cada tipo y que cada dibujo lleva su espacio', async () => {
    callGemini.mockResolvedValueOnce(respuesta());
    await generateFicha(req(), 'es');
    const s = sistema();
    expect(s).toContain('SU espacio para contestar');
    for (const x of ['"contar"', '"etiquetar"', '"clasificar"', '"relacionar" y "tabla_rellenar"']) expect(s).toContain(x);
  });

  it('«contar»: solo grupos que se pueden contar, y la solución la calcula el código', async () => {
    const e = await ej({
      tipo: 'contar', enunciado: 'Cuenta.', total: true, solucion: 'LO QUE DIGA LA IA',
      dibujos: [{ ilustracion: 'ani-vaca', cantidad: 4 }, { ilustracion: 'lug-granja', cantidad: 3 }, { ilustracion: 'ani-cerdo', cantidad: 3 }],
    });
    expect(e.tipo).toBe('contar');
    expect(e.dibujos).toEqual([{ ilustracion: 'ani-vaca', cantidad: 4 }, { ilustracion: 'ani-cerdo', cantidad: 3 }]);
    expect(e.total).toBe(true);
    expect(e.solucion).toBe('vaca: 4; cerdo: 3; Total: 7');
  });

  it('«contar» con un solo grupo no pide total; en catalán y en inglés la solución usa su idioma', async () => {
    const e = await ej({ tipo: 'contar', enunciado: 'Cuenta.', total: true, solucion: '', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 5 }] }, 'en');
    expect(e.total).toBeUndefined();
    expect(e.solucion).toBe('cow: 5');
    expect((await ej({ tipo: 'contar', enunciado: 'Cuenta.', solucion: '', dibujos: [{ ilustracion: 'ani-pez', cantidad: 2 }] }, 'ca')).solucion).toBe('peix: 2');
  });

  it('«contar» sin nada que contar pasa a pregunta abierta, no sale rota', async () => {
    const e = await ej({ tipo: 'contar', enunciado: 'Cuenta.', solucion: '3', dibujos: [{ ilustracion: 'lug-granja', cantidad: 3 }] });
    expect(e.tipo).toBe('abierta');
    expect(e.total).toBeUndefined();
    expect((await ej({ tipo: 'contar', enunciado: 'Cuenta.', solucion: '3' })).tipo).toBe('abierta');
  });

  it('«etiquetar»: de 2 a 8 dibujos con nombres distintos, cantidad 1, y la solución son los nombres', async () => {
    const e = await ej({
      tipo: 'etiquetar', enunciado: 'Nombra.', banco: true, solucion: '',
      dibujos: ['ani-perro', 'ani-gato', 'cue-corazon', 'val-corazon', 'ani-perro', 'inventado'].map(ilustracion => ({ ilustracion, cantidad: 5 })),
    });
    expect(e.tipo).toBe('etiquetar');
    // «corazón» del cuerpo y de los valores se llaman igual: solo uno
    expect(e.dibujos).toEqual([{ ilustracion: 'ani-perro', cantidad: 1 }, { ilustracion: 'ani-gato', cantidad: 1 }, { ilustracion: 'cue-corazon', cantidad: 1 }]);
    expect(e.banco).toBe(true);
    expect(e.solucion).toBe('1. perro, 2. gato, 3. corazón');
    const una = await ej({ tipo: 'etiquetar', enunciado: 'Nombra.', solucion: '', dibujos: [{ ilustracion: 'ani-perro', cantidad: 1 }] });
    expect(una.tipo).toBe('abierta');
  });

  it('«clasificar»: grupos con sus dibujos sin repetir; la solución sale de la mezcla numerada', async () => {
    const e = await ej({
      tipo: 'clasificar', enunciado: 'Clasifica.', solucion: '',
      categorias: [
        { nombre: 'Domésticos', dibujos: ['ani-vaca', 'ani-perro', 'ani-gato'] },
        { nombre: 'Salvajes', dibujos: ['ani-leon', 'ani-vaca', 'inventado', 'ani-jirafa'] },
        { nombre: '', dibujos: ['ani-cebra'] },
      ],
    });
    expect(e.tipo).toBe('clasificar');
    expect(e.categorias).toEqual([
      { nombre: 'Domésticos', dibujos: ['ani-vaca', 'ani-perro', 'ani-gato'] },
      { nombre: 'Salvajes', dibujos: ['ani-leon', 'ani-jirafa'] },
    ]);
    expect(e.dibujos).toBeUndefined();
    // Cada número aparece exactamente una vez en la solución
    const numeros = e.solucion.match(/\d+/g)!.map(Number).sort();
    expect(numeros).toEqual([1, 2, 3, 4, 5]);
    expect(e.solucion).toMatch(/^Domésticos: [\d, ]+; Salvajes: [\d, ]+$/);
  });

  it('«clasificar» con menos de dos grupos o menos de cuatro dibujos pasa a pregunta abierta', async () => {
    expect((await ej({ tipo: 'clasificar', enunciado: 'C.', solucion: '', categorias: [{ nombre: 'A', dibujos: ['ani-vaca', 'ani-gato', 'ani-perro', 'ani-leon'] }] })).tipo).toBe('abierta');
    expect((await ej({ tipo: 'clasificar', enunciado: 'C.', solucion: '', categorias: [{ nombre: 'A', dibujos: ['ani-vaca'] }, { nombre: 'B', dibujos: ['ani-gato'] }] })).tipo).toBe('abierta');
  });

  it('sin hilo (o con apoyos visuales) los tres tipos pasan a pregunta abierta y se quitan sus campos', async () => {
    const e = await ej({ tipo: 'contar', enunciado: 'Cuenta.', solucion: '', total: true, dibujos: [{ ilustracion: 'ani-vaca', cantidad: 4 }] }, 'es', { hilo: 'ninguno' });
    expect(e.tipo).toBe('abierta');
    expect(e.dibujos).toBeUndefined();
    expect(e.total).toBeUndefined();
    const v = await ej({ tipo: 'clasificar', enunciado: 'C.', solucion: '', categorias: [{ nombre: 'A', dibujos: ['ani-vaca'] }] }, 'es', { visual: true });
    expect(v.tipo).toBe('abierta');
    expect(v.categorias).toBeUndefined();
  });

  it('«relacionar» y las tablas: un dibujo por elemento o ninguno; con la longitud mal, se quitan', async () => {
    const r = await ej({ tipo: 'relacionar', enunciado: 'Une.', solucion: '', izquierda: ['a', 'b', 'c'], derecha: ['x', 'y', 'z'], dibujos: [{ ilustracion: 'ani-vaca', cantidad: 3 }, { ilustracion: 'inventado', cantidad: 1 }, { ilustracion: 'ani-cerdo', cantidad: 1 }] });
    // La cantidad se ignora (1) y el dibujo que no existe queda en blanco: la posición no se pierde
    expect(r.dibujos).toEqual([{ ilustracion: 'ani-vaca', cantidad: 1 }, { ilustracion: '', cantidad: 1 }, { ilustracion: 'ani-cerdo', cantidad: 1 }]);
    const mal = await ej({ tipo: 'relacionar', enunciado: 'Une.', solucion: '', izquierda: ['a', 'b', 'c'], derecha: ['x', 'y', 'z'], dibujos: [{ ilustracion: 'ani-vaca', cantidad: 1 }] });
    expect(mal.dibujos).toBeUndefined();
    const t = await ej({ tipo: 'tabla_rellenar', enunciado: 'T.', solucion: '', columnas: ['A', 'B'], filas: [['x', ''], ['y', '']], dibujos: [{ ilustracion: 'com-pera', cantidad: 1 }, { ilustracion: 'com-fresa', cantidad: 1 }] });
    expect(t.dibujos).toHaveLength(2);
  });

  it('rehacer o añadir un ejercicio también calcula la solución de estos tipos', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ tipo: 'contar', enunciado: 'Cuenta.', solucion: 'x', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 6 }] }));
    const f = conHilo({ titulo: 'F', explicacion: '', instrucciones: '', estilo: 'cuaderno', actividades: [{ titulo: 'B', ejercicios: [{ tipo: 'abierta', enunciado: 'a', solucion: '' }] }] }, 'granja');
    const ex = await regenerateExercise(f, req(), 0, 0, { instruccion: 'cuenta vacas', tipo: 'contar' }, 'es');
    expect(ex?.solucion).toBe('vaca: 6');
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
