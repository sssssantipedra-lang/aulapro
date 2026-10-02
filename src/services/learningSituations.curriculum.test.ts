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
import { CARGADORES } from '../lib/curriculum/cargar';
import { materiasDe, type CurriculumEntry } from '../lib/curriculum';

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

describe('generateSda: de qué decreto sale y cómo se cita', () => {
  const CITA_ESTATAL = 'Real Decreto 157/2022, de 1 de marzo (BOE núm. 52, de 2 de marzo de 2022)';

  it('sin comunidad usa el estatal y lo cita en la propia SdA', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());
    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5 }, 'es');
    expect(sda!.normativa).toEqual({ comunidad: 'fuera', origen: 'estatal', cita: CITA_ESTATAL });
  });

  it('una comunidad que aún no tiene su decreto copiado usa el estatal y lo dice: origen estatal', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());
    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5, comunidad: 'madrid' }, 'es');
    expect(sda!.normativa).toEqual({ comunidad: 'madrid', origen: 'estatal', cita: CITA_ESTATAL });
  });

  it('el prompt nombra el decreto del que salen las listas, no «enseñanzas mínimas» a secas', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());
    await generateSda({ ...BASE, etapa: 'primaria', curso: 5 }, 'es');
    const userPrompt = callGemini.mock.calls.at(-1)![1] as string;
    expect(userPrompt).toContain(`CURRÍCULO OFICIAL REAL (${CITA_ESTATAL})`);
  });

  it('no cita ningún decreto si ninguna área usó currículo oficial', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());
    const sda = await generateSda(BASE, 'es'); // sin etapa ni curso
    expect(sda!.normativa).toBeUndefined();
  });

  it('tampoco si el área empareja pero la IA eligió códigos que no existen: el texto es el libre', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada({ competenciasSeleccionadas: [999], saberesSeleccionados: ['Z'] }));
    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5 }, 'es');
    expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
    expect(sda!.normativa).toBeUndefined();
  });

  it('un área que el docente dejó en modo libre no recibe lista, aunque el alias la emparejara', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada());
    const sda = await generateSda({
      ...BASE, etapa: 'primaria', curso: 5, materiasOficiales: { Matemáticas: null },
    }, 'es');
    const userPrompt = callGemini.mock.calls.at(-1)![1] as string;
    expect(userPrompt).not.toContain('CURRÍCULO OFICIAL REAL');
    expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
    expect(sda!.normativa).toBeUndefined();
  });

  it('la materia que elige el docente manda: «Ciencias» no tiene alias, pero la eligió', async () => {
    callGemini.mockResolvedValueOnce(respuestaSimulada({ area: 'Ciencias' }));
    const sda = await generateSda({
      ...BASE, areas: ['Ciencias'], etapa: 'primaria', curso: 5,
      materiasOficiales: { Ciencias: 'Conocimiento del Medio Natural, Social y Cultural' },
    }, 'es');
    expect(sda!.areas[0].competenciasEspecificas).not.toContain('INVENTADO');
    expect(sda!.normativa?.origen).toBe('estatal');
  });

  describe('con el decreto de una comunidad copiado', () => {
    // Una materia con otro nombre y otro texto, para ver que se usa ESTA lista y no la estatal
    const CIENCIAS: CurriculumEntry = {
      ...materiasDe('primaria').find(m => m.nombre === 'Matemáticas')!,
      id: 'ciencias-de-la-naturaleza',
      nombre: 'Ciencias de la Naturaleza',
      competencias: [{ n: 1, texto: 'Texto propio de la comunidad sobre la naturaleza.' }, { n: 2, texto: 'Otro texto propio.' }],
    };

    it('usa su lista, la cita como autonómica y nombra el decreto en el prompt', async () => {
      CARGADORES.madrid = { primaria: async () => ({ idioma: 'es', materias: [CIENCIAS] }) };
      try {
        callGemini.mockResolvedValueOnce(respuestaSimulada({ area: 'Ciencias' }));
        const sda = await generateSda({
          ...BASE, areas: ['Ciencias'], etapa: 'primaria', curso: 5, comunidad: 'madrid',
          materiasOficiales: { Ciencias: 'Ciencias de la Naturaleza' },
        }, 'es');

        expect(sda!.areas[0].competenciasEspecificas).toContain('Texto propio de la comunidad sobre la naturaleza.');
        expect(sda!.normativa).toEqual({
          comunidad: 'madrid', origen: 'autonomico',
          cita: 'Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022)',
        });
        const userPrompt = callGemini.mock.calls.at(-1)![1] as string;
        expect(userPrompt).toContain('CURRÍCULO OFICIAL REAL (Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022))');
        expect(userPrompt).toContain('Texto propio de la comunidad sobre la naturaleza.');
      } finally {
        delete CARGADORES.madrid;
      }
    });

    it('una asignatura que solo existe en el estatal no se empareja con la lista de la comunidad', async () => {
      CARGADORES.madrid = { primaria: async () => ({ idioma: 'es', materias: [CIENCIAS] }) };
      try {
        callGemini.mockResolvedValueOnce(respuestaSimulada());
        const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5, comunidad: 'madrid' }, 'es');
        // «Matemáticas» no está en esta lista de la comunidad: modo libre, nunca la lista estatal
        expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
        expect(sda!.normativa).toBeUndefined();
      } finally {
        delete CARGADORES.madrid;
      }
    });
  });
});

