/**
 * Las pizzas y tartas por fracciones (ver `lib/fraccionesDibujo.ts`) en lo que se le pide a la IA y en lo
 * que devuelve: cuándo se ofrecen, el esquema y el prompt, la limpieza de las figuras, la solución que
 * calcula el código y los ejercicios en los que el enunciado y el dibujo no coinciden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import {
  addExercise, admiteFracciones, generateFicha, hablaDeFigurasSinFiguras, problemaDeEjercicio, regenerateExercise, tiposDisponibles,
  type FichaContent, type FichaExercise, type FichaRequest,
} from './resources';

const req = (over: Partial<FichaRequest> = {}): FichaRequest => ({
  tema: 'Los números decimales y las fracciones', area: 'Matemáticas', nivel: '5º Primaria', numEjercicios: 6, niveles: false, contextoClase: '', estilo: 'cuaderno',
  revisar: false, ...over,
});

const F = (partes: number, tomadas: number, objeto?: string) => ({ partes, tomadas, ...(objeto ? { objeto } : {}) });
const un = (ex: unknown) => JSON.stringify({ titulo: 'F', explicacion: '', instrucciones: '', actividades: [
  { titulo: 'A', dificultad: 1, ejercicios: [ex, { tipo: 'abierta', enunciado: 'x', solucion: 'x' }] },
  { titulo: 'B', dificultad: 2, ejercicios: [{ tipo: 'abierta', enunciado: 'y', solucion: 'y' }, { tipo: 'abierta', enunciado: 'y2', solucion: 'y' }] },
  { titulo: 'C', dificultad: 3, ejercicios: [{ tipo: 'abierta', enunciado: 'z', solucion: 'z' }, { tipo: 'abierta', enunciado: 'z2', solucion: 'z' }] },
] });
/** El primer ejercicio que devuelve la IA, ya limpio. */
const ej = async (ex: unknown, r: Partial<FichaRequest> = {}): Promise<FichaExercise> => {
  callGemini.mockResolvedValueOnce(un(ex));
  return (await generateFicha(req(r), 'es'))!.actividades[0].ejercicios[0];
};

const sistema = (i = 0) => callGemini.mock.calls[i][0] as string;
const usuario = (i = 0) => callGemini.mock.calls[i][1] as string;
const esquemaEj = (i = 0) => callGemini.mock.calls[i][4].responseSchema.properties.actividades.items.properties.ejercicios.items;

beforeEach(() => callGemini.mockReset());

describe('cuándo se ofrecen las pizzas', () => {
  it('«Cuaderno», una ficha normal, sin apoyos visuales y con un tema de fracciones, decimales o repartos', () => {
    const base = { estilo: 'cuaderno' as const, formato: 'ficha' as const, visual: false };
    for (const tema of ['Las fracciones', 'Los números decimales', 'Porcentajes', 'Repartir en partes iguales', 'La proporcionalidad', 'Números racionales']) {
      expect(admiteFracciones(base, { tema, area: 'Matemáticas' })).toBe(true);
    }
    expect(admiteFracciones(base, { tema: 'El cuerpo humano', area: 'Ciencias Naturales' })).toBe(false);
    expect(admiteFracciones(base, { tema: 'La Edad Media', area: 'Ciencias Sociales' })).toBe(false);
    expect(admiteFracciones({ ...base, estilo: 'clasico' }, { tema: 'Las fracciones', area: '' })).toBe(false);
    expect(admiteFracciones({ ...base, visual: true }, { tema: 'Las fracciones', area: '' })).toBe(false);
    expect(admiteFracciones({ ...base, formato: 'escape' }, { tema: 'Las fracciones', area: '' })).toBe(false);
    expect(admiteFracciones({ ...base, formato: 'tarjetas' }, { tema: 'Las fracciones', area: '' })).toBe(false);
  });

  it('los tipos disponibles: «fracciones» solo con el permiso, los de dibujos solo con hilo', () => {
    expect(tiposDisponibles({ dibujos: false, fracciones: false })).not.toContain('fracciones');
    expect(tiposDisponibles({ dibujos: false, fracciones: false })).not.toContain('contar');
    expect(tiposDisponibles({ dibujos: false, fracciones: true })).toContain('fracciones');
    expect(tiposDisponibles({ dibujos: false, fracciones: true })).not.toContain('contar');
    expect(tiposDisponibles({ dibujos: true, fracciones: true })).toEqual(expect.arrayContaining(['fracciones', 'contar', 'etiquetar', 'clasificar']));
    expect(tiposDisponibles({ dibujos: true, fracciones: false })).not.toContain('fracciones');
  });
});

