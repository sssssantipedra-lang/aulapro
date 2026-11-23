import { describe, it, expect } from 'vitest';
import { conDianaGuardada, dianaGuardada, otrasDianasGuardadas } from './dianaGuardada';
import type { DianaProfile } from '../types';

const HOY = '2027-02-15';
const [PRIMERA, SEGUNDA, TERCERA, CURSO] = ['1ª evaluación', '2ª evaluación', '3ª evaluación', 'Final de curso'];
const diana = (nivel: number, updated: string) => ({ scores: { ds1: nivel }, descriptors: { ds1: `Nivel ${nivel}` }, updated });

describe('la Diana competencial guardada, por evaluación', () => {
  it('una Diana guardada antes de haber evaluaciones es la de todo el curso, sin migrar nada', () => {
    const deAntes: DianaProfile = diana(3, '2026-11-12');
    expect(dianaGuardada(deAntes, CURSO, HOY)).toEqual(diana(3, '2026-11-12'));
    expect(dianaGuardada(deAntes, PRIMERA, HOY)).toBeNull();
    expect(otrasDianasGuardadas(deAntes, SEGUNDA, HOY)).toEqual([{ periodo: CURSO, updated: '2026-11-12' }]);
  });

  it('cada evaluación guarda la suya sin pisar las demás ni la del curso', () => {
    let perfil: DianaProfile | undefined = diana(3, '2026-11-12');
    perfil = conDianaGuardada(perfil, PRIMERA, HOY, diana(2, '2026-12-18'));
    perfil = conDianaGuardada(perfil, SEGUNDA, HOY, diana(4, '2027-02-15'));
    expect(dianaGuardada(perfil, PRIMERA, HOY)?.scores.ds1).toBe(2);
    expect(dianaGuardada(perfil, SEGUNDA, HOY)?.scores.ds1).toBe(4);
    expect(dianaGuardada(perfil, TERCERA, HOY)).toBeNull();
    expect(dianaGuardada(perfil, CURSO, HOY)?.scores.ds1).toBe(3);
    // Guardar la del curso conserva las de las evaluaciones
    perfil = conDianaGuardada(perfil, CURSO, HOY, diana(1, '2027-02-16'));
    expect(dianaGuardada(perfil, CURSO, HOY)).toEqual(diana(1, '2027-02-16'));
    expect(dianaGuardada(perfil, PRIMERA, HOY)?.scores.ds1).toBe(2);
    expect(otrasDianasGuardadas(perfil, TERCERA, HOY).map(o => o.periodo)).toEqual([PRIMERA, SEGUNDA, CURSO]);
  });

  it('un alumno sin Diana del curso puede tener la de una evaluación', () => {
    const perfil = conDianaGuardada(undefined, SEGUNDA, HOY, diana(3, '2027-02-15'));
    expect(perfil.porEvaluacion).toEqual({ '2026-2': diana(3, '2027-02-15') });
    expect(dianaGuardada(perfil, CURSO, HOY)).toBeNull();
    expect(otrasDianasGuardadas(perfil, CURSO, HOY)).toEqual([{ periodo: SEGUNDA, updated: '2027-02-15' }]);
    expect(otrasDianasGuardadas(perfil, SEGUNDA, HOY)).toEqual([]);
  });

  it('una Diana vacía (reiniciada y guardada) cuenta como sin guardar', () => {
    const perfil = conDianaGuardada(diana(3, '2026-11-12'), PRIMERA, HOY, { scores: { ds1: 0 }, descriptors: { ds1: ' ' }, updated: '2026-12-01' });
    expect(dianaGuardada(perfil, PRIMERA, HOY)).toBeNull();
    expect(dianaGuardada(undefined, CURSO, HOY)).toBeNull();
  });

  it('la Diana de la 1.ª de otro curso no es la de la 1.ª de este', () => {
    const perfil = conDianaGuardada(undefined, PRIMERA, '2026-10-10', diana(2, '2026-10-10'));
    expect(dianaGuardada(perfil, PRIMERA, '2027-06-01')?.scores.ds1).toBe(2);
    expect(dianaGuardada(perfil, PRIMERA, '2027-10-01')).toBeNull();
  });
});
