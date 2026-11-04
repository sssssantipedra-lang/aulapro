import { describe, it, expect } from 'vitest';
import { conInforme, propuestaDesdeFicha } from './informeOrientacion';
import { alumnoParaIA } from './apoyoIA';
import type { AlumnoApoyo } from '../types/apoyo';

const alumno = (extra: Partial<AlumnoApoyo> = {}): AlumnoApoyo => ({
  id: 'a', nombre: 'Alumno 1', claseOrigen: '3º B', categorias: ['Trastorno del espectro del autismo (TEA)'], diagnostico: 'TEA grado 1', necesidades: 'Necesita anticipación.', notas: '', ...extra,
});

describe('anotar el informe (sin IA, 3-11-2026)', () => {
  it('parte de lo que ya tiene su ficha', () => {
    const p = propuestaDesdeFicha(alumno({ apoyos: ['Apoyo visual (imágenes, pictogramas, esquemas)'], informe: { fecha: '2026-10-01', fortalezas: 'f', orientaciones: 'o', ambitos: ['Lectoescritura'] } }));
    expect(p.categorias).toEqual(['Trastorno del espectro del autismo (TEA)']);
    expect(p.diagnostico).toBe('TEA grado 1');
    expect(p.apoyos).toEqual(['Apoyo visual (imágenes, pictogramas, esquemas)']);
    expect(p.ambitos).toEqual(['Lectoescritura']);
    expect(p.objetivos).toEqual([]);
  });

  it('guarda lo anotado, también lo que se quita, sin archivo, y suma los objetivos nuevos', () => {
    const p = { ...propuestaDesdeFicha(alumno()), categorias: ['Discapacidad intelectual'], necesidades: 'Nuevas necesidades.', apoyos: ['Pausas activas'], fortalezas: 'f', orientaciones: 'o',
      objetivos: [{ id: 'x', texto: 'Reconocer las letras', ambito: 'Lectoescritura', trimestres: [1, 2] as (1 | 2 | 3)[], origen: 'informe' as const }] };
    const a = conInforme(alumno(), p, undefined, '2026-11-03');
    expect(a.categorias).toEqual(['Discapacidad intelectual']);
    expect(a.necesidades).toBe('Nuevas necesidades.');
    expect(a.apoyos).toEqual(['Pausas activas']);
    expect(a.informe).toEqual({ fecha: '2026-11-03', fortalezas: 'f', orientaciones: 'o', ambitos: [] });
    expect(a.objetivosOrientacion?.map(o => o.texto)).toEqual(['Reconocer las letras']);
    expect(conInforme(alumno({ apoyos: ['Pausas activas'] }), { ...p, apoyos: [] }, undefined, '2026-11-03').apoyos).toBeUndefined();
  });
});

describe('lo que la IA sabe del alumno', () => {
  it('incluye las conclusiones del informe del orientador', () => {
    const txt = alumnoParaIA(alumno({ informe: { fecha: '2026-10-25', fortalezas: 'Memoria visual', orientaciones: 'Anticipar los cambios', ambitos: [] } }), () => '');
    expect(txt).toContain('Fortalezas (informe del orientador): Memoria visual');
    expect(txt).toContain('Orientaciones del informe del orientador: Anticipar los cambios');
    expect(alumnoParaIA(alumno(), () => '')).not.toContain('informe del orientador');
  });
  it('recibe los apoyos que necesita en el aula, y nunca la categoría ni el diagnóstico', () => {
    const txt = alumnoParaIA(alumno({ apoyos: ['Instrucciones cortas, de una en una'] }), () => '');
    expect(txt).toContain('Apoyos que necesita en el aula: Instrucciones cortas, de una en una');
    expect(txt).not.toMatch(/TEA|autismo|grado 1/);
  });
});