describe('lo que se le pide a la IA', () => {
  it('con un tema de fracciones: el prompt explica las pizzas y el esquema trae su campo y su tipo', async () => {
    callGemini.mockResolvedValueOnce(un({ tipo: 'abierta', enunciado: 'x', solucion: 'x' }));
    await generateFicha(req(), 'es');
    expect(sistema()).toContain('FRACCIONES DIBUJADAS');
    expect(sistema()).toContain('en blanco y negro y separados del resto');
    expect(sistema()).toContain('pizzas con distinto número de trozos (2, 3, 4, 5, 6, 7, 8, 9, 10)');
    expect(sistema()).toContain('solo con 2, 4, 5, 8 o 10 trozos');
    const ej = esquemaEj();
    expect(ej.properties.tipo.enum).toContain('fracciones');
    expect(ej.properties.fracciones.items.properties.partes.type).toBe('INTEGER');
    expect(ej.properties.fracciones.items.properties.objeto.enum).toEqual(['pizza', 'tarta']);
    expect(ej.properties.modo.enum).toEqual(['leer', 'colorear', 'unir']);
    expect(ej.properties.decimal.type).toBe('BOOLEAN');
  });

  it('con otro tema o con otro diseño, nada de esto', async () => {
    for (const r of [{ tema: 'El cuerpo humano', area: 'Ciencias Naturales' }, { estilo: 'clasico' as const }]) {
      callGemini.mockReset();
      callGemini.mockResolvedValueOnce(un({ tipo: 'abierta', enunciado: 'x', solucion: 'x' }));
      await generateFicha(req(r), 'es');
      expect(sistema()).not.toContain('FRACCIONES DIBUJADAS');
      expect(esquemaEj().properties.fracciones).toBeUndefined();
      expect(esquemaEj().properties.tipo.enum).not.toContain('fracciones');
    }
  });

  it('con hilo de fracciones, la pizza del catálogo (trozos desiguales) no se ofrece a la IA', async () => {
    callGemini.mockResolvedValueOnce(un({ tipo: 'abierta', enunciado: 'x', solucion: 'x' }));
    await generateFicha(req({ tema: 'Las fracciones', hilo: 'fracciones-reparto' }), 'es');
    const lista = sistema().split('DIBUJOS DEL HILO')[1];
    expect(lista).not.toContain('mat-pizza');
    expect(lista).not.toContain('mat-grafico-tarta');
    expect(lista).toContain('com-tarta');
    // sin pizzas dibujadas por la aplicación, sigue la del catálogo
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(un({ tipo: 'abierta', enunciado: 'x', solucion: 'x' }));
    await generateFicha(req({ tema: 'Las fracciones', hilo: 'fracciones-reparto', estilo: 'cuaderno', visual: false, area: 'Matemáticas', formato: 'ficha' }), 'es');
  });
});

