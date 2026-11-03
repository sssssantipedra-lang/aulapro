/**
 * La IA propone la selección curricular y la metodología de una adaptación curricular significativa (la ACS de
 * Andalucía y de Madrid, la ACIS valenciana o el PI catalán): elige de listas cerradas (las
 * competencias, los criterios y los bloques de saberes del curso de referencia, y las estrategias de `ESTRATEGIAS_ACS`)
 * y redacta los criterios de calificación. El docente lo revisa todo. A la IA no llegan los nombres del profesorado
 * responsable ni la fecha del informe; del alumno, lo mismo que en el resto de PT y AL (`alumnoParaIA`, con el nombre
 * cambiado por un código en `callGemini`). Ver `docs/PTAL.md`, «Adaptación curricular significativa».
 */
import { callGemini, parseGeminiJson } from './gemini';
import { alumnoParaIA, marcoApoyo } from './apoyoIA';
import { objetivosTexto } from './apoyoDocumentos';
import { ESTRATEGIAS_ACS, desfaseCursos, seleccionValida } from '../lib/acs';
import { MODELOS_ACS, type ModeloAcs } from '../lib/acsModelos';
import { competenciasDe } from '../lib/curriculum';
import { translate, type Lang } from '../i18n';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { AcsApoyo, AlumnoApoyo, ApoyoData, CursoDe, ObjetivoAcs, Trimestre } from '../types/apoyo';

export interface PropuestaAcsArgs {
  acs: AcsApoyo;
  alumno: AlumnoApoyo;
  /** El área en el currículo del curso de referencia. */
  materia: MateriaDeClase;
  data: ApoyoData;
  lang: Lang;
  nombreCurso: (c: CursoDe) => string;
  /** El modelo de su comunidad: solo cambia cómo se llama la medida. */
  modelo?: ModeloAcs;
}

/** Lo que se le pide a la IA, sin enviarlo: para las pruebas y para revisar qué sale. */
export function promptAcs({ acs, alumno, materia, data, lang, nombreCurso, modelo = MODELOS_ACS.andalucia }: PropuestaAcsArgs): { prompt: string; esquema: object } {
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
    `${translate('es', modelo.nombre)} (${modelo.sigla}) del área «${entry.nombre}» con el currículo de ${nombreCurso(acs.nivel)}` +
    (desfase !== null ? `, ${desfase} cursos por debajo del curso en que está matriculado` : '') + '.\n\n' +
    `COMPETENCIAS ESPECÍFICAS Y CRITERIOS DE EVALUACIÓN DE ${nombreCurso(acs.nivel).toUpperCase()} (lista cerrada):\n${catalogo}\n\n` +
    `BLOQUES DE SABERES BÁSICOS (lista cerrada): ${bloques.map(b => `${b.bloque} (${b.tituloBloque})`).join('; ')}\n\n` +
    `ESTRATEGIAS (lista cerrada): ${ESTRATEGIAS_ACS.map(e => `${e.id} (${e.texto})`).join('; ')}\n\n` +
    'Propón:\n' +
    '- criterios: de 4 a 10 códigos de criterios de evaluación de la lista, los imprescindibles para este alumno en este curso, escritos tal cual;\n' +
    '- saberes: de 1 a 4 letras de bloques de saberes básicos mínimos imprescindibles;\n' +
    '- estrategias: de 4 a 8 identificadores de estrategias metodológicas y organizativas que le ayuden, según sus necesidades;\n' +
    '- otras: otras estrategias que no estén en la lista, si hacen falta, en una o dos frases (puede ir vacío);\n' +
    `- calificacion: los criterios de calificación de esta ${modelo.sigla} en tres o cuatro frases: cómo se califica con los criterios elegidos y sus instrumentos adaptados (observación directa, tareas, pruebas orales o con menos ejercicios).\n\n` +
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

/* ── Objetivos concretos ── */

export interface ObjetivosAcsArgs {
  acs: AcsApoyo;
  /** El área en el currículo del curso de referencia. */
  materia: MateriaDeClase;
  /** Lo que se cuenta del alumno, sin su nombre: en PT y AL, `alumnoParaIA`; en el aula, sus necesidades. */
  alumnoTexto: string;
  nombreCurso: (c: CursoDe) => string;
  modelo?: ModeloAcs;
}

/** Lo que se pide para sacar objetivos concretos de los criterios elegidos; sin enviarlo, para las pruebas. */
export function promptObjetivosAcs({ acs, materia, alumnoTexto, nombreCurso, modelo = MODELOS_ACS.andalucia }: ObjetivosAcsArgs) {
  const crits = (materia.entry.criterios[materia.grupo] ?? []).filter(c => acs.criterios.includes(c.codigo));
  const estrategias = ESTRATEGIAS_ACS.filter(e => acs.estrategias.includes(e.id)).map(e => e.texto);
  const prompt =
    `${alumnoTexto}\n\n` +
    `${translate('es', modelo.nombre)} (${modelo.sigla}) del área «${materia.entry.nombre}» con el currículo de ${nombreCurso(acs.nivel)}.\n` +
    `CRITERIOS DE EVALUACIÓN ELEGIDOS (lista cerrada):\n${crits.map(c => `- ${c.codigo}: ${c.texto}`).join('\n')}\n` +
    (estrategias.length ? `Estrategias que le ayudan: ${estrategias.join('; ')}.\n` : '') +
    ((acs.objetivos ?? []).length ? `Objetivos que ya tiene (no los repitas):\n${acs.objetivos!.map(o => `- ${o.texto}`).join('\n')}\n` : '') +
    '\nPropón de 1 a 2 objetivos concretos por cada criterio elegido, para trabajarlo con este alumno durante el curso. ' +
    'Cada objetivo: una frase corta (máximo 14 palabras) que empiece por un verbo en infinitivo, observable y evaluable ' +
    'en una sesión, con el material o la ayuda que necesita si hace falta, de lo más sencillo a lo más complejo. ' +
    'En "criterio" el código del criterio que concreta, tal cual; en "trimestres", en cuáles se trabaja (1, 2 o 3), ' +
    'con una progresión a lo largo del curso. No inventes diagnósticos ni datos del alumno. Sin títulos ni negritas.';
  const esquema = {
    type: 'OBJECT',
    properties: {
      objetivos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        texto: { type: 'STRING' },
        criterio: { type: 'STRING', enum: crits.map(c => c.codigo) },
        trimestres: { type: 'ARRAY', items: { type: 'STRING', enum: ['1', '2', '3'] } },
      }, required: ['texto', 'criterio', 'trimestres'] } },
    },
    required: ['objetivos'],
  };
  return { prompt, esquema, hayCriterios: crits.length > 0 };
}

