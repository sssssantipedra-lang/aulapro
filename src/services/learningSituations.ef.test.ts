/**
 * La SdA de Educación Física es la SdA de siempre (competencias, criterios y
 * saberes del decreto, competencias clave, sesiones) con lo propio de EF:
 * el modelo pedagógico, el DUA-A, el material, las instalaciones y las
 * limitaciones sin nombres. Las referencias las pone la aplicación desde
 * `lib/modelosEF`, nunca la IA (decisión del dueño, 5-10-2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { efDeLaRespuesta, generateSda, minutosDeSesion, secuenciaDeportes, sesionesDeLaRespuesta, type SdaRequest } from './learningSituations';
import { IDS_MODELOS_EF, MODELOS_EF, REFERENCIAS_EF, referenciasDeModelos } from '../lib/modelosEF';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

const PETICION: SdaRequest = {
  idea: 'Una liga de voleibol con su festival final',
  numero: '2', temporalizacion: '2ª evaluación', meses: 'Enero y febrero',
  areas: ['Educación Física'], numSesiones: 8, nivel: '1º ESO',
  etapa: 'eso', curso: 1, comunidad: 'comunitat-valenciana',
  contextoClase: '', metodologia: '', documentos: [],
  ef: {
    modelo: '',
    material: 'Balones de voleibol (14); Conos (40)',
    instalaciones: 'Pabellón (cubierta)',
    limitaciones: ['No puede correr, No puede saltar'],
  },
};

function respuesta(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    titulo: 'Liga de voleibol', justificacion: 'j', ods: 'ODS 3', objetivosEtapa: 'oe', competenciasClave: 'CPSAA, CC',
    explicacionCurricular: '1. x', areas: [{ area: 'Educación Física', competenciasEspecificas: 'x', criteriosEvaluacion: 'x', saberesBasicos: 'x', competenciasSeleccionadas: [1], saberesSeleccionados: ['1'] }],
    inclusionUniversal: 'u', inclusionAdicional: 'a', inclusionIndividualizada: 'No puede correr ni saltar: juega de colocador.',
    metodologia: 'Educación Deportiva', agrupamiento: 'Equipos estables', recursos: 'Balones', productoFinal: 'Festival',
    evaluacionTecnicas: 'Autoevaluación', evaluacionInstrumentos: 'Rúbrica',
    sesiones: [{ fase: 'Activación', titulo: 'Empieza la temporada', descripcion: 'Calentamiento…' }],
    referencias: 'Un estudio inventado (2030)',
    ...extra,
  });
}

beforeEach(() => callGemini.mockReset());

describe('modelos pedagógicos de EF', () => {
  it('cada modelo cita referencias que existen, y siempre van la evaluación formativa y el DUA', () => {
    const ids = new Set(REFERENCIAS_EF.map(r => r.id));
    for (const m of MODELOS_EF) expect(m.refs.every(r => ids.has(r)), m.id).toBe(true);
    const refs = referenciasDeModelos(['educacion-deportiva']);
    expect(refs.some(r => r.startsWith('Calderón, A., Hastie, P. A.'))).toBe(true);
    expect(refs.some(r => r.startsWith('López-Pastor'))).toBe(true);
    expect(refs.some(r => r.startsWith('CAST'))).toBe(true);
    expect(new Set(refs).size).toBe(refs.length);
    // Sin rayas largas en lo que se publica
    expect(REFERENCIAS_EF.every(r => !r.cita.includes('—'))).toBe(true);
  });
});

describe('SdA de Educación Física', () => {
  it('es la SdA de siempre, con el modelo, el DUA-A, el inventario y las limitaciones sin nombres', async () => {
    callGemini.mockResolvedValue(respuesta({ modelosPedagogicos: ['educacion-deportiva', 'aprendizaje-cooperativo', 'inventado'], modalidadDeportiva: 'red-pared' }));
    const sda = await generateSda(PETICION, 'es');
    const [system, user, , , opciones] = callGemini.mock.calls[0];
    // Lo general: el currículo real y las competencias
    expect(user).toContain('CURRÍCULO OFICIAL REAL');
    expect(system).toContain('competencias específicas');
    // Lo de EF
    expect(system).toContain('EDUCACIÓN FÍSICA');
    expect(system).toContain('DUA-A');
    expect(system).toContain('educacion-deportiva: Educación Deportiva');
    expect(system).toMatch(/no inventes ninguna/);
    expect(user).toContain('Material disponible: Balones de voleibol (14); Conos (40)');
    expect(user).toContain('- No puede correr, No puede saltar');
    expect(opciones.responseSchema.properties.modelosPedagogicos.items.enum).toEqual(IDS_MODELOS_EF);
    expect(opciones.responseSchema.propertyOrdering[0]).toBe('modelosPedagogicos');
    expect(opciones.responseSchema.properties.modalidadDeportiva.enum).toContain('red-pared');
    expect(opciones.responseSchema.properties.modalidadDeportiva.enum.every((x: unknown) => typeof x === 'string')).toBe(true);
    expect(system).toContain('red-pared: Red y pared. Lógica:');
    // Lo que vuelve: el currículo oficial, y los modelos válidos con sus referencias de la lista
    expect(sda?.areas[0].oficial).toBe(true);
    expect(sda?.ef?.modelos).toEqual(['educacion-deportiva', 'aprendizaje-cooperativo']);
    expect(sda?.ef?.referencias).toEqual(referenciasDeModelos(['educacion-deportiva', 'aprendizaje-cooperativo']));
    expect(sda?.ef?.modalidad).toBe('red-pared');
    expect(JSON.stringify(sda)).not.toContain('2030');
  });

  it('si el docente elige el modelo, manda el suyo; y sin EF no cambia nada', async () => {
    expect(efDeLaRespuesta({ ...PETICION.ef!, modelo: 'responsabilidad' }, ['educacion-deportiva']).modelos).toEqual(['responsabilidad']);
    // La modalidad del docente manda; «ninguna» o una inventada no se guardan
    expect(efDeLaRespuesta({ ...PETICION.ef!, modalidad: 'lucha' }, [], 'invasion').modalidad).toBe('lucha');
    expect(efDeLaRespuesta(PETICION.ef!, [], 'ninguna').modalidad).toBeUndefined();
    expect(efDeLaRespuesta(PETICION.ef!, [], 'esgrima').modalidad).toBeUndefined();
    callGemini.mockResolvedValue(respuesta());
    const sda = await generateSda({ ...PETICION, ef: undefined }, 'es');
    const [system, , , , opciones] = callGemini.mock.calls[0];
    expect(system).not.toContain('EDUCACIÓN FÍSICA');
    expect(opciones.responseSchema.properties.modelosPedagogicos).toBeUndefined();
    expect(sda?.ef).toBeUndefined();
  });
});

describe('varios deportes en una SdA de EF: uno detrás de otro', () => {
  it('el prompt manda trabajarlos en bloques seguidos, nunca alternados, y el esquema decide el orden antes de las sesiones', async () => {
    callGemini.mockResolvedValue(respuesta({ secuenciaDeportes: ['Baloncesto', 'Balonmano'] }));
    await generateSda({ ...PETICION, idea: 'Baloncesto y balonmano' }, 'es');
    const [system, , , , opciones] = callGemini.mock.calls[0];
    expect(system).toContain('SECUENCIA CON LÓGICA');
    expect(system).toContain('UNO DETRÁS DE OTRO');
    expect(system).toMatch(/Nunca alternes deportes sesión a sesión/);
    expect(system).toMatch(/última sesión, o las dos últimas, para el producto final/);
    expect(opciones.responseSchema.properties.secuenciaDeportes.type).toBe('ARRAY');
    const orden = opciones.responseSchema.propertyOrdering;
    expect(orden.indexOf('secuenciaDeportes')).toBeLessThan(orden.indexOf('sesiones'));
    expect(orden[0]).toBe('modelosPedagogicos');
  });

  it('guarda el orden de los deportes solo si son varios, sin repetir y con un tope', async () => {
    expect(secuenciaDeportes(['Baloncesto', ' balonmano ', 'BALONCESTO', 3, ''])).toEqual(['Baloncesto', 'balonmano']);
    expect(secuenciaDeportes(['Voleibol'])).toBeUndefined();
    expect(secuenciaDeportes('Voleibol')).toBeUndefined();
    expect(secuenciaDeportes(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toHaveLength(6);
    callGemini.mockResolvedValue(respuesta({ secuenciaDeportes: ['Baloncesto', 'Balonmano'] }));
    const sda = await generateSda(PETICION, 'es');
    expect(sda?.ef?.secuencia).toEqual(['Baloncesto', 'Balonmano']);
    expect(efDeLaRespuesta(PETICION.ef!, [], undefined, ['Fútbol']).secuencia).toBeUndefined();
  });
});

const act = (nombre: string, minutos = 10) => ({
  nombre, minutos, descripcion: 'Se juega por parejas: cada una pasa y se desmarca; punto si recibe en el área.',
  organizacion: 'Parejas en media pista', material: '1 balón por pareja',
});
// Lo que devuelve la IA: los momentos con su nombre de verdad (activación, desarrollo y vuelta a la calma)
const sesionEF = {
  fase: 'Desarrollo', titulo: 'El pase y el desmarque', descripcion: 'Se trabaja el pase en movimiento.',
  activacion: { texto: 'Se colocan cuatro zonas con conos y se presenta el reto.', actividades: [act('Pilla-pilla de cadenas', 8)] },
  desarrollo: { texto: 'Progresión de 2 contra 1 a 3 contra 2.', actividades: [act('Pase y desmarque 2 contra 1', 15), act('Rondo de 4 contra 1', 12)] },
  vueltaCalma: { texto: 'Puesta en común con semáforo.', actividades: [act('Estiramientos en círculo', 5)] },
};
// Y en las demás áreas: inicio, desarrollo y conclusión
const sesionAula = {
  fase: 'Desarrollo', titulo: 'Medimos el huerto', descripcion: 'Se calcula el perímetro del huerto.',
  inicio: { texto: 'Se recuerda qué es el perímetro.', actividades: [act('Lluvia de ideas', 5)] },
  desarrollo: { texto: 'Por equipos, miden y calculan.', actividades: [act('Medimos con la cinta', 25)] },
  conclusion: { texto: 'Cada equipo comparte su resultado.', actividades: [act('Semáforo de lo aprendido', 5)] },
};

describe('sesiones de EF en activación, desarrollo y vuelta a la calma', () => {
  it('pide actividades reales con nombre en cada momento y la duración de la sesión', async () => {
    callGemini.mockResolvedValue(respuesta({ sesiones: [sesionEF] }));
    await generateSda({ ...PETICION, ef: { ...PETICION.ef!, minutos: 55 } }, 'es');
    const [system, user, , , opciones] = callGemini.mock.calls[0];
    expect(system).toContain('ACTIVACIÓN');
    expect(system).toContain('DESARROLLO');
    expect(system).toContain('VUELTA A LA CALMA');
    expect(system).not.toContain('IMPACTO');
    expect(system).toMatch(/ACTIVIDADES REALES/);
    expect(system).toContain('Prohibido escribir «se realizará un juego de calentamiento»');
    expect(user).toContain('Duración de cada sesión: 55 minutos');
    const sesion = opciones.responseSchema.properties.sesiones.items;
    expect(sesion.required).toEqual(expect.arrayContaining(['activacion', 'desarrollo', 'vueltaCalma']));
    expect(sesion.properties.desarrollo.properties.actividades.items.required).toEqual(['nombre', 'minutos', 'descripcion', 'organizacion', 'material']);
    // Sin EF, inicio, desarrollo y conclusión (18-11-2026)
    callGemini.mockClear();
    callGemini.mockResolvedValue(respuesta());
    await generateSda({ ...PETICION, ef: undefined }, 'es');
    const [systemAula, , , , opcionesAula] = callGemini.mock.calls[0];
    const sesionAulaSchema = opcionesAula.responseSchema.properties.sesiones.items;
    expect(sesionAulaSchema.required).toEqual(expect.arrayContaining(['inicio', 'desarrollo', 'conclusion']));
    expect(sesionAulaSchema.properties.activacion).toBeUndefined();
    expect(sesionAulaSchema.properties.inicio.properties.actividades.items.required).toEqual(['nombre', 'minutos', 'descripcion', 'organizacion', 'material']);
    expect(systemAula).toMatch(/INICIO \("inicio"/);
    expect(systemAula).toMatch(/CONCLUSIÓN \("conclusion"/);
  });

  it('fuera de EF, la SdA guarda el inicio, el desarrollo y la conclusión con sus actividades', async () => {
    callGemini.mockResolvedValue(respuesta({ sesiones: [sesionAula] }));
    const sda = await generateSda({ ...PETICION, ef: undefined }, 'es');
    const m = sda!.sesiones[0].momentos!;
    expect(m.preimpacto.actividades.map(a => a.nombre)).toEqual(['Lluvia de ideas']);
    expect(m.impacto.texto).toBe('Por equipos, miden y calculan.');
    expect(m.postimpacto.actividades.map(a => a.nombre)).toEqual(['Semáforo de lo aprendido']);
  });

  it('la SdA guarda los tres momentos con sus actividades', async () => {
    callGemini.mockResolvedValue(respuesta({ sesiones: [sesionEF] }));
    const sda = await generateSda(PETICION, 'es');
    const m = sda!.sesiones[0].momentos!;
    expect(m.preimpacto.actividades.map(a => a.nombre)).toEqual(['Pilla-pilla de cadenas']);
    expect(m.impacto.actividades.map(a => a.nombre)).toEqual(['Pase y desmarque 2 contra 1', 'Rondo de 4 contra 1']);
    expect(m.postimpacto.texto).toBe('Puesta en común con semáforo.');
    expect(sda!.sesiones[0].descripcion).toBe('Se trabaja el pase en movimiento.');
  });

  it('sanea lo que devuelve la IA: sin nombre o sin explicación no hay actividad, minutos razonables y como mucho cuatro', () => {
    const [s] = sesionesDeLaRespuesta([{
      ...sesionEF,
      desarrollo: { texto: 'x', actividades: [
        act('Uno', 15), { ...act('Sin cómo'), descripcion: '' }, { ...act(''), nombre: '' }, act('Dos', 500), act('Tres', -3), act('Cuatro'), act('Cinco'),
      ] },
    }], true);
    expect(s.momentos!.impacto.actividades.map(a => [a.nombre, a.minutos])).toEqual([['Uno', 15], ['Dos', 0], ['Tres', 0], ['Cuatro', 10]]);
  });

  it('una sesión sin ninguna actividad se queda como sesión de solo descripción, y cada tipo lee sus propios momentos', () => {
    const vacia = { fase: 'Activación', titulo: 'Hola', descripcion: 'Resumen', activacion: { texto: 'a', actividades: [] }, desarrollo: { texto: '', actividades: [] }, vueltaCalma: { texto: '', actividades: [] } };
    expect(sesionesDeLaRespuesta([vacia], true)).toEqual([{ fase: 'Activación', titulo: 'Hola', descripcion: 'Resumen' }]);
    // Una sesión de EF leída como de aula solo encuentra su desarrollo (la clave común)
    expect(Object.keys(sesionesDeLaRespuesta([sesionEF], false)[0].momentos!.impacto)).toEqual(['texto', 'actividades']);
    expect(sesionesDeLaRespuesta([sesionEF], false)[0].momentos!.preimpacto.actividades).toEqual([]);
    expect(sesionesDeLaRespuesta('no es una lista', true)).toEqual([]);
  });

  it('la duración de la sesión, entera y con sentido', () => {
    expect(minutosDeSesion({})).toBe(50);
    expect(minutosDeSesion({ minutos: 45.4 })).toBe(45);
    expect(minutosDeSesion({ minutos: 5 })).toBe(50);
    expect(minutosDeSesion({ minutos: 999 })).toBe(50);
    expect(minutosDeSesion({ minutos: Number.NaN })).toBe(50);
  });
});

import { ajustarSesionesABase } from './learningSituations';

describe('SdA a partir de sesiones ya preparadas', () => {
  const base = [{ titulo: 'Conocemos', resumen: 'Se presentan los juegos.' }, { titulo: 'Jugamos', resumen: '' }, { titulo: 'Evaluamos', resumen: 'Cierre.' }];
  it('deja exactamente las sesiones del docente, con sus títulos, aunque la IA devuelva de más o de menos', () => {
    const r = ajustarSesionesABase([
      { fase: 'Activación', titulo: 'Otro título', descripcion: 'Texto de la IA.' },
      { fase: 'Desarrollo', titulo: 'Otro', descripcion: '' },
    ], base);
    expect(r.map(s => s.titulo)).toEqual(['Conocemos', 'Jugamos', 'Evaluamos']);
    expect(r[0]).toMatchObject({ fase: 'Activación', descripcion: 'Texto de la IA.' });
    expect(r[1].descripcion).toBe('Jugamos');
    expect(r[2]).toMatchObject({ fase: 'Cierre', descripcion: 'Cierre.' });
  });
  it('sin nada devuelto, solo lo del docente', () => {
    expect(ajustarSesionesABase([], base).map(s => s.descripcion)).toEqual(['Se presentan los juegos.', 'Jugamos', 'Cierre.']);
  });
});