describe('la limpieza del ejercicio «fracciones»', () => {
  it('conserva las figuras válidas y calcula la solución con sus números', async () => {
    const x = await ej({ tipo: 'fracciones', enunciado: 'Escribe la fracción.', fracciones: [F(8, 3), F(5, 2, 'tarta'), F(4, 1, 'pizza')], modo: 'leer', decimal: true, solucion: 'inventada' });
    expect(x.tipo).toBe('fracciones');
    expect(x.fracciones).toEqual([{ partes: 8, tomadas: 3 }, { partes: 5, tomadas: 2, objeto: 'tarta' }, { partes: 4, tomadas: 1, objeto: 'pizza' }]);
    expect(x.modo).toBe('leer');
    expect(x.decimal).toBe(true);
    expect(x.solucion).toBe('A: 3/8 = 0,375; B: 2/5 = 0,4; C: 1/4 = 0,25');
  });

  it('descarta las figuras imposibles: de 2 a 12 trozos y de 0 a todos cogidos, enteros', async () => {
    const x = await ej({ tipo: 'fracciones', enunciado: 'Cuenta.', fracciones: [F(1, 1), F(13, 2), F(6, 7), F(6, -1), F(7, 2), { partes: 'ocho', tomadas: 3 }, null, F(6.4, 2)], solucion: '' });
    // F(6.4, 2) se redondea a 6 trozos: es válida
    // Con solo dos válidas, el código añade una tercera (una pizza de 2 trozos que aún no está)
    expect(x.fracciones).toEqual([{ partes: 7, tomadas: 2 }, { partes: 6, tomadas: 2 }, { partes: 2, tomadas: 1 }]);
  });

  it('sin ninguna figura válida, pasa a pregunta abierta y no sale rota', async () => {
    // con un tema que no pide pizzas, para que la receta de fracciones no entre a sustituirlo
    const x = await ej({ tipo: 'fracciones', enunciado: 'Cuenta las pizzas.', fracciones: [F(1, 1)], solucion: 'x' }, { tema: 'La multiplicación' });
    expect(x.tipo).toBe('abierta');
    expect(x.fracciones).toBeUndefined();
    expect(x.modo).toBeUndefined();
  });

  it('como mucho cuatro figuras en el ejercicio y tres en la figura de un enunciado', async () => {
    const x = await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(2, 1), F(3, 1), F(4, 1), F(5, 1), F(6, 1)], solucion: '' });
    expect(x.fracciones).toHaveLength(4);
    const y = await ej({ tipo: 'problema', enunciado: 'Una pizza de 8 trozos, se comen 3: 5 quedan.', fracciones: [F(8, 3), F(8, 5), F(4, 1), F(5, 1)], solucion: '5/8' });
    expect(y.fracciones).toHaveLength(3);
  });

  it('el decimal solo si todas las figuras lo tienen exacto, y nunca al colorear', async () => {
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3), F(3, 1)], decimal: true, solucion: '' })).decimal).toBeUndefined();
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3), F(2, 1)], decimal: true, modo: 'colorear', solucion: '' })).decimal).toBeUndefined();
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3), F(2, 1)], decimal: true, modo: 'unir', solucion: '' })).decimal).toBe(true);
  });

  it('un modo que no existe vale «leer»; «unir» con una sola figura se completa y sigue siendo «unir»', async () => {
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3)], modo: 'saltar', solucion: '' })).modo).toBe('leer');
    const unir = await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3)], modo: 'unir', solucion: '' });
    expect(unir.modo).toBe('unir');
    expect(unir.fracciones).toHaveLength(3);
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3), F(4, 1)], modo: 'unir', solucion: '' })).modo).toBe('unir');
  });

  it('cómo se ven los cogidos: solo los valores que existen', async () => {
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3)], cogidos: 'bn', solucion: '' })).cogidos).toBe('bn');
    expect((await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3)], cogidos: 'rojo', solucion: '' })).cogidos).toBeUndefined();
  });

  it('con otro diseño (o apoyos visuales) no hay figuras y el ejercicio pasa a abierta', async () => {
    const x = await ej({ tipo: 'fracciones', enunciado: 'a', fracciones: [F(8, 3)], solucion: 'x' }, { estilo: 'clasico' });
    expect(x.tipo).toBe('abierta');
    expect(x.fracciones).toBeUndefined();
  });

  it('en la figura de un enunciado, las figuras se quedan, sin modo ni decimal', async () => {
    const y = await ej({ tipo: 'problema', enunciado: 'Una pizza de 8 trozos. Ana come 3.', fracciones: [F(8, 3)], modo: 'unir', decimal: true, solucion: '3/8' });
    expect(y.tipo).toBe('problema');
    expect(y.fracciones).toEqual([{ partes: 8, tomadas: 3 }]);
    expect(y.modo).toBeUndefined();
    expect(y.decimal).toBeUndefined();
    expect(y.solucion).toBe('3/8');
  });

  it('solo los tipos con enunciado largo llevan la pizza al lado: un verdadero o falso o una tabla no', async () => {
    expect((await ej({ tipo: 'verdadero_falso', enunciado: 'a', afirmaciones: ['a'], fracciones: [F(8, 3)], solucion: 'V' })).fracciones).toBeUndefined();
    expect((await ej({ tipo: 'tabla_rellenar', enunciado: 'a', columnas: ['a', 'b'], filas: [['1', '']], fracciones: [F(8, 3)], solucion: '' })).fracciones).toBeUndefined();
    for (const tipo of ['problema', 'abierta', 'completar', 'opcion_multiple']) {
      expect((await ej({ tipo, enunciado: 'Una pizza de 8 trozos ______', opciones: ['a', 'b', 'c'], fracciones: [F(8, 3)], solucion: 'x' })).fracciones).toEqual([{ partes: 8, tomadas: 3 }]);
    }
  });

  it('la pizza del catálogo no ilustra un enunciado de trozos cuando hay pizzas dibujadas por la aplicación', async () => {
    const x = await ej({ tipo: 'problema', enunciado: 'Una pizza se corta en 8 trozos iguales. ¿Qué fracción es un trozo?', dibujos: [{ ilustracion: 'mat-pizza', cantidad: 1 }], solucion: '1/8' }, { hilo: 'fracciones-reparto' });
    expect(x.dibujos).toBeUndefined();
    // una pregunta que no habla de trozos conserva su dibujo
    const y = await ej({ tipo: 'abierta', enunciado: '¿Qué comida es más popular en tu casa?', dibujos: [{ ilustracion: 'mat-pizza', cantidad: 1 }], solucion: 'x' }, { hilo: 'fracciones-reparto' });
    expect(y.dibujos).toHaveLength(1);
  });
});