/** Lo que devuelve la IA, en objetivos de la adaptación: solo con criterios elegidos y sin repetir los que ya hay. */
export function objetivosDePropuesta(acs: AcsApoyo, r: unknown, idNuevo: (p: string) => string): ObjetivoAcs[] {
  const lista = (r && typeof r === 'object' && Array.isArray((r as { objetivos?: unknown }).objetivos)) ? (r as { objetivos: unknown[] }).objetivos : [];
  const ya = new Set((acs.objetivos ?? []).map(o => o.texto.trim().toLowerCase()));
  return lista.flatMap(x => {
    const o = x as { texto?: unknown; criterio?: unknown; trimestres?: unknown };
    if (typeof o.texto !== 'string' || !o.texto.trim() || ya.has(o.texto.trim().toLowerCase())) return [];
    ya.add(o.texto.trim().toLowerCase());
    const ts = (Array.isArray(o.trimestres) ? o.trimestres : []).map(Number).filter((n): n is Trimestre => n === 1 || n === 2 || n === 3);
    const criterio = typeof o.criterio === 'string' && acs.criterios.includes(o.criterio) ? o.criterio : undefined;
    return [{ id: idNuevo('obj'), texto: o.texto.trim(), trimestres: ts.length ? [...new Set(ts)].sort() : [1, 2, 3] as Trimestre[], ...(criterio ? { criterio } : {}) }];
  });
}

export async function proponerObjetivosAcs(
  args: ObjetivosAcsArgs & { comunidad: Parameters<typeof marcoApoyo>[0]; lang: Lang; idNuevo: (p: string) => string },
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<ObjetivoAcs[] | null> {
  const { prompt, esquema, hayCriterios } = promptObjetivosAcs(args);
  if (!hayCriterios) { callbacks.onError?.('Elige antes los criterios de evaluación: los objetivos salen de ellos.'); return null; }
  const raw = await callGemini(marcoApoyo(args.comunidad, args.lang) + '\nResponde SOLO con JSON válido.', prompt, [], callbacks, {
    responseSchema: esquema, thinkingLevel: 'medium', maxOutputTokens: 4096,
  });
  if (!raw) return null;
  const objetivos = objetivosDePropuesta(args.acs, parseGeminiJson(raw), args.idNuevo);
  if (!objetivos.length) callbacks.onError?.('La IA no devolvió objetivos. Inténtalo de nuevo.');
  return objetivos;
}
