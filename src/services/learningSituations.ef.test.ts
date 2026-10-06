/**
 * La SdA de Educación Física es la SdA de siempre (competencias, criterios y
 * saberes del decreto, competencias clave, sesiones) con lo propio de EF:
 * el modelo pedagógico, el DUA-A, el material, las instalaciones y las
 * limitaciones sin nombres. Las referencias las pone la aplicación desde
 * `lib/modelosEF`, nunca la IA (decisión del dueño, 5-10-2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { efDeLaRespuesta, generateSda, type SdaRequest } from './learningSituations';
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