describe('ejercicios en los que el enunciado y el dibujo no coinciden', () => {
  const ex = (o: Record<string, unknown>) => ({ tipo: 'problema', enunciado: 'x', solucion: '', ...o }) as never;

  it('«fracciones» con todas las pizzas del mismo número de trozos, o con dos iguales, es roto', () => {
    expect(problemaDeEjercicio(ex({ tipo: 'fracciones', fracciones: [F(8, 3), F(8, 5)] }), false)).toContain('distinto número de trozos');
    expect(problemaDeEjercicio(ex({ tipo: 'fracciones', fracciones: [F(8, 3), F(5, 3), F(8, 3)] }), false)).toContain('distinto número de trozos');
    expect(problemaDeEjercicio(ex({ tipo: 'fracciones', fracciones: [F(8, 3), F(5, 3)] }), false)).toBeUndefined();
    expect(problemaDeEjercicio(ex({ tipo: 'fracciones', fracciones: [F(8, 3)] }), false)).toBeUndefined();
  });

  it('un enunciado que dice «8 trozos» con una figura de 6 es roto; con los números de la figura, no', () => {
    const fig = [F(8, 3)];
    expect(problemaDeEjercicio(ex({ enunciado: 'Una pizza de 6 trozos: Ana come 3. ¿Qué fracción queda?', fracciones: fig }), false)).toContain('6 trozos');
    expect(problemaDeEjercicio(ex({ enunciado: 'Una pizza de 8 trozos: Ana come 3. ¿Qué fracción queda?', fracciones: fig }), false)).toBeUndefined();
    // los trozos que se comen, y los que quedan, son números de la figura
    expect(problemaDeEjercicio(ex({ enunciado: 'Quedan 5 trozos de 8 porciones.', fracciones: fig }), false)).toBeUndefined();
    expect(problemaDeEjercicio(ex({ enunciado: 'Se reparte en 9 partes iguales.', fracciones: fig }), false)).toContain('9 trozos');
    // sin figura, o sin número de trozos, no hay nada que comprobar
    expect(problemaDeEjercicio(ex({ enunciado: 'Una pizza de 6 trozos.' }), false)).toBeUndefined();
    expect(problemaDeEjercicio(ex({ enunciado: 'Compara las pizzas A y B.', fracciones: fig }), false)).toBeUndefined();
  });

  it('con varias figuras vale cualquiera de sus números', () => {
    const fig = [F(8, 3), F(5, 2)];
    expect(problemaDeEjercicio(ex({ enunciado: 'La pizza A tiene 8 trozos y la B, 5 trozos.', fracciones: fig }), false)).toBeUndefined();
    expect(problemaDeEjercicio(ex({ enunciado: 'La pizza A tiene 8 trozos y la B, 6 trozos.', fracciones: fig }), false)).toContain('6 trozos');
  });

  it('generateFicha rehace el ejercicio y la nueva versión sustituye a la rota', async () => {
    callGemini
      .mockResolvedValueOnce(un({ tipo: 'problema', enunciado: 'Una pizza de 6 trozos: Ana come 3. ¿Qué fracción ha comido?', fracciones: [F(8, 3)], solucion: '3/6' }))
      .mockResolvedValueOnce(JSON.stringify({ tipo: 'problema', enunciado: 'Una pizza de 8 trozos: Ana come 3. ¿Qué fracción ha comido?', fracciones: [F(8, 3)], solucion: '3/8' }));
    const f = await generateFicha(req(), 'es');
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(usuario(1)).toContain('habla de 6 trozos');
    expect(f!.actividades[0].ejercicios[0].enunciado).toContain('8 trozos');
  });
});

