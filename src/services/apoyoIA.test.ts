/**
 * La IA del módulo de PT y AL: se apoya en la normativa de la comunidad y en
 * los autores de referencia, recibe la ficha entera del alumno (también el
 * diagnóstico, decisión del dueño del 4-10-2026) y solo enlaza criterios del
 * curso de su nivel, de la lista cerrada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proponerObjetivos, materiasParaAmbito, marcoApoyo, normativaInclusion, alumnoParaIA, adaptarTema } from './apoyoIA';
import { cargarCurriculo } from '../lib/curriculum/cargar';
import { resolverGrupo } from '../lib/curriculum/index';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { AlumnoApoyo, CursoDe } from '../types/apoyo';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

/** Todas las áreas de 2º de Primaria de Madrid. */
async function segundo(): Promise<MateriaDeClase[]> {
  const { materias } = await cargarCurriculo('madrid', 'primaria', 'es');
  return materias.flatMap(e => {
    const r = resolverGrupo('primaria', e.nombre, 2, undefined, materias);
    return r ? [{ asignatura: e.nombre, entry: r.entry, grupo: r.grupo }] : [];
  });
}

const nombreCurso = (c: CursoDe) => `${c.curso}º ${c.etapa === 'primaria' ? 'Primaria' : 'ESO'}`;
const marta: AlumnoApoyo = {
  id: 'a1', nombre: 'Marta Gil', claseOrigen: '4º B',
  matricula: { etapa: 'primaria', curso: 4 }, nivel: { etapa: 'primaria', curso: 2 },
  categoria: 'Necesidades educativas especiales', diagnostico: 'Discapacidad intelectual leve',
  necesidades: 'Aprende mejor con apoyo visual', notas: '',
};

describe('marco de la IA', () => {
  it('cita la normativa de inclusión de cada comunidad y la estatal para el resto', () => {
    expect(normativaInclusion('comunitat-valenciana')).toContain('Orden 20/2019');
    expect(normativaInclusion('comunitat-valenciana')).toContain('PAP');
    expect(normativaInclusion('cataluna')).toContain('Decret 150/2017');
    expect(normativaInclusion('madrid')).toContain('Decreto 23/2023');
    expect(normativaInclusion('galicia')).toContain('Real Decreto 157/2022');
    expect(normativaInclusion(undefined)).toContain('LOMLOE');
  });

  it('lleva los autores de referencia y pide no inventar', () => {
    const m = marcoApoyo('madrid', 'es');
    expect(m).toContain('Bloom y Lahey');
    expect(m).toContain('Diseño Universal para el Aprendizaje');
    expect(m).toContain('no inventes');
    expect(marcoApoyo('madrid', 'en')).toContain('in English');
  });

  it('la ficha del alumno incluye el diagnóstico y su nivel', () => {
    const f = alumnoParaIA(marta, nombreCurso);
    expect(f).toContain('Marta Gil');
    expect(f).toContain('Diagnóstico: Discapacidad intelectual leve');
    expect(f).toContain('Nivel de competencia curricular: 2º Primaria');
    expect(f).toContain('Matriculado en 4º Primaria (4º B)');
  });
});

describe('materiasParaAmbito', () => {
  it('Lengua para lectoescritura y lenguaje, Matemáticas para matemáticas, todas en una ACIS, ninguna en conducta', async () => {
    const m = await segundo();
    const nombres = (a: string) => materiasParaAmbito(a, m).map(x => x.entry.nombre);
    expect(nombres('Programa personalizado para el aprendizaje de la lectura y la escritura')).toEqual(['Lengua Castellana y Literatura']);
    expect(nombres('Morfosintaxis')).toEqual(['Lengua Castellana y Literatura']);
    expect(nombres('Programa personalizado para el aprendizaje de las matemáticas')).toEqual(['Matemáticas']);
    expect(nombres('Razonamiento lógico-matemático')).toEqual(['Matemáticas']);
    expect(nombres('Adaptación curricular individual significativa (ACIS)')).toHaveLength(m.length);
    expect(nombres('Programa específico de conducta o plan terapéutico')).toEqual([]);
    expect(nombres('Pragmática')).toEqual([]);
    expect(nombres('Atención, memoria y funciones ejecutivas')).toEqual([]);
    // La lengua extranjera no entra en lectoescritura
    expect(nombres('Lectoescritura').some(n => /Extranjera/.test(n))).toBe(false);
  });
});

