/**
 * La comprensión lectora y la lectura fácil en lo que se le pide a la IA y en lo que devuelve: dos llamadas (el texto y las
 * actividades sobre él), la longitud del texto comprobada por el código, los tipos de ejercicio de lectura y las negritas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import {
  addExercise, adaptFicha, esFacil, generateFicha, regenerateExercise, revisarFicha, tiposDisponibles, TIPOS_DE_LECTURA,
  type FichaContent, type FichaRequest,
} from './resources';

const palabras = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');
const texto = (over: Record<string, unknown> = {}) => JSON.stringify({
  titulo: 'El dragón que perdió su fuego', genero: 'cuento',
  parrafos: [`${palabras(35)}.`, `${palabras(35)}.`, `${palabras(35)}.`, `${palabras(35)}.`],
  dibujos: [{ ilustracion: 'cue-dragon', parrafo: 1 }, { ilustracion: 'cue-mago', parrafo: 3 }],
  pista: 'Fíjate en quién ayuda al dragón.', destrezas: ['Vocabulario', 'Orden de los hechos'], ...over,
});

const ex = (tipo: string, extra: Record<string, unknown> = {}) => ({ tipo, enunciado: `Enunciado ${tipo}`, solucion: 'sol', ...extra });
const actividades = (b1: unknown[] = [ex('en_texto', { lineasRespuesta: 2 }), ex('verdadero_falso', { afirmaciones: ['a', 'b', 'c', 'd'] })],
  b2: unknown[] = [ex('contestar', { preguntas: ['¿Uno?', '¿Dos?'] }), ex('abierta')],
  b3: unknown[] = [ex('dibujar', { lineasRespuesta: 1 }), ex('abierta')]) => JSON.stringify({
  actividades: [
    { titulo: 'Buscamos en el texto', dificultad: 1, recuadro: { tipo: 'consejo', texto: 'Lee primero las preguntas.' }, ejercicios: b1 },
    { titulo: 'Pensamos', dificultad: 2, ejercicios: b2 },
    { titulo: 'Opinamos y creamos', dificultad: 3, recuadro: { tipo: 'reto', texto: '¿Qué más?' }, ejercicios: b3 },
  ],
});

const req = (over: Partial<FichaRequest> = {}): FichaRequest => ({
  tema: 'Un dragón', area: 'Lengua', nivel: '3º Primaria', numEjercicios: 6, niveles: false, contextoClase: '', lectura: true, revisar: false, ...over,
});

const sistema = (i = 0) => callGemini.mock.calls[i][0] as string;
const usuario = (i = 0) => callGemini.mock.calls[i][1] as string;
const opciones = (i = 0) => callGemini.mock.calls[i][4];

beforeEach(() => callGemini.mockReset());

describe('qué tipos hay en lectura', () => {
  it('los de lectura solo con lectura; en lectura no hay cálculo, medidas ni dibujos de ejercicio', () => {
    const lect = tiposDisponibles({ dibujos: true, fracciones: true, lectura: true });
    for (const t of TIPOS_DE_LECTURA) expect(lect).toContain(t);
    for (const t of ['problema', 'calculos', 'colorear', 'contar', 'etiquetar', 'clasificar', 'fracciones']) expect(lect).not.toContain(t);
    expect(lect).toEqual(expect.arrayContaining(['abierta', 'completar', 'ordenar', 'verdadero_falso', 'tabla_rellenar', 'relacionar', 'comic']));
    const normal = tiposDisponibles({ dibujos: true, fracciones: true });
    for (const t of TIPOS_DE_LECTURA) expect(normal).not.toContain(t);
  });
});

describe('generar una comprensión lectora', () => {
  it('dos llamadas: primero el texto y después las actividades sobre el texto ya escrito', async () => {
    callGemini.mockResolvedValueOnce(texto()).mockResolvedValueOnce(actividades());
    const f = (await generateFicha(req(), 'es'))!;
    expect(callGemini).toHaveBeenCalledTimes(2);
    // 1.ª: el texto, con su longitud, la lista de dibujos y un esquema de texto
    expect(sistema(0)).toContain('ORIGINALES');
    expect(sistema(0)).toContain('cue-dragon: ');
    expect(opciones(0).responseSchema.properties.parrafos).toBeDefined();
    expect(usuario(0)).toContain('Entre 110 y 170 palabras');
    // 2.ª: las actividades, con el texto numerado y sin pedir otra vez el texto
    expect(usuario(1)).toContain('[1] palabra0');
    expect(usuario(1)).toContain('EXACTAMENTE 6 ejercicios');
    expect(sistema(1)).toContain('"en_texto"');
    expect(sistema(1)).toContain('NO uses "problema"');
    expect(opciones(1).responseSchema.properties.explicacion).toBeUndefined();
    expect(opciones(1).responseSchema.properties.actividades.items.properties.ejercicios.items.properties.tipo.enum).toContain('contestar');
    // La ficha
    expect(f.lectura!.genero).toBe('cuento');
    expect(f.titulo).toBe('El dragón que perdió su fuego');
    expect(f.lectura!.dibujos.map(d => d.ilustracion)).toEqual(['cue-dragon', 'cue-mago']);
    expect(f.estilo).toBe('cuaderno');
    expect(f.formato).toBe('ficha');
    expect(f.hilo).toBeUndefined();
    expect(f.explicacion).toBe('');
    expect(f.instrucciones).toContain('Lee el texto');
    expect(f.variante).toBeUndefined();
    expect(f.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(f.actividades[0].recuadro?.tipo).toBe('consejo');
  });

  it('un texto demasiado corto se pide otra vez, diciendo qué falla', async () => {
    callGemini.mockResolvedValueOnce(texto({ parrafos: ['Hola.', 'Adiós.'] })).mockResolvedValueOnce(texto()).mockResolvedValueOnce(actividades());
    const f = (await generateFicha(req(), 'es'))!;
    expect(callGemini).toHaveBeenCalledTimes(3);
    expect(usuario(1)).toContain('Tu intento anterior no vale');
    expect(usuario(1)).toContain('entre 110 y 170');
    expect(contarParrafos(f)).toBe(4);
  });

  it('si el segundo intento también falla, se queda con el mejor y el docente lo edita', async () => {
    callGemini.mockResolvedValueOnce(texto({ parrafos: ['Hola.'] })).mockResolvedValueOnce(texto({ parrafos: ['Hola otra vez.'] })).mockResolvedValueOnce(actividades());
    const f = (await generateFicha(req(), 'es'))!;
    expect(f.lectura!.parrafos).toEqual(['Hola otra vez.']);
  });

  it('el tipo de texto que elige el docente se respeta, y un poema se mide en versos', async () => {
    const versos = (n: number) => Array.from({ length: n }, (_, i) => `verso ${i}`).join('\n');
    callGemini.mockResolvedValueOnce(texto({ genero: 'cuento', parrafos: [versos(4), versos(4), versos(4)] })).mockResolvedValueOnce(actividades());
    const f = (await generateFicha(req({ generoLectura: 'poema' }), 'es'))!;
    expect(f.lectura!.genero).toBe('poema');
    expect(sistema(0)).toContain('"poema":');
    expect(opciones(0).responseSchema.properties.genero.enum).toEqual(['poema']);
  });

  it('sin texto, nada; con el texto pero sin actividades, nada', async () => {
    callGemini.mockResolvedValue(null);
    expect(await generateFicha(req(), 'es')).toBeNull();
    callGemini.mockReset();
    callGemini.mockResolvedValueOnce(texto()).mockResolvedValueOnce(null);
    expect(await generateFicha(req(), 'es')).toBeNull();
  });

  it('el idioma se pide en las dos llamadas', async () => {
    callGemini.mockResolvedValueOnce(texto()).mockResolvedValueOnce(actividades());
    const f = (await generateFicha(req({ nivel: '3r Primària' }), 'ca'))!;
    expect(sistema(0)).toContain('CATALÁN');
    expect(sistema(1)).toContain('CATALÁN');
    expect(f.instrucciones).toContain('Llegeix el text');
  });
});

const contarParrafos = (f: FichaContent) => f.lectura!.parrafos.length;

describe('los ejercicios de lectura, limpios', () => {
  const gen = async (b1: unknown[], b2?: unknown[], b3?: unknown[], r: Partial<FichaRequest> = {}) => {
    callGemini.mockResolvedValueOnce(texto()).mockResolvedValueOnce(actividades(b1, b2, b3));
    return (await generateFicha(req(r), 'es'))!;
  };

  it('«contestar» con una pregunta (o ninguna) es una pregunta abierta; con varias, conserva las preguntas', async () => {
    const f = await gen([ex('contestar', { preguntas: ['¿Quién?'] }), ex('contestar', { preguntas: [] })], [ex('contestar', { preguntas: ['¿A?', '', '¿B?'] }), ex('abierta')]);
    const [a, b] = f.actividades[0].ejercicios;
    expect(a.tipo).toBe('abierta');
    expect(a.enunciado).toBe('¿Quién?');
    expect(a.preguntas).toBeUndefined();
    expect(b.tipo).toBe('abierta');
    expect(f.actividades[1].ejercicios[0]).toMatchObject({ tipo: 'contestar', preguntas: ['¿A?', '¿B?'] });
  });

  it('las líneas de respuesta de «en_texto» y «dibujar» se acotan, y si faltan salen del enunciado', async () => {
    const f = await gen(
      [ex('en_texto', { lineasRespuesta: 9 }), ex('en_texto', { enunciado: 'Rodea las palabras. Después, escríbelas.' }), ex('en_texto', { enunciado: 'Subraya la frase.' })],
      [ex('dibujar', { lineasRespuesta: 7 }), ex('dibujar', { enunciado: 'Dibuja al dragón.' }), ex('abierta')], [ex('abierta'), ex('abierta')], { numEjercicios: 8 },
    );
    expect(f.actividades[0].ejercicios.map(e => e.lineasRespuesta)).toEqual([3, 1, 0]);
    expect(f.actividades[1].ejercicios.map(e => e.lineasRespuesta)).toEqual([2, 0, undefined]);
    // Y no hay líneas en los demás tipos
    expect(f.actividades[1].ejercicios[2].lineasRespuesta).toBeUndefined();
  });

  it('el recuadro de palabras solo va en «completar» y con al menos dos palabras', async () => {
    const f = await gen(
      [ex('completar', { enunciado: 'El dragón es ______.', bancoPalabras: ['verde', 'rojo', ' ', '**azul**'] }), ex('completar', { enunciado: 'Era ______.', bancoPalabras: ['una'] })],
      [ex('abierta', { bancoPalabras: ['x', 'y'] }), ex('abierta')],
    );
    expect(f.actividades[0].ejercicios[0].bancoPalabras).toEqual(['verde', 'rojo', 'azul']);
    expect(f.actividades[0].ejercicios[1].bancoPalabras).toBeUndefined();
    expect(f.actividades[1].ejercicios[0].bancoPalabras).toBeUndefined();
  });

  it('en una ficha normal no hay negritas: las que ponga la IA se quitan', async () => {
    const f = await gen([ex('abierta', { enunciado: 'Explica por qué **vuela**.', solucion: 'Porque **sí**.' }), ex('abierta')]);
    expect(f.actividades[0].ejercicios[0].enunciado).toBe('Explica por qué vuela.');
    expect(f.actividades[0].ejercicios[0].solucion).toBe('Porque sí.');
    expect(f.variante).toBeUndefined();
  });
});

describe('lectura fácil (dislexia)', () => {
  it('en lectura: se pide en las dos llamadas, la ficha lo dice y los enunciados llevan su verbo en negrita', async () => {
    const parrafos = ['**Brasas** vive en un **monte**. Tiene **alas** pequeñas. Le gusta el **fuego**. '.repeat(3)];
    callGemini.mockResolvedValueOnce(texto({ parrafos: [...parrafos, ...parrafos, ...parrafos] }))
      .mockResolvedValueOnce(actividades([ex('en_texto', { enunciado: 'Rodea el **monte**.' }), ex('verdadero_falso', { enunciado: 'Marca V o F.', afirmaciones: ['**Brasas** vuela.', 'Hay **fuego**.', 'a', 'b'] })], [ex('abierta', { enunciado: 'Contesta con tus palabras.' }), ex('abierta')]));
    const f = (await generateFicha(req({ facil: true }), 'es'))!;
    expect(sistema(0)).toContain('LECTURA FÁCIL');
    expect(sistema(1)).toContain('LECTURA FÁCIL');
    expect(usuario(0)).toMatch(/Entre \d+ y \d+ palabras/);
    expect(f.variante).toBe('lectura_facil');
    expect(esFacil(f)).toBe(true);
    expect(f.instrucciones).toBe('Lee el texto despacio. Después, haz las actividades.');
    expect(f.lectura!.parrafos[0]).toContain('**Brasas**');
    const [a, b] = f.actividades[0].ejercicios;
    expect(a.enunciado).toBe('Rodea el **monte**.');
    expect(b.enunciado).toBe('**Marca** V o F.');
    expect(b.afirmaciones![0]).toBe('**Brasas** vuela.');
    expect(f.actividades[1].ejercicios[0].enunciado).toBe('**Contesta** con tus palabras.');
  });

  it('un texto con frases largas se pide otra vez más corto', async () => {
    const larga = `${palabras(40)}. ${palabras(40)}. ${palabras(40)}.`;
    callGemini.mockResolvedValueOnce(texto({ parrafos: [larga, larga] })).mockResolvedValueOnce(texto({ parrafos: ['**A** b c d e f. **G** h i j k l. '.repeat(6), '**M** n o p q r. '.repeat(8), '**S** t u v w x. '.repeat(6)] })).mockResolvedValueOnce(actividades());
    await generateFicha(req({ facil: true }), 'es');
    expect(usuario(1)).toContain('Tu intento anterior no vale');
    expect(usuario(1)).toMatch(/frases|negrita/);
  });

  it('en una ficha de ejercicios normal: el prompt lo pide y la ficha sale marcada', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({
      titulo: 'Las sumas', explicacion: 'Sumar es **juntar**.', instrucciones: 'Resuelve.',
      actividades: [
        { titulo: 'A', dificultad: 1, ejercicios: [ex('abierta', { enunciado: 'Escribe la suma de 2 y 3.' }), ex('abierta')] },
        { titulo: 'B', dificultad: 2, ejercicios: [ex('abierta'), ex('abierta')] },
        { titulo: 'C', dificultad: 3, ejercicios: [ex('abierta'), ex('abierta')] },
      ],
    }));
    const f = (await generateFicha(req({ lectura: false, facil: true, tema: 'Las sumas', area: 'Matemáticas' }), 'es'))!;
    expect(sistema(0)).toContain('LECTURA FÁCIL');
    expect(f.variante).toBe('lectura_facil');
    expect(f.explicacion).toBe('Sumar es **juntar**.');
    expect(f.actividades[0].ejercicios[0].enunciado).toBe('**Escribe** la suma de 2 y 3.');
  });

  it('en tarjetas no hay lectura fácil', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ titulo: 'T', instrucciones: 'i', tarjetas: [{ pregunta: 'p', respuesta: 'r' }] }));
    const f = (await generateFicha(req({ lectura: false, formato: 'tarjetas', facil: true }), 'es'))!;
    expect(sistema(0)).not.toContain('LECTURA FÁCIL');
    expect(f.variante).toBeUndefined();
  });
});

describe('editar una comprensión lectora ya hecha', () => {
  const ficha = async (): Promise<FichaContent> => {
    callGemini.mockResolvedValueOnce(texto()).mockResolvedValueOnce(actividades());
    const f = (await generateFicha(req(), 'es'))!;
    callGemini.mockReset();
    return f;
  };
  const r = { tema: 'Un dragón', area: 'Lengua', nivel: '3º Primaria' };

  it('rehacer un ejercicio le enseña el texto, usa el esquema de lectura y respeta el nivel de lectura del bloque', async () => {
    const f = await ficha();
    callGemini.mockResolvedValueOnce(JSON.stringify(ex('contestar', { preguntas: ['¿Quién?', '¿Dónde?'] })));
    const nuevo = await regenerateExercise(f, r, 0, 1, { instruccion: 'otro distinto', tipo: 'contestar' }, 'es');
    expect(usuario(0)).toContain('[1] palabra0');
    expect(usuario(0)).toContain('BUSCA EN EL TEXTO');
    expect(sistema(0)).toContain('Crea UN solo ejercicio');
    expect(sistema(0)).not.toContain('RECUADROS');
    expect(opciones(0).responseSchema.properties.preguntas).toBeDefined();
    expect(nuevo).toMatchObject({ tipo: 'contestar', preguntas: ['¿Quién?', '¿Dónde?'] });
  });

  it('añadir un ejercicio: también con el texto y sin pizzas ni dibujos de catálogo', async () => {
    const f = await ficha();
    callGemini.mockResolvedValueOnce(JSON.stringify(ex('en_texto', { lineasRespuesta: 1 })));
    const nuevo = await addExercise(f, r, 1, { tipo: 'en_texto' }, 'es');
    expect(usuario(0)).toContain('[2] palabra0');
    expect(opciones(0).responseSchema.properties.dibujos).toBeUndefined();
    expect(opciones(0).responseSchema.properties.fracciones).toBeUndefined();
    expect(nuevo).toMatchObject({ tipo: 'en_texto', lineasRespuesta: 1 });
  });

  it('en lectura fácil, el ejercicio nuevo también sale con negritas', async () => {
    const f = { ...(await ficha()), variante: 'lectura_facil' as const };
    callGemini.mockResolvedValueOnce(JSON.stringify(ex('abierta', { enunciado: 'Escribe tu final.' })));
    const nuevo = await addExercise(f, r, 2, {}, 'es');
    expect(sistema(0)).toContain('LECTURA FÁCIL');
    expect(nuevo!.enunciado).toBe('**Escribe** tu final.');
  });

  it('la revisión de la IA es la de lectura: con el texto delante y sin hablar de cuentas', async () => {
    const f = await ficha();
    callGemini.mockResolvedValueOnce(JSON.stringify({ problemas: [{ bloque: 1, ejercicio: 2, motivo: 'La respuesta no está en el texto.' }, { bloque: 9, ejercicio: 1, motivo: 'no existe' }] }));
    const h = await revisarFicha(f, r, 'es');
    expect(sistema(0)).toContain('comprensión lectora');
    expect(sistema(0)).not.toContain('recalcúlala');
    expect(usuario(0)).toContain('TEXTO (cuento)');
    expect(usuario(0)).toContain('[1] palabra0');
    expect(h).toEqual([{ bloque: 1, ejercicio: 2, motivo: 'La respuesta no está en el texto.' }]);
  });

  it('adaptar a lectura fácil reescribe el texto (con el original delante) y rehace las actividades; otras versiones no se ofrecen', async () => {
    const f = await ficha();
    const facil = ['**Brasas** vive en un **monte**. Tiene **alas**. Le gusta el **fuego**. '.repeat(3)];
    callGemini.mockResolvedValueOnce(texto({ titulo: 'Brasas', parrafos: [...facil, ...facil, ...facil] })).mockResolvedValueOnce(actividades());
    const res = (await adaptFicha(f, { ...r, numEjercicios: 6, niveles: false, contextoClase: '' }, 'lectura_facil', 'es'))!;
    expect(sistema(0)).toContain('Reescribes un texto que ya existe');
    expect(usuario(0)).toContain('Texto que hay que reescribir');
    expect(usuario(0)).toContain('[1] palabra0');
    expect(res.variante).toBe('lectura_facil');
    expect(res.lectura!.parrafos[0]).toContain('**Brasas**');
    expect(res.lectura!.genero).toBe('cuento');
    callGemini.mockReset();
    expect(await adaptFicha(f, { ...r, numEjercicios: 6, niveles: false, contextoClase: '' }, 'apoyo', 'es')).toBeNull();
    expect(callGemini).not.toHaveBeenCalled();
  });
});

describe('adaptar una ficha de ejercicios a lectura fácil', () => {
  it('el prompt trae las reglas, las negritas y la ficha sale marcada', async () => {
    const original: FichaContent = {
      titulo: 'Las sumas', explicacion: 'Sumar es juntar.', instrucciones: 'Resuelve.', estilo: 'cuaderno',
      actividades: [{ titulo: 'A', dificultad: 1, ejercicios: [{ tipo: 'abierta', enunciado: 'Escribe cuánto es 2 + 3.', solucion: '5' }] }],
    };
    callGemini.mockResolvedValueOnce(JSON.stringify({
      titulo: 'Las sumas', explicacion: 'Sumar es **juntar**.', instrucciones: 'Resuelve.',
      actividades: [{ titulo: 'A', dificultad: 1, ejercicios: [{ tipo: 'abierta', enunciado: 'Suma 2 + 3.', solucion: '5' }] }],
    }));
    const res = (await adaptFicha(original, { tema: 'Las sumas', area: 'Matemáticas', nivel: '2º Primaria', numEjercicios: 1, niveles: false, contextoClase: '' }, 'lectura_facil', 'es'))!;
    expect(sistema(0)).toContain('LECTURA FÁCIL');
    expect(usuario(0)).toContain('palabras clave en negrita');
    expect(res.variante).toBe('lectura_facil');
    expect(res.explicacion).toBe('Sumar es **juntar**.');
    expect(res.actividades[0].ejercicios[0].enunciado).toBe('Suma 2 + 3.');
  });
});