describe('rehacer y añadir un ejercicio con pizzas', () => {
  const conPizzas = async (r: Partial<FichaRequest> = {}): Promise<FichaContent> => {
    callGemini.mockResolvedValueOnce(un({ tipo: 'fracciones', enunciado: 'Escribe la fracción.', fracciones: [F(8, 3), F(5, 2)], solucion: '' }));
    const f = (await generateFicha(req(r), 'es'))!;
    callGemini.mockReset();
    return f;
  };

  it('rehacer ofrece las pizzas aunque el tema ya no las admita, si el ejercicio las lleva', async () => {
    const f = await conPizzas();
    callGemini.mockResolvedValueOnce(JSON.stringify({ tipo: 'fracciones', enunciado: 'Otra vez.', fracciones: [F(10, 7), F(4, 3)], solucion: '' }));
    const nuevo = await regenerateExercise(f, { tema: 'Otro tema', area: '', nivel: '5º Primaria' }, 0, 0, { instruccion: 'otras pizzas' }, 'es');
    expect(sistema()).toContain('FRACCIONES DIBUJADAS');
    expect(callGemini.mock.calls[0][4].responseSchema.properties.fracciones).toBeDefined();
    expect(nuevo!.fracciones).toEqual([{ partes: 10, tomadas: 7 }, { partes: 4, tomadas: 3 }, { partes: 2, tomadas: 1 }]);
    expect(nuevo!.solucion).toBe('A: 7/10; B: 3/4; C: 1/2');
  });

  it('en una ficha de otro tema y sin pizzas, rehacer no las ofrece', async () => {
    callGemini.mockResolvedValueOnce(un({ tipo: 'abierta', enunciado: 'x', solucion: 'x' }));
    const f = (await generateFicha(req({ tema: 'El cuerpo humano', area: 'Ciencias Naturales' }), 'es'))!;
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(JSON.stringify({ tipo: 'abierta', enunciado: 'otra', solucion: 'x' }));
    await regenerateExercise(f, { tema: 'El cuerpo humano', area: 'Ciencias Naturales', nivel: '5º Primaria' }, 0, 0, { instruccion: 'otra' }, 'es');
    expect(sistema()).not.toContain('FRACCIONES DIBUJADAS');
  });

  it('añadir un ejercicio a un bloque de un tema de fracciones puede traer pizzas', async () => {
    const f = await conPizzas();
    callGemini.mockResolvedValueOnce(JSON.stringify({ tipo: 'fracciones', enunciado: 'Colorea.', fracciones: [F(6, 5), F(9, 4)], modo: 'colorear', solucion: '' }));
    const nuevo = await addExercise(f, req(), 1, { tipo: 'fracciones' }, 'es');
    expect(callGemini.mock.calls[0][4].responseSchema.properties.tipo.enum).toContain('fracciones');
    expect(nuevo!.tipo).toBe('fracciones');
    expect(nuevo!.solucion).toBe('A: 5 de 6 trozos; B: 4 de 9 trozos; C: 1 de 2 trozos');
  });
});

describe('la revisión sabe de las pizzas', () => {
  it('el prompt de la revisión pide que enunciado y figuras coincidan', async () => {
    callGemini.mockResolvedValueOnce(un({ tipo: 'abierta', enunciado: 'x', solucion: 'x' })).mockResolvedValueOnce(JSON.stringify({ problemas: [] }));
    await generateFicha(req({ revisar: true }), 'es');
    expect(sistema(1)).toContain('"fracciones" (pizzas o tartas que dibuja la aplicación');
    expect(sistema(1)).toContain('una pizza de 8 trozos de la que se comen 3 es 3/8, no 3/5');
  });

  it('a la revisión le llegan las figuras del ejercicio', async () => {
    callGemini
      .mockResolvedValueOnce(un({ tipo: 'fracciones', enunciado: 'Escribe la fracción.', fracciones: [F(8, 3), F(5, 2)], solucion: '' }))
      .mockResolvedValueOnce(JSON.stringify({ problemas: [] }));
    await generateFicha(req({ revisar: true }), 'es');
    expect(usuario(1)).toContain('"fracciones":[{"partes":8,"tomadas":3},{"partes":5,"tomadas":2},{"partes":2,"tomadas":1}]');
  });
});