describe('proponerObjetivos', () => {
  beforeEach(() => callGemini.mockReset());

  it('reparte por trimestres y solo deja criterios de la lista cerrada de su nivel', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ objetivos: [
      { texto: 'Leer sílabas directas', trimestres: [1, 1], criterios: ['Lengua Castellana y Literatura|3.1', 'Matemáticas|1.1', 'Lengua Castellana y Literatura|99.9'] },
      { texto: '  Escribir palabras sencillas ', trimestres: [5], criterios: [] },
      { texto: '', trimestres: [2] },
    ] }));
    const r = await proponerObjetivos({
      alumno: marta, programa: { ambito: 'Lectoescritura', especialidad: 'PT' },
      actuales: [{ id: 'x', texto: 'Reconocer las vocales', trimestres: [1], criterios: [] }],
      materias: await segundo(), comunidad: 'madrid', lang: 'es', nombreCurso,
    });
    expect(r).not.toBeNull();
    expect(r).toHaveLength(2);
    expect(r![0].trimestres).toEqual([1]);
    expect(r![0].criterios.every(c => c.materia !== 'matematicas')).toBe(true);
    expect(r![0].criterios.every(c => c.codigo !== '99.9')).toBe(true);
    expect(r![1]).toEqual({ texto: 'Escribir palabras sencillas', trimestres: [1, 2, 3], criterios: [] });

    const [sistema, usuario, , , opciones] = callGemini.mock.calls[0];
    expect(sistema).toContain('Decreto 23/2023');
    expect(usuario).toContain('Diagnóstico: Discapacidad intelectual leve');
    expect(usuario).toContain('no los repitas');
    expect(usuario).toContain('Reconocer las vocales');
    expect(usuario).toContain('Criterios oficiales de 2º Primaria');
    const enumCriterios: string[] = opciones.responseSchema.properties.objetivos.items.properties.criterios.items.enum;
    expect(enumCriterios.every(c => c.startsWith('Lengua Castellana y Literatura|'))).toBe(true);
  });

  it('en un ámbito sin área no pide criterios', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ objetivos: [{ texto: 'Respetar el turno de palabra', trimestres: [1, 2] }] }));
    const r = await proponerObjetivos({
      alumno: marta, programa: { ambito: 'Pragmática', especialidad: 'AL' }, actuales: [],
      materias: await segundo(), comunidad: 'comunitat-valenciana', lang: 'es', nombreCurso,
    });
    expect(r).toEqual([{ texto: 'Respetar el turno de palabra', trimestres: [1, 2], criterios: [] }]);
    const [sistema, usuario, , , opciones] = callGemini.mock.calls[0];
    expect(sistema).toContain('Orden 20/2019');
    expect(usuario).toContain('Audición y Lenguaje');
    expect(opciones.responseSchema.properties.objetivos.items.properties.criterios).toBeUndefined();
  });

  it('si la IA falla, no inventa nada', async () => {
    callGemini.mockResolvedValueOnce(null);
    const r = await proponerObjetivos({
      alumno: marta, programa: { ambito: 'Lectoescritura', especialidad: 'PT' }, actuales: [],
      materias: [], comunidad: undefined, lang: 'es', nombreCurso,
    });
    expect(r).toBeNull();
    callGemini.mockResolvedValueOnce('esto no es JSON');
    const onError = vi.fn();
    expect(await proponerObjetivos({
      alumno: marta, programa: { ambito: 'Lectoescritura', especialidad: 'PT' }, actuales: [],
      materias: [], comunidad: undefined, lang: 'es', nombreCurso,
    }, { onError })).toBeNull();
    expect(onError).toHaveBeenCalled();
  });
});

describe('adaptarTema', () => {
  beforeEach(() => callGemini.mockReset());

  it('propone para cada alumno cómo trabajar el tema de su clase con sus objetivos, y descarta ids ajenos', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ alumnos: [
      { id: 'a1', propuesta: ' Contar fracciones con tarjetas de sílabas. ' },
      { id: 'otro', propuesta: 'No debería entrar' },
    ] }));
    const r = await adaptarTema({
      tema: 'Las fracciones', especialidad: 'PT', comunidad: 'madrid', lang: 'es', nombreCurso,
      alumnos: [{ alumno: marta, objetivos: ['Leer sílabas directas'] }],
    });
    expect(r).toEqual({ a1: 'Contar fracciones con tarjetas de sílabas.' });
    const [sistema, usuario, , , opciones] = callGemini.mock.calls[0];
    expect(sistema).toContain('Decreto 23/2023');
    expect(usuario).toContain('Hoy su clase de referencia trabaja: Las fracciones');
    expect(usuario).toContain('- Leer sílabas directas');
    expect(usuario).toContain('DUA');
    expect(opciones.responseSchema.properties.alumnos.items.properties.id.enum).toEqual(['a1']);
  });

  it('sin alumnado no llama a la IA', async () => {
    expect(await adaptarTema({ tema: 'X', especialidad: 'AL', comunidad: undefined, lang: 'es', nombreCurso, alumnos: [] })).toEqual({});
    expect(callGemini).not.toHaveBeenCalled();
  });
});
