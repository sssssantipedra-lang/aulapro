import { describe, it, expect } from 'vitest';
import { propuestaDeRespuesta, conInforme } from './informeOrientacion';
import { alumnoParaIA } from './apoyoIA';
import type { AlumnoApoyo } from '../types/apoyo';

const alumno = (extra: Partial<AlumnoApoyo> = {}): AlumnoApoyo => ({
  id: 'a', nombre: 'Alumno 1', claseOrigen: '3º B', categorias: ['Trastorno del espectro del autismo (TEA)'], diagnostico: 'TEA grado 1', necesidades: 'Necesita anticipación.', notas: '', ...extra,
});

describe('propuestaDeRespuesta', () => {
  it('se queda solo con lo que existe: categorías de la lista, ámbitos ofrecidos y un nivel válido', () => {
    const p = propuestaDeRespuesta({
      categorias: ['Trastorno del espectro del autismo (TEA)', 'Inventada'], diagnostico: ' TEA ', necesidades: 'x', nivelEtapa: 'primaria', nivelCurso: '2',
      fortalezas: ' Memoria visual ', orientaciones: 'Anticipar', ambitos: ['Lectoescritura', 'Otro', 'Lectoescritura'],
    }, ['Lectoescritura', 'Autonomía personal']);
    expect(p.categorias).toEqual(['Trastorno del espectro del autismo (TEA)']);
    expect(p.diagnostico).toBe('TEA');
    expect(p.nivel).toEqual({ etapa: 'primaria', curso: 2 });
    expect(p.fortalezas).toBe('Memoria visual');
    expect(p.ambitos).toEqual(['Lectoescritura']);
  });
  it('los objetivos que plantea el informe se recogen tal cual, con un programa que exista y sus trimestres', () => {
    const p = propuestaDeRespuesta({
      objetivos: [
        { texto: ' Reconocer las letras ', ambito: 'Lectoescritura', trimestres: ['1', '2'] },
        { texto: 'Pedir ayuda', ambito: 'ninguno', trimestres: [] },
        { texto: 'Programa inventado', ambito: 'No existe', trimestres: ['3'] },
        { texto: '   ', ambito: 'Lectoescritura', trimestres: ['1'] },
      ],
    }, ['Lectoescritura']);
    expect(p.objetivos.map(o => [o.texto, o.ambito, o.trimestres, o.origen])).toEqual([
      ['Reconocer las letras', 'Lectoescritura', [1, 2], 'informe'],
      ['Pedir ayuda', undefined, [1, 2, 3], 'informe'],
      ['Programa inventado', undefined, [3], 'informe'],
    ]);
  });
  it('un nivel imposible o ausente no se guarda', () => {
    expect(propuestaDeRespuesta({ nivelEtapa: 'eso', nivelCurso: '6' }, []).nivel).toBeUndefined();
    expect(propuestaDeRespuesta({ nivelEtapa: 'ninguna', nivelCurso: '0' }, []).nivel).toBeUndefined();
    expect(propuestaDeRespuesta(null, []).categorias).toEqual([]);
  });
});

describe('conInforme', () => {
  const p = propuestaDeRespuesta({ categorias: ['Discapacidad intelectual'], diagnostico: '', necesidades: 'Nuevas necesidades.', nivelEtapa: 'primaria', nivelCurso: '1', fortalezas: 'f', orientaciones: 'o', ambitos: [] }, []);
  it('suma las categorías, no borra lo que la propuesta deja vacío y guarda las conclusiones sin el archivo', () => {
    const a = conInforme(alumno(), p, 'informe.pdf', '2026-10-25');
    expect(a.categorias).toContain('Trastorno del espectro del autismo (TEA)');
    expect(a.diagnostico).toBe('TEA grado 1');
    expect(a.necesidades).toBe('Nuevas necesidades.');
    expect(a.nivel).toEqual({ etapa: 'primaria', curso: 1 });
    expect(a.informe).toEqual({ fecha: '2026-10-25', archivo: 'informe.pdf', fortalezas: 'f', orientaciones: 'o', ambitos: [] });
    // Sin objetivos en el informe, no se inventa ninguno
    expect(a.objetivosOrientacion).toBeUndefined();
  });
});

describe('lo que la IA sabe del alumno', () => {
  it('incluye las conclusiones del informe del orientador', () => {
    const txt = alumnoParaIA(alumno({ informe: { fecha: '2026-10-25', fortalezas: 'Memoria visual', orientaciones: 'Anticipar los cambios', ambitos: [] } }), () => '');
    expect(txt).toContain('Fortalezas (informe del orientador): Memoria visual');
    expect(txt).toContain('Orientaciones del informe del orientador: Anticipar los cambios');
    expect(alumnoParaIA(alumno(), () => '')).not.toContain('informe del orientador');
  });
});