describe('la receta de un tema de fracciones: siempre hay pizzas', () => {
  const todos = (f: FichaContent) => f.actividades.flatMap(a => a.ejercicios);
  const ficha = (b1: unknown[], b2: unknown[] = [{ tipo: 'ordenar', enunciado: 'o', elementos: ['1', '2'], solucion: '1,2' }, { tipo: 'problema', enunciado: 'p 3 + 4', solucion: '7' }]) => JSON.stringify({
    titulo: 'F', explicacion: '', instrucciones: '',
    actividades: [
      { titulo: 'A', dificultad: 1, ejercicios: b1 },
      { titulo: 'B', dificultad: 2, ejercicios: b2 },
      { titulo: 'C', dificultad: 3, ejercicios: [{ tipo: 'abierta', enunciado: 'razona', solucion: 'x' }, { tipo: 'abierta', enunciado: 'razona 2', solucion: 'x' }] },
    ],
  });

  it('«escribe la fracción de la parte coloreada de cada figura» sin ninguna figura: lo monta el código, sin otra llamada a la IA', async () => {
    callGemini.mockResolvedValueOnce(ficha([
      { tipo: 'abierta', enunciado: 'Escribe la fracción que representa la parte coloreada de cada figura y exprésala también como número decimal.', solucion: 'x' },
      { tipo: 'completar', enunciado: 'El 0,5 es ______.', solucion: 'la mitad' },
    ]));
    const f = (await generateFicha(req(), 'es'))!;
    expect(callGemini).toHaveBeenCalledTimes(1);
    const x = f.actividades[0].ejercicios[0];
    expect(x.tipo).toBe('fracciones');
    expect(x.modo).toBe('leer');
    expect(x.decimal).toBe(true);
    expect(x.fracciones!.length).toBeGreaterThanOrEqual(3);
    expect(new Set(x.fracciones!.map(g => g.partes)).size).toBe(x.fracciones!.length);
    expect(x.solucion).toMatch(/^A: \d+\/\d+ = /);
    // lo demás queda como estaba
    expect(f.actividades[0].ejercicios[1].enunciado).toBe('El 0,5 es ______.');
  });

  it('si la IA no puso pizzas, el código sustituye una pregunta abierta de los bloques 1 y 2, la que ya hablaba de fracciones', async () => {
    callGemini.mockResolvedValueOnce(ficha([
      { tipo: 'abierta', enunciado: 'Escribe tu nombre.', solucion: 'x' },
      { tipo: 'completar', enunciado: 'La fracción 1/2 se lee ______.', solucion: 'un medio' },
    ]));
    const f = (await generateFicha(req(), 'es'))!;
    expect(todos(f).filter(x => x.tipo === 'fracciones')).toHaveLength(1);
    expect(f.actividades[0].ejercicios[0].tipo).toBe('abierta');
    expect(f.actividades[0].ejercicios[1].tipo).toBe('fracciones');
    // el bloque 3 no se toca
    expect(f.actividades[2].ejercicios.every(x => x.tipo === 'abierta')).toBe(true);
  });

  it('con un tema de decimales pide el decimal; con otro de fracciones, no', async () => {
    callGemini.mockResolvedValueOnce(ficha([{ tipo: 'abierta', enunciado: 'a', solucion: 'x' }, { tipo: 'abierta', enunciado: 'b', solucion: 'x' }]));
    expect(todos((await generateFicha(req({ tema: 'Los números decimales' }), 'es'))!).find(x => x.tipo === 'fracciones')!.decimal).toBe(true);
    callGemini.mockResolvedValueOnce(ficha([{ tipo: 'abierta', enunciado: 'a', solucion: 'x' }, { tipo: 'abierta', enunciado: 'b', solucion: 'x' }]));
    expect(todos((await generateFicha(req({ tema: 'Las fracciones' }), 'es'))!).find(x => x.tipo === 'fracciones')!.decimal).toBeUndefined();
  });

  it('si ya hay pizzas, no se añade nada', async () => {
    callGemini.mockResolvedValueOnce(ficha([
      { tipo: 'fracciones', enunciado: 'Escribe.', fracciones: [F(8, 3), F(5, 2)], solucion: '' },
      { tipo: 'abierta', enunciado: 'a', solucion: 'x' },
    ]));
    const f = (await generateFicha(req(), 'es'))!;
    expect(todos(f).filter(x => x.tipo === 'fracciones')).toHaveLength(1);
    expect(f.actividades[0].ejercicios[0].fracciones).toEqual([{ partes: 8, tomadas: 3 }, { partes: 5, tomadas: 2 }, { partes: 2, tomadas: 1 }]);
    expect(f.actividades[0].ejercicios[1].enunciado).toBe('a');
  });

  it('una figura suelta en un problema también cuenta', async () => {
    callGemini.mockResolvedValueOnce(ficha([{ tipo: 'abierta', enunciado: 'a', solucion: 'x' }], [
      { tipo: 'problema', enunciado: 'Una pizza de 8 trozos, Ana come 3.', fracciones: [F(8, 3)], solucion: '3/8' }, { tipo: 'abierta', enunciado: 'b', solucion: 'x' },
    ]));
    const f = (await generateFicha(req(), 'es'))!;
    expect(todos(f).filter(x => x.tipo === 'fracciones')).toHaveLength(0);
    expect(f.actividades[0].ejercicios[0].enunciado).toBe('a');
  });

  it('sin candidato (nada abierto en los bloques 1 y 2) no se toca nada', async () => {
    callGemini.mockResolvedValueOnce(ficha([{ tipo: 'calculos', enunciado: 'c', lineas: ['1/2'], solucion: '0,5' }, { tipo: 'verdadero_falso', enunciado: 'v', afirmaciones: ['a'], solucion: 'V' }]));
    const f = (await generateFicha(req(), 'es'))!;
    expect(todos(f).some(x => x.tipo === 'fracciones')).toBe(false);
  });

  it('solo con un tema de fracciones y en «Cuaderno»', async () => {
    for (const r of [{ tema: 'El cuerpo humano', area: 'Ciencias Naturales' }, { estilo: 'clasico' as const }]) {
      callGemini.mockReset();
      callGemini.mockResolvedValueOnce(ficha([{ tipo: 'abierta', enunciado: 'a', solucion: 'x' }, { tipo: 'abierta', enunciado: 'b', solucion: 'x' }]));
      expect(todos((await generateFicha(req(r), 'es'))!).some(x => x.tipo === 'fracciones')).toBe(false);
    }
  });

  it('hablaDeFigurasSinFiguras: solo cuando remite a algo dibujado que no está', () => {
    const e = (o: Record<string, unknown>) => ({ tipo: 'abierta', enunciado: '', solucion: '', ...o }) as FichaExercise;
    expect(hablaDeFigurasSinFiguras(e({ enunciado: 'Escribe la fracción que representa la parte coloreada de cada figura.' }))).toBe(true);
    expect(hablaDeFigurasSinFiguras(e({ enunciado: 'Observa las pizzas y escribe qué fracción se ha comido.' }))).toBe(true);
    expect(hablaDeFigurasSinFiguras(e({ enunciado: 'Mira la figura de arriba.' }))).toBe(true);
    expect(hablaDeFigurasSinFiguras(e({ enunciado: 'Cada pizza se corta en 8 trozos iguales. ¿Qué fracción es un trozo?' }))).toBe(false);
    expect(hablaDeFigurasSinFiguras(e({ enunciado: 'Escribe la parte coloreada de cada figura.', fracciones: [F(8, 3)] }))).toBe(false);
    expect(hablaDeFigurasSinFiguras(e({ enunciado: 'Observa la figura.', figura: { forma: 'rectangulo', medidas: [] } }))).toBe(false);
    expect(hablaDeFigurasSinFiguras(e({ tipo: 'verdadero_falso', enunciado: 'Observa las pizzas.' }))).toBe(false);
  });
});
