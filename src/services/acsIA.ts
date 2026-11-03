/**
 * La IA propone la selección curricular y la metodología de una ACS de Andalucía: elige de listas cerradas (las
 * competencias, los criterios y los bloques de saberes del curso de referencia, y las estrategias de `ESTRATEGIAS_ACS`)
 * y redacta los criterios de calificación. El docente lo revisa todo. A la IA no llegan los nombres del profesorado
 * responsable ni la fecha del informe; del alumno, lo mismo que en el resto de PT y AL (`alumnoParaIA`, con el nombre
 * cambiado por un código en `callGemini`). Ver `docs/PTAL.md`, «Adaptación curricular significativa (Andalucía)».
 */
import { callGemini, parseGeminiJson } from './gemini';
import { alumnoParaIA, marcoApoyo } from './apoyoIA';
import { objetivosTexto } from './apoyoDocumentos';
import { ESTRATEGIAS_ACS, desfaseCursos, seleccionValida } from '../lib/acs';
import { competenciasDe } from '../lib/curriculum';
import { translate, type Lang } from '../i18n';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { AcsApoyo, AlumnoApoyo, ApoyoData, CursoDe } from '../types/apoyo';

export interface PropuestaAcsArgs {
  acs: AcsApoyo;
  alumno: AlumnoApoyo;
  /** El área en el currículo del curso de referencia. */
  materia: MateriaDeClase;
  data: ApoyoData;
  lang: Lang;
  nombreCurso: (c: CursoDe) => string;
}

/** Lo que se le pide a la IA, sin enviarlo: para las pruebas y para revisar qué sale. */
export function promptAcs({ acs, alumno, materia, data, lang, nombreCurso }: PropuestaAcsArgs): { prompt: string; esquema: object } {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const { entry, grupo } = materia;
  const comps = competenciasDe(entry, grupo);
  const crits = entry.criterios[grupo] ?? [];
  const bloques = entry.saberes[grupo] ?? [];
  const desfase = desfaseCursos(alumno.matricula, acs.nivel);
  const catalogo = comps.map(c => {
    const suyos = crits.filter(cr => cr.competencia === c.n);
    return `CE${c.n}. ${c.texto}\n${suyos.map(cr => `  - ${cr.codigo}: ${cr.texto}`).join('\n')}`;
  }).join('\n');
  const prompt =
    `${alumnoParaIA(alumno, nombreCurso)}\n\n` +
    `Sus programas y objetivos individuales:\n${objetivosTexto(data, alumno.id, [materia], t, lang)}\n\n` +
    `Adaptación curricular significativa (ACS) del área «${entry.nombre}» con el currículo de ${nombreCurso(acs.nivel)}` +
    (desfase !== null ? `, ${desfase} cursos por debajo del curso en que está matriculado` : '') + '.\n\n' +
    `COMPETENCIAS ESPECÍFICAS Y CRITERIOS DE EVALUACIÓN DE ${nombreCurso(acs.nivel).toUpperCase()} (lista cerrada):\n${catalogo}\n\n` +
    `BLOQUES DE SABERES BÁSICOS (lista cerrada): ${bloques.map(b => `${b.bloque} (${b.tituloBloque})`).join('; ')}\n\n` +
    `ESTRATEGIAS (lista cerrada): ${ESTRATEGIAS_ACS.map(e => `${e.id} (${e.texto})`).join('; ')}\n\n` +
    'Propón:\n' +
    '- criterios: de 4 a 10 códigos de criterios de evaluación de la lista, los imprescindibles para este alumno en este curso, escritos tal cual;\n' +
    '- saberes: de 1 a 4 letras de bloques de saberes básicos mínimos imprescindibles;\n' +
    '- estrategias: de 4 a 8 identificadores de estrategias metodológicas y organizativas que le ayuden, según sus necesidades;\n' +
    '- otras: otras estrategias que no estén en la lista, si hacen falta, en una o dos frases (puede ir vacío);\n' +
    '- calificacion: los criterios de calificación de esta ACS en tres o cuatro frases: cómo se califica con los criterios elegidos y sus instrumentos adaptados (observación directa, tareas, pruebas orales o con menos ejercicios).\n\n' +
    'Redacta SOLO a partir de estos datos; no inventes diagnósticos, pruebas ni datos del alumno. Sin títulos ni negritas.';
  const esquema = {
    type: 'OBJECT',
    properties: {
      criterios: { type: 'ARRAY', items: { type: 'STRING', enum: crits.map(c => c.codigo) } },
      saberes: { type: 'ARRAY', items: { type: 'STRING', enum: bloques.map(b => b.bloque) } },
      estrategias: { type: 'ARRAY', items: { type: 'STRING', enum: ESTRATEGIAS_ACS.map(e => e.id) } },
      otras: { type: 'STRING' },
      calificacion: { type: 'STRING' },
    },
    required: ['criterios', 'saberes', 'estrategias', 'calificacion'],
  };
  return { prompt, esquema };
}

/**
 * Lo que devuelve la IA, pasado a la ACS: solo lo que está en las listas; las competencias, las de los criterios
 * elegidos. Lo escrito a mano en «Otras estrategias» y en la calificación se conserva si la IA no trae nada.
 */
export function aplicarPropuesta(acs: AcsApoyo, materia: MateriaDeClase, r: unknown): AcsApoyo | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const textos = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const crits = materia.entry.criterios[materia.grupo] ?? [];
  const criterios = textos(o.criterios).filter(c => crits.some(x => x.codigo === c));
  if (criterios.length === 0) return null;
  const competencias = [...new Set(criterios.map(c => crits.find(x => x.codigo === c)!.competencia))].sort((a, b) => a - b);
  const estrategias = textos(o.estrategias).filter(id => ESTRATEGIAS_ACS.some(e => e.id === id));
  const texto = (v: unknown, antes: string) => (typeof v === 'string' && v.trim() ? v.trim() : antes);
  return seleccionValida({
    ...acs, criterios, competencias, saberes: textos(o.saberes),
    estrategias: estrategias.length ? [...new Set(estrategias)] : acs.estrategias,
    otrasEstrategias: texto(o.otras, acs.otrasEstrategias),
    calificacion: texto(o.calificacion, acs.calificacion),
  }, materia.entry, materia.grupo);
}

export async function proponerAcs(
  args: PropuestaAcsArgs & { comunidad: Parameters<typeof marcoApoyo>[0] },
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<AcsApoyo | null> {
  const { prompt, esquema } = promptAcs(args);
  const raw = await callGemini(marcoApoyo(args.comunidad, args.lang) + '\nResponde SOLO con JSON válido.', prompt, [], callbacks, {
    responseSchema: esquema, thinkingLevel: 'high', maxOutputTokens: 4096,
  });
  if (!raw) return null;
  const propuesta = aplicarPropuesta(args.acs, args.materia, parseGeminiJson(raw));
  if (!propuesta) callbacks.onError?.('La IA no devolvió una propuesta válida. Inténtalo de nuevo.');
  return propuesta;
}
