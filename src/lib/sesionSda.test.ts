import { describe, it, expect } from 'vitest';
import { actividadEnTexto, minutosDeSesion, sesionEnTexto, sesionParaEF } from './sesionSda';
import type { SdaSession } from '../services/learningSituations';

const t = (k: string) => k;
const act = (nombre: string, minutos: number, material = 'Conos') => ({ nombre, minutos, descripcion: 'Cómo se juega.', organizacion: 'Grupos de 4', material });
const sesion: SdaSession = {
  fase: 'Desarrollo', titulo: 'Pases', descripcion: 'Resumen de la sesión.',
  momentos: {
    preimpacto: { texto: 'Se colocan zonas.', actividades: [act('Pilla-pilla', 8)] },
    impacto: { texto: 'Progresión.', actividades: [act('Rondo', 15, 'Balones'), act('2 contra 1', 12, 'Balones')] },
    postimpacto: { texto: 'Puesta en común.', actividades: [act('Estiramientos', 5, 'ninguno')] },
  },
};

describe('sesión de EF de la SdA como texto', () => {
  it('una actividad: nombre, minutos, cómo, organización y material', () => {
    expect(actividadEnTexto(act('Rondo', 15), t)).toBe('Rondo (15 min). Cómo se juega. Organización: Grupos de 4 Material: Conos');
    expect(actividadEnTexto({ ...act('Rondo', 0), material: '' }, t)).toBe('Rondo. Cómo se juega. Organización: Grupos de 4');
  });

  it('la sesión en texto lleva el resumen y los tres momentos, cada uno con sus actividades', () => {
    const x = sesionEnTexto(sesion, t);
    expect(x.split('\n\n')).toHaveLength(4);
    expect(x).toContain('PREIMPACTO\nSe colocan zonas.\n• Pilla-pilla (8 min).');
    expect(x).toContain('IMPACTO\nProgresión.\n• Rondo (15 min).');
    expect(x).toContain('POSTIMPACTO\nPuesta en común.\n• Estiramientos (5 min).');
  });

  it('una sesión sin momentos (de antes, o de otra materia) sigue siendo su descripción', () => {
    expect(sesionEnTexto({ fase: 'x', titulo: 'y', descripcion: 'Solo esto.' }, t)).toBe('Solo esto.');
  });

  it('suma los minutos de todas las actividades', () => {
    expect(minutosDeSesion(sesion.momentos!)).toBe(40);
  });

  it('al pasarla a Sesiones de EF, cada momento va a su parte y el material sin repetir ni «ninguno»', () => {
    const e = sesionParaEF(sesion, t);
    expect(e.objetivo).toBe('Resumen de la sesión.');
    expect(e.calentamiento).toContain('Pilla-pilla (8 min).');
    expect(e.principal).toContain('Rondo (15 min).');
    expect(e.principal).toContain('2 contra 1 (12 min).');
    expect(e.calma).toContain('Estiramientos (5 min).');
    expect(e.material).toBe('Conos; Balones');
    // Sin momentos: como antes, la descripción en la parte principal
    expect(sesionParaEF({ fase: 'x', titulo: 'y', descripcion: 'Solo esto.' }, t)).toEqual({ objetivo: 'Solo esto.', calentamiento: '', principal: 'Solo esto.', calma: '', material: '' });
  });
});
