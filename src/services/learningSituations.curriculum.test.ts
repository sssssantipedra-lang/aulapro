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
import {
  generateSda, generateSdaDiana, generateSdaRubric, refsDeSda, type SdaContent, type SdaRequest,
} from './learningSituations';

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
    // Y queda marcada como texto oficial, para que la pantalla lo diga
    expect(area.oficial).toBe(true);
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
    expect(sda!.areas[0].oficial).toBeUndefined();
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
    expect(sda!.areas[0].oficial).toBeUndefined();
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
    const sda = await generateSda({ ...BASE, etapa: 'primaria', curso: 5, comunidad: 'galicia' }, 'es');
    expect(sda!.normativa).toEqual({ comunidad: 'galicia', origen: 'estatal', cita: CITA_ESTATAL });
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

  describe('con el decreto de una comunidad copiado (Madrid, Primaria)', () => {
    const CITA_MADRID = 'Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022), '
      + 'modificado por Decreto 59/2024, de 12 de junio (BOCM núm. 140, de 13 de junio de 2024)';

    it('usa su lista, con el texto del ciclo del curso, la cita como autonómica y nombra el decreto en el prompt', async () => {
      callGemini.mockResolvedValueOnce(respuestaSimulada({ area: 'Ciencias' }));
      const sda = await generateSda({
        ...BASE, areas: ['Ciencias'], etapa: 'primaria', curso: 5, comunidad: 'madrid',
        materiasOficiales: { Ciencias: 'ciencias-de-la-naturaleza' },
      }, 'es');

      // Quinto es el tercer ciclo, y el decreto escribe esta competencia un
      // poco distinta en cada ciclo: va la del tercero
      const competencias = sda!.areas[0].competenciasEspecificas;
      expect(competencias).toContain('1. Utilizar dispositivos y recursos digitales');
      expect(competencias).toContain('en equipo y en red, y para reelaborar y crear contenido digital.');
      expect(competencias).not.toContain('INVENTADO');
      expect(sda!.areas[0].saberesBasicos).toContain('A. Cultura científica (Iniciación en la actividad científica');
      expect(sda!.normativa).toEqual({ comunidad: 'madrid', origen: 'autonomico', cita: CITA_MADRID });
      // Recuerda de qué materia oficial sale el área, para marcar luego los criterios de sus instrumentos
      expect(sda!.areas[0].materia).toBe('ciencias-de-la-naturaleza');
      const userPrompt = callGemini.mock.calls.at(-1)![1] as string;
      expect(userPrompt).toContain(`CURRÍCULO OFICIAL REAL (${CITA_MADRID})`);
      expect(userPrompt).toContain('en equipo y en red, y para reelaborar');
    });

    it('una asignatura que solo existe en el estatal no se empareja con la lista de la comunidad', async () => {
      const medio = 'Conocimiento del Medio Natural, Social y Cultural';
      callGemini.mockResolvedValueOnce(respuestaSimulada({ area: medio }));
      const sda = await generateSda({ ...BASE, areas: [medio], etapa: 'primaria', curso: 5, comunidad: 'madrid' }, 'es');
      // En Madrid son dos áreas: modo libre, nunca la lista estatal
      expect(sda!.areas[0].competenciasEspecificas).toContain('INVENTADO');
      expect(sda!.normativa).toBeUndefined();
    });
  });
});

describe('rúbrica y diana de la SdA: criterios oficiales ya marcados', () => {
  const SDA = {
    ...JSON.parse(respuestaSimulada()),
    areas: [
      {
        area: 'Matemáticas', oficial: true, materia: 'matematicas', competenciasEspecificas: '1. …', saberesBasicos: 'A. …',
        criteriosEvaluacion: '1.1 Interpretar problemas.\n2.1 Comprobar soluciones.',
      },
      { area: 'Religión', competenciasEspecificas: 'libre', criteriosEvaluacion: '1.1 Inventado', saberesBasicos: 'libre' },
    ],
  } as SdaContent;

  it('solo pasan los criterios que son de verdad de las áreas oficiales de la SdA', () => {
    expect(refsDeSda(SDA, ['Matemáticas|2.1', 'Matemáticas|9.9', 'Religión|1.1', 'Matemáticas|2.1', 'Otra|1.1']))
      .toEqual([{ materia: 'matematicas', codigo: '2.1' }]);
    expect(refsDeSda(SDA, undefined)).toEqual([]);
  });

  it.each([
    ['rúbrica', generateSdaRubric, 'rubrica'],
    ['diana', generateSdaDiana, 'diana'],
  ] as const)('la %s pide marcarlos, de una lista cerrada', async (_, generar, clave) => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ [clave]: [] }));
    await generar(SDA, '', ['1', '2', '3', '4'], 'es');
    const [sistema, usuario, , , opciones] = callGemini.mock.calls.at(-1)!;
    expect(sistema).toContain('CRITERIOS OFICIALES');
    expect(usuario).toContain('- Matemáticas|1.1: Interpretar problemas.');
    expect(usuario).not.toContain('Religión|');
    const fila = opciones.responseSchema.properties[clave].items;
    expect(fila.properties.criteriosOficiales.items.enum).toEqual(['Matemáticas|1.1', 'Matemáticas|2.1']);
  });

  it('una SdA sin áreas oficiales no pide nada de esto', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ rubrica: [] }));
    await generateSdaRubric({ ...SDA, areas: [SDA.areas[1]] }, '', ['1', '2', '3', '4'], 'es');
    const [sistema, usuario, , , opciones] = callGemini.mock.calls.at(-1)!;
    expect(sistema).not.toContain('CRITERIOS OFICIALES');
    expect(usuario).not.toContain('Criterios de evaluación oficiales disponibles');
    expect(opciones.responseSchema.properties.rubrica.items.properties.criteriosOficiales).toBeUndefined();
  });
});
