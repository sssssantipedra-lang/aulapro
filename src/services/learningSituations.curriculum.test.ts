/**
 * Que la SdA deje de inventarse competencias específicas y saberes básicos
 * es el cambio que motivó `lib/curriculum`. Aquí se comprueba el mecanismo
 * completo: para un área que empareja con el currículo real, el texto final
 * sale de los datos verificados —nunca de lo que escriba la IA en esos
 * campos—, y para la que no empareja, todo sigue funcionando como antes.
 *
 * Se mockea `callGemini` en vez de `fetch`: lo que aquí importa es cómo se
 * construye el prompt y, sobre todo, qué hace `generateSda` con la respuesta
 * — no la llamada HTTP en sí, que ya cubre `gemini.thinking.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateSda, type SdaRequest } from './learningSituations';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

const BASE: SdaRequest = {
  idea: 'Un proyecto sobre el reciclaje en el patio',
  numero: '3',
  temporalizacion: '4 semanas',
  meses: 'Marzo',
  areas: ['Matemáticas'],
  numSesiones: 4,
  nivel: '5º de Primaria',
  contextoClase: '',
  metodologia: '',
  docente: 'Ana',
  documentos: [],
};

/** Una respuesta de la IA con texto libre inventado y, además, códigos elegidos. */
function respuestaSimulada(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    titulo: 't', justificacion: 'j', ods: 'o', objetivosEtapa: 'oe',
    competenciasClave: 'CCL', explicacionCurricular: 'e',
    areas: [{
      area: 'Matemáticas',
      // Texto que la IA NO debería poder colar si el área está emparejada:
      // si esto acaba en el resultado, el mecanismo de sustitución ha fallado.
      competenciasEspecificas: 'TEXTO INVENTADO POR LA IA, NO DEBERÍA VERSE',
      criteriosEvaluacion: 'TEXTO INVENTADO POR LA IA, NO DEBERÍA VERSE',
      saberesBasicos: 'TEXTO INVENTADO POR LA IA, NO DEBERÍA VERSE',
      competenciasSeleccionadas: [1, 2],
      saberesSeleccionados: ['A', 'B'],
      ...overrides,
    }],
    inclusionUniversal: 'u', inclusionAdicional: 'ad', inclusionIndividualizada: 'i',
    metodologia: 'm', agrupamiento: 'ag', recursos: 'r', productoFinal: 'p',
    evaluacionTecnicas: 'et', evaluacionInstrumentos: 'ei', sesiones: [],
  });
}

describe('generateSda con currículo real', () => {
  it('sustituye el texto de la IA por el texto oficial cuando el área empareja', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());

    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5 }, 'es');

    const area = sda!.areas[0];
    expect(area.competenciasEspecificas).not.toContain('INVENTADO');
    expect(area.criteriosEvaluacion).not.toContain('INVENTADO');
    expect(area.saberesBasicos).not.toContain('INVENTADO');
    // Texto real de la competencia 1 de Matemáticas de Primaria (RD 157/2022).
    expect(area.competenciasEspecificas).toContain('Interpretar situaciones de la vida cotidiana');
    // El código del criterio debe ser del 3er ciclo (curso 5 → ciclo 3), no de otro.
    expect(area.criteriosEvaluacion).toMatch(/^1\.1 /m);
    expect(area.saberesBasicos).toContain('Sentido numérico');
  });

  it('no toca el texto libre si el área no empareja con ninguna materia', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada({
      area: 'Una asignatura que no existe en ningún decreto',
      competenciasSeleccionadas: [1, 2],
      saberesSeleccionados: ['A', 'B'],
    }));

    const sda = await generateSda({ ...BASE, areas: ['Una asignatura que no existe en ningún decreto'], etapa: 'primaria', curso: 5 }, 'es');

    // Sin materia emparejada, los códigos elegidos no tienen dónde aplicarse:
    // se queda el texto de la IA, exactamente como antes de este cambio.
    expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
  });

  it('no toca el texto libre si no se indica etapa y curso', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());

    const sda = await generateSda(BASE, 'es'); // sin etapa/curso

    expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
  });

  it('no toca el texto libre si los códigos elegidos no son válidos para esa área', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada({
      competenciasSeleccionadas: [999], // no existe
      saberesSeleccionados: ['Z'],      // no existe
    }));

    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5 }, 'es');

    expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
  });

  it('no filtra los campos internos de selección al resultado final', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());
    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5 }, 'es');
    expect(sda!.areas[0]).not.toHaveProperty('competenciasSeleccionadas');
    expect(sda!.areas[0]).not.toHaveProperty('saberesSeleccionados');
  });

  it('en la ESO, resuelve el grupo de cursos correcto por materia (no un ciclo uniforme)', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada({
      area: 'Biología y Geología',
      competenciasSeleccionadas: [1],
      saberesSeleccionados: ['A'],
    }));

    // 1º de ESO: Biología agrupa "Cursos de primero a tercero".
    const sda = await generateSda(
      { ...BASE, areas: ['Biología y Geología'], etapa: 'eso', curso: 1 }, 'es',
    );
    expect(sda!.areas[0].competenciasEspecificas).not.toContain('INVENTADO');
    expect(sda!.areas[0].competenciasEspecificas).toContain('Interpretar y transmitir información');
  });

  it('Matemáticas de 4º de ESO sin indicar opción A/B no empareja (queda en texto libre)', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());

    const sda = await generateSda(
      { ...BASE, areas: ['Matemáticas'], etapa: 'eso', curso: 4 }, 'es', // sin opcionMatematicas
    );
    expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
  });

  it('Matemáticas de 4º de ESO con opción B usa los criterios propios de esa opción', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());

    const sda = await generateSda(
      { ...BASE, areas: ['Matemáticas'], etapa: 'eso', curso: 4, opcionMatematicas: 'B' }, 'es',
    );
    expect(sda!.areas[0].competenciasEspecificas).not.toContain('INVENTADO');
  });

  it('el prompt trae la lista real solo para las áreas que emparejan, no para las demás', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());

    await generateSda({
      ...BASE,
      areas: ['Matemáticas', 'Una optativa de centro'],
      etapa: 'primaria', curso: 5,
    }, 'es');

    const userPrompt = callGemini.mock.calls[0][1] as string;
    expect(userPrompt).toContain('ÁREA "Matemáticas" — CURRÍCULO OFICIAL REAL');
    expect(userPrompt).not.toContain('ÁREA "Una optativa de centro"');
  });
});
