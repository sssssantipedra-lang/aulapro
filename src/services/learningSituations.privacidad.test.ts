/**
 * «Cómo es el grupo» de una situación de aprendizaje es texto libre sobre el alumnado: va sin datos de contacto ni de
 * salud (auditoría del 5-11-2026). Las barreras ya pasaban por `lib/barreras.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateSda, type SdaRequest } from './learningSituations';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

describe('generateSda', () => {
  it('las características del grupo van sin datos de salud ni teléfonos', async () => {
    callGemini.mockResolvedValueOnce(null);
    const req = {
      idea: 'El huerto escolar', numero: '1', temporalizacion: '1er trimestre', meses: 'octubre', areas: ['Matemáticas'], numSesiones: 3,
      nivel: '5º de Primaria', contextoClase: 'Dos alumnos con TEA y uno con TDAH; la madre de uno avisa al 612 345 678. Les cuesta trabajar en grupo.',
      metodologia: 'ABP', documentos: [],
    } as SdaRequest;
    await generateSda(req, 'es');
    const usuario = callGemini.mock.calls[0][1] as string;
    expect(usuario).not.toMatch(/TEA|TDAH|612/);
    expect(usuario).toContain('Les cuesta trabajar en grupo');
    expect(usuario).toContain('[dato de salud]');
  });
});
