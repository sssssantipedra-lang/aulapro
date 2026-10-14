/**
 * La escalera de dificultad en lo que se le pide a la IA y en lo que devuelve (ver
 * `lib/escalera.ts`): el reparto por bloques que decide el código, el ajuste por
 * curso (5.º y 6.º suben), el ejemplo guía, el orden «de menos a más» de lo que
 * contesta la IA y la revisión de la ficha con rehacer los ejercicios graves.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import {
  addExercise, adaptFicha, generateFicha, generateFichaFromSda, regenerateExercise, revisarFicha,
  type FichaContent, type FichaRequest,
} from './resources';
import type { SdaContent } from './learningSituations';

const req = (over: Partial<FichaRequest> = {}): FichaRequest => ({
  tema: 'Los decimales', area: 'Matemáticas', nivel: '6º Primaria', numEjercicios: 6, niveles: false, contextoClase: '', estilo: 'cuaderno',
  revisar: false, ...over,
});

const ej = (enunciado = 'Calcula 4,5 + 2,25.') => ({ tipo: 'abierta', enunciado, solucion: '6,75' });
const bloque = (titulo: string, dificultad?: number, n = 2) => ({
  titulo, ...(dificultad === undefined ? {} : { dificultad }), ejercicios: Array.from({ length: n }, (_, i) => ej(`${titulo} ${i + 1}`)),
});
const ficha = (actividades: unknown[]) => JSON.stringify({ titulo: 'Decimales', explicacion: 'Repaso.', instrucciones: 'Resuelve.', actividades });
const buena = () => ficha([bloque('Calculamos', 1), bloque('Resolvemos', 2), bloque('Razonamos', 3)]);

const sistema = (i = 0) => callGemini.mock.calls[i][0] as string;
const usuario = (i = 0) => callGemini.mock.calls[i][1] as string;
const esquema = (i = 0) => callGemini.mock.calls[i][4].responseSchema;

beforeEach(() => callGemini.mockReset());

describe('el reparto lo decide el código', () => {
  it('el prompt trae la escalera con los bloques, su nivel y cuántos ejercicios lleva cada uno', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req(), 'es');
    const s = sistema();
    expect(s).toContain('ESCALERA DE DIFICULTAD (obligatoria)');
    expect(s).toContain('EXACTAMENTE 3 bloques');
    expect(s).toMatch(/Bloque 1 · "dificultad": 1 \(para empezar\) · 2 ejercicios/);
    expect(s).toMatch(/Bloque 2 · "dificultad": 2 \(para practicar\) · 2 ejercicios/);
    expect(s).toMatch(/Bloque 3 · "dificultad": 3 \(para retarte\) · 2 ejercicios/);
    expect(usuario()).toContain('EXACTAMENTE 3 bloques de menos a más dificultad (2 + 2 + 2 ejercicios)');
  });

  it('el esquema pide el nivel de cada bloque y fija el número de bloques', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ numEjercicios: 7 }), 'es');
    const acts = esquema().properties.actividades;
    expect(acts.minItems).toBe(3);
    expect(acts.maxItems).toBe(3);
    expect(acts.items.required).toContain('dificultad');
    expect(acts.items.properties.dificultad.type).toBe('INTEGER');
    expect(usuario()).toContain('(2 + 3 + 2 ejercicios)');
  });

  it('con pocos ejercicios, la escalera se reduce', async () => {
    callGemini.mockResolvedValueOnce(ficha([bloque('A', 1, 1), bloque('B', 3, 1)]));
    await generateFicha(req({ numEjercicios: 2 }), 'es');
    expect(esquema().properties.actividades.minItems).toBe(2);
    expect(sistema()).toMatch(/Bloque 1 · "dificultad": 1/);
    expect(sistema()).toMatch(/Bloque 2 · "dificultad": 3/);
  });

  it('las tarjetas no llevan escalera', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ titulo: 'T', instrucciones: 'i', tarjetas: [{ pregunta: 'p', respuesta: 'r' }] }));
    await generateFicha(req({ formato: 'tarjetas', numEjercicios: 12 }), 'es');
    expect(sistema()).not.toContain('ESCALERA');
    expect(esquema().properties.actividades).toBeUndefined();
  });

  it('el escape room también sube de nivel, sala a sala', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({
      estilo: 'espacio', titulo: 'E', historia: { personaje: 'P', emoji: '🚀', mision: 'm', cierre: 'c', insignia: 'i' }, explicacion: 'x', instrucciones: 'i',
      actividades: [1, 2, 3].map(d => ({ ...bloque(`Sala ${d}`, d), emoji: '🚀', narrativa: 'n', candado: { codigo: '123', pista: 'p' } })),
    }));
    const f = await generateFicha(req({ formato: 'escape', estilo: 'espacio' }), 'es');
    expect(usuario()).toContain('EXACTAMENTE 3 salas');
    expect(f!.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
  });

  it('también por la vía de la situación de aprendizaje, con el curso de la clase', async () => {
    callGemini.mockResolvedValueOnce(buena());
    const sda = { titulo: 'Las rebajas', areas: [{ area: 'Matemáticas', saberesBasicos: 'porcentajes', criteriosEvaluacion: '1.1' }] } as unknown as SdaContent;
    await generateFichaFromSda(sda, 'Matemáticas', { numEjercicios: 6, niveles: false, detalles: '', estilo: 'cuaderno', nivel: '5º Primaria', revisar: false }, 'es');
    expect(sistema()).toContain('ESCALERA DE DIFICULTAD');
    expect(sistema()).toContain('NIVEL ALTO');
    expect(usuario()).toContain('Curso o nivel: 5º Primaria');
  });
});

describe('lo que devuelve la IA se deja de menos a más', () => {
  it('ordena los bloques por nivel sin perder ninguno', async () => {
    callGemini.mockResolvedValueOnce(ficha([bloque('Razonamos', 3), bloque('Calculamos', 1), bloque('Resolvemos', 2)]));
    const f = await generateFicha(req(), 'es');
    expect(f!.actividades.map(a => a.titulo)).toEqual(['Calculamos', 'Resolvemos', 'Razonamos']);
    expect(f!.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(f!.actividades.every(a => a.ejercicios.length === 2)).toBe(true);
  });

  it('si no trae los niveles, o todos iguales, los reparte por posición', async () => {
    callGemini.mockResolvedValueOnce(ficha([bloque('A'), bloque('B'), bloque('C')]));
    expect((await generateFicha(req(), 'es'))!.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    callGemini.mockResolvedValueOnce(ficha([bloque('A', 2), bloque('B', 2), bloque('C', 2)]));
    expect((await generateFicha(req(), 'es'))!.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
  });

  it('un nivel fuera de rango o en texto no vale', async () => {
    callGemini.mockResolvedValueOnce(ficha([bloque('A', 9), bloque('B', 2), bloque('C', 3)]));
    expect((await generateFicha(req(), 'es'))!.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
  });

  it('las versiones adaptadas conservan el peldaño de cada bloque', async () => {
    callGemini.mockResolvedValueOnce(buena());
    const original = (await generateFicha(req(), 'es'))!;
    callGemini.mockResolvedValueOnce(ficha([bloque('A'), bloque('B'), bloque('C')]));
    const apoyo = await adaptFicha(original, req(), 'apoyo', 'es');
    expect(apoyo!.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(apoyo!.actividades.map(a => a.titulo)).toEqual(['A', 'B', 'C']);
  });
});

describe('5.º y 6.º suben de nivel', () => {
  it('el prompt de 5.º y 6.º lleva el aviso y lo que se pide en cada peldaño con el nivel del ciclo', async () => {
    for (const nivel of ['5º Primaria', '6º de Primaria']) {
      callGemini.mockReset();
      callGemini.mockResolvedValueOnce(buena());
      await generateFicha(req({ nivel }), 'es');
      expect(sistema()).toContain('NIVEL ALTO');
      expect(sistema()).toContain('sube un punto');
      expect(sistema()).toContain('decimales (décimas y centésimas)');
      expect(sistema()).toContain('problemas de tres pasos');
    }
  });

  it('4.º y los demás cursos no llevan el aviso', async () => {
    for (const nivel of ['4º Primaria', '2º Primaria', '1º ESO', '']) {
      callGemini.mockReset();
      callGemini.mockResolvedValueOnce(buena());
      await generateFicha(req({ nivel }), 'es');
      expect(sistema()).not.toContain('NIVEL ALTO');
      expect(sistema()).toContain('ESCALERA DE DIFICULTAD');
    }
  });

  it('los números de los datos se ajustan al curso: 6.º en miles, 2.º en decenas', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ nivel: '6º Primaria' }), 'es');
    const alto = /entre (\d+) y (\d+)/.exec(usuario())!;
    expect(Number(alto[2])).toBeGreaterThanOrEqual(20000);
    expect(usuario()).toContain('decimales');
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ nivel: '2º Primaria' }), 'es');
    const bajo = /entre (\d+) y (\d+)/.exec(usuario())!;
    expect(Number(bajo[2])).toBeLessThanOrEqual(99);
  });
});

describe('en ciencias, 5.º y 6.º suben sin convertirlo en cálculo', () => {
  it('sin cifras de seis cifras ni rango de números, pero con el aviso de nivel alto', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ tema: 'El cuerpo humano: los órganos y sus funciones', area: 'Ciencias Naturales', nivel: '6º Primaria' }), 'es');
    expect(sistema()).toContain('NIVEL ALTO');
    expect(sistema()).toContain('vocabulario técnico del tema, definiciones precisas');
    expect(sistema()).not.toContain('decimales (décimas y centésimas)');
    expect(usuario()).toContain('DATOS: si algún ejercicio lleva números');
    expect(usuario()).not.toContain('VARIEDAD NUMÉRICA');
  });

  it('en matemáticas, el rango y los decimales', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ tema: 'Los decimales', area: 'Matemáticas', nivel: '6º Primaria' }), 'es');
    expect(usuario()).toContain('VARIEDAD NUMÉRICA');
    expect(sistema()).toContain('decimales (décimas y centésimas)');
  });

  it('rehacer un ejercicio y la revisión usan el mismo criterio', async () => {
    callGemini.mockResolvedValueOnce(buena());
    const f = (await generateFicha(req({ tema: 'El cuerpo humano', area: 'Ciencias Naturales', nivel: '6º Primaria' }), 'es'))!;
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(JSON.stringify(ej()));
    await regenerateExercise(f, { tema: 'El cuerpo humano', area: 'Ciencias Naturales', nivel: '6º Primaria' }, 0, 0, { instruccion: 'otro' }, 'es');
    expect(usuario()).toContain('Sin cálculos, salvo que el tema los pida');
    expect(usuario()).toContain('DATOS:');
  });
});

describe('la receta de 1.º y 2.º con hilo conductor: contar y rotular', () => {
  const abierta = (t: string) => ({ tipo: 'abierta', enunciado: t, solucion: 'x' });
  const dosAbiertas = (n = 3) => ficha([1, 2, 3].map(d => ({ titulo: `B${d}`, dificultad: d, ejercicios: Array.from({ length: n - 1 }, (_, i) => abierta(`Pregunta ${d}.${i + 1}`)) })));
  const granja = (o: Partial<FichaRequest> = {}) => req({ nivel: '2º Primaria', tema: 'Los animales de la granja', area: 'Ciencias Naturales', ...o });

  it('si la IA solo dio preguntas abiertas, el código monta un «contar» y un «etiquetar» con los dibujos del hilo', async () => {
    callGemini.mockResolvedValueOnce(dosAbiertas());
    const f = (await generateFicha(granja(), 'es'))!;
    const todos = f.actividades.flatMap(a => a.ejercicios);
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(todos.filter(x => x.tipo === 'contar')).toHaveLength(1);
    expect(todos.filter(x => x.tipo === 'etiquetar')).toHaveLength(1);
    const contar = todos.find(x => x.tipo === 'contar')!;
    expect(contar.total).toBe(true);
    expect(contar.dibujos!.map(d => d.ilustracion)).toEqual(['ani-vaca', 'ani-cerdo']);
    expect(new Set(contar.dibujos!.map(d => d.cantidad)).size).toBe(2);
    expect(contar.solucion).toMatch(/^vaca: \d; cerdo: \d; Total: \d+$/);
    const etiq = todos.find(x => x.tipo === 'etiquetar')!;
    expect(etiq.banco).toBe(true);
    expect(etiq.dibujos).toHaveLength(4);
    // sustituyen a preguntas del nivel 1 y 2, nunca del 3: las demás quedan
    expect(f.actividades[2].ejercicios.every(x => x.tipo === 'abierta')).toBe(true);
    expect(todos).toHaveLength(6);
  });

  it('si ya hay dos ejercicios con dibujos, no se toca nada', async () => {
    callGemini.mockResolvedValueOnce(ficha([
      { titulo: 'A', dificultad: 1, ejercicios: [{ tipo: 'contar', enunciado: 'Cuenta.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 3 }, { ilustracion: 'ani-oveja', cantidad: 5 }], total: true, solucion: '' }, abierta('x')] },
      { titulo: 'B', dificultad: 2, ejercicios: [{ tipo: 'etiquetar', enunciado: 'Rotula.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 1 }, { ilustracion: 'ani-cerdo', cantidad: 1 }, { ilustracion: 'ani-pato', cantidad: 1 }], solucion: '' }, abierta('y')] },
      { titulo: 'C', dificultad: 3, ejercicios: [abierta('z'), abierta('w')] },
    ]));
    const f = (await generateFicha(granja(), 'es'))!;
    expect(f.actividades[0].ejercicios[1].enunciado).toBe('x');
    expect(f.actividades[1].ejercicios[1].enunciado).toBe('y');
    expect(f.actividades.flatMap(a => a.ejercicios).filter(x => x.tipo === 'contar' || x.tipo === 'etiquetar')).toHaveLength(2);
  });

  it('con uno solo, añade el que falta', async () => {
    callGemini.mockResolvedValueOnce(ficha([
      { titulo: 'A', dificultad: 1, ejercicios: [{ tipo: 'contar', enunciado: 'Cuenta.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 3 }, { ilustracion: 'ani-oveja', cantidad: 5 }], total: true, solucion: '' }, abierta('x')] },
      { titulo: 'B', dificultad: 2, ejercicios: [abierta('y'), abierta('y2')] },
      { titulo: 'C', dificultad: 3, ejercicios: [abierta('z'), abierta('w')] },
    ]));
    const f = (await generateFicha(granja(), 'es'))!;
    const tipos = f.actividades.flatMap(a => a.ejercicios).map(x => x.tipo);
    expect(tipos.filter(t => t === 'contar')).toHaveLength(1);
    expect(tipos.filter(t => t === 'etiquetar')).toHaveLength(1);
  });

  it('solo en 1.º y 2.º, con hilo y en una ficha normal', async () => {
    for (const [nivel, over] of [['4º Primaria', {}], ['2º Primaria', { hilo: 'ninguno' }], ['2º Primaria', { estilo: 'clasico' }], ['2º Primaria', { visual: true }]] as const) {
      callGemini.mockReset();
      callGemini.mockResolvedValueOnce(dosAbiertas());
      const f = (await generateFicha(granja({ nivel, ...over } as Partial<FichaRequest>), 'es'))!;
      expect(f.actividades.flatMap(a => a.ejercicios).every(x => x.tipo === 'abierta')).toBe(true);
    }
  });

  it('también en 1.º, con cantidades pequeñas', async () => {
    callGemini.mockResolvedValueOnce(dosAbiertas());
    const f = (await generateFicha(granja({ nivel: '1º Primaria' }), 'es'))!;
    const contar = f.actividades.flatMap(a => a.ejercicios).find(x => x.tipo === 'contar')!;
    for (const d of contar.dibujos!) expect(d.cantidad).toBeLessThanOrEqual(5);
  });
});

describe('el ejemplo guía', () => {
  it.each([
    ['2º Primaria', 'Sumamos y restamos en la tienda'],
    ['3º Primaria', 'Sumamos y restamos en la tienda'],
    ['4º Primaria', 'El viaje del agua'],
    ['6º Primaria', 'Rebajas y porcentajes'],
    ['2º ESO', 'Rebajas y porcentajes'],
  ])('%s recibe un ejemplo de su tramo', async (nivel, titulo) => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ nivel }), 'es');
    expect(sistema()).toContain('EJEMPLO DE FICHA BIEN HECHA');
    expect(sistema()).toContain(`"titulo":"${titulo}"`);
    expect(sistema()).toContain('nunca su tema');
  });

  it('el ejemplo lleva los recuadros solo en «Cuaderno»', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ estilo: 'cuaderno' }), 'es');
    expect(sistema()).toContain('"recuadro"');
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ estilo: 'clasico' }), 'es');
    expect(sistema()).not.toContain('"recuadro"');
  });

  it('con hilo conductor avisa de que el ejemplo no lleva dibujos', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ nivel: '2º Primaria', tema: 'Los animales de la granja', area: 'Ciencias Naturales' }), 'es');
    expect(sistema()).toContain('No lleva dibujos porque no tiene hilo conductor');
  });
});

describe('rehacer un ejercicio mantiene el nivel de su bloque', () => {
  const unaFicha = async (nivel = '6º Primaria') => {
    callGemini.mockResolvedValueOnce(buena());
    const f = (await generateFicha(req({ nivel }), 'es'))!;
    callGemini.mockReset();
    return f;
  };

  it('regenerateExercise y addExercise dicen en qué peldaño está el bloque y qué se pide', async () => {
    const f = await unaFicha();
    callGemini.mockResolvedValueOnce(JSON.stringify(ej()));
    await regenerateExercise(f, req(), 2, 0, { instruccion: 'otro' }, 'es');
    expect(usuario()).toContain('Nivel de dificultad de este bloque: 3 de 3 (para retarte)');
    expect(usuario()).toContain('problemas de tres pasos');
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(JSON.stringify(ej()));
    await addExercise(f, req(), 0, {}, 'es');
    expect(usuario()).toContain('Nivel de dificultad de este bloque: 1 de 3 (para empezar)');
  });
});

describe('los ejercicios de cada bloque son los que decidió el código', () => {
  const bloques = (...cuantos: number[]) => ficha(cuantos.map((n, i) => bloque(`B${i + 1}`, (i + 1) as 1 | 2 | 3, n)));

  it('si la IA puso menos, se le piden los que faltan al bloque que se quedó corto', async () => {
    callGemini
      .mockResolvedValueOnce(bloques(2, 1, 2))
      .mockResolvedValueOnce(JSON.stringify({ tipo: 'abierta', enunciado: 'Uno que faltaba.', solucion: 'x' }));
    const f = await generateFicha(req(), 'es');
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(usuario(1)).toContain('Bloque de actividad: B2');
    expect(usuario(1)).toContain('Nivel de dificultad de este bloque: 2 de 3');
    expect(f!.actividades.map(a => a.ejercicios.length)).toEqual([2, 2, 2]);
    expect(f!.actividades[1].ejercicios[1].enunciado).toBe('Uno que faltaba.');
  });

  it('si puso de más, se quitan los últimos', async () => {
    callGemini.mockResolvedValueOnce(bloques(2, 4, 2));
    const f = await generateFicha(req(), 'es');
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(f!.actividades.map(a => a.ejercicios.length)).toEqual([2, 2, 2]);
    expect(f!.actividades[1].ejercicios.map(e => e.enunciado)).toEqual(['B2 1', 'B2 2']);
  });

  it('si la IA no contesta, se queda como estaba y no se insiste', async () => {
    callGemini.mockResolvedValueOnce(bloques(1, 1, 1)).mockResolvedValue(null);
    const f = await generateFicha(req(), 'es');
    expect(f!.actividades.map(a => a.ejercicios.length)).toEqual([1, 1, 1]);
    // un intento por bloque como mucho, y se corta en cuanto uno falla
    expect(callGemini.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('con otro número de bloques que el del reparto no se toca nada', async () => {
    callGemini.mockResolvedValueOnce(ficha([bloque('A', 1, 1), bloque('B', 3, 1)]));
    const f = await generateFicha(req(), 'es');
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(f!.actividades).toHaveLength(2);
  });

  it('un reparto completo no hace ninguna llamada más', async () => {
    callGemini.mockResolvedValueOnce(bloques(2, 2, 2));
    await generateFicha(req(), 'es');
    expect(callGemini).toHaveBeenCalledTimes(1);
  });
});

describe('los recuadros y la revisión en el prompt', () => {
  it('«Cuaderno» pide un «recuerda» en el primer bloque y un «reto» en el último; los demás diseños, no', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ estilo: 'cuaderno' }), 'es');
    expect(sistema()).toContain('RECUADROS: el primer bloque lleva un "recuerda"');
    expect(sistema()).toContain('el último un "reto"');
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ estilo: 'clasico' }), 'es');
    expect(sistema()).not.toContain('RECUADROS:');
  });

  it('la revisión sabe que «ordenar» viene en orden a propósito y que la rejilla la monta la aplicación', async () => {
    callGemini.mockResolvedValueOnce(buena()).mockResolvedValueOnce(JSON.stringify({ problemas: [] }));
    await generateFicha(req({ revisar: true }), 'es');
    expect(sistema(1)).toContain('NO son fallos');
    expect(sistema(1)).toContain('"ordenar" los "elementos" vienen en el orden correcto a propósito');
  });

  it('con hilo, las cantidades de «contar» son distintas y pequeñas', async () => {
    callGemini.mockResolvedValueOnce(buena());
    await generateFicha(req({ nivel: '2º Primaria', tema: 'Los animales de la granja', area: 'Ciencias Naturales' }), 'es');
    expect(sistema()).toContain('Las cantidades son distintas entre sí (nunca 10 y 10)');
  });
});

describe('la revisión de la IA', () => {
  const con = (problemas: unknown) => JSON.stringify({ problemas });

  it('revisa la ficha con otro prompt y rehace el ejercicio señalado, con el motivo como indicación', async () => {
    callGemini
      .mockResolvedValueOnce(buena())
      .mockResolvedValueOnce(con([{ bloque: 3, ejercicio: 2, motivo: 'La solución está mal: 4,5 + 2,25 es 6,75.' }]))
      .mockResolvedValueOnce(JSON.stringify({ tipo: 'problema', enunciado: 'Ahora un problema nuevo de dos pasos.', solucion: '12' }));
    const f = await generateFicha(req({ revisar: true }), 'es');
    expect(callGemini).toHaveBeenCalledTimes(3);
    expect(sistema(1)).toContain('Eres un maestro o una maestra con muchos años de experiencia');
    expect(usuario(1)).toContain('Curso o nivel: 6º Primaria');
    expect(usuario(1)).toContain('NIVEL ALTO');
    expect(usuario(2)).toContain('La solución está mal');
    expect(f!.actividades[2].ejercicios[1].enunciado).toBe('Ahora un problema nuevo de dos pasos.');
    expect(f!.actividades[2].ejercicios[0].enunciado).toBe('Razonamos 1');
  });

  it('una ficha sin fallos graves no se toca ni hace más llamadas', async () => {
    callGemini.mockResolvedValueOnce(buena()).mockResolvedValueOnce(con([]));
    await generateFicha(req({ revisar: true }), 'es');
    expect(callGemini).toHaveBeenCalledTimes(2);
  });

  it('si la revisión falla o devuelve algo raro, la ficha se queda como estaba', async () => {
    for (const rara of [null, 'no es json', JSON.stringify({ otra: 1 }), con('no es una lista')]) {
      callGemini.mockReset();
      callGemini.mockResolvedValueOnce(buena()).mockResolvedValueOnce(rara);
      const f = await generateFicha(req({ revisar: true }), 'es');
      expect(f!.actividades).toHaveLength(3);
      expect(callGemini).toHaveBeenCalledTimes(2);
    }
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(buena()).mockRejectedValueOnce(new Error('sin red'));
    expect((await generateFicha(req({ revisar: true }), 'es'))!.actividades).toHaveLength(3);
  });

  it('descarta los hallazgos que apuntan a un ejercicio que no existe y se queda con tres como mucho', async () => {
    const f = (await (async () => {
      callGemini.mockResolvedValueOnce(buena());
      return generateFicha(req(), 'es');
    })())!;
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(con([
      { bloque: 9, ejercicio: 1, motivo: 'no existe' },
      { bloque: 1, ejercicio: 1, motivo: 'a' }, { bloque: 1, ejercicio: 2, motivo: 'b' },
      { bloque: 2, ejercicio: 1, motivo: 'c' }, { bloque: 2, ejercicio: 2, motivo: 'd' },
      { bloque: 1, ejercicio: 1, motivo: '' },
    ]));
    const h = await revisarFicha(f, req(), 'es');
    expect(h.map(x => x.motivo)).toEqual(['a', 'b', 'c']);
  });

  it('un ejercicio nuevo que sigue roto no sustituye al anterior', async () => {
    callGemini
      .mockResolvedValueOnce(buena())
      .mockResolvedValueOnce(con([{ bloque: 1, ejercicio: 1, motivo: 'rehazlo' }]))
      .mockResolvedValueOnce(JSON.stringify({ tipo: 'completar', enunciado: 'Completa las frases.', solucion: 'x' }));
    const f = await generateFicha(req({ revisar: true }), 'es');
    expect(f!.actividades[0].ejercicios[0].enunciado).toBe('Calculamos 1');
  });

  it('no se revisan el escape room ni las tarjetas', async () => {
    const f = { titulo: 'x', explicacion: '', instrucciones: '', formato: 'escape', actividades: [] } as unknown as FichaContent;
    expect(await revisarFicha(f, req(), 'es')).toEqual([]);
    expect(await revisarFicha({ ...f, formato: 'tarjetas' }, req(), 'es')).toEqual([]);
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('los ejercicios con dibujos del catálogo no van a la revisión: su recuento lo calcula el código', async () => {
    const f = {
      titulo: 'x', explicacion: '', instrucciones: '', formato: 'ficha', hilo: 'granja',
      actividades: [{
        titulo: 'A', dificultad: 1, ejercicios: [
          { tipo: 'contar', enunciado: 'Cuenta.', dibujos: [{ ilustracion: 'ani-vaca', cantidad: 3 }], solucion: 'vaca: 3' },
          { tipo: 'abierta', enunciado: 'Explica por qué.', solucion: 'x' },
        ],
      }],
    } as unknown as FichaContent;
    callGemini.mockResolvedValueOnce(con([]));
    await revisarFicha(f, req(), 'es');
    const enviado = JSON.parse(usuario().split('Ficha (JSON):\n')[1].split('\n\nRevísala')[0]);
    expect(enviado.bloques[0].ejercicios).toHaveLength(1);
    expect(enviado.bloques[0].ejercicios[0].ejercicio).toBe(2);
  });
});
