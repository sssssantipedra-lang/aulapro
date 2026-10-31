/**
 * La adaptación de la programación de aula (ACI o ACIS, en formato general): lo que el tutor programa para un área y
 * un trimestre, adaptado a un alumno con el nivel de competencia, los objetivos y el informe de orientación que tiene
 * en la app. Es un documento, no materiales: para las fichas adaptadas está «Ficha adaptada» en Recursos. Los criterios y
 * los saberes salen de la lista oficial del curso de su nivel, que pone el código; la IA elige entre ellos y redacta el
 * resto. Ver `docs/PTAL.md`, «Adaptación de la programación de aula».
 */
import { callGemini, parseGeminiJson } from './gemini';
import { alumnoParaIA, marcoApoyo } from './apoyoIA';
import { NOMBRE_TIPO, objetivosTexto } from './apoyoDocumentos';
import { catalogoCriterios, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import { nivelDe, nuevoIdApoyo } from '../lib/apoyo';
import { translate, type Lang } from '../i18n';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { FuenteInforme } from './informeOrientacion';
import { textoDeDocumento } from '../lib/documentoParaIA';
import { currentPseudonymizer } from './privacy';
import type { AlumnoApoyo, ApartadoDocumento, ApoyoData, CursoDe, DocumentoApoyo, Trimestre } from '../types/apoyo';

type T = (k: string, vars?: Record<string, string | number>) => string;

/** Los apartados de la adaptación; `ia` es lo que se le pide a la IA (sin él, lo pone el código). */
export const APARTADOS_ADAPTACION: { id: string; titulo: string; ia?: string }[] = [
  { id: 'partida', titulo: 'Punto de partida en el área',
    ia: 'Qué sabe y qué le cuesta en esta área según su nivel de competencia, sus necesidades y el informe, y qué distancia hay con lo que programa el aula. Un párrafo.' },
  { id: 'objetivos', titulo: 'Objetivos adaptados',
    ia: 'De 3 a 6 objetivos para este trimestre en esta área, adaptados de los de la programación del aula a su nivel y a sus objetivos individuales, cada uno en una frase corta que empiece por un verbo en infinitivo. Una lista.' },
  { id: 'criterios', titulo: 'Criterios de evaluación del curso de su nivel' },
  { id: 'saberes', titulo: 'Saberes básicos del curso de su nivel' },
  { id: 'contenidos', titulo: 'Contenidos de la programación del aula, adaptados',
    ia: 'Qué de lo que trabaja el aula este trimestre trabajará con él, qué se simplifica o se reduce y qué se deja para más adelante, a partir de la programación del aula. Una lista breve.' },
  { id: 'metodologia', titulo: 'Medidas metodológicas y de acceso',
    ia: 'Cómo se trabaja en el aula y en el apoyo: principios del DUA, apoyos visuales, tiempos, agrupamiento, materiales adaptados y qué puede hacer el tutor. Una lista breve.' },
  { id: 'evaluacion', titulo: 'Evaluación adaptada',
    ia: 'Cómo se evalúa en esta área: instrumentos y adaptaciones de las pruebas (formato, tiempo, apoyos), y cómo se califica según sus objetivos. Un párrafo.' },
  { id: 'coordinacion', titulo: 'Acuerdos con el tutor',
    ia: 'Qué se acuerda con el tutor o la tutora: qué hace cada uno, cada cuánto se revisa y cómo se informa a la familia. Una lista breve.' },
];

/** El documento de ese alumno, área y trimestre, si ya hay uno: se sustituye al generar. */
export const adaptacionExistente = (d: ApoyoData, alumnoId: string, area: string, trimestre: Trimestre): DocumentoApoyo | undefined =>
  d.documentos.find(x => x.tipo === 'adaptacion' && x.alumnoId === alumnoId && x.area === area && x.trimestre === trimestre);

export interface AdaptacionArgs {
  alumno: AlumnoApoyo;
  /** El área, con el currículo del curso de su nivel. */
  materia: MateriaDeClase;
  trimestre: Trimestre;
  /** La programación de aula del tutor, en texto (un PDF se lee en el navegador). Sin ella, se adapta lo que dice el currículo. */
  programacion?: FuenteInforme;
  data: ApoyoData;
  comunidad: ComunidadId | undefined;
  lang: Lang;
  nombreCurso: (c: CursoDe) => string;
  /** Todas las materias del nivel, para escribir los objetivos de sus programas con sus criterios. */
  materias: MateriaDeClase[];
  hoy: string;
}

/** Los criterios elegidos, con su texto oficial: lo escribe el código, no la IA. */
export function textoCriterios(materia: MateriaDeClase, marcados: unknown): string {
  const lista = (Array.isArray(marcados) ? marcados : []).filter((m): m is string => typeof m === 'string');
  const delCurso = materia.entry.criterios[materia.grupo] ?? [];
  return [...new Set(lista)].flatMap(m => {
    const codigo = m.slice(m.lastIndexOf('|') + 1).trim();
    const cr = delCurso.find(c => c.codigo === codigo);
    return cr && m.startsWith(`${materia.entry.nombre}|`) ? [`- ${cr.codigo} ${cr.texto}`] : [];
  }).join('\n');
}

/** Los bloques de saberes elegidos, con su título oficial. */
export function textoSaberes(materia: MateriaDeClase, marcados: unknown): string {
  const letras = new Set((Array.isArray(marcados) ? marcados : []).filter((m): m is string => typeof m === 'string'));
  return (materia.entry.saberes[materia.grupo] ?? []).filter(b => letras.has(b.bloque)).map(b => `- ${b.bloque}. ${b.tituloBloque}`).join('\n');
}

export async function generarAdaptacion(
  args: AdaptacionArgs, callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<DocumentoApoyo | null> {
  const { alumno, materia, trimestre, programacion, data, comunidad, lang, nombreCurso, hoy } = args;
  const t: T = (k, vars) => translate(lang, k, vars);
  const area = materia.entry.nombre;
  const { disponibles, texto: catalogo } = catalogoCriterios([materia]);
  const bloques = materia.entry.saberes[materia.grupo] ?? [];
  const anterior = adaptacionExistente(data, alumno.id, area, trimestre);
  const nivel = nivelDe(alumno);
  const programacionTexto = textoDeDocumento(programacion?.texto ?? '', t => currentPseudonymizer().mask(t));

  const userPrompt =
    `${alumnoParaIA(alumno, nombreCurso)}\n\n` +
    `Área: ${area}. Trimestre: ${trimestre}º.\n` +
    `Sus programas y objetivos individuales:\n${objetivosTexto(data, alumno.id, args.materias, t, lang)}\n\n` +
    (programacionTexto
      ? `PROGRAMACIÓN DE AULA DEL TUTOR PARA ESTA ÁREA:\n${programacionTexto.slice(0, 30000)}\n\n`
      : 'No hay programación de aula del tutor: adapta lo que dice el currículo del curso de su nivel para esta área.\n\n') +
    `Redacta la adaptación de la programación de aula de esta área para este alumno${nivel ? `, con el currículo del curso de su nivel (${nombreCurso(nivel)})` : ''}:\n` +
    APARTADOS_ADAPTACION.filter(a => a.ia).map(a => `- ${a.id} («${a.titulo}»): ${a.ia}`).join('\n') +
    (disponibles.length ? `\n- criterios: de 3 a 8 criterios de evaluación de esta lista cerrada, los que se trabajan con sus objetivos adaptados, escritos tal cual:\n${catalogo}` : '') +
    (bloques.length ? `\n- bloques: de 1 a 4 letras de los bloques de saberes básicos de esta lista cerrada que se trabajan: ${bloques.map(b => `${b.bloque} (${b.tituloBloque})`).join('; ')}` : '') +
    '\n\nRedacta SOLO a partir de estos datos; no inventes diagnósticos, pruebas ni datos del alumno. Usa el nombre del alumno tal como aparece. ' +
    'Sin títulos ni negritas dentro de los textos.';
  const textos = APARTADOS_ADAPTACION.filter(a => a.ia).map(a => a.id);
  const raw = await callGemini(marcoApoyo(comunidad, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        ...Object.fromEntries(textos.map(id => [id, { type: 'STRING' }])),
        ...(disponibles.length ? { criterios: { type: 'ARRAY', items: { type: 'STRING', enum: disponibles } } } : {}),
        ...(bloques.length ? { bloques: { type: 'ARRAY', items: { type: 'STRING', enum: bloques.map(b => b.bloque) } } } : {}),
      },
      required: textos,
    },
    thinkingLevel: 'high',
    maxOutputTokens: 8192,
  });
  if (!raw) return null;
  const r = parseGeminiJson<Record<string, unknown>>(raw);
  if (!r || typeof r !== 'object') { callbacks.onError?.('La IA no devolvió el documento. Inténtalo de nuevo.'); return null; }

  const apartados: ApartadoDocumento[] = APARTADOS_ADAPTACION.map(a => ({
    id: a.id, titulo: t(a.titulo),
    texto: a.id === 'criterios' ? textoCriterios(materia, r.criterios)
      : a.id === 'saberes' ? textoSaberes(materia, r.bloques)
        : (typeof r[a.id] === 'string' ? (r[a.id] as string).trim() : ''),
  }));
  return {
    id: anterior?.id ?? nuevoIdApoyo('doc'), alumnoId: alumno.id, tipo: 'adaptacion', trimestre, area, fecha: hoy,
    titulo: `${t(NOMBRE_TIPO.adaptacion)} · ${area} · ${t('{n}º trimestre', { n: trimestre })}`,
    apartados,
  };
}
